import Link from "next/link";
import { FileText } from "lucide-react";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TASK_PRIORITY } from "@/lib/constants/task-status";
import { addDays, startOfToday } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { formatRelativeDay, formatShortDate } from "@/lib/utils/format";
import type { TaskListItem } from "../types";
import { TaskQuickToggle } from "./task-quick-toggle";
import { TaskStatusBadge } from "./task-status-badge";

type Group = { key: string; title: string; tone: string; tasks: TaskListItem[] };

/** Splits open tasks into Overdue / Today / This week / Later / No due date. */
function groupByDue(tasks: TaskListItem[]): Group[] {
  const today = startOfToday();
  const weekEnd = addDays(today, 7);
  const groups: Group[] = [
    { key: "overdue", title: "Overdue", tone: "text-warning-ink", tasks: [] },
    { key: "today", title: "Today", tone: "text-primary", tasks: [] },
    { key: "week", title: "Next 7 days", tone: "text-foreground", tasks: [] },
    { key: "later", title: "Later", tone: "text-foreground", tasks: [] },
    { key: "none", title: "No due date", tone: "text-muted-foreground", tasks: [] },
  ];
  for (const t of tasks) {
    const due = t.dueDate ? new Date(t.dueDate) : null;
    const g = !due ? 4 : due < today ? 0 : due.getTime() === today.getTime() ? 1 : due <= weekEnd ? 2 : 3;
    groups[g].tasks.push(t);
  }
  return groups.filter((g) => g.tasks.length);
}

function TaskRow({ task }: { task: TaskListItem }) {
  const done = task.status === "DONE" || task.status === "SKIPPED";
  return (
    <li className="flex items-center gap-3 border-t py-3 first:border-t-0">
      {!task.documentTypeId && task.status !== "SKIPPED" ? (
        <TaskQuickToggle taskId={task.id} title={task.title} done={task.status === "DONE"} />
      ) : (
        <span className={cn("size-6 shrink-0 rounded-full border-2", done ? "border-success bg-success/20" : "border-dashed border-input")} aria-hidden="true" />
      )}
      <Link href={`/tasks/${task.id}`} className="group flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 basis-60">
          <span className={cn("block text-sm font-semibold group-hover:text-primary", done && "text-muted-foreground line-through decoration-1")}>
            {task.documentTypeId ? <FileText className="mr-1.5 inline size-3.5 text-muted-foreground" aria-label="Needs a document" /> : null}
            {task.title}
          </span>
          <span className="block text-xs text-muted-foreground">
            {task.process.employee.firstName} {task.process.employee.lastName}
            {task.step ? ` · ${task.step.title}` : ""}
          </span>
        </span>
        {task.priority === "HIGH" || task.priority === "URGENT" ? (
          <StatusBadge tone={TASK_PRIORITY[task.priority].tone}>{TASK_PRIORITY[task.priority].label}</StatusBadge>
        ) : null}
        <span className={cn("w-36 text-right text-xs whitespace-nowrap", task.isOverdue ? "font-semibold text-warning-ink" : "text-muted-foreground")}>
          {task.dueDate ? (done ? formatShortDate(task.dueDate) : `${formatShortDate(task.dueDate)} · ${formatRelativeDay(task.dueDate)}`) : ""}
        </span>
        <span className="w-24 text-right">
          <TaskStatusBadge status={task.status} overdue={task.isOverdue} />
        </span>
      </Link>
    </li>
  );
}

export function MyTaskGroups({ open, recentlyDone }: { open: TaskListItem[]; recentlyDone: TaskListItem[] }) {
  return (
    <div className="flex flex-col gap-5">
      {groupByDue(open).map((group) => (
        <DashboardCard key={group.key}>
          <h2 className={cn("mb-1 flex items-center gap-2 text-lg font-bold", group.tone)}>
            {group.title}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{group.tasks.length}</span>
          </h2>
          <ul>
            {group.tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </DashboardCard>
      ))}
      {recentlyDone.length ? (
        <DashboardCard title="Recently finished">
          <ul>
            {recentlyDone.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </DashboardCard>
      ) : null}
    </div>
  );
}
