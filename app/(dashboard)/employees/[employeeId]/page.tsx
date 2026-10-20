import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileText, Hash, Mail, Phone, Rocket, Route, Upload, UserRound, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { getDocumentChecklist } from "@/features/documents/queries";
import { EmployeeActions } from "@/features/employees/components/employee-actions";
import { getEmployee } from "@/features/employees/queries";
import { ProgressBar } from "@/features/onboarding/components/progress-bar";
import { getProgress } from "@/features/onboarding/queries";
import { can, isHrViewer, requirePageAccess } from "@/lib/auth/rbac";
import { DOCUMENT_STATUS } from "@/lib/constants/document-status";
import { EMPLOYEE_STATUS, PROCESS_STATUS } from "@/lib/constants/employee-status";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate, formatDateTime, initials, formatDay } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Employee profile" };

function Detail({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-ink" aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-semibold break-words">{children}</dd>
      </div>
    </div>
  );
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ employeeId: string }> }) {
  const user = await requirePageAccess(PERMISSIONS.EMPLOYEE_READ);
  const { employeeId } = await params;
  const employee = await getEmployee(user, employeeId);
  if (!employee) notFound();

  const hr = isHrViewer(user);
  const isSelf = employee.id === user.employeeId;
  const canDocs = can(user, PERMISSIONS.DOCUMENT_READ);
  const [progress, checklist] = await Promise.all([
    getProgress(employee.processes.map((p) => p.id)),
    canDocs ? getDocumentChecklist(user, employee.id) : null,
  ]);
  const active = employee.processes.find((p) => p.status === "IN_PROGRESS" || p.status === "NOT_STARTED");
  const canStart = can(user, PERMISSIONS.ONBOARDING_MANAGE) && !active && !employee.archivedAt;
  const name = `${employee.firstName} ${employee.lastName}`;
  const status = EMPLOYEE_STATUS[employee.status];

  return (
    <>
      <PageHeader
        title={isSelf ? "My profile" : name}
        back={hr ? { href: "/employees", label: "Employees" } : isSelf ? undefined : { href: "/employees", label: "My team" }}
        actions={
          <EmployeeActions
            id={employee.id}
            name={employee.firstName}
            isArchived={Boolean(employee.archivedAt)}
            canEdit={employee.canEdit}
            canArchive={employee.canArchive}
            canResend={hr && can(user, PERMISSIONS.EMPLOYEE_INVITE) && !employee.isRegistered}
          />
        }
      />

      <section className="mb-5 flex flex-col gap-5 rounded-[1.75rem] bg-card p-6 shadow-card sm:flex-row sm:items-center">
        <Avatar className="size-20">
          <AvatarFallback className="bg-sky text-2xl font-bold text-info-ink">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {employee.archivedAt ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
          </div>
          <p className="mt-1 text-muted-foreground">
            {[employee.designation?.title, employee.department?.name].filter(Boolean).join(" · ") || "No department yet"}
          </p>
          <p className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-accent px-2.5 py-1 font-semibold text-accent-foreground">{employee.role.name}</span>
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono">{employee.employeeCode}</span>
            {hr ? (
              employee.isRegistered ? (
                <span className="rounded-full bg-success-soft px-2.5 py-1 font-semibold text-success-ink">Has a login</span>
              ) : (
                <span className="rounded-full bg-pending-soft px-2.5 py-1 font-semibold text-pending-ink">Invited, no login yet</span>
              )
            ) : null}
          </p>
        </div>
        {active ? (
          <div className="w-full sm:w-64">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Onboarding</p>
            <ProgressBar percent={progress.get(active.id)!.percent} overdue={progress.get(active.id)!.overdue} />
          </div>
        ) : null}
      </section>

      <Tabs defaultValue="overview">
        <TabsList className="mb-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          {checklist ? <TabsTrigger value="documents">Documents</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="overview" className="grid gap-5 lg:grid-cols-2">
          <DashboardCard title="Details">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail icon={Mail} label="Work email">{employee.email}</Detail>
              <Detail icon={Phone} label="Phone">{employee.phone ?? "—"}</Detail>
              <Detail icon={CalendarDays} label="Joining date">{formatDate(employee.joiningDate)}</Detail>
              <Detail icon={Hash} label="Employee code">{employee.employeeCode}</Detail>
            </dl>
          </DashboardCard>
          <DashboardCard title="Team">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail icon={UserRound} label="HR">
                {employee.hr ? `${employee.hr.name}${employee.hr.isRegistered ? "" : " (not registered yet)"}` : "Not assigned"}
              </Detail>
              <Detail icon={Users} label="Reporting manager">
                {employee.reportingManager ? (
                  <Link href={`/employees/${employee.reportingManager.id}`} className="hover:underline">
                    {employee.reportingManager.firstName} {employee.reportingManager.lastName}
                  </Link>
                ) : (
                  "Not assigned"
                )}
              </Detail>
            </dl>
            {employee.directReports.length ? (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Direct reports</p>
                <ul className="flex flex-wrap gap-2">
                  {employee.directReports.map((r) => (
                    <li key={r.id}>
                      <Link href={`/employees/${r.id}`} className="inline-flex rounded-full bg-muted px-3 py-1 text-sm font-medium hover:bg-accent">
                        {r.firstName} {r.lastName}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {hr && employee.account ? (
              <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
                Login created {formatDateTime(employee.account.createdAt)}
                {employee.account.isActive ? "" : " · deactivated"}
              </p>
            ) : null}
          </DashboardCard>
        </TabsContent>

        <TabsContent value="onboarding">
          {employee.processes.length === 0 ? (
            <EmptyState
              icon={Route}
              title="Onboarding hasn't started"
              description={canStart ? "Start from a template and their tasks are assigned automatically." : "HR will start it soon."}
              action={
                canStart ? (
                  <Button asChild size="lg" className="rounded-full">
                    <Link href={`/onboarding/new?employeeId=${employee.id}`}>
                      <Rocket /> Start onboarding
                    </Link>
                  </Button>
                ) : null
              }
            />
          ) : (
            <DashboardCard
              title="Onboarding history"
              action={
                canStart ? (
                  <Button asChild size="sm" className="rounded-full">
                    <Link href={`/onboarding/new?employeeId=${employee.id}`}>
                      <Rocket /> Start again
                    </Link>
                  </Button>
                ) : undefined
              }
            >
              <ul className="flex flex-col gap-2">
                {employee.processes.map((p) => {
                  const pr = progress.get(p.id)!;
                  return (
                    <li key={p.id}>
                      <Link href={`/onboarding/${p.id}`} className="grid items-center gap-3 rounded-2xl p-3.5 hover:bg-muted/70 sm:grid-cols-[1fr_1.4fr_auto]">
                        <span>
                          <span className="block text-sm font-semibold">Started {formatDate(p.startDate)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {p.completedAt ? `Completed ${formatDay(p.completedAt)}` : p.targetDate ? `Target ${formatDate(p.targetDate)}` : ""}
                          </span>
                        </span>
                        <ProgressBar percent={pr.percent} overdue={p.status === "IN_PROGRESS" ? pr.overdue : 0} />
                        <StatusBadge tone={PROCESS_STATUS[p.status].tone}>{PROCESS_STATUS[p.status].label}</StatusBadge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </DashboardCard>
          )}
        </TabsContent>

        {checklist ? (
          <TabsContent value="documents">
            <DashboardCard
              title="Required documents"
              action={
                can(user, PERMISSIONS.DOCUMENT_UPLOAD) && !employee.archivedAt ? (
                  <Button asChild size="sm" className="rounded-full">
                    <Link href={`/documents/upload?employeeId=${employee.id}`}>
                      <Upload /> Upload
                    </Link>
                  </Button>
                ) : undefined
              }
            >
              <ul className="flex flex-col divide-y">
                {checklist.items.map((item) => {
                  const s = item.status === "MISSING" ? { label: "Missing", tone: "neutral" as const } : DOCUMENT_STATUS[item.status];
                  return (
                    <li key={item.documentType.id} className="flex items-center gap-3 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-ink" aria-hidden="true">
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{item.documentType.name}</span>
                        {item.document ? (
                          <Link href={`/documents/${item.document.id}`} className="block truncate text-xs text-muted-foreground hover:underline">
                            {item.document.fileName}
                            {item.document.expiryDate ? ` · expires ${formatDate(item.document.expiryDate)}` : ""}
                          </Link>
                        ) : (
                          <span className="block text-xs text-muted-foreground">Not uploaded yet</span>
                        )}
                      </span>
                      <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                    </li>
                  );
                })}
              </ul>
            </DashboardCard>
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}
