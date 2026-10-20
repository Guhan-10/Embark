import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { assertCan, employeeScope, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { CLOSED_TASK_STATUSES } from "@/lib/constants/task-status";
import { audit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { ActionError } from "@/lib/utils/action";
import { addDays, startOfToday } from "@/lib/utils/date";
import { notify, type NewNotification } from "@/features/notifications/service";
import { effectiveHrUserId, hrOwnerSelect } from "@/lib/auth/hr-owner";
import { resolveAssignee } from "./assignment";
import { startOnboardingSchema, templateSchema } from "./schemas";
import type { StartOnboardingInput, TemplateInput } from "./types";

type Tx = Prisma.TransactionClient;

const ACTIVE_PROCESS_STATUSES = ["NOT_STARTED", "IN_PROGRESS"] as const;

// ─── Templates ───────────────────────────────────────────────────────────────

async function assertTemplateReferences(tx: Tx, input: ReturnType<typeof templateSchema.parse>) {
  if (input.departmentId) {
    const department = await tx.department.findUnique({ where: { id: input.departmentId } });
    if (!department) throw new ActionError("That department doesn't exist.");
  }
  const documentTypeIds = [
    ...new Set(input.steps.flatMap((s) => s.tasks.map((t) => t.documentTypeId)).filter(Boolean)),
  ] as string[];
  if (documentTypeIds.length) {
    const found = await tx.documentType.count({ where: { id: { in: documentTypeIds } } });
    if (found !== documentTypeIds.length) throw new ActionError("One of the document types doesn't exist.");
  }
}

function stepsCreateData(input: ReturnType<typeof templateSchema.parse>) {
  return input.steps.map((step, stepIndex) => ({
    title: step.title,
    order: stepIndex,
    tasks: {
      create: step.tasks.map((task, taskIndex) => ({
        title: task.title,
        description: task.description ?? null,
        assigneeType: task.assigneeType,
        dueOffsetDays: task.dueOffsetDays,
        priority: task.priority,
        documentTypeId: task.documentTypeId ?? null,
        order: taskIndex,
      })),
    },
  }));
}

export async function createTemplate(user: CurrentUser, raw: TemplateInput) {
  assertCan(user, PERMISSIONS.TEMPLATE_MANAGE);
  const input = templateSchema.parse(raw);

  return prisma.$transaction(async (tx) => {
    await assertTemplateReferences(tx, input);
    const template = await tx.onboardingTemplate.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        departmentId: input.departmentId ?? null,
        createdById: user.id,
        steps: { create: stepsCreateData(input) },
      },
    });
    await audit(tx, { actorId: user.id, action: "template.create", entityType: "OnboardingTemplate", entityId: template.id });
    return template;
  });
}

/** Replaces a template's details, steps, and tasks. Onboarding already started from it is unaffected. */
export async function updateTemplate(user: CurrentUser, id: string, raw: TemplateInput) {
  assertCan(user, PERMISSIONS.TEMPLATE_MANAGE);
  const input = templateSchema.parse(raw);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.onboardingTemplate.findUnique({ where: { id } });
    if (!existing) throw new ActionError("Template not found.");
    await assertTemplateReferences(tx, input);

    await tx.templateStep.deleteMany({ where: { templateId: id } });
    const template = await tx.onboardingTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        departmentId: input.departmentId ?? null,
        steps: { create: stepsCreateData(input) },
      },
    });
    await audit(tx, { actorId: user.id, action: "template.update", entityType: "OnboardingTemplate", entityId: id });
    return template;
  });
}

/** Inactive templates can't be used to start new onboarding. */
export async function setTemplateActive(user: CurrentUser, id: string, isActive: boolean) {
  assertCan(user, PERMISSIONS.TEMPLATE_MANAGE);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.onboardingTemplate.findUnique({ where: { id } });
    if (!existing) throw new ActionError("Template not found.");
    const template = await tx.onboardingTemplate.update({ where: { id }, data: { isActive } });
    await audit(tx, {
      actorId: user.id,
      action: isActive ? "template.activate" : "template.deactivate",
      entityType: "OnboardingTemplate",
      entityId: id,
    });
    return template;
  });
}

// ─── Processes ───────────────────────────────────────────────────────────────

/**
 * Brings a process and its employee in line with its tasks:
 * all tasks closed → COMPLETED (employee ACTIVE); any open again → IN_PROGRESS (employee ONBOARDING).
 * Returns notifications to send when the process just completed.
 */
export async function recalculateProcess(tx: Tx, processId: string): Promise<NewNotification[]> {
  const process = await tx.onboardingProcess.findUniqueOrThrow({
    where: { id: processId },
    include: {
      employee: {
        select: {
          ...hrOwnerSelect,
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          reportingManager: { select: { userId: true } },
        },
      },
    },
  });
  if (process.status === "CANCELLED") return [];

  // Sequential: a transaction uses one connection, which can't run two queries at once.
  const total = await tx.onboardingTask.count({ where: { processId } });
  const open = await tx.onboardingTask.count({ where: { processId, status: { notIn: CLOSED_TASK_STATUSES } } });
  const shouldBeComplete = total > 0 && open === 0;

  if (shouldBeComplete && process.status !== "COMPLETED") {
    await tx.onboardingProcess.update({
      where: { id: processId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await tx.employee.update({ where: { id: process.employeeId }, data: { status: "ACTIVE" } });

    const name = `${process.employee.firstName} ${process.employee.lastName}`;
    const link = `/onboarding/${processId}`;
    return [effectiveHrUserId(process.employee), process.employee.reportingManager?.userId, process.employee.userId]
      .filter((id): id is string => Boolean(id))
      .map((userId) => ({
        userId,
        type: "ONBOARDING_COMPLETED" as const,
        title: userId === process.employee.userId ? "Your onboarding is complete" : `${name} finished onboarding`,
        link,
      }));
  }

  if (!shouldBeComplete && process.status !== "IN_PROGRESS") {
    await tx.onboardingProcess.update({
      where: { id: processId },
      data: { status: "IN_PROGRESS", completedAt: null },
    });
    await tx.employee.update({ where: { id: process.employeeId }, data: { status: "ONBOARDING" } });
  }
  return [];
}

/** Starts onboarding for an employee, copying the template's steps and tasks with real due dates and assignees. */
export async function startOnboarding(user: CurrentUser, raw: StartOnboardingInput) {
  assertCan(user, PERMISSIONS.ONBOARDING_MANAGE);
  const input = startOnboardingSchema.parse(raw);

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { AND: [{ id: input.employeeId }, employeeScope(user)] },
      include: {
        reportingManager: { select: { userId: true } },
        department: { select: hrOwnerSelect.department.select },
      },
    });
    if (!employee) throw new ActionError("Employee not found.");
    if (employee.archivedAt) throw new ActionError("Restore this employee before starting onboarding.");

    const active = await tx.onboardingProcess.findFirst({
      where: { employeeId: employee.id, status: { in: [...ACTIVE_PROCESS_STATUSES] } },
    });
    if (active) throw new ActionError("This employee already has onboarding in progress.");

    const template = input.templateId
      ? await tx.onboardingTemplate.findUnique({
          where: { id: input.templateId },
          include: { steps: { orderBy: { order: "asc" }, include: { tasks: { orderBy: { order: "asc" } } } } },
        })
      : null;
    if (input.templateId && !template) throw new ActionError("Template not found.");
    if (template && !template.isActive) throw new ActionError("That template is inactive.");

    const dueDates = template?.steps.flatMap((s) => s.tasks.map((t) => addDays(employee.joiningDate, t.dueOffsetDays))) ?? [];
    const latestDue = dueDates.length ? new Date(Math.max(...dueDates.map((d) => d.getTime()))) : null;

    const process = await tx.onboardingProcess.create({
      data: {
        employeeId: employee.id,
        templateId: template?.id ?? null,
        status: template ? "IN_PROGRESS" : "NOT_STARTED",
        startDate: startOfToday(),
        targetDate: input.targetDate ?? latestDue,
        createdById: user.id,
      },
    });

    const assigneeTaskCounts = new Map<string, number>();
    for (const step of template?.steps ?? []) {
      const processStep = await tx.onboardingProcessStep.create({
        data: { processId: process.id, title: step.title, order: step.order },
      });
      for (const task of step.tasks) {
        const assigneeId = resolveAssignee(task.assigneeType, employee);
        await tx.onboardingTask.create({
          data: {
            processId: process.id,
            stepId: processStep.id,
            title: task.title,
            description: task.description,
            assigneeType: task.assigneeType,
            priority: task.priority,
            dueDate: addDays(employee.joiningDate, task.dueOffsetDays),
            order: task.order,
            documentTypeId: task.documentTypeId,
            assignments: assigneeId ? { create: { userId: assigneeId } } : undefined,
            history: { create: { toStatus: "TODO", changedById: user.id, note: "Created from template" } },
          },
        });
        if (assigneeId) assigneeTaskCounts.set(assigneeId, (assigneeTaskCounts.get(assigneeId) ?? 0) + 1);
      }
    }

    await tx.employee.update({ where: { id: employee.id }, data: { status: "ONBOARDING" } });

    const name = `${employee.firstName} ${employee.lastName}`;
    const link = `/onboarding/${process.id}`;
    await notify(
      tx,
      [
        ...[...assigneeTaskCounts].map(([userId, count]) => ({
          userId,
          type: "TASK_ASSIGNED" as const,
          title:
            userId === employee.userId
              ? `You have ${count} onboarding ${count === 1 ? "task" : "tasks"}`
              : `${count} onboarding ${count === 1 ? "task" : "tasks"} for ${name}`,
          link: userId === employee.userId ? "/tasks/assigned-to-me" : link,
        })),
        ...(employee.userId
          ? [{ userId: employee.userId, type: "ONBOARDING_STARTED" as const, title: "Your onboarding has started", link }]
          : []),
      ],
      { exceptUserId: user.id },
    );

    await audit(tx, {
      actorId: user.id,
      action: "onboarding.start",
      entityType: "OnboardingProcess",
      entityId: process.id,
      metadata: { employeeId: employee.id, templateId: template?.id ?? null, tasks: dueDates.length },
    });
    return process;
  });
}

export async function cancelOnboarding(user: CurrentUser, processId: string, reason?: string) {
  assertCan(user, PERMISSIONS.ONBOARDING_MANAGE);

  return prisma.$transaction(async (tx) => {
    const process = await tx.onboardingProcess.findFirst({
      where: { id: processId, employee: employeeScope(user) },
    });
    if (!process) throw new ActionError("Onboarding not found.");
    if (!ACTIVE_PROCESS_STATUSES.includes(process.status as (typeof ACTIVE_PROCESS_STATUSES)[number])) {
      throw new ActionError("Only onboarding that's in progress can be cancelled.");
    }

    const updated = await tx.onboardingProcess.update({
      where: { id: processId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    const hasCompleted = await tx.onboardingProcess.count({
      where: { employeeId: process.employeeId, status: "COMPLETED" },
    });
    await tx.employee.update({
      where: { id: process.employeeId },
      data: { status: hasCompleted ? "ACTIVE" : "PRE_BOARDING" },
    });

    await audit(tx, {
      actorId: user.id,
      action: "onboarding.cancel",
      entityType: "OnboardingProcess",
      entityId: processId,
      metadata: reason ? { reason } : undefined,
    });
    return updated;
  });
}
