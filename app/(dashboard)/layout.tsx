import { buildNav, primaryActionFor, SETTINGS_PERMISSIONS } from "@/components/layout/nav";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { getUnreadCount } from "@/features/notifications/queries";
import { can, isHrViewer, requirePageAccess } from "@/lib/auth/rbac";
import { ROLE_DETAILS, type RoleKey } from "@/lib/constants/roles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageAccess();
  const navItems = buildNav(user);
  const unreadCount = await getUnreadCount(user);
  const role = user.roles[0] as RoleKey | undefined;

  return (
    <div className="min-h-svh">
      <Sidebar items={navItems} />
      <div className="flex min-h-svh flex-col lg:pl-[88px]">
        <Navbar
          user={{
            name: user.name,
            email: user.email,
            roleName: role ? ROLE_DETAILS[role].name : "No role",
            employeeId: user.employeeId,
          }}
          navItems={navItems}
          unreadCount={unreadCount}
          canSearchEmployees={isHrViewer(user)}
          canOpenSettings={SETTINGS_PERMISSIONS.some((p) => can(user, p))}
          primaryAction={primaryActionFor(user)}
        />
        <main id="main" className="flex-1 px-4 pt-2 pb-10 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
