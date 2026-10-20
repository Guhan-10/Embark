import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableCard } from "@/components/shared/table-card";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { UserActions } from "@/features/settings/components/user-actions";
import { UserFilters } from "@/features/settings/components/user-filters";
import { listUsers } from "@/features/settings/queries";
import type { UserListFilters } from "@/features/settings/types";
import { requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ROLE_DETAILS } from "@/lib/constants/roles";
import { formatTimeAgo, initials, plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Users" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageAccess(PERMISSIONS.USER_MANAGE);
  const params = await searchParams;
  const list = await listUsers(user, {
    q: one(params.q),
    roleKey: one(params.roleKey),
    active: one(params.active),
    page: one(params.page),
  } as UserListFilters).catch(() => null);
  const filtered = Object.keys(params).some((k) => k !== "page");
  const roles = Object.entries(ROLE_DETAILS).map(([key, r]) => ({ key, name: r.name }));

  return (
    <>
      <PageHeader
        title="Users"
        description={
          <>
            Everyone who has created a login. To change someone&apos;s role, edit their{" "}
            <Link href="/employees" className="font-medium text-primary-ink underline underline-offset-4">
              employee profile
            </Link>
            .
          </>
        }
      />
      <SettingsTabs user={user} />
      <UserFilters roles={roles} />
      {!list || list.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "Nobody matches those filters" : "No logins yet"}
          description={filtered ? "Try different filters." : "People appear here once they follow their welcome email and set a password."}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{plural(list.total, "login")}</p>
          <TableCard>
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">User logins</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-3.5 pr-3 pl-6 font-semibold">Person</th>
                  <th scope="col" className="px-3 font-semibold">Role</th>
                  <th scope="col" className="px-3 font-semibold">Department</th>
                  <th scope="col" className="px-3 font-semibold">Login</th>
                  <th scope="col" className="px-3 font-semibold">Last sign-in</th>
                  <th scope="col" className="pr-6 pl-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 pl-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-sky text-xs font-bold text-info-ink">{initials(u.name)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          {u.employee ? (
                            <Link href={`/employees/${u.employee.id}`} className="block truncate font-semibold hover:text-primary">
                              {u.name}
                            </Link>
                          ) : (
                            <span className="block truncate font-semibold">{u.name}</span>
                          )}
                          <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 whitespace-nowrap">{u.role?.name ?? "—"}</td>
                    <td className="px-3">{u.employee?.department?.name ?? "—"}</td>
                    <td className="px-3">
                      {u.isActive ? <StatusBadge tone="success">On</StatusBadge> : <StatusBadge tone="neutral">Turned off</StatusBadge>}
                    </td>
                    <td className="px-3 whitespace-nowrap text-muted-foreground">{u.lastSignInAt ? formatTimeAgo(u.lastSignInAt) : "Never"}</td>
                    <td className="pr-6 pl-3 text-right">
                      <UserActions user={{ id: u.id, name: u.name, isActive: u.isActive, isSelf: u.isSelf, archived: Boolean(u.employee?.archivedAt) }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} basePath="/settings/users" searchParams={params} />
        </>
      )}
    </>
  );
}
