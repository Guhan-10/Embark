import { z } from "zod";
import { DocumentStatus } from "@/generated/prisma/enums";

const optionalId = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .optional();

/** Metadata sent with an upload. Either the task it's for, or the employee it belongs to. */
export const uploadMetaSchema = z
  .object({
    taskId: optionalId,
    employeeId: optionalId,
    documentTypeId: optionalId,
    expiryDate: z
      .union([z.literal(""), z.coerce.date()])
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
  })
  .refine((v) => v.taskId || v.employeeId, { message: "Choose who this document is for", path: ["employeeId"] });

export const reviewSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z
      .string()
      .trim()
      .max(500)
      .transform((v) => v || null)
      .nullable()
      .optional(),
  })
  .refine((v) => v.decision === "APPROVE" || Boolean(v.reason), {
    message: "Tell them why it was rejected so they can fix it",
    path: ["reason"],
  });

export const documentListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(DocumentStatus).optional(),
  employeeId: z.string().optional(),
  documentTypeId: z.string().optional(),
  /** Only documents expiring within this many days (and not already expired). */
  expiringWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
