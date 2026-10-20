import Link from "next/link";
import { CalendarHeart, Download, FileCheck2, Rocket, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { HighlightCard } from "@/components/shared/highlight-card";
import { AddTile, QuickActionTile } from "@/components/shared/quick-action-tile";
import { RingStatCard } from "@/components/shared/ring-stat-card";
import { ReviewQueueCard } from "@/features/documents/components/review-queue-card";
import { listDocuments } from "@/features/documents/queries";
import { NotificationsCard } from "@/features/notifications/components/notifications-card";
import { listNotifications } from "@/features/notifications/queries";
import { OnboardingCard } from "@/features/onboarding/components/onboarding-card";
import { listEmployeesReadyForOnboarding, listProcesses } from "@/features/onboarding/queries";
import { can, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { addDays, startOfToday } from "@/lib/utils/date";
import { formatDate, formatRelativeDay, initials, plural } from "@/lib/utils/format";
import { getHrDashboard, getWeekAgenda } from "../queries";
import { Greeting } from "./greeting";
import { WeekAgenda } from "./week-agenda";

/** HR's dashboard: what needs doing across their space today. */
export async function HrDashboard({ user }: { user: CurrentUser }) {
  const canStart = can(user, PERMISSIONS.ONBOARDING_MANAGE);
  const [stats, agenda, notifications, reviews, processes, readyToStart] = await Promise.all([
    getHrDashboard(user),
    getWeekAgenda(user),
    listNotifications(user, { pageSize: 3 }),
    listDocuments(user, { status: "PENDING", pageSize: 3 }),
    listProcesses(user, { status: "IN_PROGRESS", pageSize: 4 }),
    canStart ? listEmployeesReadyForOnboarding(user) : Promise.resolve([]),
  ]);

  const tasksTotal = stats.tasks.open + stats.tasks.completed;
  const completedPct = tasksTotal ? (stats.tasks.completed / tasksTotal) * 100 : 0;
  const onTrackPct = stats.tasks.open ? ((stats.tasks.open - stats.tasks.overdue) / stats.tasks.open) * 100 : 100;
  const nextJoiner = stats.upcomingJoiners[0];
  // Only recent and upcoming joiners: long-standing staff (HR, managers) never had onboarding and shouldn't count.
  const notStarted = readyToStart.filter((e) => e.joiningDate >= addDays(startOfToday(), -30));

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-12">
      {/* Row 1: hello + shortcuts */}
      <div className="md:col-span-2 lg:col-span-5">
        <Greeting
          name={user.name}
          line="Let's get everyone ready."
          description={`${plural(stats.activeOnboarding, "person is", "people are")} onboarding in your space, with ${plural(stats.tasks.open, "task")} still open.`}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 md:col-span-2 lg:col-span-7 xl:grid-cols-4">
        {can(user, PERMISSIONS.EMPLOYEE_CREATE) ? <AddTile href="/employees/new" label="Add employee" /> : null}
        {canStart ? (
          <QuickActionTile href="/onboarding/new" icon={Rocket} title="Start onboarding" description="From a ready-made template" tone="mint" />
        ) : null}
        <QuickActionTile href="/documents?status=PENDING" icon={FileCheck2} title="Review documents" description={`${stats.documents.pendingReview} waiting for you`} tone="sky" />
        {can(user, PERMISSIONS.REPORT_EXPORT) ? (
          <QuickActionTile href="/reports" icon={Download} title="Reports" description="Progress and CSV exports" tone="sun" />
        ) : null}
      </div>

      {/* Row 2 */}
      <div className="lg:col-span-4">
        <NotificationsCard items={notifications.items} unread={notifications.unread} />
      </div>
      <div className="lg:col-span-4">
        <ReviewQueueCard items={reviews.items} total={reviews.total} />
      </div>
      <div className="md:col-span-2 lg:col-span-4">
        <WeekAgenda
          days={agenda.days.map((d) => ({ ...d, date: d.date.toISOString() }))}
          events={agenda.events.map((e) => ({ ...e, date: e.date.toISOString() }))}
          emptyHint="Nobody joins and nothing is due."
        />
      </div>

      {/* Row 3 */}
      <div className="md:col-span-2 lg:col-span-5">
        <OnboardingCard items={processes.items} total={processes.total} />
      </div>
      <div className="lg:col-span-3">
        {notStarted.length > 0 && canStart ? (
          <HighlightCard
            icon={Rocket}
            eyebrow="Ready to start"
            title={`${plural(notStarted.length, "new hire")} ${notStarted.length === 1 ? "hasn't" : "haven't"} started onboarding`}
            description="Start from a template and their tasks are assigned automatically."
            action={{ href: "/onboarding/new", label: "Start onboarding" }}
            className="h-full"
          />
        ) : (
          <HighlightCard
            icon={CalendarHeart}
            eyebrow="This week"
            title={`${plural(agenda.events.filter((e) => e.kind === "joiner").length, "person joins", "people join")} this week`}
            description="Everyone already has onboarding underway."
            action={{ href: "/onboarding", label: "See onboarding" }}
            className="h-full"
          />
        )}
      </div>
      <div className="flex flex-col gap-5 md:col-span-2 lg:col-span-4">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <RingStatCard
            value={completedPct}
            color="var(--success)"
            eyebrow="Tasks"
            title="Completed"
            detail={`${stats.tasks.completed} of ${tasksTotal} done`}
          />
          <RingStatCard
            value={onTrackPct}
            color={stats.tasks.overdue ? "var(--warning)" : "var(--primary)"}
            eyebrow="Deadlines"
            title="On track"
            detail={stats.tasks.overdue ? `${stats.tasks.overdue} overdue` : "Nothing overdue"}
            action={stats.tasks.overdue ? { href: "/tasks?overdue=true", label: "Check" } : undefined}
          />
        </div>
        <DashboardCard title="Next to join" className="flex-1">
          {nextJoiner ? (
            <div className="flex h-full flex-col">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                {formatDate(nextJoiner.joiningDate)} · {formatRelativeDay(nextJoiner.joiningDate)}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback className="bg-sky font-bold text-info-ink">
                    {initials(`${nextJoiner.firstName} ${nextJoiner.lastName}`)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {nextJoiner.firstName} {nextJoiner.lastName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[nextJoiner.designation?.title, nextJoiner.department?.name].filter(Boolean).join(" · ") || "New hire"}
                  </p>
                </div>
              </div>
              <Button asChild size="lg" className="mt-4 h-10 self-start rounded-full px-5">
                <Link href={`/employees/${nextJoiner.id}`}>View profile</Link>
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserPlus className="size-4" aria-hidden="true" /> Nobody joins in the next 7 days.
            </p>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
