import { z } from "zod";

export const reportRangeSchema = z.object({
  /** How many months back trends and averages cover. */
  months: z.coerce.number().int().min(1).max(24).default(6),
  departmentId: z.string().optional(),
});

export const REPORT_KINDS = ["employees", "onboarding"] as const;

export const exportSchema = z.object({
  kind: z.enum(REPORT_KINDS),
  departmentId: z.string().optional(),
});
