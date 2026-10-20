import { ROLES, type RoleKey } from "./roles";

export const PERMISSIONS = {
  EMPLOYEE_READ: "employee:read",
  EMPLOYEE_CREATE: "employee:create",
  EMPLOYEE_UPDATE: "employee:update",
  EMPLOYEE_ARCHIVE: "employee:archive",
  EMPLOYEE_INVITE: "employee:invite",
  DEPARTMENT_MANAGE: "department:manage",

  ONBOARDING_READ: "onboarding:read",
  ONBOARDING_MANAGE: "onboarding:manage",
  TEMPLATE_MANAGE: "template:manage",

  TASK_READ: "task:read",
  TASK_CREATE: "task:create",
  TASK_UPDATE: "task:update",
  TASK_ASSIGN: "task:assign",

  DOCUMENT_READ: "document:read",
  DOCUMENT_UPLOAD: "document:upload",
  DOCUMENT_REVIEW: "document:review",
  DOCUMENT_DELETE: "document:delete",
  DOCUMENT_TYPE_MANAGE: "document_type:manage",

  REPORT_READ: "report:read",
  REPORT_EXPORT: "report:export",

  USER_MANAGE: "user:manage",
  ROLE_MANAGE: "role:manage",
  AUDIT_READ: "audit:read",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "employee:read": "View employee profiles",
  "employee:create": "Add employees",
  "employee:update": "Edit employee details",
  "employee:archive": "Archive and restore employees",
  "employee:invite": "Send employee invites",
  "department:manage": "Manage departments and designations",
  "onboarding:read": "View onboarding processes",
  "onboarding:manage": "Start and cancel onboarding",
  "template:manage": "Manage onboarding templates",
  "task:read": "View tasks",
  "task:create": "Create and edit tasks",
  "task:update": "Update the status of tasks",
  "task:assign": "Assign tasks to people",
  "document:read": "View and download documents",
  "document:upload": "Upload documents",
  "document:review": "Approve or reject documents",
  "document:delete": "Delete documents",
  "document_type:manage": "Manage document types",
  "report:read": "View reports and analytics",
  "report:export": "Export reports",
  "user:manage": "Manage user accounts and role assignments",
  "role:manage": "Manage roles and permissions",
  "audit:read": "View the audit log",
};

const ALL = Object.values(PERMISSIONS);

/**
 * Default permissions per role, applied by the seed script.
 * What a role can see is narrowed further by data scoping in lib/auth/rbac.ts.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  [ROLES.HR_ADMIN]: ALL,
  [ROLES.HR_MANAGER]: [
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.EMPLOYEE_CREATE,
    PERMISSIONS.EMPLOYEE_UPDATE,
    PERMISSIONS.EMPLOYEE_INVITE,
    PERMISSIONS.ONBOARDING_READ,
    PERMISSIONS.ONBOARDING_MANAGE,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_CREATE,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.TASK_ASSIGN,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_REVIEW,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT,
  ],
  [ROLES.REPORTING_MANAGER]: [
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.ONBOARDING_READ,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
  ],
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.ONBOARDING_READ,
    PERMISSIONS.TASK_READ,
    PERMISSIONS.TASK_UPDATE,
    PERMISSIONS.DOCUMENT_READ,
    PERMISSIONS.DOCUMENT_UPLOAD,
  ],
};
