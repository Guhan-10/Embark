"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { useTableFilters } from "@/hooks/use-table-filters";
import { LoadingSpinner } from "./loading-spinner";

const ALL = "all";

export type FilterSelectConfig = {
  /** URL parameter, e.g. "status". */
  param: string;
  label: string;
  options: { value: string; label: string }[];
  /** Extra URL params to set alongside, per chosen value (e.g. a sort order). */
  also?: (value: string) => Record<string, string>;
};

/** Search-as-you-type plus dropdown filters, all stored in the URL. Shared by every list page. */
export function ListFilters({
  searchLabel,
  selects,
  children,
}: {
  searchLabel?: string;
  selects: FilterSelectConfig[];
  /** Extra controls (e.g. date inputs) placed after the dropdowns. */
  children?: React.ReactNode;
}) {
  const filters = useTableFilters();
  const [query, setQuery] = useState(filters.get("q"));
  const debounced = useDebounce(query);

  useEffect(() => {
    if (searchLabel && debounced !== filters.get("q")) filters.set({ q: debounced });
    // Only react to typing, not to the URL changing underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
      {searchLabel ? (
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            className="h-11 w-full rounded-full border bg-card pr-10 pl-10 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          {filters.pending ? <LoadingSpinner label="Updating" className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground" /> : null}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        {selects.map((s) => (
          <Select
            key={s.param}
            value={filters.get(s.param) || ALL}
            onValueChange={(v) => {
              const value = v === ALL ? "" : v;
              filters.set({ [s.param]: value, ...(s.also?.(value) ?? {}) });
            }}
          >
            <SelectTrigger aria-label={s.label} className="w-full rounded-full bg-card px-4 sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{s.label}: all</SelectItem>
              {s.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {children}
        {filters.hasFilters ? (
          <Button
            variant="ghost"
            className="h-11 rounded-full px-4"
            onClick={() => {
              setQuery("");
              filters.clear();
            }}
          >
            <X /> Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
