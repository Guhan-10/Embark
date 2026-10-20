import "server-only";
import type { Prisma, TaskStatus } from "@/generated/prisma/client";
import { effectiveHrUserId, hrOwnerSelect } from "@/lib/auth/hr-owner";
import { assertCan, employeeScope, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CLOSED_TASK_STATUSES, TASK_STATUS } from "@/lib/constants/task-status";
import { audit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { ActionError } from "@/lib/utils/action";
import { notify, type NewNotification } from "@/features/notifications/service";
import { recalculateProcess } from "@/features/onboarding/service";
import { taskAssignSchema, taskCreateSchema, taskStatusSchema, taskUpdateSchema } from "./schemas";
import { assertAssignable } from "./assignees";
import { managedTaskScope, taskScope } from "./scope";
import type { TaskAssignInput, TaskCreateInput, TaskStatusInput, TaskUpdateInput } from "./types";

type Tx = Prisma.TransactionClient;

const taskWithContext = {
  process: {
    select: {
      id: true,
      status: true,
      employee: { select: { ...hrOwnerSelect, firstName: true, lastName: true } },
    },
  },
  assignments: { select: { userId: true } },
} satisfies Prisma.OnboardingTaskInclude;

async function findManagedTask(tx: Tx, user: CurrentUser, id: string) {
  const task = await tx.onboardingTask.findFirst({
    where: { AND: [{ id }, managedTaskScope(user)] },
    include: taskWithContext,
  });
  if (!task) throw new ActionError("Task not found.");
  if (task.process.status === "CANCELLED") throw new ActionError("This onboarding was cancelled.");
  return task;
}

function assignedNotifications(
  userIds: string[],
  task: { id: string; title: string },
  employee: { firstName: string; lastName: string },
): NewNotification[] {
  return userIds.map((userId) => ({
    userId,
    type: "TASK_ASSIGNED",
    title: `New task: ${task.title}`,
    body: `Onboarding for ${employee.firstName} ${employee.lastName}`,
    link: `/tasks/${task.id}`,
  }));
}

/** Adds a task to an onboarding process by hand. */
export async function createTask(user: CurrentUser, raw: TaskCreateInput) {
  assertCan(user, PERMISSIONS.TASK_CREATE);
  const input = taskCreateSchema.parse(raw);
  if (input.assigneeIds.length) assertCan(user, PERMISSIONS.TASK_ASSIGN);

  return prisma.$transaction(async (tx) => {
    const process = await tx.onboardingProcess.findFirst({
      where: { id: input.processId, employee: employeeScope(user) },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    if (!process) throw new ActionError("Onboarding not found.");
    if (process.status === "CANCELLED") throw new ActionError("This onboarding was cancelled.");

    if (input.stepId) {
      const step = await tx.onboardingProcessStep.findFirst({ where: { id: input.stepId, processId: process.id } });
      if (!step) throw new ActionError("That step isn't part of this onboarding.");
    }
    if (input.documentTypeId) {
      const type = await tx.documentType.findUnique({ where: { id: input.documentTypeId } });
      if (!type) throw new ActionError("That document type doesn't exist.");
    }
    const assigneeIds = await assertAssignable(tx, user, process.id, input.assigneeIds);

    const last = await tx.onboardingTask.aggregate({
      where: { processId: process.id, stepId: input.stepId ?? null },
      _max: { order: true },
    });
    const task = await tx.onboardingTask.create({
      data: {
        processId: process.id,
        stepId: input.stepId ?? null,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        dueDate: input.dueDate ?? null,
        documentTypeId: input.documentTypeId ?? null,
        order: (last._max.order ?? -1) + 1,
        assignments: { create: assigneeIds.map((userId) => ({ userId, assignedById: user.id })) },
        history: { create: { toStatus: "TODO", changedById: user.id, note: "Added by hand" } },
      },
    });

    const completed = await recalculateProcess(tx, process.id);
    await notify(tx, [...assignedNotifications(assigneeIds, task, process.employee), ...completed], {
      exceptUserId: user.id,
    });
    await audit(tx, { actorId: user.id, action: "task.create", entityType: "OnboardingTask", entityId: task.id });
    return task;
  });
}

/** Edits a task's details. Status changes go through changeTaskStatus. */
export async function updateTask(user: CurrentUser, id: string, raw: TaskUpdateInput) {
  assertCan(user, PERMISSIONS.TASK_CREATE);
  const input = taskUpdateSchema.parse(raw);

  return prisma.$transaction(async (tx) => {
    const current = await findManagedTask(tx, user, id);
    if (input.stepId) {
      const step = await tx.onboardingProcessStep.findFirst({
        where: { id: input.stepId, processId: current.processId },
      });
      if (!step) throw new ActionError("That step isn't part of this onboarding.");
    }
    const task = await tx.onboardingTask.update({
      where: { id },
      data: {
        stepId: input.stepId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
      },
    });
    await audit(tx, {
      actorId: user.id,
      action: "task.update",
      entityType: "OnboardingTask",
      entityId: id,
      metadata: { fields: Object.keys(raw) },
    });
    return task;
  });
}

/** Replaces a task's assignees. Hand-picked assignees stop automatic reassignment for this task. */
export async function assignTask(user: CurrentUser, id: string, raw: TaskAssignInput) {
  assertCan(user, PERMISSIONS.TASK_ASSIGN);
  const input = taskAssignSchema.parse(raw);

  return prisma.$transaction(async (tx) => {
    const task = await findManagedTask(tx, user, id);
    const userIds = await assertAssignable(tx, user, task.processId, input.userIds);
    const before = new Set(task.assignments.map((a) => a.userId));

    await tx.taskAssignment.deleteMany({ where: { taskId: id } });
    await tx.taskAssignment.createMany({
      data: userIds.map((userId) => ({ taskId: id, userId, assignedById: user.id })),
    });

    await notify(
      tx,
      assignedNotifications(userIds.filter((u) => !before.has(u)), task, task.process.employee),
      { exceptUserId: user.id },
    );
    await audit(tx, {
      actorId: user.id,
      action: "task.assign",
      entityType: "OnboardingTask",
      entityId: id,
      metadata: { from: [...before], to: userIds },
    });
    return { id, userIds };
  });
}

/**
 * Moves a task to a new status and records it in the task's history.
 * Assignees can update their own tasks; HR can update any task they manage and is the only one who can skip.
 */
export async function changeTaskStatus(user: CurrentUser, id: string, raw: TaskStatusInput) {
  assertCan(user, PERMISSIONS.TASK_UPDATE);
  const input = taskStatusSchema.parse(raw);

  return prisma.$transaction(async (tx) => {
    const task = await tx.onboardingTask.findFirst({
      where: { AND: [{ id }, taskScope(user)] },
      include: taskWithContext,
    });
    if (!task) throw new ActionError("Task not found.");

    const managed = await tx.onboardingTask.count({ where: { AND: [{ id }, managedTaskScope(user)] } });
    const isAssignee = task.assignments.some((a) => a.userId === user.id);
    if (!isAssignee && !managed) throw new ActionError("Only the people assigned to this task can update it.");
    if (input.status === "SKIPPED" && !managed) throw new ActionError("Only HR can skip a task.");
    if (task.process.status === "CANCELLED") throw new ActionError("This onboarding was cancelled.");
    if (task.status === input.status) return task;

    if (input.status === "DONE" && task.documentTypeId) {
      const uploaded = await tx.document.count({
        where: { taskId: id, deletedAt: null, status: { in: ["PENDING", "APPROVED"] } },
      });
      if (!uploaded) throw new ActionError("Upload the required document before marking this task done.");
    }

    const closing = CLOSED_TASK_STATUSES.includes(input.status as TaskStatus);
    const updated = await tx.onboardingTask.update({
      where: { id },
      data: { status: input.status, completedAt: closing ? new Date() : null },
    });
    await tx.taskStatusHistory.create({
      data: {
        taskId: id,
        fromStatus: task.status,
        toStatus: input.status,
        changedById: user.id,
        note: input.note ?? null,
      },
    });

    const notifications: NewNotification[] = await recalculateProcess(tx, task.processId);
    const hrManagerId = effectiveHrUserId(task.process.employee);
    if (hrManagerId && (input.status === "DONE" || input.status === "BLOCKED")) {
      const name = `${task.process.employee.firstName} ${task.process.employee.lastName}`;
      notifications.push({
        userId: hrManagerId,
        type: input.status === "DONE" ? "TASK_COMPLETED" : "SYSTEM",
        title: `${TASK_STATUS[input.status].label}: ${task.title}`,
        body: input.note ? `${name} — ${input.note}` : `Onboarding for ${name}`,
        link: `/tasks/${id}`,
      });
    }
    await notify(tx, notifications, { exceptUserId: user.id });

    await audit(tx, {
      actorId: user.id,
      action: "task.status",
      entityType: "OnboardingTask",
      entityId: id,
      metadata: { from: task.status, to: input.status },
    });
    return updated;
  });
}

