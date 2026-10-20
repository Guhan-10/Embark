import type { DocumentStatus } from "@/generated/prisma/enums";
import type { StatusTone } from "./task-status";

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Pending review", tone: "pending" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "warning" },
};

/** Days before expiry when reminders are sent. */
export const DOCUMENT_EXPIRY_REMINDER_DAYS = [30, 7, 0] as const;
