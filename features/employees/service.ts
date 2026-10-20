import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { assertCan, can, employeeScope, type CurrentUser } from "@/lib/auth/rbac";
import { createInvite, INVITE_TTL_DAYS, syncUserRole } from "@/lib/auth/registration";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  HR_ROLES,
  NON_PRIVILEGED_ROLES,
  REPORTING_MANAGER_ROLES,
  ROLE_DETAILS,
  type RoleKey,
} from "@/lib/constants/roles";
import { audit } from "@/lib/db/audit";
import { deliverEmail } from "@/lib/email/deliver";
import { welcomeTemplate } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { ActionError } from "@/lib/utils/action";
import { notify } from "@/features/notifications/service";
import { newAssignmentNotifications, syncTaskAssignees } from "@/features/onboarding/assignment";
import { employeeCreateSchema, employeeUpdateSchema } from "./schemas";
import type { EmployeeCreateInput, EmployeeUpdateInput } from "./types";

// Business rules for employee records. Every function takes the acting user and
// checks permissions and scope itself, so callers can't skip them.

type Tx = Prisma.TransactionClient;

const CODE_PREFIX = "EMB-";

async function nextEmployeeCode(tx: Tx) {
  const [row] = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("employeeCode" FROM 5) AS INTEGER)) AS max
    FROM employees
    WHERE "employeeCode" ~ '^EMB-[0-9]+$'`;
  return `${CODE_PREFIX}${String((row?.max ?? 0) + 1).padStart(4, "0")}`;
}

function assertRoleAssignable(user: CurrentUser, roleKey: string) {
  if (NON_PRIVILEGED_ROLES.includes(roleKey as RoleKey)) return;
  if (!can(user, PERMISSIONS.USER_MANAGE)) {
    const name = ROLE_DETAILS[roleKey as RoleKey]?.name ?? roleKey;
    throw new ActionError(`Only an HR Admin can give someone the ${name} role.`);
  }
}

async function assertEmailAvailable(tx: Tx, email: string, exceptId?: string) {
  const taken = await tx.employee.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, id: exceptId ? { not: exceptId } : undefined },
    select: { id: true },
  });
  if (taken) throw new ActionError("An employee with this email already exists.");
}

async function assertCodeAvailable(tx: Tx, employeeCode: string, exceptId?: string) {
  const taken = await tx.employee.findFirst({
    where: { employeeCode, id: exceptId ? { not: exceptId } : undefined },
    select: { id: true },
  });
  if (taken) throw new ActionError(`Employee code ${employeeCode} is already in use.`);
}

type References = {
  departmentId: string | null;
  designationId: string | null;
  hrManagerId: string | null;
  reportingManagerId: string | null;
};

/** Checks that linked records exist and fit together. Fills in the department from the designation if needed. */
async function validateReferences(
  tx: Tx,
  user: CurrentUser,
  refs: References,
  employeeId?: string,
): Promise<References> {
  let { departmentId } = refs;

  if (refs.designationId) {
    const designation = await tx.designation.findUnique({ where: { id: refs.designationId } });
    if (!designation) throw new ActionError("That designation doesn't exist.");
    if (departmentId && designation.departmentId !== departmentId) {
      throw new ActionError("That designation belongs to a different department.");
    }
    departmentId = designation.departmentId;
  } else if (departmentId) {
    const department = await tx.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new ActionError("That department doesn't exist.");
  }

  if (refs.hrManagerId) {
    const hrManager = await tx.user.findFirst({
      where: {
        id: refs.hrManagerId,
        isActive: true,
        roles: { some: { role: { key: { in: HR_ROLES } } } },
      },
    });
    if (!hrManager) throw new ActionError("The HR manager must be an active HR Admin or HR Manager.");
  }

  if (refs.reportingManagerId) {
    if (refs.reportingManagerId === employeeId) {
      throw new ActionError("Someone can't be their own reporting manager.");
    }
    const manager = await tx.employee.findFirst({
      where: {
        AND: [
          { id: refs.reportingManagerId, archivedAt: null, roleKey: { in: REPORTING_MANAGER_ROLES } },
          // HR Managers can only pick managers from their own HR space.
          can(user, PERMISSIONS.USER_MANAGE) ? {} : employeeScope(user),
        ],
      },
    });
    if (!manager) {
      throw new ActionError("The reporting manager must be an active employee with a manager or HR role.");
    }
    // Walk up the reporting line to make sure this doesn't create a loop.
    if (employeeId) {
      let cursor: string | null = manager.reportingManagerId;
      for (let depth = 0; cursor && depth < 50; depth++) {
        if (cursor === employeeId) {
          throw new ActionError("That would create a loop in the reporting line.");
        }
        const next: { reportingManagerId: string | null } | null = await tx.employee.findUnique({
          where: { id: cursor },
          select: { reportingManagerId: true },
        });
        cursor = next?.reportingManagerId ?? null;
      }
    }
  }

  return { ...refs, departmentId };
}

/**
 * Applies department HR ownership so HR spaces never overlap:
 * - A department with an HR always belongs to that HR; its people get them as HR manager.
 * - HR Managers can only place people in departments they own (or ones with no HR), and own whoever they add.
 * - HR Admins can place anyone anywhere; outside owned departments they may pick the HR manager.
 */
async function applyHrOwnership(
  tx: Tx,
  user: CurrentUser,
  departmentId: string | null,
  requestedHrManagerId: string | null | undefined,
  fallbackHrManagerId: string | null,
): Promise<{ departmentId: string | null; hrManagerId: string | null }> {
  const department = departmentId
    ? await tx.department.findUnique({
        where: { id: departmentId },
        select: {
          id: true,
          name: true,
          hrEmployeeId: true,
          hrEmployee: { select: { userId: true, archivedAt: true, firstName: true, lastName: true } },
        },
      })
    : null;

  if (!can(user, PERMISSIONS.USER_MANAGE)) {
    if (!department) {
      const owned = await tx.department.findMany({ where: { hrEmployee: { userId: user.id } }, select: { id: true } });
      if (owned.length === 1) return { departmentId: owned[0].id, hrManagerId: user.id };
      if (owned.length > 1) throw new ActionError("Choose which of your departments they'll join.");
      return { departmentId: null, hrManagerId: user.id };
    }
    if (department.hrEmployeeId && department.hrEmployee?.userId !== user.id) {
      throw new ActionError(`${department.name} is managed by another HR. Ask an HR Admin to add people there.`);
    }
    return { departmentId: department.id, hrManagerId: user.id };
  }

  if (department?.hrEmployeeId) {
    const hr = department.hrEmployee;
    const deptHrUserId = hr && !hr.archivedAt ? hr.userId : null;
    if (requestedHrManagerId && requestedHrManagerId !== deptHrUserId) {
      const name = hr ? `${hr.firstName} ${hr.lastName}` : "assigned";
      throw new ActionError(`${department.name}'s HR is ${name}; people in this department are always managed by them.`);
    }
    return { departmentId: department.id, hrManagerId: deptHrUserId };
  }
  return {
    departmentId,
    hrManagerId: requestedHrManagerId !== undefined ? requestedHrManagerId : fallbackHrManagerId,
  };
}

async function findInScope(tx: Pick<Tx, "employee">, user: CurrentUser, id: string) {
  const employee = await tx.employee.findFirst({ where: { AND: [{ id }, employeeScope(user)] } });
  if (!employee) throw new ActionError("Employee not found.");
  return employee;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createEmployee(user: CurrentUser, raw: EmployeeCreateInput) {
  assertCan(user, PERMISSIONS.EMPLOYEE_CREATE);
  const input = employeeCreateSchema.parse(raw);
  assertRoleAssignable(user, input.roleKey);

  // Retry when two people add employees at once and get the same generated code.
  for (let attempt = 1; ; attempt++) {
    try {
      const { employee, inviteToken } = await prisma.$transaction(async (tx) => {
        await assertEmailAvailable(tx, input.email);
        if (input.employeeCode) await assertCodeAvailable(tx, input.employeeCode);

        const refs = await validateReferences(tx, user, {
          departmentId: input.departmentId ?? null,
          designationId: input.designationId ?? null,
          hrManagerId: can(user, PERMISSIONS.USER_MANAGE) ? (input.hrManagerId ?? null) : null,
          reportingManagerId: input.reportingManagerId ?? null,
        });
        const ownership = await applyHrOwnership(tx, user, refs.departmentId, input.hrManagerId, null);

        const employee = await tx.employee.create({
          data: {
            ...refs,
            ...ownership,
            employeeCode: input.employeeCode ?? (await nextEmployeeCode(tx)),
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone ?? null,
            joiningDate: input.joiningDate,
            roleKey: input.roleKey,
            createdById: user.id,
          },
        });

        await audit(tx, {
          actorId: user.id,
          action: "employee.create",
          entityType: "Employee",
          entityId: employee.id,
          metadata: { employeeCode: employee.employeeCode, roleKey: employee.roleKey },
        });
        return { employee, inviteToken: await createInvite(tx, employee.id, user.id) };
      });

      await sendWelcomeEmail(employee, user.name, inviteToken);
      return employee;
    } catch (error) {
      if (!input.employeeCode && isUniqueViolation(error) && attempt < 3) continue;
      throw error;
    }
  }
}

export async function updateEmployee(user: CurrentUser, id: string, raw: EmployeeUpdateInput) {
  assertCan(user, PERMISSIONS.EMPLOYEE_UPDATE);
  const input = employeeUpdateSchema.parse(raw);

  return prisma.$transaction(async (tx) => {
    const current = await findInScope(tx, user, id);
    if (current.archivedAt) throw new ActionError("Restore this employee before editing them.");

    if (input.status === "INACTIVE") {
      throw new ActionError("Archive the employee instead of setting them to inactive.");
    }

    if (input.email && input.email !== current.email) {
      if (current.userId) {
        throw new ActionError("This person has already registered, so their email can't be changed.");
      }
      await assertEmailAvailable(tx, input.email, id);
    }

    if (input.employeeCode && input.employeeCode !== current.employeeCode) {
      await assertCodeAvailable(tx, input.employeeCode, id);
    }

    const roleChanged = input.roleKey !== undefined && input.roleKey !== current.roleKey;
    if (roleChanged) {
      if (current.userId === user.id) throw new ActionError("You can't change your own role.");
      assertRoleAssignable(user, current.roleKey);
      assertRoleAssignable(user, input.roleKey!);
    }

    if (
      input.hrManagerId !== undefined &&
      input.hrManagerId !== current.hrManagerId &&
      !can(user, PERMISSIONS.USER_MANAGE)
    ) {
      throw new ActionError("Only an HR Admin can change someone's HR manager.");
    }

    const refs = await validateReferences(
      tx,
      user,
      {
        departmentId: input.departmentId !== undefined ? input.departmentId : current.departmentId,
        designationId: input.designationId !== undefined ? input.designationId : current.designationId,
        hrManagerId: input.hrManagerId !== undefined ? input.hrManagerId : current.hrManagerId,
        reportingManagerId:
          input.reportingManagerId !== undefined ? input.reportingManagerId : current.reportingManagerId,
      },
      id,
    );
    const ownership =
      refs.departmentId !== current.departmentId || input.hrManagerId !== undefined
        ? await applyHrOwnership(tx, user, refs.departmentId, input.hrManagerId, current.hrManagerId)
        : { departmentId: current.departmentId, hrManagerId: current.hrManagerId };

    const employee = await tx.employee.update({
      where: { id },
      data: {
        ...refs,
        ...ownership,
        employeeCode: input.employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        joiningDate: input.joiningDate,
        roleKey: input.roleKey,
        status: input.status,
      },
    });

    if (roleChanged && employee.userId) await syncUserRole(employee.userId, employee.roleKey, tx);

    // Open onboarding tasks follow a new department HR, HR manager, or reporting manager.
    if (
      ownership.departmentId !== current.departmentId ||
      ownership.hrManagerId !== current.hrManagerId ||
      refs.reportingManagerId !== current.reportingManagerId
    ) {
      const assigned = await syncTaskAssignees(tx, id);
      await notify(tx, newAssignmentNotifications(assigned), { exceptUserId: user.id });
    }

    if (employee.userId && (input.firstName || input.lastName)) {
      await tx.user.update({
        where: { id: employee.userId },
        data: { name: `${employee.firstName} ${employee.lastName}` },
      });
    }

    await audit(tx, {
      actorId: user.id,
      action: "employee.update",
      entityType: "Employee",
      entityId: id,
      metadata: {
        fields: Object.keys(raw),
        ...(roleChanged ? { roleFrom: current.roleKey, roleTo: employee.roleKey } : {}),
      },
    });
    return employee;
  });
}

/** Archives an employee: blocks their login, ends their sessions, and cancels unfinished onboarding. */
export async function archiveEmployee(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.EMPLOYEE_ARCHIVE);

  return prisma.$transaction(async (tx) => {
    const current = await findInScope(tx, user, id);
    if (current.archivedAt) throw new ActionError("This employee is already archived.");
    if (current.userId === user.id) throw new ActionError("You can't archive yourself.");

    const now = new Date();
    const employee = await tx.employee.update({
      where: { id },
      data: { archivedAt: now, status: "INACTIVE" },
    });

    if (employee.userId) {
      await tx.user.update({ where: { id: employee.userId }, data: { isActive: false } });
      await tx.session.deleteMany({ where: { userId: employee.userId } });
    }

    const cancelled = await tx.onboardingProcess.updateMany({
      where: { employeeId: id, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
      data: { status: "CANCELLED", cancelledAt: now },
    });

    await audit(tx, {
      actorId: user.id,
      action: "employee.archive",
      entityType: "Employee",
      entityId: id,
      metadata: { previousStatus: current.status, cancelledProcesses: cancelled.count },
    });
    return employee;
  });
}

/** Restores an archived employee and re-enables their login. Onboarding has to be started again if needed. */
export async function restoreEmployee(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.EMPLOYEE_ARCHIVE);

  return prisma.$transaction(async (tx) => {
    const current = await findInScope(tx, user, id);
    if (!current.archivedAt) throw new ActionError("This employee isn't archived.");

    // Their onboarding was cancelled when archived, so they're Active only if they finished it before.
    const completed = await tx.onboardingProcess.count({ where: { employeeId: id, status: "COMPLETED" } });
    const employee = await tx.employee.update({
      where: { id },
      data: { archivedAt: null, status: completed ? "ACTIVE" : "PRE_BOARDING" },
    });

    if (employee.userId) {
      await tx.user.update({ where: { id: employee.userId }, data: { isActive: true } });
    }

    await audit(tx, {
      actorId: user.id,
      action: "employee.restore",
      entityType: "Employee",
      entityId: id,
    });
    return employee;
  });
}

// ─── Welcome emails ──────────────────────────────────────────────────────────

/** Emails a newly added person their one-time sign-up link. A failed send never undoes the add. */
async function sendWelcomeEmail(
  employee: { email: string; firstName: string },
  addedBy: string,
  inviteToken: string,
) {
  const url = `${env.APP_URL}/sign-up?token=${inviteToken}`;
  try {
    await deliverEmail(welcomeTemplate(employee.email, employee.firstName, addedBy, url, INVITE_TTL_DAYS));
    return true;
  } catch (error) {
    console.error("Failed to send welcome email", error);
    return false;
  }
}

/** Sends a new welcome email to someone who hasn't registered yet. Earlier links stop working. */
export async function resendWelcomeEmail(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.EMPLOYEE_INVITE);
  const employee = await findInScope(prisma, user, id);
  if (employee.archivedAt) throw new ActionError("Restore this employee first.");
  if (employee.userId) throw new ActionError("This person has already created their login.");

  const inviteToken = await createInvite(prisma, employee.id, user.id);
  if (!(await sendWelcomeEmail(employee, user.name, inviteToken))) {
    throw new ActionError("The email couldn't be sent. Try again in a minute.");
  }
  await audit(prisma, { actorId: user.id, action: "employee.invite", entityType: "Employee", entityId: id });
}

// ─── Department HR ───────────────────────────────────────────────────────────

/**
 * Makes an HR person the owner of a department, or clears it with null. Everyone in the department moves into
 * that HR's space and their open auto-assigned HR tasks follow. `actor` is null when the database admin runs it.
 */
export async function setDepartmentHr(actor: CurrentUser | null, departmentId: string, hrEmployeeId: string | null) {
  if (actor) assertCan(actor, PERMISSIONS.USER_MANAGE);

  return prisma.$transaction(async (tx) => {
    const department = await tx.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new ActionError("Department not found.");

    let hrUserId: string | null = null;
    if (hrEmployeeId) {
      const hr = await tx.employee.findFirst({
        where: { id: hrEmployeeId, archivedAt: null, roleKey: { in: HR_ROLES } },
      });
      if (!hr) throw new ActionError("The department HR must be an active employee with an HR role.");
      hrUserId = hr.userId;
    }

    await tx.department.update({ where: { id: departmentId }, data: { hrEmployeeId } });
    if (hrEmployeeId) {
      await tx.employee.updateMany({ where: { departmentId }, data: { hrManagerId: hrUserId } });
    }

    const members = await tx.employee.findMany({ where: { departmentId, archivedAt: null }, select: { id: true } });
    const assigned = [];
    for (const member of members) assigned.push(...(await syncTaskAssignees(tx, member.id)));
    await notify(tx, newAssignmentNotifications(assigned), { exceptUserId: actor?.id });

    await audit(tx, {
      actorId: actor?.id ?? null,
      action: "department.set_hr",
      entityType: "Department",
      entityId: departmentId,
      metadata: { from: department.hrEmployeeId, to: hrEmployeeId, employeesMoved: members.length },
    });
    return { employees: members.length, tasksReassigned: assigned.length };
  });
}
