import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck2, CalendarDays, Flag, Route } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProgressRing } from "@/components/shared/progress-ring";
import { StatusBadge } from "@/components/shared/status-badge";
import { listDocumentTypes } from "@/features/documents/queries";
import { CancelOnboardingButton } from "@/features/onboarding/components/cancel-onboarding-button";
import { ProcessSteps } from "@/features/onboarding/components/process-steps";
import { getProcess } from "@/features/onboarding/queries";
import { AddTaskDialog } from "@/features/tasks/components/task-form";
import { getAssignableUsers } from "@/features/tasks/queries";
import { can, isHrViewer, requirePageAccess } from "@/lib/auth/rbac";
import { PROCESS_STATUS } from "@/lib/constants/employee-status";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate, initials, formatDay } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Onboarding" };

export default async function ProcessPage({ params }: { params: Promise<{ processId: string }> }) {
  const user = await requirePageAccess(PERMISSIONS.ONBOARDING_READ);
  const { processId } = await params;
  const process = await getProcess(user, processId);
  if (!process) notFound();

  const { employee, progress } = process;
  const name = `${employee.firstName} ${employee.lastName}`;
  const isSelf = employee.userId === user.id;
  const canAddTasks = process.canManage && can(user, PERMISSIONS.TASK_CREATE) && process.status !== "CANCELLED";
  const [people, documentTypes] = canAddTasks
    ? await Promise.all([getAssignableUsers(user, processId), listDocumentTypes(user)])
    : [[], []];
  const status = PROCESS_STATUS[process.status];

  return (
    <>
      <PageHeader
        title={isSelf ? "My onboarding" : `${name}'s onboarding`}
        back={isSelf ? undefined : { href: "/onboarding", label: isHrViewer(user) ? "Onboarding" : "Your team's onboarding" }}
        actions={
          <>
            {process.canCancel ? <CancelOnboardingButton processId={processId} name={employee.firstName} /> : null}
            {canAddTasks ? (
              <AddTaskDialog
                processId={processId}
                steps={process.steps.filter((s) => s.id).map((s) => ({ id: s.id!, title: s.title }))}
                documentTypes={documentTypes.map((d) => ({ id: d.id, name: d.name }))}
                people={people.map((p) => ({
                  id: p.id,
                  name: p.id === user.id ? `${p.name} (you)` : p.name,
                  hint: p.id === employee.userId ? "New hire" : undefined,
                }))}
              />
            ) : null}
          </>
        }
      />

      <section className="mb-5 grid gap-6 rounded-[1.75rem] bg-card p-6 shadow-card md:grid-cols-[auto_1fr_auto] md:items-center">
        <ProgressRing value={progress.percent} size={96} stroke={9} color={progress.percent === 100 ? "var(--success)" : "var(--primary)"} className="[&>span]:text-xl" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {!isSelf ? (
              <Link href={`/employees/${employee.id}`} className="flex items-center gap-2 hover:underline">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-sky text-xs font-bold text-info-ink">{initials(name)}</AvatarFallback>
                </Avatar>
                <span className="text-lg font-bold">{name}</span>
              </Link>
            ) : (
              <span className="text-lg font-bold">{progress.done} of {progress.total} tasks done</span>
            )}
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {process.status === "IN_PROGRESS" && progress.overdue > 0 ? <StatusBadge tone="warning">{progress.overdue} overdue</StatusBadge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[employee.designation?.title, employee.department?.name].filter(Boolean).join(" · ")}
            {process.template ? ` · ${process.template.name}` : " · Custom onboarding"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {employee.hrManager ? `HR: ${employee.hrManager.name}` : ""}
            {employee.reportingManager ? ` · Manager: ${employee.reportingManager.firstName} ${employee.reportingManager.lastName}` : ""}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-sm md:w-80">
          {[
            { icon: CalendarDays, label: "Joins", value: formatDate(employee.joiningDate) },
            { icon: Flag, label: "Target", value: formatDate(process.targetDate) },
            {
              icon: CalendarCheck2,
              label: process.status === "CANCELLED" ? "Cancelled" : "Completed",
              value: process.status === "CANCELLED" ? formatDay(process.cancelledAt) : formatDay(process.completedAt),
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5" aria-hidden="true" /> {label}
              </dt>
              <dd className="mt-0.5 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {process.steps.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No tasks yet"
          description={canAddTasks ? "This onboarding was started without a template. Add its tasks by hand." : "HR hasn't added any tasks yet."}
        />
      ) : (
        <ProcessSteps process={process} />
      )}
    </>
  );
}
