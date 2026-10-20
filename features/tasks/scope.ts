import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { can, employeeScope, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";

/** Tasks a user can see: ones assigned to them, plus every task in onboarding of employees they can see. */
export function taskScope(user: CurrentUser): Prisma.OnboardingTaskWhereInput {
  return {
    OR: [
      { assignments: { some: { userId: user.id } } },
      { process: { employee: employeeScope(user) } },
    ],
  };
}

/** Tasks a user can manage as HR (edit, assign, skip, change any status): assign permission plus the employee in scope. */
export function managedTaskScope(user: CurrentUser): Prisma.OnboardingTaskWhereInput {
  if (!can(user, PERMISSIONS.TASK_ASSIGN)) return { id: { in: [] } };
  return { process: { employee: employeeScope(user) } };
}
