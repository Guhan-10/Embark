import type { z } from "zod";
import type {
  auditListSchema,
  departmentSchema,
  designationSchema,
  documentTypeSchema,
  rolePermissionsSchema,
  userListSchema,
} from "./schemas";
import type {
  listAuditLogs,
  listDepartments,
  listDocumentTypesForSettings,
  listRolesWithPermissions,
  listUsers,
} from "./queries";

export type RolePermissionsInput = z.input<typeof rolePermissionsSchema>;
export type UserListFilters = z.input<typeof userListSchema>;
export type DepartmentInput = z.input<typeof departmentSchema>;
export type DesignationInput = z.input<typeof designationSchema>;
export type DocumentTypeInput = z.input<typeof documentTypeSchema>;
export type AuditListFilters = z.input<typeof auditListSchema>;

export type RoleSettings = Awaited<ReturnType<typeof listRolesWithPermissions>>;
export type UserList = Awaited<ReturnType<typeof listUsers>>;
export type DepartmentSettings = Awaited<ReturnType<typeof listDepartments>>;
export type DocumentTypeSettings = Awaited<ReturnType<typeof listDocumentTypesForSettings>>;
export type AuditLogList = Awaited<ReturnType<typeof listAuditLogs>>;
