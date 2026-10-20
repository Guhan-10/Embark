"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/rbac";
import { runAction, type ActionResult } from "@/lib/utils/action";
import {
  cancelOnboarding,
  createTemplate,
  setTemplateActive,
  startOnboarding,
  updateTemplate,
} from "./service";
import type { StartOnboardingInput, TemplateInput } from "./types";

export async function startOnboardingAction(
  input: StartOnboardingInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const process = await startOnboarding(await requireUser(), input);
    revalidatePath("/onboarding");
    revalidatePath(`/employees/${process.employeeId}`);
    return { id: process.id };
  });
}

export async function cancelOnboardingAction(id: string, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const process = await cancelOnboarding(await requireUser(), id, reason);
    revalidatePath("/onboarding");
    revalidatePath(`/onboarding/${id}`);
    revalidatePath(`/employees/${process.employeeId}`);
  });
}

export async function createTemplateAction(input: TemplateInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const template = await createTemplate(await requireUser(), input);
    revalidatePath("/onboarding");
    return { id: template.id };
  });
}

export async function updateTemplateAction(id: string, input: TemplateInput): Promise<ActionResult> {
  return runAction(async () => {
    await updateTemplate(await requireUser(), id, input);
    revalidatePath("/onboarding");
  });
}

export async function setTemplateActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  return runAction(async () => {
    await setTemplateActive(await requireUser(), id, isActive);
    revalidatePath("/onboarding");
  });
}
