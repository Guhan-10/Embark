import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TaskQuickToggle } from "@/features/tasks/components/task-quick-toggle";
import { TaskStatusBadge } from "@/features/tasks/components/task-status-badge";
import { ASSIGNEE_TYPE, CLOSED_TASK_STATUSES, TASK_PRIORITY } from "@/lib/constants/task-status";
import { cn } from "@/lib/utils/cn";
import { formatShortDate, plural } from "@/lib/utils/format";
import type { ProcessDetail } from "../types";

/** The onboarding's steps, each a card of tasks. People can tick off tasks they're allowed to update. */
export function ProcessSteps({ process }: { process: ProcessDetail }) {
  const cancelled = process.status === "CANCELLED";
  return (
    <div className="flex flex-col gap-5">
      {process.steps.map((step, i) => {
        const done = step.tasks.filter((t) => CLOSED_TASK_STATUSES.includes(t.status)).length;
        return (
          <DashboardCard key={step.id ?? "other"}>
            <header className="mb-3 flex items-center gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  done === step.tasks.length && step.tasks.length ? "bg-success-soft text-success-ink" : "bg-accent text-primary-ink",
                )}
              >
                {i + 1}
              </span>
              <h2 className="flex-1 text-lg font-bold tracking-tight">{step.title}</h2>
              <span className="text-sm text-muted-foreground">
                {done} of {plural(step.tasks.length, "task")}
              </span>
            </header>
            <ul className="flex flex-col">
              {step.tasks.map((task) => {
                const closed = CLOSED_TASK_STATUSES.includes(task.status);
                const canToggle = !cancelled && !task.documentType && (task.isMine || process.canManage) && task.status !== "SKIPPED";
                return (
                  <li key={task.id} className="flex items-center gap-3 border-t py-3 first:border-t-0">
                    {canToggle ? (
                      <TaskQuickToggle taskId={task.id} title={task.title} done={task.status === "DONE"} />
                    ) : (
                      <span
                        className={cn("size-6 shrink-0 rounded-full border-2", closed ? "border-success bg-success/20" : "border-dashed border-input")}
                        aria-hidden="true"
                      />
                    )}
                    <Link href={`/tasks/${task.id}`} className="group flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 focus-visible:outline-none">
                      <span className={cn("min-w-0 flex-1 basis-56 text-sm font-semibold group-hover:text-primary", closed && "text-muted-foreground line-through decoration-1")}>
                        {task.documentType ? <FileText className="mr-1.5 inline size-3.5 text-muted-foreground" aria-label="Needs a document" /> : null}
                        {task.title}
                        {task.isMine ? <span className="ml-2 rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-success-ink no-underline">You</span> : null}
                      </span>
                      <span className="w-40 truncate text-xs text-muted-foreground">
                        {task.assignees.length
                          ? task.assignees.map((a) => a.name).join(", ")
                          : task.assigneeType === "EMPLOYEE" && !process.employee.userId
                            ? "New hire · hasn't signed up"
                            : task.assigneeType
                              ? `${ASSIGNEE_TYPE[task.assigneeType].short} · not assigned yet`
                              : "Unassigned"}
                      </span>
                      {task.priority === "HIGH" || task.priority === "URGENT" ? (
                        <StatusBadge tone={TASK_PRIORITY[task.priority].tone}>{TASK_PRIORITY[task.priority].label}</StatusBadge>
                      ) : null}
                      <span className={cn("w-14 text-right text-xs tabular-nums", task.isOverdue ? "font-semibold text-warning-ink" : "text-muted-foreground")}>
                        {formatShortDate(task.dueDate)}
                      </span>
                      <span className="w-24 text-right">
                        <TaskStatusBadge status={task.status} overdue={task.isOverdue} />
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </DashboardCard>
        );
      })}
    </div>
  );
}
