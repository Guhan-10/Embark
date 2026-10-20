import "server-only";
import { can, hasRole, isHrViewer, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ROLES } from "@/lib/constants/roles";

export type NavIcon =
  | "dashboard"
  | "employees"
  | "onboarding"
  | "tasks"
  | "documents"
  | "notifications"
  | "reports"
  | "settings";

export type NavItem = { href: string; label: string; icon: NavIcon };

export const SETTINGS_PERMISSIONS = [
  PERMISSIONS.ROLE_MANAGE,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.DEPARTMENT_MANAGE,
  PERMISSIONS.DOCUMENT_TYPE_MANAGE,
  PERMISSIONS.AUDIT_READ,
] as const;

/** The sidebar for this user: only sections their role can open, labelled for how they'll use them. */
export function buildNav(user: CurrentUser): NavItem[] {
  const hr = isHrViewer(user);
  const items: NavItem[] = [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }];

  if (hr || hasRole(user, ROLES.REPORTING_MANAGER)) {
    items.push({ href: "/employees", label: hr ? "Employees" : "My team", icon: "employees" });
  }
  if (can(user, PERMISSIONS.ONBOARDING_READ)) {
    items.push({ href: "/onboarding", label: hr ? "Onboarding" : "My onboarding", icon: "onboarding" });
  }
  if (can(user, PERMISSIONS.TASK_READ)) items.push({ href: "/tasks", label: "Tasks", icon: "tasks" });
  if (can(user, PERMISSIONS.DOCUMENT_READ)) items.push({ href: "/documents", label: "Documents", icon: "documents" });
  items.push({ href: "/notifications", label: "Notifications", icon: "notifications" });
  if (can(user, PERMISSIONS.REPORT_READ)) items.push({ href: "/reports", label: "Reports", icon: "reports" });
  if (SETTINGS_PERMISSIONS.some((p) => can(user, p))) {
    items.push({ href: "/settings", label: "Settings", icon: "settings" });
  }
  return items;
}

/** The dark pill button in the top bar: the most common thing this person starts. */
export function primaryActionFor(user: CurrentUser): { href: string; label: string } | null {
  if (can(user, PERMISSIONS.EMPLOYEE_CREATE)) return { href: "/employees/new", label: "Add employee" };
  if (can(user, PERMISSIONS.DOCUMENT_UPLOAD)) return { href: "/documents/upload", label: "Upload document" };
  return null;
}
