import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { RolePermissionGrid } from "@/features/settings/components/role-permission-grid";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { listRolesWithPermissions } from "@/features/settings/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ROLES } from "@/lib/constants/roles";

// Most access first; custom roles (if any) after the built-in ones.
const ORDER: string[] = [ROLES.HR_ADMIN, ROLES.HR_MANAGER, ROLES.REPORTING_MANAGER, ROLES.EMPLOYEE];
const rank = (key: string) => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length);

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const user = await requirePageAccess(PERMISSIONS.ROLE_MANAGE);
  const data = await listRolesWithPermissions(user);
  return (
    <>
      <PageHeader
        title="Roles and permissions"
        description="What each role can do. People still only see records in their own space: their department, their reports, or themselves."
      />
      <SettingsTabs user={user} />
      <RolePermissionGrid roles={[...data.roles].sort((a, b) => rank(a.key) - rank(b.key))} permissions={data.permissions} />
    </>
  );
}
