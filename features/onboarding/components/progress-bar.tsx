import { cn } from "@/lib/utils/cn";

/** A slim onboarding progress bar: teal while in progress, green when done, orange if anything is overdue. */
export function ProgressBar({
  percent,
  overdue = 0,
  showLabel = true,
  className,
}: {
  percent: number;
  overdue?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const color = value === 100 ? "bg-success" : overdue > 0 ? "bg-warning" : "bg-primary";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showLabel ? <span className="w-9 text-right text-xs font-semibold tabular-nums">{value}%</span> : null}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full transition-[width] duration-700", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
