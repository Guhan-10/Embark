import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PermissionKey } from "@/lib/constants/permissions";
import { ROLES, type RoleKey } from "@/lib/constants/roles";
import { auth } from "./auth";
import { ownedByHr } from "./hr-owner";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  roles: RoleKey[];
  permissions: ReadonlySet<PermissionKey>;
};

export class AuthError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code === "UNAUTHENTICATED" ? "You need to sign in." : "You don't have access to do that.");
    this.name = "AuthError";
  }
}

/** The signed-in user with roles and permissions, loaded once per request. Null if signed out or deactivated. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return loadUserContext(session.user.id);
});

/** Loads a user's roles and permissions. Null if the user is deactivated or their employee record is archived. */
export async function loadUserContext(userId: string): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      employee: { select: { id: true, archivedAt: true } },
      roles: {
        select: {
          role: {
            select: {
              key: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });
  if (!user?.isActive || user.employee?.archivedAt) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    employeeId: user.employee?.id ?? null,
    roles: user.roles.map((r) => r.role.key as RoleKey),
    permissions: new Set(
      user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key as PermissionKey)),
    ),
  };
}

export function can(user: CurrentUser, ...permissions: PermissionKey[]) {
  return permissions.every((p) => user.permissions.has(p));
}

export function hasRole(user: CurrentUser, role: RoleKey) {
  return user.roles.includes(role);
}

/** For server actions and API routes: throws AuthError if signed out. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED");
  return user;
}

/** Throws AuthError if the user is missing any of the permissions. */
export function assertCan(user: CurrentUser, ...permissions: PermissionKey[]) {
  if (!can(user, ...permissions)) throw new AuthError("FORBIDDEN");
}

/** For server actions and API routes: throws AuthError if signed out or missing any permission. */
export async function requirePermission(...permissions: PermissionKey[]) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED");
  if (!can(user, ...permissions)) throw new AuthError("FORBIDDEN");
  return user;
}

/** For pages and layouts: redirects to sign-in if signed out, or to the dashboard if missing a permission. */
export async function requirePageAccess(...permissions: PermissionKey[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!can(user, ...permissions)) redirect("/dashboard");
  return user;
}

/**
 * Which employees this user may see in full and act on (profile, onboarding detail, tasks, documents):
 * HR Admin → everyone; HR Manager → their HR space (people in departments they own, plus people they
 * manage in departments with no HR); Reporting Manager → their direct reports; Employee → themselves.
 * Everyone can also see their own record.
 */
export function employeeScope(user: CurrentUser): Prisma.EmployeeWhereInput {
  if (hasRole(user, ROLES.HR_ADMIN)) return {};
  if (hasRole(user, ROLES.HR_MANAGER)) {
    return { OR: [ownedByHr(user.id), { userId: user.id }] };
  }
  if (hasRole(user, ROLES.REPORTING_MANAGER)) {
    return { OR: [{ reportingManager: { userId: user.id } }, { userId: user.id }] };
  }
  return { userId: user.id };
}

/** True for HR staff, who see full details of everyone in their scope. Others get limited views. */
export function isHrViewer(user: CurrentUser) {
  return hasRole(user, ROLES.HR_ADMIN) || hasRole(user, ROLES.HR_MANAGER);
}

/**
 * Everyone in the user's HR space — the people who share their HR. Used only for the colleague directory,
 * which shows names, designations, and onboarding progress, never tasks, documents, or contact details.
 * HR Admin → everyone; HR Manager → their space; others → colleagues under the same HR.
 */
export async function spaceScope(user: CurrentUser): Promise<Prisma.EmployeeWhereInput> {
  if (hasRole(user, ROLES.HR_ADMIN)) return {};
  if (hasRole(user, ROLES.HR_MANAGER)) return { OR: [ownedByHr(user.id), { userId: user.id }] };

  const me = user.employeeId
    ? await prisma.employee.findUnique({
        where: { id: user.employeeId },
        select: { id: true, hrManagerId: true, department: { select: { hrEmployeeId: true } } },
      })
    : null;
  if (!me) return { userId: user.id };
  if (me.department?.hrEmployeeId) return { department: { hrEmployeeId: me.department.hrEmployeeId } };
  if (me.hrManagerId) {
    return {
      AND: [
        { OR: [{ departmentId: null }, { department: { hrEmployeeId: null } }] },
        { hrManagerId: me.hrManagerId },
      ],
    };
  }
  return { id: me.id };
}
