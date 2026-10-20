import type { Metadata } from "next";
import Link from "next/link";
import { Archive, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { EmployeeFilters } from "@/features/employees/components/employee-filters";
import { EmployeeTable } from "@/features/employees/components/employee-table";
import { getEmployeeFormOptions, listEmployees } from "@/features/employees/queries";
import type { EmployeeListFilters } from "@/features/employees/types";
import { can, isHrViewer, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Employees" };

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess(PERMISSIONS.EMPLOYEE_READ);
  const params = await searchParams;
  const hr = isHrViewer(user);

  const [list, options] = await Promise.all([
    // URL values are validated by the query; bad ones (e.g. a hand-edited link) show the "didn't work" state.
    listEmployees(user, {
      q: one(params.q),
      departmentId: one(params.departmentId),
      status: one(params.status),
      roleKey: one(params.roleKey),
      sort: one(params.sort),
      order: one(params.order),
      page: one(params.page),
    } as EmployeeListFilters).catch(() => null),
    hr ? getEmployeeFormOptions(user) : null,
  ]);
  const filtered = Object.keys(params).some((k) => k !== "page" && k !== "sort" && k !== "order");

  return (
    <>
      <PageHeader
        title={hr ? "Employees" : "My team"}
        description={
          list
            ? filtered
              ? plural(list.total, "match", "matches")
              : `${plural(list.total, "person", "people")}${hr ? " in your space" : ""}`
            : undefined
        }
        actions={
          hr ? (
            <>
              <Button variant="outline" asChild className="h-11 rounded-full bg-card px-4">
                <Link href="/employees/archived">
                  <Archive /> Archived
                </Link>
              </Button>
              {/* The top bar has "Add employee" on larger screens; this copy is for phones. */}
              {can(user, PERMISSIONS.EMPLOYEE_CREATE) ? (
                <Button asChild className="h-11 rounded-full px-5 sm:hidden">
                  <Link href="/employees/new">
                    <UserPlus /> Add employee
                  </Link>
                </Button>
              ) : null}
            </>
          ) : null
        }
      />
      {options ? <EmployeeFilters departments={options.departments} roles={options.roles} /> : null}

      {!list ? (
        <EmptyState icon={Users} title="Those filters didn't work" description="Clear them and try again." />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "Nobody matches those filters" : "No employees yet"}
          description={filtered ? "Try a different search or clear the filters." : "Add your first employee and they'll get a welcome email to set up their login."}
          action={
            !filtered && can(user, PERMISSIONS.EMPLOYEE_CREATE) ? (
              <Button asChild size="lg" className="rounded-full">
                <Link href="/employees/new">
                  <UserPlus /> Add employee
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <EmployeeTable items={list.items} currentEmployeeId={user.employeeId} />
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} basePath="/employees" searchParams={params} />
        </>
      )}
    </>
  );
}
