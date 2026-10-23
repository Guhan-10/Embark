import "server-only";
import { after } from "next/server";
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
    // Claim the notification first, so two dispatchers running at once never send the same e-mail twice.
    const claimed = await prisma.notification.updateMany({ where: { id: n.id, emailPending: true }, data: { emailPending: false } });
    if (claimed.count === 0) continue;
    try {
      await deliverEmail(notificationTemplate(n.user.email, n.user.name, n, env.APP_URL), {
        jobId: `notification-${n.id}`,
      });
      await prisma.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
      queued++;
    } catch (error) {
      console.error(`Couldn't email notification ${n.id}`, error);
      await prisma.notification.update({ where: { id: n.id }, data: { emailPending: true } });
      failed++;
    }
  }
  return { queued, skipped, failed };
}

/**
 * Without a worker (no REDIS_URL, e.g. on Vercel), e-mails the notifications a request created once its
 * response has been sent. With a worker this does nothing: the worker's one-minute job sends them.
 */
export function flushNotificationEmailsAfterResponse() {
  if (env.REDIS_URL) return;
  try {
    after(async () => {
      try {
        await dispatchNotificationEmails();
      } catch (error) {
        console.error("Couldn't send notification e-mails", error);
      }
    });
  } catch {
    // Outside a request (scripts): the next request or the daily cron sends them.
  }
}
