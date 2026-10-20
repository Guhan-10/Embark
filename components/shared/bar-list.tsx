import { cn } from "@/lib/utils/cn";

export type BarListItem = {
  label: string;
  value: number;
  /** What's printed at the end of the bar; defaults to the value. */
  display?: string;
  /** Extra detail under the label, e.g. "3 active · 1 completed". */
  detail?: string;
  href?: string;
};

/**
 * Horizontal bars as plain HTML: label, bar, and the value written out. Readable without hovering,
 * works with screen readers, and doubles as the table view. One colour — the bars compare magnitude.
 */
export function BarList({
  items,
  max,
  className,
  emptyText = "Nothing to show yet.",
}: {
  items: BarListItem[];
  /** Scale maximum, e.g. 100 for percentages. Defaults to the largest value. */
  max?: number;
  className?: string;
  emptyText?: string;
}) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
          <span className="min-w-0">
            <span className="block truncate font-medium" title={item.label}>
              {item.label}
            </span>
            {item.detail ? <span className="block truncate text-xs text-muted-foreground">{item.detail}</span> : null}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.max(item.value > 0 ? 2 : 0, (item.value / top) * 100)}%` }}
            />
          </span>
          <span className="w-12 text-right font-semibold tabular-nums">{item.display ?? item.value}</span>
        </li>
      ))}
    </ul>
  );
}
