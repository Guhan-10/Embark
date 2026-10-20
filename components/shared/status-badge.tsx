import { cn } from "@/lib/utils/cn";
import type { StatusTone } from "@/lib/constants/task-status";

/** Soft background + dark ink of the same colour, so every badge passes contrast. */
const TONES: Record<StatusTone, string> = {
  neutral: "bg-neutral-soft text-neutral-ink",
  info: "bg-info-soft text-info-ink",
  success: "bg-success-soft text-success-ink",
  pending: "bg-pending-soft text-pending-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
};

export function StatusBadge({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}
