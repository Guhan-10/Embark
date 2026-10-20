import type { CurrentUser } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/rbac";
import { PERMISSIONS, type PermissionKey } from "@/lib/constants/permissions";

export type SettingsSectionKey = "users" | "roles" | "departments" | "documentTypes" | "audit";

const SECTIONS: { key: SettingsSectionKey; href: string; label: string; description: string; permission: PermissionKey }[] = [
  { key: "users", href: "/settings/users", label: "Users", description: "Turn logins on or off and sign people out", permission: PERMISSIONS.USER_MANAGE },
  { key: "roles", href: "/settings/roles", label: "Roles", description: "Choose what each role can do", permission: PERMISSIONS.ROLE_MANAGE },
  { key: "departments", href: "/settings/departments", label: "Departments", description: "Departments, designations, and each one's HR", permission: PERMISSIONS.DEPARTMENT_MANAGE },
  { key: "documentTypes", href: "/settings/document-types", label: "Document types", description: "What people upload, which file types, and size limits", permission: PERMISSIONS.DOCUMENT_TYPE_MANAGE },
  { key: "audit", href: "/settings/audit", label: "Audit log", description: "Who changed what, and when", permission: PERMISSIONS.AUDIT_READ },
];

/** The settings sections this user can open, in menu order. */
export function settingsSectionsFor(user: CurrentUser) {
  return SECTIONS.filter((s) => can(user, s.permission));
}
