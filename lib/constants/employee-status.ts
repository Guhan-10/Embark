import type { EmployeeStatus, ProcessStatus } from "@/generated/prisma/enums";
import type { StatusTone } from "./task-status";

export const EMPLOYEE_STATUS: Record<EmployeeStatus, { label: string; tone: StatusTone }> = {
  PRE_BOARDING: { label: "Pre-boarding", tone: "pending" },
  ONBOARDING: { label: "Onboarding", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
};

export const PROCESS_STATUS: Record<ProcessStatus, { label: string; tone: StatusTone }> = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};
