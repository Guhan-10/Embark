import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { effectiveHrUserId } from "@/lib/auth/hr-owner";
import { can, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { HR_ROLES } from "@/lib/constants/roles";
import { assigneeLinksSelect } from "@/features/onboarding/assignment";
import { ActionError } from "@/lib/utils/action";

type Db = Pick<Prisma.TransactionClient, "onboardingProcess" | "user">;

/**
 * Who a task in this onboarding may be assigned to. HR Admins: any HR staff plus the people involved.
 * HR Managers: only people inside this employee's HR space — the new hire, their reporting manager, and their HR.
 */
export async function assignableUserIds(db: Db, user: CurrentUser, processId: string) {
  const process = await db.onboardingProcess.findUnique({
    where: { id: processId },
    select: { employee: { select: assigneeLinksSelect } },
  });
  if (!process) return [];

  const involved = [
    process.employee.userId,
    process.employee.reportingManager?.userId,
    effectiveHrUserId(process.employee),
    user.id,
  ].filter((id): id is string => Boolean(id));

  const users = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { id: { in: involved } },
        ...(can(user, PERMISSIONS.USER_MANAGE) ? [{ roles: { some: { role: { key: { in: HR_ROLES } } } } }] : []),
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function assertAssignable(db: Db, user: CurrentUser, processId: string, userIds: string[]) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return unique;
  const allowed = new Set(await assignableUserIds(db, user, processId));
  if (unique.some((id) => !allowed.has(id))) {
    throw new ActionError(
      "Tasks can only go to active people involved in this onboarding: the new hire, their reporting manager, or their HR.",
    );
  }
  return unique;
}
