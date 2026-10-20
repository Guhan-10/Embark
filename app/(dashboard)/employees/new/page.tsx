import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeForm } from "@/features/employees/components/employee-form";
import { getEmployeeFormOptions } from "@/features/employees/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";

export const metadata: Metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  const user = await requirePageAccess(PERMISSIONS.EMPLOYEE_CREATE);
  const options = await getEmployeeFormOptions(user);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Add employee"
        description="They'll get a welcome email with a link to set up their login."
        back={{ href: "/employees", label: "Employees" }}
      />
      <EmployeeForm mode="create" options={options} />
    </div>
  );
}
