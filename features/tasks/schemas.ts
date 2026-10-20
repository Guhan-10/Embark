import { z } from "zod";
import { TaskPriority, TaskStatus } from "@/generated/prisma/enums";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

const optionalId = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .optional();

const flag = z.union([z.boolean(), z.stringbool()]);

export const taskCreateSchema = z.object({
  processId: z.string().min(1),
  stepId: optionalId,
  title: z.string().trim().min(1, "Enter a task title").max(200),
  description: optionalText(2000),
  priority: z.enum(TaskPriority).default("MEDIUM"),
  dueDate: z.coerce.date().nullable().optional(),
  documentTypeId: optionalId,
  assigneeIds: z.array(z.string().min(1)).max(10).default([]),
});

export const taskUpdateSchema = taskCreateSchema
  .pick({ stepId: true, title: true, description: true, priority: true, dueDate: true })
  .partial();

export const taskStatusSchema = z
  .object({
    status: z.enum(TaskStatus),
    note: optionalText(500),
  })
  .refine((v) => !["BLOCKED", "SKIPPED"].includes(v.status) || Boolean(v.note), {
    message: "Add a short note explaining why",
    path: ["note"],
  });

export const taskAssignSchema = z.object({
  userIds: z.array(z.string().min(1)).max(10),
});

export const TASK_SORT_FIELDS = ["dueDate", "createdAt", "priority", "completedAt"] as const;

export const taskListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  processId: z.string().optional(),
  employeeId: z.string().optional(),
  assignedToMe: flag.default(false),
  overdue: flag.default(false),
  /** Done and skipped tasks are hidden unless asked for. */
  includeClosed: flag.default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(TASK_SORT_FIELDS).default("dueDate"),
  order: z.enum(["asc", "desc"]).default("asc"),
});
