import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileText, Flag, Route, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentUpload } from "@/features/documents/components/document-upload";
import { TaskAssignDialog } from "@/features/tasks/components/task-assign-dialog";
import { TaskEditDialog } from "@/features/tasks/components/task-edit-dialog";
import { TaskHistory } from "@/features/tasks/components/task-history";
import { TaskStatusBadge } from "@/features/tasks/components/task-status-badge";
import { TaskStatusControl } from "@/features/tasks/components/task-status-control";
import { getAssignableUsers, getTask } from "@/features/tasks/queries";
import { requirePageAccess } from "@/lib/auth/rbac";
import { DOCUMENT_STATUS } from "@/lib/constants/document-status";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ASSIGNEE_TYPE, TASK_PRIORITY } from "@/lib/constants/task-status";
import { dateKey } from "@/lib/utils/date";
import { formatDate, formatRelativeDay, formatTimeAgo, initials, formatDay } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Task" };

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requirePageAccess(PERMISSIONS.TASK_READ);
  const { taskId } = await params;
  const task = await getTask(user, taskId);
  if (!task) notFound();

  const employee = task.process.employee;
  const forName = `${employee.firstName} ${employee.lastName}`;
  const people = task.permissions.assign ? await getAssignableUsers(user, task.process.id) : [];
  const priority = TASK_PRIORITY[task.priority];
  const pendingDoc = task.documents.find((d) => d.status === "PENDING" || d.status === "APPROVED");

  return (
    <>
      <PageHeader
        title={task.title}
        back={{ href: `/onboarding/${task.process.id}`, label: employee.userId === user.id ? "My onboarding" : `${forName}'s onboarding` }}
        actions={
          <>
            {task.permissions.assign ? (
              <TaskAssignDialog
                taskId={task.id}
                current={task.assignees.map((a) => a.id)}
                people={people.map((p) => ({ id: p.id, name: p.id === user.id ? `${p.name} (you)` : p.name, hint: p.id === employee.userId ? "New hire" : undefined }))}
              />
            ) : null}
            {task.permissions.edit ? (
              <TaskEditDialog
                taskId={task.id}
                initial={{
                  title: task.title,
                  description: task.description ?? "",
                  priority: task.priority,
                  dueDate: task.dueDate ? dateKey(task.dueDate) : "",
                }}
              />
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <DashboardCard>
            <div className="flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={task.status} overdue={task.isOverdue} />
              <StatusBadge tone={priority.tone}>{priority.label} priority</StatusBadge>
              {task.step ? <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{task.step.title}</span> : null}
            </div>
            {task.description ? <p className="mt-4 text-sm leading-relaxed whitespace-pre-line">{task.description}</p> : null}
            {task.process.status === "CANCELLED" ? (
              <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">This onboarding was cancelled, so the task can&apos;t be changed.</p>
            ) : task.permissions.changeStatus ? (
              <div className="mt-5 border-t pt-5">
                <TaskStatusControl
                  taskId={task.id}
                  status={task.status}
                  canSkip={task.permissions.skip}
                  needsDocument={Boolean(task.documentType) && !pendingDoc}
                />
                {task.documentType && !pendingDoc && task.status !== "DONE" && task.status !== "SKIPPED" ? (
                  <p className="mt-3 text-xs text-muted-foreground">Uploading the document below completes this task.</p>
                ) : null}
              </div>
            ) : null}
          </DashboardCard>

          {task.documentType ? (
            <DashboardCard title={`Document: ${task.documentType.name}`}>
              {task.documents.length ? (
                <ul className="mb-5 flex flex-col divide-y">
                  {task.documents.map((d) => {
                    const s = DOCUMENT_STATUS[d.status];
                    return (
                      <li key={d.id} className="flex items-center gap-3 py-2.5">
                        <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                        <Link href={`/documents/${d.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                          {d.fileName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(d.createdAt)}</span>
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {task.permissions.uploadDocument && !pendingDoc ? (
                <DocumentUpload
                  taskId={task.id}
                  fixedType={{
                    id: task.documentType.id,
                    name: task.documentType.name,
                    hasExpiry: false,
                    allowedMimeTypes: task.documentType.allowedMimeTypes,
                    maxSizeBytes: task.documentType.maxSizeBytes,
                  }}
                />
              ) : !task.documents.length ? (
                <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
              ) : null}
            </DashboardCard>
          ) : null}

          <DashboardCard title="History">
            <TaskHistory history={task.history} />
          </DashboardCard>
        </div>

        <div className="flex flex-col gap-5">
          <DashboardCard title="Details" className="h-auto">
            <dl className="flex flex-col gap-4 text-sm">
              <div className="flex items-center gap-3">
                <Route className="size-4 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Onboarding for</dt>
                <dd>
                  Onboarding for{" "}
                  <Link href={`/onboarding/${task.process.id}`} className="font-semibold hover:underline">
                    {employee.userId === user.id ? "you" : forName}
                  </Link>
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Due</dt>
                <dd className={task.isOverdue ? "font-semibold text-warning-ink" : ""}>
                  {task.dueDate ? `Due ${formatDate(task.dueDate)} · ${formatRelativeDay(task.dueDate)}` : "No due date"}
                </dd>
              </div>
              {task.completedAt ? (
                <div className="flex items-center gap-3">
                  <Flag className="size-4 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Finished</dt>
                  <dd>Finished {formatDay(task.completedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </DashboardCard>
          <DashboardCard title="Assigned to" className="h-auto">
            {task.assignees.length ? (
              <ul className="flex flex-col gap-3">
                {task.assignees.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-mint text-xs font-bold text-primary-ink">{initials(a.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      <span className="block font-semibold">{a.id === user.id ? `${a.name} (you)` : a.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {a.assignedBy ? `Assigned by ${a.assignedBy}` : "Assigned automatically"} · {formatTimeAgo(a.assignedAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserRound className="size-4" aria-hidden="true" />
                {task.assigneeType ? `Goes to ${ASSIGNEE_TYPE[task.assigneeType].label.toLowerCase()} once they're set up.` : "Not assigned yet."}
              </p>
            )}
          </DashboardCard>
        </div>
      </div>
    </>
  );
}
