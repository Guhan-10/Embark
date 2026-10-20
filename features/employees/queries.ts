import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { effectiveHrUserId } from "@/lib/auth/hr-owner";
import { can, employeeScope, isHrViewer, type CurrentUser } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  HR_ROLES,
  NON_PRIVILEGED_ROLES,
  REPORTING_MANAGER_ROLES,
} from "@/lib/constants/roles";
import { prisma } from "@/lib/db/prisma";
import { employeeListSchema } from "./schemas";
import type { EmployeeListFilters } from "./types";

// Read queries. Callers pass the user from requirePageAccess(); results are always scoped to them.

const listSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  roleKey: true,
  joiningDate: true,
  archivedAt: true,
  userId: true,
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, title: true } },
  hrManager: { select: { id: true, name: true } },
  reportingManager: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EmployeeSelect;

function searchFilter(q: string): Prisma.EmployeeWhereInput {
  // Every word must match a name, email, or code, so "priya sha" finds Priya Sharma.
  return {
    AND: q.split(/\s+/).map((word) => ({
      OR: [
        { firstName: { contains: word, mode: "insensitive" } },
        { lastName: { contains: word, mode: "insensitive" } },
        { email: { contains: word, mode: "insensitive" } },
        { employeeCode: { contains: word, mode: "insensitive" } },
      ],
    })),
  };
}

export async function listEmployees(user: CurrentUser, rawFilters: EmployeeListFilters = {}) {
  const f = employeeListSchema.parse(rawFilters);

  const where: Prisma.EmployeeWhereInput = {
    AND: [
      employeeScope(user),
      { archivedAt: f.archived ? { not: null } : null },
      f.q ? searchFilter(f.q) : {},
      f.departmentId ? { departmentId: f.departmentId } : {},
      f.status ? { status: f.status } : {},
      f.roleKey ? { roleKey: f.roleKey } : {},
      f.hrManagerId ? { hrManagerId: f.hrManagerId } : {},
    ],
  };

  const orderBy: Prisma.EmployeeOrderByWithRelationInput[] =
    f.sort === "name"
      ? [{ firstName: f.order }, { lastName: f.order }]
      : [{ [f.sort]: f.order }, { id: "asc" }];

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy,
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: listSelect,
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    items: items.map(({ userId, ...e }) => ({ ...e, isRegistered: userId !== null })),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  };
}

export async function getEmployee(user: CurrentUser, id: string) {
  const employee = await prisma.employee.findFirst({
    where: { AND: [{ id }, employeeScope(user)] },
    include: {
      department: {
        select: {
          id: true,
          name: true,
          hrEmployeeId: true,
          hrEmployee: { select: { userId: true, archivedAt: true, firstName: true, lastName: true } },
        },
      },
      designation: { select: { id: true, title: true } },
      role: { select: { key: true, name: true } },
      hrManager: { select: { id: true, name: true, email: true } },
      reportingManager: { select: { id: true, firstName: true, lastName: true, email: true } },
      directReports: {
        where: { archivedAt: null },
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
        orderBy: { firstName: "asc" },
      },
      user: { select: { emailVerified: true, isActive: true, createdAt: true } },
      processes: {
        select: { id: true, status: true, startDate: true, targetDate: true, completedAt: true },
        orderBy: { createdAt: "desc" },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!employee) return null;

  const { userId, user: account, createdBy, hrManager, ...rest } = employee;
  const hrUserId = effectiveHrUserId(employee);
  const departmentHr = employee.department?.hrEmployee;
  // Reporting managers (viewing a direct report) and employees (viewing themselves) don't get login or admin details.
  const hrView = isHrViewer(user);
  return {
    ...rest,
    hrManager: hrManager ? { id: hrManager.id, name: hrManager.name, ...(hrView ? { email: hrManager.email } : {}) } : null,
    account: hrView ? account : undefined,
    createdBy: hrView ? createdBy : undefined,
    /** Who is actually in charge: the department's HR if it has one, otherwise the HR manager. */
    hr: departmentHr
      ? { name: `${departmentHr.firstName} ${departmentHr.lastName}`, isRegistered: Boolean(hrUserId), fromDepartment: true }
      : hrManager
        ? { name: hrManager.name, isRegistered: true, fromDepartment: false }
        : null,
    isRegistered: userId !== null,
    canEdit: can(user, PERMISSIONS.EMPLOYEE_UPDATE) && !employee.archivedAt,
    canArchive: can(user, PERMISSIONS.EMPLOYEE_ARCHIVE) && userId !== user.id,
  };
}

/** Choices for the add/edit employee form, limited to what this user may pick. */
export async function getEmployeeFormOptions(user: CurrentUser) {
  const isAdmin = can(user, PERMISSIONS.USER_MANAGE);

  const ownedDepartments = isAdmin
    ? 0
    : await prisma.department.count({ where: { hrEmployee: { userId: user.id } } });

  const [departments, hrManagers, reportingManagers, roles] = await Promise.all([
    prisma.department.findMany({
      // HR Managers only see their own departments (or, if they own none, departments with no HR).
      where: isAdmin ? {} : ownedDepartments ? { hrEmployee: { userId: user.id } } : { hrEmployeeId: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        hrEmployee: { select: { firstName: true, lastName: true } },
        designations: { select: { id: true, title: true }, orderBy: { title: "asc" } },
      },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: { key: { in: HR_ROLES } } } },
        ...(isAdmin ? {} : { id: user.id }),
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: {
        AND: [
          { archivedAt: null, roleKey: { in: REPORTING_MANAGER_ROLES } },
          isAdmin ? {} : employeeScope(user),
        ],
      },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.role.findMany({
      where: isAdmin ? {} : { key: { in: NON_PRIVILEGED_ROLES } },
      select: { key: true, name: true, description: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { departments, hrManagers, reportingManagers, roles, canChooseHrManager: isAdmin };
}
