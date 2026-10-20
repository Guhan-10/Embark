import Link from "next/link";
import { FileText } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableCard } from "@/components/shared/table-card";
import { CLOSED_TASK_STATUSES, TASK_PRIORITY } from "@/lib/constants/task-status";
import { cn } from "@/lib/utils/cn";
import { formatRelativeDay, formatShortDate } from "@/lib/utils/format";
import type { TaskListItem } from "../types";
import { TaskQuickToggle } from "./task-quick-toggle";
import { TaskStatusBadge } from "./task-status-badge";

/** Tasks across onboarding: what, for whom, who does it, when it's due. People can tick off their own. */
export function TaskTable({ items, showEmployee = true }: { items: TaskListItem[]; showEmployee?: boolean }) {
  return (
    <TableCard>
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="w-10 py-3.5 pl-6"><span className="sr-only">Done</span></th>
            <th scope="col" className="py-3.5 pr-3 font-semibold">Task</th>
            {showEmployee ? <th scope="col" className="px-3 font-semibold">For</th> : null}
            <th scope="col" className="px-3 font-semibold">Assigned to</th>
            <th scope="col" className="px-3 font-semibold">Due</th>
            <th scope="col" className="px-3 font-semibold">Priority</th>
            <th scope="col" className="pr-6 pl-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const closed = CLOSED_TASK_STATUSES.includes(t.status);
            const priority = TASK_PRIORITY[t.priority];
            return (
              <tr key={t.id} className="group border-b last:border-0 hover:bg-muted/50">
                <td className="py-3 pl-6">
                  {t.isMine && !t.documentTypeId && t.status !== "SKIPPED" ? (
                    <TaskQuickToggle taskId={t.id} title={t.title} done={t.status === "DONE"} />
                  ) : (
                    <span className={cn("block size-6 rounded-full border-2", closed ? "border-success bg-success/20" : "border-dashed border-input")} aria-hidden="true" />
                  )}
                </td>
                <td className="py-3 pr-3">
                  <Link href={`/tasks/${t.id}`} className="block rounded-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
                    <span className={cn("block font-semibold group-hover:text-primary", closed && "text-muted-foreground line-through decoration-1")}>
                      {t.documentTypeId ? <FileText className="mr-1.5 inline size-3.5 text-muted-foreground" aria-label="Needs a document" /> : null}
                      {t.title}
                    </span>
                    {t.step ? <span className="block text-xs text-muted-foreground">{t.step.title}</span> : null}
                  </Link>
                </td>
                {showEmployee ? (
                  <td className="px-3 whitespace-nowrap">
                    {t.process.employee.firstName} {t.process.employee.lastName}
                  </td>
                ) : null}
                <td className="max-w-44 truncate px-3 text-muted-foreground">
                  {t.assignees.length ? t.assignees.map((a) => a.name).join(", ") : "Unassigned"}
                </td>
                <td className={cn("px-3 whitespace-nowrap", t.isOverdue ? "font-semibold text-warning-ink" : "")}>
                  {t.dueDate ? (
                    <>
                      {formatShortDate(t.dueDate)}
                      <span className="block text-xs font-normal text-muted-foreground">{closed ? "" : formatRelativeDay(t.dueDate)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3">
                  <StatusBadge tone={priority.tone}>{priority.label}</StatusBadge>
                </td>
                <td className="pr-6 pl-3">
                  <TaskStatusBadge status={t.status} overdue={t.isOverdue} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
