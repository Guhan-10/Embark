export const ROLES = {
  HR_ADMIN: "HR_ADMIN",
  HR_MANAGER: "HR_MANAGER",
  REPORTING_MANAGER: "REPORTING_MANAGER",
  EMPLOYEE: "EMPLOYEE",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_DETAILS: Record<RoleKey, { name: string; description: string }> = {
  HR_ADMIN: { name: "HR Admin", description: "Full system access" },
  HR_MANAGER: {
    name: "HR Manager",
    description: "Manages assigned employees and their onboarding",
  },
  REPORTING_MANAGER: {
    name: "Reporting Manager",
    description: "Sees their direct reports' onboarding and completes tasks assigned to them",
  },
  EMPLOYEE: {
    name: "Employee",
    description: "Views own profile, tasks, and documents",
  },
};

/** Roles that can be someone's reporting manager. */
export const REPORTING_MANAGER_ROLES: RoleKey[] = [
  ROLES.HR_ADMIN,
  ROLES.HR_MANAGER,
  ROLES.REPORTING_MANAGER,
];

/** Roles that can own an employee's onboarding as their HR manager. */
export const HR_ROLES: RoleKey[] = [ROLES.HR_ADMIN, ROLES.HR_MANAGER];

/** Roles anyone with employee:create may assign. Granting other roles needs user:manage. */
export const NON_PRIVILEGED_ROLES: RoleKey[] = [ROLES.EMPLOYEE, ROLES.REPORTING_MANAGER];
