import "server-only";
import { reconcileDepartmentHr } from "./reconcile";
import { processDocumentExpiry, sendTaskReminders } from "./reminders";

/** Everything that runs once a day. Safe to re-run: reminders are de-duplicated per day. */
export async function runDailyJobs(now = new Date()) {
  const reconcile = await reconcileDepartmentHr();
  const tasks = await sendTaskReminders(now);
  const documents = await processDocumentExpiry(now);
  return { reconcile, tasks, documents };
}
