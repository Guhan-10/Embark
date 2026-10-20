import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { effectiveHrUserId, hrOwnerSelect } from "@/lib/auth/hr-owner";
import { DOCUMENT_EXPIRY_REMINDER_DAYS } from "@/lib/constants/document-status";
import { CLOSED_TASK_STATUSES } from "@/lib/constants/task-status";
import { audit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { addDays, dateKey, daysBetween, startOfToday } from "@/lib/utils/date";
import { notify, type NewNotification } from "@/features/notifications/service";

// Daily reminders. Every notification carries a dedupe key, so running a job twice on the same day
// (a retry, a manual run) never sends anything twice.

const employeeSelect = { ...hrOwnerSelect, userId: true, firstName: true, lastName: true } satisfies Prisma.EmployeeSelect;

const openTaskSelect = {
  id: true,
  title: true,
  dueDate: true,
  assignments: { select: { userId: true } },
  process: { select: { employee: { select: employeeSelect } } },
} satisfies Prisma.OnboardingTaskSelect;

const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;

/** Overdue reminders go out on the first day overdue, then once a week, not every day. */
export function isOverdueReminderDay(daysOverdue: number) {
  return daysOverdue >= 1 && (daysOverdue - 1) % 7 === 0;
}

/** Due-tomorrow reminders to assignees; overdue reminders to assignees plus one daily summary per HR. */
export async function sendTaskReminders(now = new Date()) {
  const today = startOfToday(now);
  const day = dateKey(today);
  const open = { status: { notIn: CLOSED_TASK_STATUSES }, process: { status: "IN_PROGRESS" as const } };

  const [dueSoon, overdue] = await Promise.all([
    prisma.onboardingTask.findMany({ where: { ...open, dueDate: addDays(today, 1) }, select: openTaskSelect }),
    prisma.onboardingTask.findMany({ where: { ...open, dueDate: { lt: today } }, select: openTaskSelect }),
  ]);

  const notifications: NewNotification[] = [];
  for (const task of dueSoon) {
    const employee = task.process.employee;
    for (const { userId } of task.assignments) {
      notifications.push({
        userId,
        type: "TASK_DUE_SOON",
        title: `Due tomorrow: ${task.title}`,
        body: userId === employee.userId ? "Part of your onboarding" : `Onboarding for ${fullName(employee)}`,
        link: `/tasks/${task.id}`,
        dedupeKey: `due-soon:${task.id}:${userId}:${day}`,
      });
    }
  }

  const overdueByHr = new Map<string, number>();
  for (const task of overdue) {
    const daysOverdue = daysBetween(task.dueDate!, today);
    if (!isOverdueReminderDay(daysOverdue)) continue;
    const employee = task.process.employee;
    for (const { userId } of task.assignments) {
      notifications.push({
        userId,
        type: "TASK_OVERDUE",
        title: `Overdue by ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"}: ${task.title}`,
        body: userId === employee.userId ? "Part of your onboarding" : `Onboarding for ${fullName(employee)}`,
        link: `/tasks/${task.id}`,
        dedupeKey: `overdue:${task.id}:${userId}:${day}`,
      });
    }
    const hr = effectiveHrUserId(employee);
    if (hr) overdueByHr.set(hr, (overdueByHr.get(hr) ?? 0) + 1);
  }
  for (const [userId, count] of overdueByHr) {
    notifications.push({
      userId,
      type: "TASK_OVERDUE",
      title: `${count} onboarding ${count === 1 ? "task is" : "tasks are"} overdue in your space`,
      link: "/tasks?overdue=true",
      dedupeKey: `overdue-summary:${userId}:${day}`,
    });
  }

  await notify(prisma, notifications);
  return { dueSoon: dueSoon.length, overdueReminded: overdueByHr.size ? [...overdueByHr.values()].reduce((a, b) => a + b) : 0 };
}

/** Marks lapsed documents EXPIRED and warns the employee and their HR 30, 7, and 0 days before expiry. */
export async function processDocumentExpiry(now = new Date()) {
  const today = startOfToday(now);
  const live = { deletedAt: null, status: { in: ["PENDING" as const, "APPROVED" as const] } };
  const select = {
    id: true,
    fileName: true,
    expiryDate: true,
    documentType: { select: { name: true } },
    employee: { select: employeeSelect },
  } satisfies Prisma.DocumentSelect;

  const notifications: NewNotification[] = [];
  const recipients = (employee: Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>) =>
    [employee.userId, effectiveHrUserId(employee)].filter((id): id is string => Boolean(id));

  const lapsed = await prisma.document.findMany({ where: { ...live, expiryDate: { lt: today } }, select });
  for (const doc of lapsed) {
    await prisma.document.update({ where: { id: doc.id }, data: { status: "EXPIRED" } });
    await audit(prisma, { actorId: null, action: "document.expire", entityType: "Document", entityId: doc.id });
    const label = doc.documentType?.name ?? doc.fileName;
    for (const userId of recipients(doc.employee)) {
      notifications.push({
        userId,
        type: "DOCUMENT_EXPIRED",
        title: userId === doc.employee.userId ? `Your ${label} has expired` : `${fullName(doc.employee)}'s ${label} has expired`,
        body: "Upload a valid replacement.",
        link: `/documents/${doc.id}`,
        dedupeKey: `expired:${doc.id}:${userId}`,
      });
    }
  }

  let warned = 0;
  for (const days of DOCUMENT_EXPIRY_REMINDER_DAYS) {
    const expiring = await prisma.document.findMany({ where: { ...live, expiryDate: addDays(today, days) }, select });
    warned += expiring.length;
    for (const doc of expiring) {
      const label = doc.documentType?.name ?? doc.fileName;
      const when = days === 0 ? "expires today" : `expires in ${days} days`;
      for (const userId of recipients(doc.employee)) {
        notifications.push({
          userId,
          type: "DOCUMENT_EXPIRING",
          title: userId === doc.employee.userId ? `Your ${label} ${when}` : `${fullName(doc.employee)}'s ${label} ${when}`,
          link: `/documents/${doc.id}`,
          dedupeKey: `expiring:${doc.id}:${days}:${userId}`,
        });
      }
    }
  }

  await notify(prisma, notifications);
  return { expired: lapsed.length, warned };
}
