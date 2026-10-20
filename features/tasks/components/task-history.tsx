import { TASK_STATUS } from "@/lib/constants/task-status";
import { formatDateTime } from "@/lib/utils/format";
import type { TaskDetail } from "../types";
import { TaskStatusBadge } from "./task-status-badge";

/** Every status change, newest first, with who made it and any note. */
export function TaskHistory({ history }: { history: TaskDetail["history"] }) {
  return (
    <ol className="relative flex flex-col gap-5 border-l-2 border-dashed border-border pl-6">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute top-1 -left-[31px] size-3.5 rounded-full border-2 border-card bg-primary" aria-hidden="true" />
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{h.changedBy?.name ?? "System"}</span>
            {h.fromStatus ? (
              <>
                <span className="text-muted-foreground">moved it from {TASK_STATUS[h.fromStatus].label.toLowerCase()} to</span>
                <TaskStatusBadge status={h.toStatus} />
              </>
            ) : (
              <span className="text-muted-foreground">created it</span>
            )}
          </p>
          {h.note ? <p className="mt-1 rounded-xl bg-muted px-3 py-2 text-sm">{h.note}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
