import "server-only";
import { enqueueEmail } from "@/lib/queue/bullmq";
import { sendEmail, type Email } from "./mailer";

/**
 * Sends an email via the background queue (retried if the mail server is down).
 * If the queue itself is unreachable, sends directly so nothing is lost. Throws only if both fail.
 */
export async function deliverEmail(email: Email, options: { jobId?: string } = {}) {
  try {
    await enqueueEmail(email, options);
    return "queued" as const;
  } catch (error) {
    console.warn("Email queue unavailable; sending directly.", error);
    await sendEmail(email);
    return "sent" as const;
  }
}
