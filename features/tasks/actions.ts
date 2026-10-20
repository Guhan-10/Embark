"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/rbac";
import { runAction, type ActionResult } from "@/lib/utils/action";
import { assignTask, changeTaskStatus, createTask, updateTask } from "./service";
import type { TaskAssignInput, TaskCreateInput, TaskStatusInput, TaskUpdateInput } from "./types";

function refresh(taskId: string, processId: string) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/assigned-to-me");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath(`/onboarding/${processId}`);
  revalidatePath("/dashboard");
}

export async function createTaskAction(input: TaskCreateInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const task = await createTask(await requireUser(), input);
    refresh(task.id, task.processId);
    return { id: task.id };
  });
}

export async function updateTaskAction(id: string, input: TaskUpdateInput): Promise<ActionResult> {
  return runAction(async () => {
    const task = await updateTask(await requireUser(), id, input);
    refresh(id, task.processId);
  });
}

export async function changeTaskStatusAction(id: string, input: TaskStatusInput): Promise<ActionResult> {
  return runAction(async () => {
    const task = await changeTaskStatus(await requireUser(), id, input);
    refresh(id, task.processId);
  });
}

export async function assignTaskAction(id: string, input: TaskAssignInput): Promise<ActionResult> {
  return runAction(async () => {
    await assignTask(await requireUser(), id, input);
    revalidatePath(`/tasks/${id}`);
    revalidatePath("/tasks");
  });
}
