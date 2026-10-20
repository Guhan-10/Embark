import Link from "next/link";
import { ProgressRing } from "./progress-ring";

/** A small card with a percentage ring, a category, a label, and an optional "Check" button. */
export function RingStatCard({
  value,
  color,
  eyebrow,
  title,
  detail,
  action,
}: {
  value: number;
  color: string;
  eyebrow: string;
  title: string;
  detail: string;
  action?: { href: string; label: string };
}) {
  return (
    <section className="flex flex-col rounded-[1.75rem] bg-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <ProgressRing value={value} color={color} size={60} />
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wide uppercase" style={{ color }}>
            {eyebrow}
          </p>
          <p className="truncate text-sm font-bold">{title}</p>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground">{detail}</p>
        {action ? (
          <Link href={action.href} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-dark">
            {action.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
