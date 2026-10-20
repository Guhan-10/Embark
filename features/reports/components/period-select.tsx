"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTableFilters } from "@/hooks/use-table-filters";

/** How many months the trend covers, kept in the URL (?months=6). */
export function PeriodSelect({ value }: { value: number }) {
  const filters = useTableFilters();
  return (
    <Select value={String(value)} onValueChange={(v) => filters.set({ months: v === "6" ? "" : v })}>
      <SelectTrigger aria-label="Period" className="w-40 rounded-full bg-card px-4">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="3">Last 3 months</SelectItem>
        <SelectItem value="6">Last 6 months</SelectItem>
        <SelectItem value="12">Last 12 months</SelectItem>
      </SelectContent>
    </Select>
  );
}
