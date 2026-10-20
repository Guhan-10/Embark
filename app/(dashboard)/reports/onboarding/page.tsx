import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { EmptyState } from "@/components/shared/empty-state";
import { TableCard } from "@/components/shared/table-card";
import { ProgressBar } from "@/features/onboarding/components/progress-bar";
import { ExportButton } from "@/features/reports/components/export-button";
import { OnboardingChart } from "@/features/reports/components/onboarding-chart";
import { PeriodSelect } from "@/features/reports/components/period-select";
import { ReportTabs } from "@/features/reports/components/report-tabs";
import { getOnboardingByDepartment, getOnboardingTrends } from "@/features/reports/queries";
import { can, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDays } from "@/lib/utils/format";
import { BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "Onboarding report" };

export default async function OnboardingReportPage({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const user = await requirePageAccess(PERMISSIONS.REPORT_READ);
  const requested = Number((await searchParams).months);
  const months = [3, 6, 12].includes(requested) ? requested : 6;
  const [departments, trends] = await Promise.all([getOnboardingByDepartment(user), getOnboardingTrends(user, { months })]);

  return (
    <>
      <PageHeader
        title="Onboarding report"
        description={trends.duration ? `Onboarding takes ${formatDays(trends.duration.averageDays).toLowerCase()} on average (median: ${formatDays(trends.duration.medianDays).toLowerCase()}).` : undefined}
        actions={can(user, PERMISSIONS.REPORT_EXPORT) ? <ExportButton kind="onboarding" label="Export CSV" /> : null}
      />
      <ReportTabs />
      <div className="flex flex-col gap-5">
        <DashboardCard title="Started and completed" action={<PeriodSelect value={months} />}>
          <OnboardingChart months={trends.months} />
        </DashboardCard>
        {departments.length === 0 ? (
          <EmptyState icon={BarChart3} title="No onboarding yet" description="Department numbers appear once onboarding starts." />
        ) : (
          <TableCard>
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Onboarding by department</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-3.5 pr-3 pl-6 font-semibold">Department</th>
                  <th scope="col" className="px-3 text-right font-semibold">In progress</th>
                  <th scope="col" className="px-3 text-right font-semibold">Completed</th>
                  <th scope="col" className="w-64 px-3 font-semibold">Average progress</th>
                  <th scope="col" className="pr-6 pl-3 text-right font-semibold">Overdue tasks</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.department} className="border-b last:border-0">
                    <th scope="row" className="py-3 pr-3 pl-6 text-left font-semibold">{d.department}</th>
                    <td className="px-3 text-right tabular-nums">{d.active}</td>
                    <td className="px-3 text-right tabular-nums">{d.completed}</td>
                    <td className="px-3">{d.averageProgress === null ? <span className="text-muted-foreground">—</span> : <ProgressBar percent={d.averageProgress} />}</td>
                    <td className={`pr-6 pl-3 text-right tabular-nums ${d.overdueTasks ? "font-semibold text-warning-ink" : ""}`}>{d.overdueTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        )}
      </div>
    </>
  );
}
