"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/rbac";
import { runAction, type ActionResult } from "@/lib/utils/action";
import { setDepartmentHr } from "@/features/employees/service";
import {
  createDepartment,
  createDesignation,
  createDocumentType,
  deleteDepartment,
  deleteDesignation,
  deleteDocumentType,
  renameDesignation,
  revokeUserSessions,
  setRolePermissions,
  setUserActive,
  updateDepartment,
  updateDocumentType,
} from "./service";
import type { DepartmentInput, DesignationInput, DocumentTypeInput, RolePermissionsInput } from "./types";

const run = <T>(paths: string[], fn: (user: Awaited<ReturnType<typeof requireUser>>) => Promise<T>) =>
  runAction(async () => {
    const result = await fn(await requireUser());
    for (const path of paths) revalidatePath(path);
    return result;
  });

export async function setRolePermissionsAction(roleKey: string, input: RolePermissionsInput): Promise<ActionResult> {
  return run(["/settings/roles"], async (u) => void (await setRolePermissions(u, roleKey, input)));
}

export async function setUserActiveAction(userId: string, isActive: boolean): Promise<ActionResult> {
  return run(["/settings", "/settings/users"], async (u) => void (await setUserActive(u, userId, isActive)));
}

export async function revokeUserSessionsAction(userId: string): Promise<ActionResult<{ sessions: number }>> {
  return run(["/settings/users"], (u) => revokeUserSessions(u, userId));
}

export async function createDepartmentAction(input: DepartmentInput): Promise<ActionResult<{ id: string }>> {
  return run(["/settings", "/settings/departments"], async (u) => ({ id: (await createDepartment(u, input)).id }));
}

export async function updateDepartmentAction(id: string, input: DepartmentInput): Promise<ActionResult> {
  return run(["/settings", "/settings/departments"], async (u) => void (await updateDepartment(u, id, input)));
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  return run(["/settings", "/settings/departments"], (u) => deleteDepartment(u, id));
}

/** Same as `npm run department:set-hr`, for HR Admins who'd rather click than run a command. */
export async function setDepartmentHrAction(departmentId: string, hrEmployeeId: string | null): Promise<ActionResult> {
  return run(["/settings", "/settings/departments", "/employees"], async (u) => void (await setDepartmentHr(u, departmentId, hrEmployeeId)));
}

export async function createDesignationAction(input: DesignationInput): Promise<ActionResult<{ id: string }>> {
  return run(["/settings", "/settings/departments"], async (u) => ({ id: (await createDesignation(u, input)).id }));
}

export async function renameDesignationAction(id: string, title: string): Promise<ActionResult> {
  return run(["/settings/departments"], async (u) => void (await renameDesignation(u, id, title)));
}

export async function deleteDesignationAction(id: string): Promise<ActionResult> {
  return run(["/settings/departments"], (u) => deleteDesignation(u, id));
}

export async function createDocumentTypeAction(input: DocumentTypeInput): Promise<ActionResult<{ id: string }>> {
  return run(["/settings", "/settings/document-types"], async (u) => ({ id: (await createDocumentType(u, input)).id }));
}

export async function updateDocumentTypeAction(id: string, input: DocumentTypeInput): Promise<ActionResult> {
  return run(["/settings/document-types"], async (u) => void (await updateDocumentType(u, id, input)));
}

export async function deleteDocumentTypeAction(id: string): Promise<ActionResult> {
  return run(["/settings", "/settings/document-types"], (u) => deleteDocumentType(u, id));
}
