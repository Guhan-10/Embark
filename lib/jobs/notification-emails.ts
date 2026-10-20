import "server-only";
import { prisma } from "@/lib/db/prisma";
import { deliverEmail } from "@/lib/email/deliver";
import { notificationTemplate } from "@/lib/email/templates";
import { env } from "@/lib/env";

/**
 * Outbox dispatcher (runs every minute): queues an email for each notification flagged for email.
 * Deactivated users are skipped. If queueing fails, the notification stays pending for the next run.
 */
export async function dispatchNotificationEmails(limit = 200) {
  const pending = await prisma.notification.findMany({
    where: { emailPending: true },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { user: { select: { email: true, name: true, isActive: true } } },
  });

  let queued = 0;
  let skipped = 0;
  let failed = 0;
  for (const n of pending) {
    if (!n.user.isActive) {
      await prisma.notification.update({ where: { id: n.id }, data: { emailPending: false } });
      skipped++;
      continue;
    }
    try {
      await deliverEmail(notificationTemplate(n.user.email, n.user.name, n, env.APP_URL), {
        jobId: `notification-${n.id}`,
      });
      await prisma.notification.update({
        where: { id: n.id },
        data: { emailPending: false, emailedAt: new Date() },
      });
      queued++;
    } catch (error) {
      console.error(`Couldn't email notification ${n.id}`, error);
      failed++;
    }
  }
  return { queued, skipped, failed };
}
