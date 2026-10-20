import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { startOfToday } from "@/lib/utils/date";

export type StatusTone = "info" | "success" | "pending" | "warning" | "danger" | "neutral";

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: StatusTone }> = {
  TODO: { label: "To do", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  BLOCKED: { label: "Blocked", tone: "danger" },
  DONE: { label: "Done", tone: "success" },
  SKIPPED: { label: "Skipped", tone: "neutral" },
};

export const TASK_PRIORITY: Record<TaskPriority, { label: string; tone: StatusTone }> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Medium", tone: "info" },
  HIGH: { label: "High", tone: "warning" },
  URGENT: { label: "Urgent", tone: "danger" },
};

/** Statuses that count as finished for progress and overdue checks. */
export const CLOSED_TASK_STATUSES: TaskStatus[] = ["DONE", "SKIPPED"];

export function isTaskOverdue(task: { status: TaskStatus; dueDate: Date | null }, now = new Date()) {
  if (!task.dueDate || CLOSED_TASK_STATUSES.includes(task.status)) return false;
  return task.dueDate < startOfToday(now);
}

/** Who a template task goes to, as people read it. */
export const ASSIGNEE_TYPE: Record<"HR_MANAGER" | "REPORTING_MANAGER" | "EMPLOYEE", { label: string; short: string }> = {
  HR_MANAGER: { label: "Their HR", short: "HR" },
  REPORTING_MANAGER: { label: "Their reporting manager", short: "Manager" },
  EMPLOYEE: { label: "The new hire", short: "New hire" },
};
