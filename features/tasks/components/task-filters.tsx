"use client";

import { ListFilters } from "@/components/shared/list-filters";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/constants/task-status";

export function TaskFilters() {
  return (
    <ListFilters
      searchLabel="Search tasks"
      selects={[
        { param: "status", label: "Status", options: Object.entries(TASK_STATUS).map(([value, s]) => ({ value, label: s.label })) },
        { param: "priority", label: "Priority", options: Object.entries(TASK_PRIORITY).map(([value, p]) => ({ value, label: p.label })) },
        { param: "overdue", label: "Due", options: [{ value: "true", label: "Overdue only" }] },
        { param: "includeClosed", label: "Finished", options: [{ value: "true", label: "Include finished" }] },
      ]}
    />
  );
}
