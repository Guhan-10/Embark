import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { ActionError } from "@/lib/utils/action";
import { addDays } from "@/lib/utils/date";
import { notify } from "@/features/notifications/service";
import { newAssignmentNotifications, syncTaskAssignees } from "@/features/onboarding/assignment";
import { registerSchema } from "@/features/auth/schemas";

// Accounts can only be created through the one-time link in the welcome email that HR adding someone sends.
// Better Auth's own sign-up endpoint is disabled (see auth.ts).

type Tx = Prisma.TransactionClient;

export const INVITE_TTL_DAYS = 7;

export const INVALID_LINK =
  "This sign-up link is invalid or has expired. Ask your HR to send you a new one.";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a fresh sign-up link for an employee, replacing any unused ones. Returns the raw token for the email. */
export async function createInvite(
  tx: Pick<Tx, "employeeInvite">,
  employeeId: string,
  createdById: string | null,
) {
  const token = randomBytes(32).toString("base64url");
  await tx.employeeInvite.deleteMany({ where: { employeeId, usedAt: null } });
  await tx.employeeInvite.create({
    data: {
      employeeId,
      tokenHash: hashToken(token),
      expiresAt: addDays(new Date(), INVITE_TTL_DAYS),
      createdById,
    },
  });
  return token;
}

async function findUsableInvite(db: Pick<Tx, "employeeInvite">, token: string) {
  const invite = await db.employeeInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      employee: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          roleKey: true,
          userId: true,
          archivedAt: true,
        },
      },
    },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) return null;
  if (invite.employee.archivedAt || invite.employee.userId) return null;
  return invite;
}

/** What the sign-up page shows for a link: who it's for, or null if it can't be used. */
export async function getInviteDetails(token: string) {
  if (!token) return null;
  const invite = await findUsableInvite(prisma, token);
  if (!invite) return null;
  return {
    firstName: invite.employee.firstName,
    email: invite.employee.email,
    expiresAt: invite.expiresAt,
  };
}

/** Makes the user's roles match the role HR set on their employee record. Pass a transaction client to include it in one. */
export async function syncUserRole(
  userId: string,
  roleKey: string,
  db: Pick<Tx, "role" | "userRole"> = prisma,
) {
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  await db.userRole.deleteMany({ where: { userId, roleId: { not: role.id } } });
  await db.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, roleId: role.id },
    update: {},
  });
}

/**
 * Creates a login from a welcome-email link. The link proves the person owns the inbox, so the email is
 * verified immediately. Links the login to their employee record, grants the HR-assigned role, and hands
 * them any onboarding tasks that were waiting: their own, their direct reports', and — for a department
 * HR — those of everyone in their departments.
 */
export async function registerWithInvite(raw: unknown) {
  const input = registerSchema.parse(raw);
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const invite = await findUsableInvite(tx, input.token);
    if (!invite) throw new ActionError(INVALID_LINK);
    const { employee } = invite;

    if (await tx.user.findUnique({ where: { email: employee.email } })) {
      throw new ActionError("An account with this email already exists. Try signing in instead.");
    }

    const userId = randomUUID();
    await tx.user.create({
      data: {
        id: userId,
        name: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
        emailVerified: true,
        // Same shape Better Auth stores for an email/password account.
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            password: passwordHash,
          },
        },
      },
    });
    await tx.employeeInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    await tx.employee.update({ where: { id: employee.id }, data: { userId } });
    await syncUserRole(userId, employee.roleKey, tx);

    // If they're the HR of any departments, those people's HR manager becomes this new login.
    await tx.employee.updateMany({
      where: { department: { hrEmployeeId: employee.id } },
      data: { hrManagerId: userId },
    });

    const waiting = await tx.employee.findMany({
      where: {
        archivedAt: null,
        OR: [{ reportingManagerId: employee.id }, { department: { hrEmployeeId: employee.id } }],
      },
      select: { id: true },
    });
    const assigned = [];
    for (const id of [employee.id, ...waiting.map((r) => r.id)]) {
      assigned.push(...(await syncTaskAssignees(tx, id)));
    }
    await notify(tx, newAssignmentNotifications(assigned));

    await audit(tx, {
      actorId: userId,
      action: "user.register",
      entityType: "Employee",
      entityId: employee.id,
      metadata: { roleKey: employee.roleKey },
    });
    return { userId, email: employee.email };
  });
}
