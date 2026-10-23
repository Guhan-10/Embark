import { env } from "@/lib/env";
import { runDailyJobs } from "@/lib/jobs/daily";
import { dispatchNotificationEmails } from "@/lib/jobs/notification-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily jobs for hosts without a worker (Vercel Cron calls this once a day with CRON_SECRET as a bearer
 * token): department HR fix-up, task reminders and document expiry, then any notification e-mails still pending.
 * Disabled unless CRON_SECRET is set.
 */
export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const daily = await runDailyJobs();
  const emails = await dispatchNotificationEmails();
  return Response.json({ ok: true, daily, emails });
}
