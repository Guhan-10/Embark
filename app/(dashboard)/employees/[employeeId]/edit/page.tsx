import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeForm } from "@/features/employees/components/employee-form";
import { getEmployee, getEmployeeFormOptions } from "@/features/employees/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { dateKey } from "@/lib/utils/date";

export const metadata: Metadata = { title: "Edit employee" };

export default async function EditEmployeePage({ params }: { params: Promise<{ employeeId: string }> }) {
  const user = await requirePageAccess(PERMISSIONS.EMPLOYEE_UPDATE);
  const { employeeId } = await params;
  const [employee, options] = await Promise.all([getEmployee(user, employeeId), getEmployeeFormOptions(user)]);
  if (!employee) notFound();
  if (employee.archivedAt) redirect(`/employees/${employeeId}`);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${employee.firstName} ${employee.lastName}`}
        back={{ href: `/employees/${employeeId}`, label: "Back to profile" }}
      />
      <EmployeeForm
        mode="edit"
        employeeId={employeeId}
        options={options}
        emailLocked={employee.isRegistered}
        isSelf={employee.id === user.employeeId}
        defaults={{
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone ?? "",
          employeeCode: employee.employeeCode,
          joiningDate: dateKey(employee.joiningDate),
          departmentId: employee.departmentId ?? "",
          designationId: employee.designationId ?? "",
          roleKey: employee.roleKey,
          reportingManagerId: employee.reportingManagerId ?? "",
          hrManagerId: employee.hrManagerId ?? "",
        }}
      />
    </div>
  );
}
