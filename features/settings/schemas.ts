import { z } from "zod";
import { DEFAULT_ALLOWED_MIME_TYPES } from "@/lib/constants/files";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

export const rolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string().min(1)).max(100),
});

export const userListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  roleKey: z.string().optional(),
  active: z.union([z.boolean(), z.stringbool()]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Enter a department name").max(80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .max(10)
    .regex(/^[A-Z0-9-]*$/, "Use letters, numbers, and dashes only")
    .transform((v) => v || null)
    .nullable()
    .optional(),
  description: optionalText(500),
});

export const designationSchema = z.object({
  departmentId: z.string().min(1, "Choose a department"),
  title: z.string().trim().min(1, "Enter a designation").max(80),
});

export const documentTypeSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80),
  description: optionalText(500),
  isRequired: z.boolean().default(false),
  hasExpiry: z.boolean().default(false),
  allowedMimeTypes: z
    .array(z.enum(DEFAULT_ALLOWED_MIME_TYPES as [string, ...string[]]))
    .min(1, "Allow at least one file type"),
  /** Megabytes, 1–10. */
  maxSizeMb: z.coerce.number().int().min(1).max(10).default(10),
});

export const auditListSchema = z.object({
  actorId: z.string().optional(),
  action: z.string().trim().max(60).optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
