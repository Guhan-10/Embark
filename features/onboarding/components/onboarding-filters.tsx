"use client";

import { ListFilters } from "@/components/shared/list-filters";
import { PROCESS_STATUS } from "@/lib/constants/employee-status";

export function OnboardingFilters({ departments }: { departments: { id: string; name: string }[] }) {
  return (
    <ListFilters
      searchLabel="Search by name or employee code"
      selects={[
        { param: "status", label: "Status", options: Object.entries(PROCESS_STATUS).map(([value, s]) => ({ value, label: s.label })) },
        { param: "departmentId", label: "Department", options: departments.map((d) => ({ value: d.id, label: d.name })) },
      ]}
    />
  );
}
