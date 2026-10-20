import type { Prisma } from "@/generated/prisma/client";

/**
 * Who is an employee's HR:
 * - their department's HR, when the department has one (set by the database admin), otherwise
 * - employees.hrManagerId (the HR who added them, or whoever an HR Admin picked).
 */
export const hrOwnerSelect = {
  hrManagerId: true,
  department: {
    select: {
      hrEmployeeId: true,
      hrEmployee: { select: { userId: true, archivedAt: true } },
    },
  },
} satisfies Prisma.EmployeeSelect;

export type HrOwnerFields = Prisma.EmployeeGetPayload<{ select: typeof hrOwnerSelect }>;

/** The HR user in charge of this employee, or null if that HR hasn't registered (or was archived). */
export function effectiveHrUserId(employee: HrOwnerFields) {
  if (employee.department?.hrEmployeeId) {
    const hr = employee.department.hrEmployee;
    return hr && !hr.archivedAt ? hr.userId : null;
  }
  return employee.hrManagerId;
}

/** Prisma filter for employees whose HR is this user — mirrors effectiveHrUserId. */
export function ownedByHr(userId: string): Prisma.EmployeeWhereInput {
  return {
    OR: [
      { department: { hrEmployee: { userId } } },
      {
        AND: [
          { OR: [{ departmentId: null }, { department: { hrEmployeeId: null } }] },
          { hrManagerId: userId },
        ],
      },
    ],
  };
}
