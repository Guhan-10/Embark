import "server-only";
import { env } from "@/lib/env";
import { enqueueEmail } from "@/lib/queue/bullmq";
import { sendEmail, type Email } from "./mailer";

/**
 * Sends an email via the background queue (retried if the mail server is down).
 * If the queue itself is unreachable, sends directly so nothing is lost. Throws only if both fail.
 * Without Redis (serverless hosting such as Vercel) there is no queue, so it always sends directly.
 */
export async function deliverEmail(email: Email, options: { jobId?: string } = {}) {
  if (!env.REDIS_URL) {
    await sendEmail(email);
    return "sent" as const;
  }
  try {
    await enqueueEmail(email, options);
    return "queued" as const;
  } catch (error) {
    console.warn("Email queue unavailable; sending directly.", error);
    await sendEmail(email);
    return "sent" as const;
  }
}
