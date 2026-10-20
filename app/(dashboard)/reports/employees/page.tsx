import type { Metadata } from "next";
import { Clock, UserCheck, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BarList } from "@/components/shared/bar-list";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { StatTile } from "@/components/shared/stat-tile";
import { ExportButton } from "@/features/reports/components/export-button";
import { ReportTabs } from "@/features/reports/components/report-tabs";
import { getEmployeesByDepartment, getHrDashboard } from "@/features/reports/queries";
import { can, requirePageAccess } from "@/lib/auth/rbac";
import { EMPLOYEE_STATUS } from "@/lib/constants/employee-status";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatShortDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Employee report" };

export default async function EmployeeReportPage() {
  const user = await requirePageAccess(PERMISSIONS.REPORT_READ);
  const [stats, byDepartment] = await Promise.all([getHrDashboard(user), getEmployeesByDepartment(user)]);

  return (
    <>
      <PageHeader
        title="Employee report"
        description="Everyone in your space, by status and department."
        actions={can(user, PERMISSIONS.REPORT_EXPORT) ? <ExportButton kind="employees" label="Export CSV" /> : null}
      />
      <ReportTabs />
      <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Users} label="Employees" value={stats.employees.total} />
        <StatTile icon={UserPlus} tone="sun" label={EMPLOYEE_STATUS.PRE_BOARDING.label} value={stats.employees.preBoarding} detail="Added, onboarding not started" />
        <StatTile icon={Clock} tone="sky" label={EMPLOYEE_STATUS.ONBOARDING.label} value={stats.employees.onboarding} />
        <StatTile icon={UserCheck} tone="mint" label={EMPLOYEE_STATUS.ACTIVE.label} value={stats.employees.active} detail="Onboarding finished" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <DashboardCard title="People by department">
          <BarList
            items={byDepartment.map((d) => ({
              label: d.department,
              value: d.total,
              detail: Object.entries(d.byStatus)
                .map(([status, n]) => `${n} ${EMPLOYEE_STATUS[status as keyof typeof EMPLOYEE_STATUS].label.toLowerCase()}`)
                .join(" · "),
            }))}
            emptyText="No employees yet."
          />
        </DashboardCard>
        <DashboardCard title="Joining in the next 7 days">
          {stats.upcomingJoiners.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nobody joins in the next 7 days.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {stats.upcomingJoiners.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="block font-semibold">
                      {j.firstName} {j.lastName}
                    </span>
                    <span className="block text-xs text-muted-foreground">{[j.designation?.title, j.department?.name].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {formatShortDate(j.joiningDate)}
                    <span className="block font-semibold text-foreground">{j.daysUntil === 0 ? "Today" : `In ${j.daysUntil} days`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </>
  );
}
