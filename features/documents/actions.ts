"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/rbac";
import { runAction, type ActionResult } from "@/lib/utils/action";
import { deleteDocument, reviewDocument } from "./service";
import type { ReviewInput } from "./types";

// Uploads and downloads go through the API routes in app/api/documents (files don't fit server actions).

function refresh(id: string, employeeId: string, taskId: string | null) {
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  revalidatePath(`/employees/${employeeId}`);
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

export async function reviewDocumentAction(id: string, input: ReviewInput): Promise<ActionResult> {
  return runAction(async () => {
    const document = await reviewDocument(await requireUser(), id, input);
    refresh(id, document.employeeId, document.taskId);
  });
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const document = await deleteDocument(await requireUser(), id);
    refresh(id, document.employeeId, document.taskId);
  });
}
