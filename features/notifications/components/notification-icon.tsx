import {
  BadgeCheck,
  Bell,
  CalendarClock,
  CircleAlert,
  ClipboardList,
  FileClock,
  FileUp,
  FileX2,
  PartyPopper,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import type { NotificationType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  TASK_ASSIGNED: { icon: ClipboardList, tone: "bg-info-soft text-info-ink" },
  TASK_DUE_SOON: { icon: CalendarClock, tone: "bg-pending-soft text-pending-ink" },
  TASK_OVERDUE: { icon: CircleAlert, tone: "bg-warning-soft text-warning-ink" },
  TASK_COMPLETED: { icon: BadgeCheck, tone: "bg-success-soft text-success-ink" },
  DOCUMENT_UPLOADED: { icon: FileUp, tone: "bg-info-soft text-info-ink" },
  DOCUMENT_APPROVED: { icon: BadgeCheck, tone: "bg-success-soft text-success-ink" },
  DOCUMENT_REJECTED: { icon: FileX2, tone: "bg-danger-soft text-danger-ink" },
  DOCUMENT_EXPIRING: { icon: FileClock, tone: "bg-pending-soft text-pending-ink" },
  DOCUMENT_EXPIRED: { icon: FileX2, tone: "bg-warning-soft text-warning-ink" },
  ONBOARDING_STARTED: { icon: Rocket, tone: "bg-accent text-primary-ink" },
  ONBOARDING_COMPLETED: { icon: PartyPopper, tone: "bg-success-soft text-success-ink" },
  SYSTEM: { icon: Bell, tone: "bg-neutral-soft text-neutral-ink" },
};

export function NotificationIcon({ type, className }: { type: NotificationType; className?: string }) {
  const { icon: Icon, tone } = ICONS[type];
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone, className)} aria-hidden="true">
      <Icon className="size-[18px]" />
    </span>
  );
}
