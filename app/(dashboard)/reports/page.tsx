import type { Metadata } from "next";
import { CheckCircle2, Clock, Route, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BarList } from "@/components/shared/bar-list";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { StatTile } from "@/components/shared/stat-tile";
import { ExportButton } from "@/features/reports/components/export-button";
import { OnboardingChart } from "@/features/reports/components/onboarding-chart";
import { PeriodSelect } from "@/features/reports/components/period-select";
import { ReportTabs } from "@/features/reports/components/report-tabs";
import { getHrDashboard, getOnboardingByDepartment, getOnboardingTrends, getTaskBreakdown } from "@/features/reports/queries";
import { can, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ASSIGNEE_TYPE, TASK_STATUS } from "@/lib/constants/task-status";
import { formatDays, plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const user = await requirePageAccess(PERMISSIONS.REPORT_READ);
  const requested = Number((await searchParams).months);
  const months = [3, 6, 12].includes(requested) ? requested : 6;
  const [stats, trends, departments, tasks] = await Promise.all([
    getHrDashboard(user),
    getOnboardingTrends(user, { months }),
    getOnboardingByDepartment(user),
    getTaskBreakdown(user),
  ]);
  const canExport = can(user, PERMISSIONS.REPORT_EXPORT);
  const completedInPeriod = trends.months.reduce((s, m) => s + m.completed, 0);

  return (
    <>
      <PageHeader
        title="Reports"
        description="How onboarding is going across your space."
        actions={canExport ? <ExportButton kind="onboarding" label="Export onboarding CSV" /> : null}
      />
      <ReportTabs />

      <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Route} label="Onboarding now" value={stats.activeOnboarding} detail={`${plural(stats.tasks.open, "open task")}`} />
        <StatTile icon={CheckCircle2} tone="mint" label={`Completed, last ${months} months`} value={completedInPeriod} />
        <StatTile
          icon={Clock}
          tone="sky"
          label="Average time to complete"
          value={trends.duration ? formatDays(trends.duration.averageDays) : "—"}
          detail={trends.duration ? `Median: ${formatDays(trends.duration.medianDays).toLowerCase()}` : "No completed onboarding yet"}
        />
        <StatTile icon={TriangleAlert} tone="sun" label="Overdue tasks" value={stats.tasks.overdue} detail={`${plural(stats.documents.pendingReview, "document")} to review`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <DashboardCard title="Started and completed" action={<PeriodSelect value={months} />}>
          <OnboardingChart months={trends.months} />
        </DashboardCard>
        <DashboardCard title="Progress by department">
          <BarList
            max={100}
            emptyText="No onboarding in progress."
            items={departments
              .filter((d) => d.averageProgress !== null)
              .map((d) => ({
                label: d.department,
                value: d.averageProgress ?? 0,
                display: `${d.averageProgress}%`,
                detail: `${d.active} active · ${d.completed} completed${d.overdueTasks ? ` · ${d.overdueTasks} overdue` : ""}`,
              }))}
          />
        </DashboardCard>
        <DashboardCard title="Tasks in open onboarding">
          <BarList items={tasks.byStatus.map((r) => ({ label: TASK_STATUS[r.status].label, value: r.count }))} emptyText="No tasks yet." />
        </DashboardCard>
        <DashboardCard title="Open tasks by who does them">
          <BarList
            items={tasks.openByAssignee.map((r) => ({
              label: r.assigneeType === "MANUAL" ? "Added by hand" : ASSIGNEE_TYPE[r.assigneeType as keyof typeof ASSIGNEE_TYPE].label,
              value: r.count,
            }))}
            emptyText="No open tasks."
          />
        </DashboardCard>
      </div>
    </>
  );
}
