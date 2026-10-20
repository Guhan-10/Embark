import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** A headline number with its label: the right form when the point is one figure, not a trend. */
export function StatTile({ icon: Icon, label, value, detail, tone = "teal" }: { icon: LucideIcon; label: string; value: string | number; detail?: string; tone?: "teal" | "mint" | "sky" | "sun" }) {
  const tones = { teal: "bg-accent text-primary-ink", mint: "bg-mint text-success-ink", sky: "bg-sky text-info-ink", sun: "bg-sun text-pending-ink" };
  return (
    <section className="flex items-center gap-4 rounded-[1.75rem] bg-card p-5 shadow-card">
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", tones[tone])} aria-hidden="true">
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </section>
  );
}
