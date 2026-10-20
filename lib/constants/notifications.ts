import type { NotificationType } from "@/generated/prisma/enums";

/**
 * Notifications that are also emailed. The rest (e.g. "a task was completed") only appear in the app,
 * so people aren't flooded with email for routine progress.
 */
export const EMAILED_NOTIFICATION_TYPES: NotificationType[] = [
  "TASK_ASSIGNED",
  "TASK_DUE_SOON",
  "TASK_OVERDUE",
  "DOCUMENT_REJECTED",
  "DOCUMENT_EXPIRING",
  "DOCUMENT_EXPIRED",
  "ONBOARDING_STARTED",
  "ONBOARDING_COMPLETED",
];
