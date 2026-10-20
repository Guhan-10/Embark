import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { assertCan, employeeScope, hasRole, isHrViewer, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { ROLES } from "@/lib/constants/roles";
import { CLOSED_TASK_STATUSES, isTaskOverdue } from "@/lib/constants/task-status";
import { prisma } from "@/lib/db/prisma";
import { addDays, dateKey, daysBetween, startOfToday } from "@/lib/utils/date";
import { getProgress } from "@/features/onboarding/queries";
import { reportRangeSchema } from "./schemas";
import type { ReportRange } from "./types";

// HR reports. Everything is limited to the viewer's space via employeeScope:
// HR Admins see the whole company, HR Managers only their own space.

const ACTIVE = ["NOT_STARTED", "IN_PROGRESS"] as const;

function inScope(user: CurrentUser, departmentId?: string): Prisma.EmployeeWhereInput {
  return { AND: [employeeScope(user), departmentId ? { departmentId } : {}] };
}

/** Headline numbers for the HR dashboard. */
export async function getHrDashboard(user: CurrentUser, departmentId?: string) {
  assertCan(user, PERMISSIONS.REPORT_READ);
  const employees = inScope(user, departmentId);
  const today = startOfToday();
  const openTask = {
    status: { notIn: CLOSED_TASK_STATUSES },
    process: { status: { in: [...ACTIVE] }, employee: employees },
  } satisfies Prisma.OnboardingTaskWhereInput;
  const liveDoc = { deletedAt: null, employee: employees } satisfies Prisma.DocumentWhereInput;

  const [
    byStatus,
    activeOnboarding,
    openTasks,
    overdueTasks,
    completedTasks,
    pendingDocuments,
    expiringDocuments,
    expiredDocuments,
    upcomingJoiners,
  ] = await Promise.all([
    prisma.employee.groupBy({ by: ["status"], where: { AND: [employees, { archivedAt: null }] }, _count: { _all: true } }),
    prisma.onboardingProcess.count({ where: { status: { in: [...ACTIVE] }, employee: employees } }),
    prisma.onboardingTask.count({ where: openTask }),
    prisma.onboardingTask.count({ where: { ...openTask, dueDate: { lt: today } } }),
    prisma.onboardingTask.count({
      where: { status: { in: CLOSED_TASK_STATUSES }, process: { status: { not: "CANCELLED" }, employee: employees } },
    }),
    prisma.document.count({ where: { ...liveDoc, status: "PENDING" } }),
    prisma.document.count({
      where: { ...liveDoc, status: { in: ["PENDING", "APPROVED"] }, expiryDate: { gte: today, lte: addDays(today, 30) } },
    }),
    prisma.document.count({ where: { ...liveDoc, status: "EXPIRED" } }),
    prisma.employee.findMany({
      where: { AND: [employees, { archivedAt: null, joiningDate: { gte: today, lte: addDays(today, 7) } }] },
      orderBy: { joiningDate: "asc" },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        joiningDate: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
    }),
  ]);

  const count = (status: string) => byStatus.find((s) => s.status === status)?._count._all ?? 0;
  return {
    employees: {
      total: byStatus.reduce((sum, s) => sum + s._count._all, 0),
      preBoarding: count("PRE_BOARDING"),
      onboarding: count("ONBOARDING"),
      active: count("ACTIVE"),
    },
    activeOnboarding,
    tasks: { open: openTasks, overdue: overdueTasks, completed: completedTasks },
    documents: { pendingReview: pendingDocuments, expiringIn30Days: expiringDocuments, expired: expiredDocuments },
    upcomingJoiners: upcomingJoiners.map((e) => ({ ...e, daysUntil: daysBetween(today, e.joiningDate) })),
  };
}

/** Onboarding progress per department: active, completed, average progress of active ones, overdue tasks. */
export async function getOnboardingByDepartment(user: CurrentUser) {
  assertCan(user, PERMISSIONS.REPORT_READ);
  const processes = await prisma.onboardingProcess.findMany({
    where: { status: { in: [...ACTIVE, "COMPLETED"] }, employee: employeeScope(user) },
    select: { id: true, status: true, employee: { select: { department: { select: { id: true, name: true } } } } },
  });
  const progress = await getProgress(processes.filter((p) => p.status !== "COMPLETED").map((p) => p.id));

  type Row = { departmentId: string | null; department: string; active: number; completed: number; overdueTasks: number; percents: number[] };
  const rows = new Map<string, Row>();
  for (const p of processes) {
    const dept = p.employee.department;
    const key = dept?.id ?? "none";
    const row = rows.get(key) ?? { departmentId: dept?.id ?? null, department: dept?.name ?? "No department", active: 0, completed: 0, overdueTasks: 0, percents: [] };
    if (p.status === "COMPLETED") {
      row.completed++;
    } else {
      const pr = progress.get(p.id)!;
      row.active++;
      row.overdueTasks += pr.overdue;
      row.percents.push(pr.percent);
    }
    rows.set(key, row);
  }

  return [...rows.values()]
    .map(({ percents, ...row }) => ({
      ...row,
      averageProgress: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null,
    }))
    .sort((a, b) => a.department.localeCompare(b.department));
}

/** Monthly onboarding starts and completions, plus how long completed onboarding took on average. */
export async function getOnboardingTrends(user: CurrentUser, rawRange: ReportRange = {}) {
  assertCan(user, PERMISSIONS.REPORT_READ);
  const { months, departmentId } = reportRangeSchema.parse(rawRange);
  const today = startOfToday();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1), 1));

  const processes = await prisma.onboardingProcess.findMany({
    where: {
      employee: inScope(user, departmentId),
      status: { not: "CANCELLED" },
      OR: [{ startDate: { gte: from } }, { completedAt: { gte: from } }],
    },
    select: { startDate: true, completedAt: true, status: true },
  });

  const monthKey = (d: Date) => dateKey(d).slice(0, 7);
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    return { month: monthKey(d), started: 0, completed: 0 };
  });
  const byMonth = new Map(buckets.map((b) => [b.month, b]));

  const durations: number[] = [];
  for (const p of processes) {
    const started = byMonth.get(monthKey(p.startDate));
    if (started) started.started++;
    if (p.status === "COMPLETED" && p.completedAt && p.completedAt >= from) {
      const done = byMonth.get(monthKey(startOfToday(p.completedAt)));
      if (done) done.completed++;
      durations.push(Math.max(0, daysBetween(p.startDate, p.completedAt)));
    }
  }

  const sorted = [...durations].sort((a, b) => a - b);
  return {
    months: buckets,
    duration: durations.length
      ? {
          completed: durations.length,
          averageDays: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          medianDays: sorted[Math.floor(sorted.length / 2)],
        }
      : null,
  };
}

/** Task counts by status and by who does them, for open onboarding. */
export async function getTaskBreakdown(user: CurrentUser, departmentId?: string) {
  assertCan(user, PERMISSIONS.REPORT_READ);
  const where = { process: { status: { in: [...ACTIVE] }, employee: inScope(user, departmentId) } } satisfies Prisma.OnboardingTaskWhereInput;
  const [byStatus, byAssignee] = await Promise.all([
    prisma.onboardingTask.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.onboardingTask.groupBy({
      by: ["assigneeType"],
      where: { ...where, status: { notIn: CLOSED_TASK_STATUSES } },
      _count: { _all: true },
    }),
  ]);
  return {
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    openByAssignee: byAssignee.map((r) => ({ assigneeType: r.assigneeType ?? "MANUAL", count: r._count._all })),
  };
}

/**
 * The dashboard for people without report access: their own onboarding, tasks, and documents,
 * and — for reporting managers — how their direct reports are getting on.
 */
export async function getMyDashboard(user: CurrentUser) {
  const today = startOfToday();
  const myOpenTasks = { assignments: { some: { userId: user.id } }, status: { notIn: CLOSED_TASK_STATUSES }, process: { status: { in: [...ACTIVE] } } } satisfies Prisma.OnboardingTaskWhereInput;

  const [process, openTasks, nextTasks, documents, reports] = await Promise.all([
    user.employeeId
      ? prisma.onboardingProcess.findFirst({
          where: { employeeId: user.employeeId, status: { not: "CANCELLED" } },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, targetDate: true },
        })
      : null,
    prisma.onboardingTask.count({ where: myOpenTasks }),
    prisma.onboardingTask.findMany({
      where: myOpenTasks,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: 5,
      select: { id: true, title: true, status: true, priority: true, dueDate: true },
    }),
    user.employeeId
      ? prisma.document.groupBy({
          by: ["status"],
          where: { employeeId: user.employeeId, deletedAt: null },
          _count: { _all: true },
        })
      : [],
    hasRole(user, ROLES.REPORTING_MANAGER)
      ? prisma.employee.findMany({
          where: { reportingManager: { userId: user.id }, archivedAt: null },
          orderBy: { firstName: "asc" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            processes: {
              where: { status: { not: "CANCELLED" } },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, status: true },
            },
          },
        })
      : [],
  ]);

  const ids = [process?.id, ...reports.map((r) => r.processes[0]?.id)].filter((id): id is string => Boolean(id));
  const progress = await getProgress(ids);
  const docCount = (status: string) => documents.find((d) => d.status === status)?._count._all ?? 0;

  return {
    onboarding: process ? { ...process, progress: progress.get(process.id)! } : null,
    tasks: {
      open: openTasks,
      overdue: nextTasks.length ? await prisma.onboardingTask.count({ where: { ...myOpenTasks, dueDate: { lt: today } } }) : 0,
      next: nextTasks.map((t) => ({ ...t, isOverdue: isTaskOverdue(t) })),
    },
    documents: { pending: docCount("PENDING"), rejected: docCount("REJECTED"), expired: docCount("EXPIRED") },
    directReports: reports.map((r) => ({
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      onboarding: r.processes[0] ? { ...r.processes[0], progress: progress.get(r.processes[0].id)! } : null,
    })),
  };
}

/**
 * This week (Monday–Sunday) at a glance: for HR, who joins and which onboarding tasks fall due in their
 * space; for everyone else, the tasks assigned to them that fall due.
 */
export async function getWeekAgenda(user: CurrentUser, now = new Date()) {
  const today = startOfToday(now);
  const weekStart = addDays(today, -((today.getUTCDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 6);
  const hr = isHrViewer(user);

  const [joiners, tasks] = await Promise.all([
    hr
      ? prisma.employee.findMany({
          where: { AND: [employeeScope(user), { archivedAt: null, joiningDate: { gte: weekStart, lte: weekEnd } }] },
          orderBy: { joiningDate: "asc" },
          select: { id: true, firstName: true, lastName: true, joiningDate: true, designation: { select: { title: true } } },
        })
      : [],
    prisma.onboardingTask.findMany({
      where: {
        AND: [
          hr ? { process: { employee: employeeScope(user) } } : { assignments: { some: { userId: user.id } } },
          { status: { notIn: CLOSED_TASK_STATUSES }, dueDate: { gte: weekStart, lte: weekEnd }, process: { status: "IN_PROGRESS" } },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 40,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        process: { select: { employee: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);

  const events = [
    ...joiners.map((e) => ({
      id: `join-${e.id}`,
      kind: "joiner" as const,
      date: e.joiningDate,
      title: `${e.firstName} ${e.lastName} joins`,
      subtitle: e.designation?.title ?? "New hire",
      href: `/employees/${e.id}`,
    })),
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      kind: "task" as const,
      date: t.dueDate!,
      title: t.title,
      subtitle: hr ? `${t.process.employee.firstName} ${t.process.employee.lastName}` : "Due",
      href: `/tasks/${t.id}`,
      priority: t.priority,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === "joiner" ? -1 : 1));

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const key = dateKey(date);
    return {
      date,
      isToday: key === dateKey(today),
      isPast: date < today,
      joiners: events.filter((e) => e.kind === "joiner" && dateKey(e.date) === key).length,
      tasks: events.filter((e) => e.kind === "task" && dateKey(e.date) === key).length,
    };
  });

  return { weekStart, weekEnd, days, events };
}

/** Head count per department (and status), for the employee report. */
export async function getEmployeesByDepartment(user: CurrentUser) {
  assertCan(user, PERMISSIONS.REPORT_READ);
  const rows = await prisma.employee.groupBy({
    by: ["departmentId", "status"],
    where: { AND: [employeeScope(user), { archivedAt: null }] },
    _count: { _all: true },
  });
  const departments = await prisma.department.findMany({
    where: { id: { in: rows.map((r) => r.departmentId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, name: true },
  });
  const name = new Map(departments.map((d) => [d.id, d.name]));
  const byDept = new Map<string, { department: string; total: number; byStatus: Record<string, number> }>();
  for (const r of rows) {
    const key = r.departmentId ?? "none";
    const entry = byDept.get(key) ?? { department: r.departmentId ? (name.get(r.departmentId) ?? "Unknown") : "No department", total: 0, byStatus: {} };
    entry.total += r._count._all;
    entry.byStatus[r.status] = (entry.byStatus[r.status] ?? 0) + r._count._all;
    byDept.set(key, entry);
  }
  return [...byDept.values()].sort((a, b) => b.total - a.total);
}
