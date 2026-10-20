// Background worker: run with `npm run worker` (alongside `npm run dev`), or as the `worker` service in Docker.
import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { sendEmail, type Email } from "@/lib/email/mailer";
import { env } from "@/lib/env";
import { runDailyJobs } from "@/lib/jobs/daily";
import { dispatchNotificationEmails } from "@/lib/jobs/notification-emails";
import { JOBS, QUEUE_PREFIX, QUEUES, workerConnection } from "./bullmq";

const emailWorker = new Worker<Email>(
  QUEUES.EMAIL,
  async (job) => {
    await sendEmail(job.data);
    return { to: job.data.to };
  },
  { prefix: QUEUE_PREFIX, connection: workerConnection(), concurrency: 5 },
);

const maintenanceWorker = new Worker(
  QUEUES.MAINTENANCE,
  async (job) => {
    switch (job.name) {
      case JOBS.DISPATCH_NOTIFICATION_EMAILS:
        return dispatchNotificationEmails();
      case JOBS.DAILY:
        return runDailyJobs();
      default:
        throw new Error(`Unknown maintenance job: ${job.name}`);
    }
  },
  { prefix: QUEUE_PREFIX, connection: workerConnection(), concurrency: 1 },
);

for (const worker of [emailWorker, maintenanceWorker]) {
  worker.on("failed", (job, error) => {
    console.error(`[${worker.name}] ${job?.name} ${job?.id} failed (attempt ${job?.attemptsMade}):`, error.message);
  });
  worker.on("completed", (job, result) => {
    if (job.name !== JOBS.DISPATCH_NOTIFICATION_EMAILS || result?.queued) {
      console.log(`[${worker.name}] ${job.name} done`, JSON.stringify(result));
    }
  });
}

/** Registers the recurring jobs. Upserting means restarts and multiple workers never duplicate them. */
async function scheduleRecurringJobs() {
  const maintenance = new Queue(QUEUES.MAINTENANCE, { prefix: QUEUE_PREFIX, connection: workerConnection() });
  await maintenance.upsertJobScheduler(
    JOBS.DISPATCH_NOTIFICATION_EMAILS,
    { every: 60_000 },
    { name: JOBS.DISPATCH_NOTIFICATION_EMAILS, opts: { removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } } },
  );
  await maintenance.upsertJobScheduler(
    JOBS.DAILY,
    { pattern: env.DAILY_JOBS_CRON, tz: env.NEXT_PUBLIC_APP_TIMEZONE },
    { name: JOBS.DAILY, opts: { attempts: 3, backoff: { type: "exponential", delay: 5 * 60_000 } } },
  );
  await maintenance.close();
}

async function shutdown(signal: string) {
  console.log(`${signal} received, finishing current jobs…`);
  await Promise.all([emailWorker.close(), maintenanceWorker.close()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

scheduleRecurringJobs()
  .then(() =>
    console.log(
      `Embark worker running. Notification emails every minute; daily jobs at "${env.DAILY_JOBS_CRON}" (${env.NEXT_PUBLIC_APP_TIMEZONE}).`,
    ),
  )
  .catch((error) => {
    console.error("Couldn't schedule recurring jobs", error);
    process.exit(1);
  });
