import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { assertCan, can, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS, type PermissionKey } from "@/lib/constants/permissions";
import { HR_ROLES } from "@/lib/constants/roles";
import { prisma } from "@/lib/db/prisma";
import { ADMIN_ONLY_PERMISSIONS } from "./constants";
import { auditListSchema, userListSchema } from "./schemas";
import type { AuditListFilters, UserListFilters } from "./types";

/** Every role with its permissions and how many people have it, plus the full permission list. */
export async function listRolesWithPermissions(user: CurrentUser) {
  assertCan(user, PERMISSIONS.ROLE_MANAGE);
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
    }),
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
  ]);
  return {
    roles: roles.map((r) => ({
      key: r.key,
      name: r.name,
      description: r.description,
      userCount: r._count.users,
      permissionKeys: r.permissions.map((p) => p.permission.key),
      editable: r.key !== "HR_ADMIN",
    })),
    permissions: permissions.map((p) => ({
      key: p.key,
      description: p.description,
      adminOnly: ADMIN_ONLY_PERMISSIONS.includes(p.key as PermissionKey),
    })),
  };
}

/** Logins with their employee record, role, status, and last sign-in. */
export async function listUsers(user: CurrentUser, rawFilters: UserListFilters = {}) {
  assertCan(user, PERMISSIONS.USER_MANAGE);
  const f = userListSchema.parse(rawFilters);
  const where: Prisma.UserWhereInput = {
    AND: [
      f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: "insensitive" } },
              { email: { contains: f.q, mode: "insensitive" } },
              { employee: { employeeCode: { contains: f.q, mode: "insensitive" } } },
            ],
          }
        : {},
      f.roleKey ? { roles: { some: { role: { key: f.roleKey } } } } : {},
      f.active === undefined ? {} : { isActive: f.active },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        roles: { select: { role: { select: { key: true, name: true } } } },
        employee: { select: { id: true, employeeCode: true, archivedAt: true, department: { select: { name: true } } } },
        sessions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: rows.map(({ roles, sessions, ...u }) => ({
      ...u,
      role: roles[0]?.role ?? null,
      lastSignInAt: sessions[0]?.createdAt ?? null,
      isSelf: u.id === user.id,
    })),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

/** Departments with their HR, designations, and head count. */
export async function listDepartments(user: CurrentUser) {
  assertCan(user, PERMISSIONS.DEPARTMENT_MANAGE);
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: {
      hrEmployee: { select: { id: true, firstName: true, lastName: true, email: true, userId: true } },
      designations: {
        orderBy: { title: "asc" },
        include: { _count: { select: { employees: { where: { archivedAt: null } } } } },
      },
      _count: { select: { employees: { where: { archivedAt: null } } } },
    },
  });
  return departments.map(({ _count, designations, hrEmployee, ...d }) => ({
    ...d,
    hr: hrEmployee
      ? { employeeId: hrEmployee.id, name: `${hrEmployee.firstName} ${hrEmployee.lastName}`, email: hrEmployee.email, isRegistered: Boolean(hrEmployee.userId) }
      : null,
    headCount: _count.employees,
    designations: designations.map(({ _count: c, ...des }) => ({ ...des, headCount: c.employees })),
  }));
}

export async function listDocumentTypesForSettings(user: CurrentUser) {
  assertCan(user, PERMISSIONS.DOCUMENT_TYPE_MANAGE);
  const types = await prisma.documentType.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { documents: { where: { deletedAt: null } } } } },
  });
  return types.map(({ _count, maxSizeBytes, ...t }) => ({
    ...t,
    maxSizeMb: Math.round(maxSizeBytes / 1024 / 1024),
    documentCount: _count.documents,
  }));
}

/** The audit trail, newest first. */
export async function listAuditLogs(user: CurrentUser, rawFilters: AuditListFilters = {}) {
  assertCan(user, PERMISSIONS.AUDIT_READ);
  const f = auditListSchema.parse(rawFilters);
  const where: Prisma.AuditLogWhereInput = {
    ...(f.actorId ? { actorId: f.actorId } : {}),
    ...(f.action ? { action: { startsWith: f.action } } : {}),
    ...(f.entityType ? { entityType: f.entityType } : {}),
    ...(f.entityId ? { entityId: f.entityId } : {}),
    ...(f.from || f.to ? { createdAt: { gte: f.from, lte: f.to } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    items: items.map(({ actor, actorId, ...log }) => ({ ...log, actor: actor ?? (actorId ? null : { id: null, name: "System", email: null }) })),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

/** People who can be a department's HR: active employees with an HR role. */
export async function listHrCandidates(user: CurrentUser) {
  assertCan(user, PERMISSIONS.USER_MANAGE);
  const rows = await prisma.employee.findMany({
    where: { archivedAt: null, roleKey: { in: HR_ROLES } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, employeeCode: true, userId: true },
  });
  return rows.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, employeeCode: e.employeeCode, isRegistered: Boolean(e.userId) }));
}

/** The actions and record types that appear in the audit log, for its filters. */
export async function getAuditFacets(user: CurrentUser) {
  assertCan(user, PERMISSIONS.AUDIT_READ);
  const [actions, entityTypes] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } }),
  ]);
  return { actions: actions.map((a) => a.action), entityTypes: entityTypes.map((e) => e.entityType) };
}

/** Counts for the settings overview, only for sections this user can open. */
export async function getSettingsSummary(user: CurrentUser) {
  const has = (p: PermissionKey) => can(user, p);
  const [roles, users, inactiveUsers, departments, unassignedDepartments, documentTypes, auditToday] = await Promise.all([
    has(PERMISSIONS.ROLE_MANAGE) ? prisma.role.count() : null,
    has(PERMISSIONS.USER_MANAGE) ? prisma.user.count() : null,
    has(PERMISSIONS.USER_MANAGE) ? prisma.user.count({ where: { isActive: false } }) : null,
    has(PERMISSIONS.DEPARTMENT_MANAGE) ? prisma.department.count() : null,
    has(PERMISSIONS.DEPARTMENT_MANAGE) ? prisma.department.count({ where: { hrEmployeeId: null } }) : null,
    has(PERMISSIONS.DOCUMENT_TYPE_MANAGE) ? prisma.documentType.count() : null,
    has(PERMISSIONS.AUDIT_READ) ? prisma.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }) : null,
  ]);
  return { roles, users, inactiveUsers, departments, unassignedDepartments, documentTypes, auditToday };
}
