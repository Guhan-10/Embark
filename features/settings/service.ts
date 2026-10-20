import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { assertCan, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS, type PermissionKey } from "@/lib/constants/permissions";
import { ROLES } from "@/lib/constants/roles";
import { audit } from "@/lib/db/audit";
import { prisma } from "@/lib/db/prisma";
import { ActionError } from "@/lib/utils/action";
import { ADMIN_ONLY_PERMISSIONS } from "./constants";
import { departmentSchema, designationSchema, documentTypeSchema, rolePermissionsSchema } from "./schemas";
import type { DepartmentInput, DesignationInput, DocumentTypeInput, RolePermissionsInput } from "./types";

// HR Admin settings. Each function checks its own permission and protects against locking everyone out.

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ─── Roles and permissions ───────────────────────────────────────────────────

/**
 * Replaces a role's permissions. The HR Admin role always keeps every permission, and the admin-only
 * permissions (managing users and roles, reading the audit log) can't be given to other roles.
 */
export async function setRolePermissions(user: CurrentUser, roleKey: string, raw: RolePermissionsInput) {
  assertCan(user, PERMISSIONS.ROLE_MANAGE);
  const input = rolePermissionsSchema.parse(raw);
  if (roleKey === ROLES.HR_ADMIN) throw new ActionError("The HR Admin role always has every permission.");

  const keys = [...new Set(input.permissionKeys)] as PermissionKey[];
  const adminOnly = keys.filter((k) => ADMIN_ONLY_PERMISSIONS.includes(k));
  if (adminOnly.length) throw new ActionError(`Only HR Admins can have: ${adminOnly.join(", ")}.`);

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { key: roleKey }, include: { permissions: { include: { permission: true } } } });
    if (!role) throw new ActionError("Role not found.");
    const permissions = await tx.permission.findMany({ where: { key: { in: keys } } });
    if (permissions.length !== keys.length) throw new ActionError("One of those permissions doesn't exist.");

    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });

    const before = role.permissions.map((p) => p.permission.key);
    await audit(tx, {
      actorId: user.id,
      action: "role.permissions",
      entityType: "Role",
      entityId: role.key,
      metadata: { added: keys.filter((k) => !before.includes(k)), removed: before.filter((k) => !keys.includes(k as PermissionKey)) },
    });
    return { roleKey, permissionKeys: keys };
  });
}

// ─── Users ───────────────────────────────────────────────────────────────────

/**
 * Turns a login on or off. Turning it off signs the person out everywhere. You can't deactivate yourself
 * or the last active HR Admin, and archived employees are reactivated by restoring them instead.
 */
export async function setUserActive(user: CurrentUser, userId: string, isActive: boolean) {
  assertCan(user, PERMISSIONS.USER_MANAGE);
  if (userId === user.id) throw new ActionError("You can't deactivate your own account.");

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      include: { employee: { select: { archivedAt: true } }, roles: { include: { role: true } } },
    });
    if (!target) throw new ActionError("User not found.");
    if (isActive && target.employee?.archivedAt) {
      throw new ActionError("This person's employee record is archived. Restore it to give them access again.");
    }
    if (!isActive && target.roles.some((r) => r.role.key === ROLES.HR_ADMIN)) {
      const otherAdmins = await tx.user.count({
        where: { id: { not: userId }, isActive: true, roles: { some: { role: { key: ROLES.HR_ADMIN } } } },
      });
      if (!otherAdmins) throw new ActionError("You can't deactivate the last active HR Admin.");
    }

    const updated = await tx.user.update({ where: { id: userId }, data: { isActive } });
    if (!isActive) await tx.session.deleteMany({ where: { userId } });
    await audit(tx, {
      actorId: user.id,
      action: isActive ? "user.activate" : "user.deactivate",
      entityType: "User",
      entityId: userId,
    });
    return updated;
  });
}

/** Signs someone out on every device (e.g. a lost laptop) without deactivating them. */
export async function revokeUserSessions(user: CurrentUser, userId: string) {
  assertCan(user, PERMISSIONS.USER_MANAGE);
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  await audit(prisma, { actorId: user.id, action: "user.sign_out_everywhere", entityType: "User", entityId: userId, metadata: { sessions: count } });
  return { sessions: count };
}

// ─── Departments and designations ────────────────────────────────────────────

export async function createDepartment(user: CurrentUser, raw: DepartmentInput) {
  assertCan(user, PERMISSIONS.DEPARTMENT_MANAGE);
  const input = departmentSchema.parse(raw);
  try {
    const department = await prisma.department.create({ data: input });
    await audit(prisma, { actorId: user.id, action: "department.create", entityType: "Department", entityId: department.id });
    return department;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ActionError("A department with that name or code already exists.");
    throw error;
  }
}

export async function updateDepartment(user: CurrentUser, id: string, raw: DepartmentInput) {
  assertCan(user, PERMISSIONS.DEPARTMENT_MANAGE);
  const input = departmentSchema.parse(raw);
  try {
    const department = await prisma.department.update({ where: { id }, data: input });
    await audit(prisma, { actorId: user.id, action: "department.update", entityType: "Department", entityId: id });
    return department;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ActionError("A department with that name or code already exists.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ActionError("Department not found.");
    }
    throw error;
  }
}

/** Deletes a department nobody belongs to (archived people included, to keep their history intact). */
export async function deleteDepartment(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.DEPARTMENT_MANAGE);
  return prisma.$transaction(async (tx) => {
    const department = await tx.department.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
    if (!department) throw new ActionError("Department not found.");
    if (department._count.employees) {
      throw new ActionError(`${department.name} still has ${department._count.employees} people. Move them first.`);
    }
    await tx.designation.deleteMany({ where: { departmentId: id } });
    await tx.department.delete({ where: { id } });
    await audit(tx, { actorId: user.id, action: "department.delete", entityType: "Department", entityId: id, metadata: { name: department.name } });
  });
}

export async function createDesignation(user: CurrentUser, raw: DesignationInput) {
  assertCan(user, PERMISSIONS.DEPARTMENT_MANAGE);
  const input = designationSchema.parse(raw);
  if (!(await prisma.department.findUnique({ where: { id: input.departmentId } }))) {
    throw new ActionError("Department not found.");
  }
  try {
    return await prisma.designation.create({ data: input });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ActionError("That department already has this designation.");
    throw error;
  }
}

export async function renameDesignation(user: CurrentUser, id: string, title: string) {
  assertCan(user, PERMISSIONS.DEPARTMENT_MANAGE);
  const parsed = designationSchema.shape.title.parse(title);
  try {
    return await prisma.designation.update({ where: { id }, data: { title: parsed } });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ActionError("That department already has this designation.");
    throw error;
  }
}

export async function deleteDesignation(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.DEPARTMENT_MANAGE);
  const designation = await prisma.designation.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
  if (!designation) throw new ActionError("Designation not found.");
  if (designation._count.employees) throw new ActionError("People still have this designation. Change theirs first.");
  await prisma.designation.delete({ where: { id } });
}

// ─── Document types ──────────────────────────────────────────────────────────

function documentTypeData(input: ReturnType<typeof documentTypeSchema.parse>) {
  const { maxSizeMb, ...rest } = input;
  return { ...rest, maxSizeBytes: maxSizeMb * 1024 * 1024 };
}

export async function createDocumentType(user: CurrentUser, raw: DocumentTypeInput) {
  assertCan(user, PERMISSIONS.DOCUMENT_TYPE_MANAGE);
  const input = documentTypeSchema.parse(raw);
  try {
    const type = await prisma.documentType.create({ data: documentTypeData(input) });
    await audit(prisma, { actorId: user.id, action: "document_type.create", entityType: "DocumentType", entityId: type.id });
    return type;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ActionError("A document type with that name already exists.");
    throw error;
  }
}

/** Changes apply to new uploads only; documents already uploaded aren't re-checked. */
export async function updateDocumentType(user: CurrentUser, id: string, raw: DocumentTypeInput) {
  assertCan(user, PERMISSIONS.DOCUMENT_TYPE_MANAGE);
  const input = documentTypeSchema.parse(raw);
  try {
    const type = await prisma.documentType.update({ where: { id }, data: documentTypeData(input) });
    await audit(prisma, { actorId: user.id, action: "document_type.update", entityType: "DocumentType", entityId: id });
    return type;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ActionError("A document type with that name already exists.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ActionError("Document type not found.");
    }
    throw error;
  }
}

/** Only unused types can be deleted, so no uploaded document or template loses its type. */
export async function deleteDocumentType(user: CurrentUser, id: string) {
  assertCan(user, PERMISSIONS.DOCUMENT_TYPE_MANAGE);
  const type = await prisma.documentType.findUnique({
    where: { id },
    include: { _count: { select: { documents: true, templateTasks: true, tasks: true } } },
  });
  if (!type) throw new ActionError("Document type not found.");
  const { documents, templateTasks, tasks } = type._count;
  if (documents || templateTasks || tasks) {
    throw new ActionError("This document type is in use by uploads, templates, or tasks. Turn off \"required\" instead.");
  }
  await prisma.documentType.delete({ where: { id } });
  await audit(prisma, { actorId: user.id, action: "document_type.delete", entityType: "DocumentType", entityId: id, metadata: { name: type.name } });
}
