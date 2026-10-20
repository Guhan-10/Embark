import { beforeEach, describe, expect, it } from "vitest";
import { uploadDocument } from "@/features/documents/service";
import { createEmployee, setDepartmentHr } from "@/features/employees/service";
import { startOnboarding } from "@/features/onboarding/service";
import {
  getHrDashboard,
  getMyDashboard,
  getOnboardingByDepartment,
  getOnboardingTrends,
  getTaskBreakdown,
} from "@/features/reports/queries";
import { exportReport } from "@/features/reports/service";
import { changeTaskStatus } from "@/features/tasks/service";
import { addDays, startOfToday } from "@/lib/utils/date";
import { createPerson, prisma, register, resetData } from "../helpers/db";

const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"));

/**
 * Engineering (HR1): Asha mid-onboarding (1 task done), Bala finished, Chitra joining in 3 days (not started),
 * plus a reporting manager Asha reports to. Design (HR2): Dev mid-onboarding.
 */
async function company() {
  const today = startOfToday();
  const engineering = await prisma.department.findUniqueOrThrow({ where: { name: "Engineering" } });
  const design = await prisma.department.findUniqueOrThrow({ where: { name: "Design" } });
  const { user: hr1, employee: hr1Record } = await createPerson("HR_MANAGER");
  const { user: hr2, employee: hr2Record } = await createPerson("HR_MANAGER");
  await setDepartmentHr(null, engineering.id, hr1Record.id);
  await setDepartmentHr(null, design.id, hr2Record.id);
  const template = await prisma.onboardingTemplate.findFirstOrThrow({ where: { name: "Standard onboarding" } });

  const add = (by: typeof hr1, first: string, joining: Date, extra: Record<string, unknown> = {}) =>
    createEmployee(by, { firstName: first, lastName: "K", email: `${first.toLowerCase()}@example.com`, joiningDate: joining, ...extra });
  const lead = await add(hr1, "Lead", today, { roleKey: "REPORTING_MANAGER" });
  const asha = await add(hr1, "Asha", addDays(today, 60), { reportingManagerId: lead.id });
  const bala = await add(hr1, "Bala", addDays(today, 60));
  await add(hr1, "Chitra", addDays(today, 3));
  const dev = await add(hr2, "Dev", addDays(today, 60));
  const [ashaUser, leadUser] = [await register("asha@example.com"), await register("lead@example.com")];

  const pAsha = await startOnboarding(hr1, { employeeId: asha.id, templateId: template.id });
  const pBala = await startOnboarding(hr1, { employeeId: bala.id, templateId: template.id });
  await startOnboarding(hr2, { employeeId: dev.id, templateId: template.id });

  const handbook = await prisma.onboardingTask.findFirstOrThrow({ where: { processId: pAsha.id, title: "Read the employee handbook" } });
  await changeTaskStatus(ashaUser, handbook.id, { status: "DONE" });
  for (const task of await prisma.onboardingTask.findMany({ where: { processId: pBala.id } })) {
    await changeTaskStatus(hr1, task.id, task.documentTypeId ? { status: "SKIPPED", note: "Paper copy" } : { status: "DONE" });
  }

  const passport = await prisma.documentType.findUniqueOrThrow({ where: { name: "Passport" } });
  await uploadDocument(ashaUser, { name: "passport.pdf", bytes: PDF }, {
    employeeId: asha.id,
    documentTypeId: passport.id,
    expiryDate: addDays(today, 10),
  });

  return { engineering, hr1, hr2, ashaUser, leadUser, asha };
}

beforeEach(resetData);

describe("HR dashboard", () => {
  it("counts only the HR's own space", async () => {
    const { hr1, engineering } = await company();
    const dash = await getHrDashboard(hr1, engineering.id);

    expect(dash.employees).toEqual({ total: 4, preBoarding: 2, onboarding: 1, active: 1 });
    expect(dash.activeOnboarding).toBe(1);
    expect(dash.tasks).toEqual({ open: 11, overdue: 0, completed: 13 });
    expect(dash.documents).toEqual({ pendingReview: 1, expiringIn30Days: 1, expired: 0 });
    expect(dash.upcomingJoiners.map((j) => [j.firstName, j.daysUntil])).toEqual([
      ["Lead", 0],
      ["Chitra", 3],
    ]);

    const everything = await getHrDashboard(hr1);
    expect(everything.activeOnboarding).toBe(1); // Dev (Design) is never counted for HR1
  });

  it("is HR-only", async () => {
    const { ashaUser, leadUser } = await company();
    await expect(getHrDashboard(ashaUser)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getOnboardingByDepartment(leadUser)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("onboarding reports", () => {
  it("breaks progress down by department", async () => {
    const { hr1 } = await company();
    const rows = await getOnboardingByDepartment(hr1);
    expect(rows).toEqual([
      expect.objectContaining({ department: "Engineering", active: 1, completed: 1, averageProgress: 8, overdueTasks: 0 }),
    ]);
  });

  it("shows monthly starts, completions, and how long onboarding took", async () => {
    const { hr1 } = await company();
    const trends = await getOnboardingTrends(hr1, { months: 3 });
    expect(trends.months).toHaveLength(3);
    expect(trends.months.at(-1)).toMatchObject({ started: 2, completed: 1 });
    expect(trends.duration).toEqual({ completed: 1, averageDays: 0, medianDays: 0 });
  });

  it("breaks open tasks down by status and owner", async () => {
    const { hr1 } = await company();
    const breakdown = await getTaskBreakdown(hr1);
    const byStatus = Object.fromEntries(breakdown.byStatus.map((r) => [r.status, r.count]));
    expect(byStatus).toEqual({ TODO: 11, DONE: 1 });
    const byOwner = Object.fromEntries(breakdown.openByAssignee.map((r) => [r.assigneeType, r.count]));
    expect(byOwner).toEqual({ EMPLOYEE: 5, HR_MANAGER: 3, REPORTING_MANAGER: 3 });
  });
});

describe("personal dashboard", () => {
  it("shows a new hire their own onboarding, tasks, and documents", async () => {
    const { ashaUser } = await company();
    const dash = await getMyDashboard(ashaUser);
    expect(dash.onboarding?.progress).toMatchObject({ done: 1, total: 12 });
    expect(dash.tasks.open).toBe(5);
    expect(dash.tasks.next).toHaveLength(5);
    expect(dash.documents).toEqual({ pending: 1, rejected: 0, expired: 0 });
    expect(dash.directReports).toEqual([]);
  });

  it("shows reporting managers their direct reports' progress", async () => {
    const { leadUser } = await company();
    const dash = await getMyDashboard(leadUser);
    expect(dash.directReports).toEqual([
      expect.objectContaining({ name: "Asha K", onboarding: expect.objectContaining({ progress: expect.objectContaining({ percent: 8 }) }) }),
    ]);
    expect(dash.tasks.open).toBe(3);
  });
});

describe("CSV export", () => {
  it("exports the HR's space only, and records the export", async () => {
    const { hr1 } = await company();
    const { filename, csv } = await exportReport(hr1, { kind: "employees" });
    expect(filename).toMatch(/^embark-employees-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain("asha@example.com");
    expect(csv).not.toContain("dev@example.com");
    expect(csv.split("\r\n")[0]).toContain("Onboarding progress %");

    const onboarding = await exportReport(hr1, { kind: "onboarding" });
    const lines = onboarding.csv.trim().split("\r\n");
    expect(lines).toHaveLength(3); // header + Asha + Bala
    expect(onboarding.csv).toContain("COMPLETED");
    expect(await prisma.auditLog.count({ where: { action: "report.export", actorId: hr1.id } })).toBe(2);
  });

  it("neutralises formula-like names and is HR-only", async () => {
    const { hr1, leadUser } = await company();
    await createEmployee(hr1, { firstName: "=HYPERLINK(\"http://evil\")", lastName: "X", email: "evil@example.com", joiningDate: "2026-12-01" });
    const { csv } = await exportReport(hr1, { kind: "employees" });
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    await expect(exportReport(leadUser, { kind: "employees" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
