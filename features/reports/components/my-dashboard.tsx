import Link from "next/link";
import { ClipboardCheck, FileUp, ListChecks, Route, Sparkles, UserRound, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { HighlightCard } from "@/components/shared/highlight-card";
import { ProgressRing } from "@/components/shared/progress-ring";
import { QuickActionTile } from "@/components/shared/quick-action-tile";
import { RingStatCard } from "@/components/shared/ring-stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getDocumentChecklist } from "@/features/documents/queries";
import { getEmployee } from "@/features/employees/queries";
import { NotificationsCard } from "@/features/notifications/components/notifications-card";
import { listNotifications } from "@/features/notifications/queries";
import { ProgressBar } from "@/features/onboarding/components/progress-bar";
import { listTeamProgress } from "@/features/onboarding/queries";
import { can, hasRole, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ROLES } from "@/lib/constants/roles";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/constants/task-status";
import { cn } from "@/lib/utils/cn";
import { formatRelativeDay, initials, plural } from "@/lib/utils/format";
import { getMyDashboard, getWeekAgenda } from "../queries";
import { Greeting } from "./greeting";
import { WeekAgenda } from "./week-agenda";

/** The dashboard for new hires and reporting managers: their own onboarding first, then their team. */
export async function MyDashboard({ user }: { user: CurrentUser }) {
  const isManager = hasRole(user, ROLES.REPORTING_MANAGER);
  const canDocs = can(user, PERMISSIONS.DOCUMENT_READ);
  const [mine, agenda, notifications, team, me, checklist] = await Promise.all([
    getMyDashboard(user),
    getWeekAgenda(user),
    listNotifications(user, { pageSize: 3 }),
    listTeamProgress(user, { pageSize: 6 }),
    user.employeeId ? getEmployee(user, user.employeeId) : null,
    user.employeeId && canDocs ? getDocumentChecklist(user, user.employeeId) : null,
  ]);

  const progress = mine.onboarding?.progress;
  const colleagues = team.items.filter((c) => !c.isMe && c.onboarding);
  const docsApproved = checklist?.items.filter((i) => i.status === "APPROVED").length ?? 0;
  const docsRequired = checklist?.items.length ?? 0;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-12">
      {/* Row 1 */}
      <div className="md:col-span-2 lg:col-span-5">
        <Greeting
          name={user.name}
          line={progress && progress.percent === 100 ? "You're all set." : "Ready for your first days?"}
          description={
            mine.tasks.open
              ? `You have ${plural(mine.tasks.open, "task")} to do${mine.tasks.overdue ? `, ${mine.tasks.overdue} overdue` : ""}.`
              : "Nothing on your list right now."
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-4 md:col-span-2 lg:col-span-7 xl:grid-cols-3">
        <QuickActionTile href="/tasks/assigned-to-me" icon={ListChecks} title="My tasks" description={`${mine.tasks.open} open`} tone="sky" />
        {can(user, PERMISSIONS.DOCUMENT_UPLOAD) ? (
          <QuickActionTile href="/documents/upload" icon={FileUp} title="Upload a document" description="ID, certificates, forms" tone="mint" />
        ) : null}
        {isManager ? (
          <QuickActionTile href="/employees" icon={Users} title="My team" description={plural(mine.directReports.length, "direct report")} tone="sun" />
        ) : mine.onboarding ? (
          <QuickActionTile href={`/onboarding/${mine.onboarding.id}`} icon={Route} title="My onboarding" description={`${progress?.percent ?? 0}% complete`} tone="sun" />
        ) : null}
      </div>

      {/* Row 2 */}
      <div className="lg:col-span-4">
        <NotificationsCard items={notifications.items} unread={notifications.unread} />
      </div>
      <div className="lg:col-span-4">
        <DashboardCard title="Up next" action={{ href: "/tasks/assigned-to-me", label: "All tasks" }} className="h-full">
          {mine.tasks.next.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
              <ClipboardCheck className="mb-2 size-6" aria-hidden="true" />
              No open tasks. Nice work.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {mine.tasks.next.map((t, i) => (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className={cn(
                      "block rounded-2xl p-3.5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                      i === 0 ? "bg-card shadow-raised ring-1 ring-border" : "hover:bg-muted/70",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold">{t.title}</span>
                      {t.isOverdue ? (
                        <StatusBadge tone="warning">Overdue</StatusBadge>
                      ) : (
                        <StatusBadge tone={TASK_PRIORITY[t.priority].tone}>{TASK_PRIORITY[t.priority].label}</StatusBadge>
                      )}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge tone={TASK_STATUS[t.status].tone} className="px-2 py-0 text-[11px]">
                        {TASK_STATUS[t.status].label}
                      </StatusBadge>
                      Due {formatRelativeDay(t.dueDate).toLowerCase()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
      <div className="md:col-span-2 lg:col-span-4">
        <WeekAgenda
          days={agenda.days.map((d) => ({ ...d, date: d.date.toISOString() }))}
          events={agenda.events.map((e) => ({ ...e, date: e.date.toISOString() }))}
          emptyHint="Nothing due on this day."
        />
      </div>

      {/* Row 3 */}
      <div className="md:col-span-2 lg:col-span-5">
        {isManager && mine.directReports.length > 0 ? (
          <DashboardCard title="Your direct reports" action={{ href: "/employees", label: "My team" }} className="h-full">
            <ul className="flex flex-col gap-2">
              {mine.directReports.map((r) => (
                <li key={r.id} className="grid grid-cols-[auto_1fr_1.2fr] items-center gap-3 rounded-2xl p-2.5 hover:bg-muted/70">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-sky text-xs font-bold text-info-ink">{initials(r.name)}</AvatarFallback>
                  </Avatar>
                  <Link href={`/employees/${r.id}`} className="truncate text-sm font-semibold hover:underline">
                    {r.name}
                  </Link>
                  {r.onboarding ? (
                    <ProgressBar percent={r.onboarding.progress.percent} overdue={r.onboarding.progress.overdue} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Not started</span>
                  )}
                </li>
              ))}
            </ul>
          </DashboardCard>
        ) : (
          <DashboardCard title="Your team's progress" className="h-full">
            {colleagues.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nobody else in your team is onboarding right now.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {colleagues.map((c) => (
                  <li key={c.id} className="grid grid-cols-[auto_1fr_1.2fr] items-center gap-3 rounded-2xl p-2.5">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-sky text-xs font-bold text-info-ink">{initials(c.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.designation ?? c.department ?? ""}</span>
                    </span>
                    <ProgressBar percent={c.onboarding!.percent} />
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        )}
      </div>
      <div className="lg:col-span-3">
        {mine.onboarding && progress ? (
          <HighlightCard
            icon={Sparkles}
            eyebrow="Your onboarding"
            title={progress.percent === 100 ? "All done. Welcome aboard!" : `${progress.done} of ${progress.total} tasks done`}
            action={{ href: `/onboarding/${mine.onboarding.id}`, label: progress.percent === 100 ? "See summary" : "See what's next" }}
            className="h-full"
          >
            <ProgressRing value={progress.percent} size={92} stroke={8} color="var(--brand-mint)" className="relative mt-4 [&>span]:text-white [&_circle:first-child]:stroke-white/20" />
          </HighlightCard>
        ) : (
          <HighlightCard
            icon={Route}
            eyebrow="Onboarding"
            title="Your onboarding hasn't started yet"
            description="Your HR will start it soon. You'll get an email when it does."
            className="h-full"
          />
        )}
      </div>
      <div className="flex flex-col gap-5 md:col-span-2 lg:col-span-4">
        {checklist ? (
          <RingStatCard
            value={docsRequired ? (docsApproved / docsRequired) * 100 : 100}
            color="var(--success)"
            eyebrow="Documents"
            title="Required documents"
            detail={`${docsApproved} of ${docsRequired} approved`}
            action={docsApproved < docsRequired ? { href: "/documents/upload", label: "Upload" } : undefined}
          />
        ) : null}
        <DashboardCard title="Your contacts" className="flex-1">
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary-ink" aria-hidden="true">
                <UserRound className="size-4" />
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Your HR</span>
                <span className="font-semibold">{me?.hr?.name ?? "Not assigned yet"}</span>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-mint text-success-ink" aria-hidden="true">
                <Users className="size-4" />
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Reporting manager</span>
                <span className="font-semibold">
                  {me?.reportingManager ? `${me.reportingManager.firstName} ${me.reportingManager.lastName}` : "Not assigned yet"}
                </span>
              </span>
            </li>
          </ul>
        </DashboardCard>
      </div>
    </div>
  );
}
