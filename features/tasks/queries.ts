import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { assertCan, can, employeeScope, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CLOSED_TASK_STATUSES, isTaskOverdue } from "@/lib/constants/task-status";
import { prisma } from "@/lib/db/prisma";
import { startOfToday } from "@/lib/utils/date";
import { taskListSchema } from "./schemas";
import { assignableUserIds } from "./assignees";
import { managedTaskScope, taskScope } from "./scope";
import type { TaskListFilters } from "./types";

export async function listTasks(user: CurrentUser, rawFilters: TaskListFilters = {}) {
  assertCan(user, PERMISSIONS.TASK_READ);
  const f = taskListSchema.parse(rawFilters);

  const where: Prisma.OnboardingTaskWhereInput = {
    AND: [
      taskScope(user),
      { process: { status: { not: "CANCELLED" } } },
      f.assignedToMe ? { assignments: { some: { userId: user.id } } } : {},
      f.status ? { status: f.status } : f.includeClosed ? {} : { status: { notIn: CLOSED_TASK_STATUSES } },
      f.priority ? { priority: f.priority } : {},
      f.processId ? { processId: f.processId } : {},
      f.employeeId ? { process: { employeeId: f.employeeId } } : {},
      f.overdue
        ? { dueDate: { lt: startOfToday() }, status: { notIn: CLOSED_TASK_STATUSES } }
        : {},
      f.q ? { title: { contains: f.q, mode: "insensitive" } } : {},
    ],
  };

  // Postgres sorts the priority enum in declared order (LOW → URGENT), so "desc" puts urgent first.
  const orderBy: Prisma.OnboardingTaskOrderByWithRelationInput[] =
    f.sort === "dueDate"
      ? [{ dueDate: { sort: f.order, nulls: "last" } }, { id: "asc" }]
      : [{ [f.sort]: f.order }, { id: "asc" }];

  const [rows, total] = await Promise.all([
    prisma.onboardingTask.findMany({
      where,
      orderBy,
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assigneeType: true,
        documentTypeId: true,
        process: {
          select: {
            id: true,
            employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          },
        },
        step: { select: { title: true } },
        assignments: { select: { user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.onboardingTask.count({ where }),
  ]);

  return {
    items: rows.map(({ assignments, ...task }) => ({
      ...task,
      assignees: assignments.map((a) => a.user),
      isOverdue: isTaskOverdue(task),
      isMine: assignments.some((a) => a.user.id === user.id),
    })),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

export async function getTask(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.TASK_READ);

  const task = await prisma.onboardingTask.findFirst({
    where: { AND: [{ id }, taskScope(user)] },
    include: {
      step: { select: { id: true, title: true } },
      documentType: { select: { id: true, name: true, allowedMimeTypes: true, maxSizeBytes: true } },
      process: {
        select: {
          id: true,
          status: true,
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true, userId: true },
          },
        },
      },
      assignments: {
        select: { assignedAt: true, assignedBy: { select: { name: true } }, user: { select: { id: true, name: true } } },
      },
      history: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          changedBy: { select: { id: true, name: true } },
        },
      },
      documents: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!task) return null;

  const isManaged =
    (await prisma.onboardingTask.count({ where: { AND: [{ id }, managedTaskScope(user)] } })) > 0;
  const isAssignee = task.assignments.some((a) => a.user.id === user.id);
  const isOpenProcess = task.process.status !== "CANCELLED";
  const { assignments, documents, ...rest } = task;

  return {
    ...rest,
    assignees: assignments.map((a) => ({ ...a.user, assignedAt: a.assignedAt, assignedBy: a.assignedBy?.name ?? null })),
    documents: can(user, PERMISSIONS.DOCUMENT_READ) ? documents : [],
    isOverdue: isTaskOverdue(task),
    permissions: {
      changeStatus: isOpenProcess && can(user, PERMISSIONS.TASK_UPDATE) && (isAssignee || isManaged),
      skip: isOpenProcess && isManaged,
      edit: isOpenProcess && isManaged && can(user, PERMISSIONS.TASK_CREATE),
      assign: isOpenProcess && isManaged,
      uploadDocument:
        isOpenProcess && Boolean(task.documentTypeId) && can(user, PERMISSIONS.DOCUMENT_UPLOAD) && (isAssignee || isManaged),
    },
  };
}

/** People a task in this onboarding can be assigned to (see assignableUserIds for the rules). */
export async function getAssignableUsers(user: CurrentUser, processId: string) {
  assertCan(user, PERMISSIONS.TASK_ASSIGN);
  const process = await prisma.onboardingProcess.findFirst({
    where: { id: processId, employee: employeeScope(user) },
    select: { id: true },
  });
  if (!process) return [];

  const ids = await assignableUserIds(prisma, user, processId);
  return prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
