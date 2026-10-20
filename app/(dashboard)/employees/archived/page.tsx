import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { RestoreButton } from "@/features/employees/components/employee-actions";
import { EmployeeTable } from "@/features/employees/components/employee-table";
import { listEmployees } from "@/features/employees/queries";
import { can, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";

export const metadata: Metadata = { title: "Archived employees" };

export default async function ArchivedEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageAccess(PERMISSIONS.EMPLOYEE_UPDATE);
  const params = await searchParams;
  const page = Array.isArray(params.page) ? params.page[0] : params.page;
  const list = await listEmployees(user, { archived: true, sort: "name", order: "asc", page: page ?? 1 });
  const canRestore = can(user, PERMISSIONS.EMPLOYEE_ARCHIVE);

  return (
    <>
      <PageHeader
        title="Archived employees"
        description="People who've left. Their records are kept; restoring someone lets them log in again."
        back={{ href: "/employees", label: "Employees" }}
      />
      {list.items.length === 0 ? (
        <EmptyState icon={Archive} title="Nobody is archived" description="When you archive someone, they'll appear here." />
      ) : (
        <>
          <EmployeeTable
            items={list.items}
            actions={canRestore ? (e) => <RestoreButton id={e.id} name={`${e.firstName} ${e.lastName}`} /> : undefined}
          />
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} basePath="/employees/archived" searchParams={params} />
        </>
      )}
    </>
  );
}
