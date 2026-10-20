import "server-only";
import { assertCan, employeeScope, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { audit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { ActionError } from "@/lib/utils/action";
import { toCsv } from "@/lib/utils/csv";
import { dateKey, daysBetween, startOfToday } from "@/lib/utils/date";
import { getProgress } from "@/features/onboarding/queries";
import { exportSchema } from "./schemas";
import type { ExportInput } from "./types";

/** Exports are capped so one click can't pull an unbounded amount of data. */
const MAX_EXPORT_ROWS = 10_000;

async function exportEmployees(user: CurrentUser, departmentId?: string) {
  const rows = await prisma.employee.findMany({
    where: { AND: [employeeScope(user), { archivedAt: null }, departmentId ? { departmentId } : {}] },
    orderBy: [{ employeeCode: "asc" }],
    take: MAX_EXPORT_ROWS + 1,
    select: {
      employeeCode: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      roleKey: true,
      joiningDate: true,
      userId: true,
      department: { select: { name: true, hrEmployee: { select: { firstName: true, lastName: true } } } },
      designation: { select: { title: true } },
      hrManager: { select: { name: true } },
      reportingManager: { select: { firstName: true, lastName: true } },
      processes: { where: { status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
    },
  });
  if (rows.length > MAX_EXPORT_ROWS) throw new ActionError("Too many rows to export. Filter by department first.");
  const progress = await getProgress(rows.flatMap((r) => r.processes.map((p) => p.id)));

  return toCsv(rows, [
    { header: "Employee code", value: (r) => r.employeeCode },
    { header: "First name", value: (r) => r.firstName },
    { header: "Last name", value: (r) => r.lastName },
    { header: "Email", value: (r) => r.email },
    { header: "Phone", value: (r) => r.phone },
    { header: "Department", value: (r) => r.department?.name },
    { header: "Designation", value: (r) => r.designation?.title },
    { header: "Role", value: (r) => r.roleKey },
    { header: "Status", value: (r) => r.status },
    { header: "Joining date", value: (r) => r.joiningDate },
    { header: "Registered", value: (r) => (r.userId ? "Yes" : "No") },
    {
      // The department's HR when it has one, otherwise the HR manager who added them.
      header: "HR",
      value: (r) =>
        r.department?.hrEmployee
          ? `${r.department.hrEmployee.firstName} ${r.department.hrEmployee.lastName}`
          : r.hrManager?.name,
    },
    { header: "Reporting manager", value: (r) => (r.reportingManager ? `${r.reportingManager.firstName} ${r.reportingManager.lastName}` : "") },
    { header: "Onboarding status", value: (r) => r.processes[0]?.status ?? "NOT_STARTED" },
    { header: "Onboarding progress %", value: (r) => (r.processes[0] ? progress.get(r.processes[0].id)!.percent : "") },
  ]);
}

async function exportOnboarding(user: CurrentUser, departmentId?: string) {
  const rows = await prisma.onboardingProcess.findMany({
    where: { employee: { AND: [employeeScope(user), departmentId ? { departmentId } : {}] } },
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
    take: MAX_EXPORT_ROWS + 1,
    select: {
      id: true,
      status: true,
      startDate: true,
      targetDate: true,
      completedAt: true,
      cancelledAt: true,
      template: { select: { name: true } },
      employee: {
        select: {
          employeeCode: true,
          firstName: true,
          lastName: true,
          joiningDate: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
        },
      },
    },
  });
  if (rows.length > MAX_EXPORT_ROWS) throw new ActionError("Too many rows to export. Filter by department first.");
  const progress = await getProgress(rows.map((r) => r.id));
  const today = startOfToday();

  return toCsv(rows, [
    { header: "Employee code", value: (r) => r.employee.employeeCode },
    { header: "Employee", value: (r) => `${r.employee.firstName} ${r.employee.lastName}` },
    { header: "Department", value: (r) => r.employee.department?.name },
    { header: "Designation", value: (r) => r.employee.designation?.title },
    { header: "Joining date", value: (r) => r.employee.joiningDate },
    { header: "Template", value: (r) => r.template?.name },
    { header: "Status", value: (r) => r.status },
    { header: "Started", value: (r) => r.startDate },
    { header: "Target", value: (r) => r.targetDate },
    { header: "Completed", value: (r) => (r.completedAt ? startOfToday(r.completedAt) : null) },
    { header: "Tasks done", value: (r) => progress.get(r.id)!.done },
    { header: "Tasks total", value: (r) => progress.get(r.id)!.total },
    { header: "Progress %", value: (r) => progress.get(r.id)!.percent },
    { header: "Overdue tasks", value: (r) => (r.status === "IN_PROGRESS" ? progress.get(r.id)!.overdue : 0) },
    {
      header: "Days taken",
      value: (r) => (r.status === "CANCELLED" ? "" : daysBetween(r.startDate, r.completedAt ?? today)),
    },
  ]);
}

/** Builds a CSV of one report, limited to the user's space. Every export is audited. */
export async function exportReport(user: CurrentUser, raw: ExportInput) {
  assertCan(user, PERMISSIONS.REPORT_EXPORT);
  const input = exportSchema.parse(raw);
  const csv =
    input.kind === "employees"
      ? await exportEmployees(user, input.departmentId)
      : await exportOnboarding(user, input.departmentId);

  await audit(prisma, {
    actorId: user.id,
    action: "report.export",
    entityType: "Report",
    entityId: input.kind,
    metadata: input.departmentId ? { departmentId: input.departmentId } : undefined,
  });
  return { filename: `embark-${input.kind}-${dateKey(startOfToday())}.csv`, csv };
}
