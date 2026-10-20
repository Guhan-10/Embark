import type { z } from "zod";
import type {
  taskAssignSchema,
  taskCreateSchema,
  taskListSchema,
  taskStatusSchema,
  taskUpdateSchema,
} from "./schemas";
import type { getTask, listTasks } from "./queries";

export type TaskCreateInput = z.input<typeof taskCreateSchema>;
export type TaskUpdateInput = z.input<typeof taskUpdateSchema>;
export type TaskStatusInput = z.input<typeof taskStatusSchema>;
export type TaskAssignInput = z.input<typeof taskAssignSchema>;
export type TaskListFilters = z.input<typeof taskListSchema>;

export type TaskList = Awaited<ReturnType<typeof listTasks>>;
export type TaskListItem = TaskList["items"][number];
export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTask>>>;
