"use client";

import { ListFilters } from "@/components/shared/list-filters";
import { useTableFilters } from "@/hooks/use-table-filters";
import { auditActionLabel, auditEntityLabel } from "../audit-labels";

export function AuditFilters({ actions, entityTypes }: { actions: string[]; entityTypes: string[] }) {
  const filters = useTableFilters();
  const date = (param: "from" | "to", label: string) => (
    <label className="flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="date"
        value={filters.get(param)}
        onChange={(e) => filters.set({ [param]: e.target.value })}
        className="min-w-0 bg-transparent outline-none"
      />
    </label>
  );
  return (
    <ListFilters
      selects={[
        { param: "action", label: "Action", options: actions.map((a) => ({ value: a, label: auditActionLabel(a) })) },
        { param: "entityType", label: "Record", options: entityTypes.map((t) => ({ value: t, label: auditEntityLabel(t) })) },
      ]}
    >
      {date("from", "From")}
      {date("to", "To")}
    </ListFilters>
  );
}
