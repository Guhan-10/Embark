import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { assertCan, can, employeeScope, isHrViewer, spaceScope, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CLOSED_TASK_STATUSES, isTaskOverdue } from "@/lib/constants/task-status";
import { prisma } from "@/lib/db/prisma";
import { startOfToday } from "@/lib/utils/date";
import { processListSchema, teamProgressSchema } from "./schemas";
import type { ProcessListFilters, TeamProgressFilters } from "./types";

export type Progress = { total: number; done: number; overdue: number; percent: number };

/** Task progress for several processes in two queries. */
export async function getProgress(processIds: string[]): Promise<Map<string, Progress>> {
  const progress = new Map<string, Progress>(
    processIds.map((id) => [id, { total: 0, done: 0, overdue: 0, percent: 0 }]),
  );
  if (!processIds.length) return progress;

  const [byStatus, overdue] = await Promise.all([
    prisma.onboardingTask.groupBy({
      by: ["processId", "status"],
      where: { processId: { in: processIds } },
      _count: { _all: true },
    }),
    prisma.onboardingTask.groupBy({
      by: ["processId"],
      where: {
        processId: { in: processIds },
        status: { notIn: CLOSED_TASK_STATUSES },
        dueDate: { lt: startOfToday() },
      },
      _count: { _all: true },
    }),
  ]);

  for (const row of byStatus) {
    const p = progress.get(row.processId)!;
    p.total += row._count._all;
    if (CLOSED_TASK_STATUSES.includes(row.status)) p.done += row._count._all;
  }
  for (const row of overdue) progress.get(row.processId)!.overdue = row._count._all;
  for (const p of progress.values()) p.percent = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return progress;
}

export async function listProcesses(user: CurrentUser, rawFilters: ProcessListFilters = {}) {
  assertCan(user, PERMISSIONS.ONBOARDING_READ);
  const f = processListSchema.parse(rawFilters);

  const employeeFilter: Prisma.EmployeeWhereInput = {
    AND: [
      employeeScope(user),
      f.departmentId ? { departmentId: f.departmentId } : {},
      f.q
        ? {
            AND: f.q.split(/\s+/).map((word) => ({
              OR: [
                { firstName: { contains: word, mode: "insensitive" as const } },
                { lastName: { contains: word, mode: "insensitive" as const } },
                { employeeCode: { contains: word, mode: "insensitive" as const } },
              ],
            })),
          }
        : {},
    ],
  };
  const where: Prisma.OnboardingProcessWhereInput = {
    employee: employeeFilter,
    ...(f.status ? { status: f.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.onboardingProcess.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true,
        status: true,
        startDate: true,
        targetDate: true,
        completedAt: true,
        template: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            joiningDate: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } },
          },
        },
      },
    }),
    prisma.onboardingProcess.count({ where }),
  ]);

  const progress = await getProgress(items.map((p) => p.id));
  return {
    items: items.map((p) => ({ ...p, progress: progress.get(p.id)! })),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

export async function getProcess(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.ONBOARDING_READ);

  const process = await prisma.onboardingProcess.findFirst({
    where: { id, employee: employeeScope(user) },
    include: {
      template: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      employee: {
        select: {
          id: true,
          userId: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          email: true,
          joiningDate: true,
          status: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
          hrManager: { select: { id: true, name: true } },
          reportingManager: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      steps: { orderBy: { order: "asc" }, select: { id: true, title: true, order: true } },
      tasks: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          stepId: true,
          title: true,
          description: true,
          assigneeType: true,
          priority: true,
          status: true,
          dueDate: true,
          completedAt: true,
          documentType: { select: { id: true, name: true } },
          assignments: { select: { user: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!process) return null;

  const progress = (await getProgress([process.id])).get(process.id)!;
  const canManage = can(user, PERMISSIONS.ONBOARDING_MANAGE);
  const { tasks: rawTasks, ...rest } = process;
  const tasks = rawTasks.map(({ assignments, ...task }) => ({
    ...task,
    assignees: assignments.map((a) => a.user),
    isOverdue: isTaskOverdue(task),
    isMine: assignments.some((a) => a.user.id === user.id),
  }));

  return {
    ...rest,
    // Group tasks under their steps; tasks added by hand without a step go in "Other tasks".
    steps: [
      ...rest.steps.map((step) => ({ ...step, tasks: tasks.filter((t) => t.stepId === step.id) })),
      ...(tasks.some((t) => !t.stepId)
        ? [{ id: null, title: "Other tasks", order: rest.steps.length, tasks: tasks.filter((t) => !t.stepId) }]
        : []),
    ],
    progress,
    canManage,
    canCancel: canManage && (process.status === "NOT_STARTED" || process.status === "IN_PROGRESS"),
  };
}

function assertCanUseTemplates(user: CurrentUser) {
  if (!can(user, PERMISSIONS.TEMPLATE_MANAGE)) assertCan(user, PERMISSIONS.ONBOARDING_MANAGE);
}

export async function listTemplates(user: CurrentUser, options: { includeInactive?: boolean } = {}) {
  assertCanUseTemplates(user);
  const templates = await prisma.onboardingTemplate.findMany({
    where: options.includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      updatedAt: true,
      department: { select: { id: true, name: true } },
      steps: { select: { _count: { select: { tasks: true } } } },
      _count: { select: { processes: true } },
    },
  });
  return templates.map(({ steps, _count, ...t }) => ({
    ...t,
    stepCount: steps.length,
    taskCount: steps.reduce((sum, s) => sum + s._count.tasks, 0),
    timesUsed: _count.processes,
  }));
}

export async function getTemplate(user: CurrentUser, id: string) {
  assertCanUseTemplates(user);
  return prisma.onboardingTemplate.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      steps: {
        orderBy: { order: "asc" },
        include: {
          tasks: {
            orderBy: { order: "asc" },
            include: { documentType: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
}

/** Employees in scope who can start onboarding now (not archived, nothing in progress). */
export async function listEmployeesReadyForOnboarding(user: CurrentUser) {
  assertCan(user, PERMISSIONS.ONBOARDING_MANAGE);
  return prisma.employee.findMany({
    where: {
      AND: [
        employeeScope(user),
        { archivedAt: null },
        { processes: { none: { status: { in: ["NOT_STARTED", "IN_PROGRESS"] } } } },
      ],
    },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, joiningDate: true, departmentId: true },
    // New hires (pre-boarding) first, soonest joiners at the top; long-standing staff after them.
    orderBy: [{ status: "asc" }, { joiningDate: "asc" }],
  });
}

/**
 * Colleagues in the user's HR space and how far along their onboarding is.
 * Deliberately limited: name, designation, department, joining date, and progress — no contact details,
 * tasks, documents, or overdue counts. HR staff also get the process id to open it.
 */
export async function listTeamProgress(user: CurrentUser, rawFilters: TeamProgressFilters = {}) {
  assertCan(user, PERMISSIONS.ONBOARDING_READ);
  const f = teamProgressSchema.parse(rawFilters);

  const where: Prisma.EmployeeWhereInput = {
    AND: [
      await spaceScope(user),
      { archivedAt: null },
      f.q
        ? {
            AND: f.q.split(/\s+/).map((word) => ({
              OR: [
                { firstName: { contains: word, mode: "insensitive" as const } },
                { lastName: { contains: word, mode: "insensitive" as const } },
              ],
            })),
          }
        : {},
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: [{ joiningDate: "desc" }, { firstName: "asc" }, { id: "asc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        joiningDate: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
        processes: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true },
        },
      },
    }),
    prisma.employee.count({ where }),
  ]);

  const progress = await getProgress(rows.flatMap((r) => r.processes.map((p) => p.id)));
  const showProcess = isHrViewer(user);

  return {
    items: rows.map((r) => {
      const process = r.processes[0];
      const p = process ? progress.get(process.id)! : null;
      return {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        designation: r.designation?.title ?? null,
        department: r.department?.name ?? null,
        joiningDate: r.joiningDate,
        isMe: r.userId === user.id,
        onboarding: process
          ? {
              status: process.status,
              percent: p!.percent,
              done: p!.done,
              total: p!.total,
              processId: showProcess ? process.id : undefined,
            }
          : null,
      };
    }),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

/** Active templates with their steps and tasks, for previewing what starting onboarding will create. */
export async function listTemplatesForStart(user: CurrentUser) {
  assertCan(user, PERMISSIONS.ONBOARDING_MANAGE);
  return prisma.onboardingTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      departmentId: true,
      steps: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          tasks: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              assigneeType: true,
              dueOffsetDays: true,
              priority: true,
              documentType: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

/** True if the user may see templates: HR who start onboarding, or admins who edit templates. */
export function canViewTemplates(user: CurrentUser) {
  return can(user, PERMISSIONS.TEMPLATE_MANAGE) || can(user, PERMISSIONS.ONBOARDING_MANAGE);
}

/** Departments and document types for the template builder. */
export async function getTemplateFormOptions(user: CurrentUser) {
  assertCan(user, PERMISSIONS.TEMPLATE_MANAGE);
  const [departments, documentTypes] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.documentType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { departments, documentTypes };
}
