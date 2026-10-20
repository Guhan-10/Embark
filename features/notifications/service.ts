import "server-only";
import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { EMAILED_NOTIFICATION_TYPES } from "@/lib/constants/notifications";
import { prisma } from "@/lib/db/prisma";

export type NewNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** In-app path, e.g. /tasks/abc */
  link?: string;
  /** Scheduled reminders set this so re-running a job never creates the same reminder twice. */
  dedupeKey?: string;
};

/**
 * Creates in-app notifications inside the caller's transaction. Types in EMAILED_NOTIFICATION_TYPES are
 * flagged for email; the worker sends them once the transaction has committed (an outbox), so a
 * rolled-back change never sends email. Skips the person who caused the event and duplicates.
 */
export async function notify(
  tx: Pick<Prisma.TransactionClient, "notification">,
  items: NewNotification[],
  options: { exceptUserId?: string } = {},
) {
  const seen = new Set<string>();
  const data = items.filter((n) => {
    const key = `${n.userId}:${n.type}:${n.link ?? ""}`;
    if (n.userId === options.exceptUserId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (data.length) {
    await tx.notification.createMany({
      data: data.map((n) => ({ ...n, emailPending: EMAILED_NOTIFICATION_TYPES.includes(n.type) })),
      skipDuplicates: true,
    });
  }
  return data;
}

/** Marks one of the user's own notifications as read. */
export async function markNotificationRead(userId: string, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/** Marks all of the user's notifications as read. */
export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
