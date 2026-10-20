import "server-only";
import type { AssigneeType, Prisma } from "@/generated/prisma/client";
import { effectiveHrUserId, hrOwnerSelect, type HrOwnerFields } from "@/lib/auth/hr-owner";
import { CLOSED_TASK_STATUSES } from "@/lib/constants/task-status";

type Tx = Prisma.TransactionClient;

/** Select this on an employee to pass it to resolveAssignee. */
export const assigneeLinksSelect = {
  ...hrOwnerSelect,
  userId: true,
  reportingManager: { select: { userId: true } },
} satisfies Prisma.EmployeeSelect;

type EmployeeLinks = HrOwnerFields & {
  userId: string | null;
  reportingManager: { userId: string | null } | null;
};

/** The user an auto-assigned task should go to, or null if that person hasn't registered yet. */
export function resolveAssignee(type: AssigneeType | null, employee: EmployeeLinks) {
  switch (type) {
    case "EMPLOYEE":
      return employee.userId;
    case "HR_MANAGER":
      return effectiveHrUserId(employee);
    case "REPORTING_MANAGER":
      return employee.reportingManager?.userId ?? null;
    default:
      return null;
  }
}

/**
 * Re-points auto-assigned open tasks in an employee's active onboarding after their
 * HR manager, reporting manager, or login changes. Tasks someone assigned by hand are left alone.
 * Returns the tasks that gained a new assignee so callers can notify them.
 */
export async function syncTaskAssignees(tx: Tx, employeeId: string) {
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: assigneeLinksSelect,
  });
  if (!employee) return [];

  const tasks = await tx.onboardingTask.findMany({
    where: {
      assigneeType: { not: null },
      status: { notIn: CLOSED_TASK_STATUSES },
      process: { employeeId, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
      // Only tasks whose assignments were all made automatically (assignedById null).
      assignments: { none: { assignedById: { not: null } } },
    },
    select: { id: true, title: true, processId: true, assigneeType: true, assignments: { select: { userId: true } } },
  });

  const newlyAssigned: { taskId: string; processId: string; title: string; userId: string }[] = [];
  for (const task of tasks) {
    const target = resolveAssignee(task.assigneeType, employee);
    const current = task.assignments.map((a) => a.userId);
    if (current.length === (target ? 1 : 0) && (!target || current[0] === target)) continue;

    await tx.taskAssignment.deleteMany({ where: { taskId: task.id } });
    if (target) {
      await tx.taskAssignment.create({ data: { taskId: task.id, userId: target } });
      newlyAssigned.push({ taskId: task.id, processId: task.processId, title: task.title, userId: target });
    }
  }
  return newlyAssigned;
}

/** One "you have new tasks" notification per person for tasks that just got assigned to them. */
export function newAssignmentNotifications(assigned: Awaited<ReturnType<typeof syncTaskAssignees>>) {
  const perUser = new Map<string, number>();
  for (const a of assigned) perUser.set(a.userId, (perUser.get(a.userId) ?? 0) + 1);
  return [...perUser].map(([userId, count]) => ({
    userId,
    type: "TASK_ASSIGNED" as const,
    title: `You have ${count} new onboarding ${count === 1 ? "task" : "tasks"}`,
    link: "/tasks/assigned-to-me",
  }));
}
