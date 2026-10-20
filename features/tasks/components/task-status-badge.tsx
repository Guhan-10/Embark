import { StatusBadge } from "@/components/shared/status-badge";
import type { TaskStatus } from "@/generated/prisma/enums";
import { TASK_STATUS } from "@/lib/constants/task-status";

export function TaskStatusBadge({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  // Blocked says more than overdue, so it wins.
  if (overdue && status !== "BLOCKED") return <StatusBadge tone="warning">Overdue</StatusBadge>;
  const s = TASK_STATUS[status];
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}
