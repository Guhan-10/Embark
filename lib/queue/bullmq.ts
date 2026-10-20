import "server-only";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { Email } from "@/lib/email/mailer";
import { env } from "@/lib/env";

export const QUEUE_PREFIX = "embark";

export const QUEUES = {
  EMAIL: "email",
  MAINTENANCE: "maintenance",
} as const;

export const JOBS = {
  SEND_EMAIL: "send-email",
  DISPATCH_NOTIFICATION_EMAILS: "dispatch-notification-emails",
  DAILY: "daily-jobs",
} as const;

/** Workers block on Redis, so each needs its own connection that retries forever. */
export function workerConnection() {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

const globalForQueues = globalThis as unknown as { embarkEmailQueue?: Queue };

/**
 * Queue used by the web app to hand off emails. Fails fast when Redis is unreachable
 * (instead of hanging the request) so callers can fall back to sending directly.
 */
function emailQueue() {
  globalForQueues.embarkEmailQueue ??= new Queue(QUEUES.EMAIL, {
    prefix: QUEUE_PREFIX,
    connection: new IORedis(env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 }),
  });
  return globalForQueues.embarkEmailQueue;
}

/**
 * Queues an email for the worker, retried with backoff for about an hour if the mail server is down.
 * A jobId makes it idempotent: the same id is never queued twice. (BullMQ ids can't contain ":".)
 */
export async function enqueueEmail(email: Email, options: { jobId?: string } = {}) {
  await emailQueue().add(JOBS.SEND_EMAIL, email, {
    jobId: options.jobId,
    attempts: 6,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
}
