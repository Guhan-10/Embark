"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/rbac";
import { runAction, type ActionResult } from "@/lib/utils/action";
import {
  archiveEmployee,
  createEmployee,
  resendWelcomeEmail,
  restoreEmployee,
  updateEmployee,
} from "./service";
import type { EmployeeCreateInput, EmployeeUpdateInput } from "./types";

function refresh(id?: string) {
  revalidatePath("/employees");
  revalidatePath("/employees/archived");
  if (id) revalidatePath(`/employees/${id}`);
}

export async function createEmployeeAction(
  input: EmployeeCreateInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const employee = await createEmployee(await requireUser(), input);
    refresh();
    return { id: employee.id };
  });
}

export async function updateEmployeeAction(
  id: string,
  input: EmployeeUpdateInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await updateEmployee(await requireUser(), id, input);
    refresh(id);
    return { id };
  });
}

export async function archiveEmployeeAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await archiveEmployee(await requireUser(), id);
    refresh(id);
  });
}

export async function restoreEmployeeAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await restoreEmployee(await requireUser(), id);
    refresh(id);
  });
}

export async function resendWelcomeEmailAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await resendWelcomeEmail(await requireUser(), id);
  });
}
