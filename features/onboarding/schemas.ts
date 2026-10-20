import { z } from "zod";
import { AssigneeType, ProcessStatus, TaskPriority } from "@/generated/prisma/enums";

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

export const templateTaskSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title").max(200),
  description: optionalText(2000),
  assigneeType: z.enum(AssigneeType, { error: "Choose who does this task" }),
  /** Days after the joining date; negative for tasks due before day one. */
  dueOffsetDays: z.coerce.number().int().min(-90).max(365).default(0),
  priority: z.enum(TaskPriority).default("MEDIUM"),
  documentTypeId: optionalId,
});

export const templateStepSchema = z.object({
  title: z.string().trim().min(1, "Enter a step title").max(120),
  tasks: z.array(templateTaskSchema).min(1, "Add at least one task to this step").max(50),
});

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Enter a template name").max(120),
  description: optionalText(1000),
  departmentId: optionalId,
  steps: z.array(templateStepSchema).min(1, "Add at least one step").max(20),
});

export const startOnboardingSchema = z.object({
  employeeId: z.string().min(1, "Choose an employee"),
  /** Leave empty to start with no tasks and add them by hand. */
  templateId: optionalId,
  targetDate: z.coerce.date().nullable().optional(),
});

export const processListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ProcessStatus).optional(),
  departmentId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const teamProgressSchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
