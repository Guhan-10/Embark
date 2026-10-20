"use client";

import { ListFilters } from "@/components/shared/list-filters";
import { EMPLOYEE_STATUS } from "@/lib/constants/employee-status";

/** Search and filters for the employee list. */
export function EmployeeFilters({
  departments,
  roles,
}: {
  departments: { id: string; name: string }[];
  roles: { key: string; name: string }[];
}) {
  return (
    <ListFilters
      searchLabel="Search by name, email, or code"
      selects={[
        { param: "departmentId", label: "Department", options: departments.map((d) => ({ value: d.id, label: d.name })) },
        {
          param: "status",
          label: "Status",
          options: Object.entries(EMPLOYEE_STATUS)
            .filter(([k]) => k !== "INACTIVE")
            .map(([value, s]) => ({ value, label: s.label })),
        },
        ...(roles.length > 1 ? [{ param: "roleKey", label: "Role", options: roles.map((r) => ({ value: r.key, label: r.name })) }] : []),
        {
          param: "sort",
          label: "Sort",
          options: [
            { value: "name", label: "Name" },
            { value: "joiningDate", label: "Joining date" },
            { value: "employeeCode", label: "Employee code" },
          ],
          also: (v) => ({ order: v === "name" || v === "employeeCode" ? "asc" : v ? "desc" : "" }),
        },
      ]}
    />
  );
}
