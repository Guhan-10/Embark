import { beforeEach, describe, expect, it } from "vitest";
import { uploadDocument } from "@/features/documents/service";
import { archiveEmployee, createEmployee } from "@/features/employees/service";
import {
  listAuditLogs,
  listDepartments,
  listRolesWithPermissions,
  listUsers,
} from "@/features/settings/queries";
import {
  createDepartment,
  createDesignation,
  createDocumentType,
  deleteDepartment,
  deleteDesignation,
  deleteDocumentType,
  revokeUserSessions,
  setRolePermissions,
  setUserActive,
} from "@/features/settings/service";
import { loadUserContext } from "@/lib/auth/rbac";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/constants/permissions";
import { seedRolesAndPermissions } from "@/prisma/seed-data";
import { createPerson, prisma, resetData } from "../helpers/db";

const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"));

async function restoreDefaultPermissions() {
  for (const role of await prisma.role.findMany()) {
    const perms = await prisma.permission.findMany({
      where: { key: { in: DEFAULT_ROLE_PERMISSIONS[role.key as keyof typeof DEFAULT_ROLE_PERMISSIONS] } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
}

beforeEach(async () => {
  await resetData();
  await restoreDefaultPermissions();
});

describe("roles and permissions", () => {
  it("changes what a role can do, immediately, and survives re-seeding", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: hr } = await createPerson("HR_MANAGER");
    const current = (await listRolesWithPermissions(admin)).roles.find((r) => r.key === "HR_MANAGER")!;

    await setRolePermissions(admin, "HR_MANAGER", {
      permissionKeys: current.permissionKeys.filter((k) => k !== "report:export"),
    });
    expect((await loadUserContext(hr.id))?.permissions.has("report:export")).toBe(false);

    await seedRolesAndPermissions();
    expect((await loadUserContext(hr.id))?.permissions.has("report:export")).toBe(false);
  });

  it("protects the HR Admin role and admin-only permissions", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: hr } = await createPerson("HR_MANAGER");
    await expect(setRolePermissions(admin, "HR_ADMIN", { permissionKeys: [] })).rejects.toThrow("always has every permission");
    await expect(setRolePermissions(admin, "EMPLOYEE", { permissionKeys: ["user:manage"] })).rejects.toThrow("Only HR Admins");
    await expect(setRolePermissions(hr, "EMPLOYEE", { permissionKeys: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await listRolesWithPermissions(admin)).permissions.find((p) => p.key === "audit:read")?.adminOnly).toBe(true);
  });
});

describe("users", () => {
  it("deactivates and reactivates logins, signing them out", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: target } = await createPerson("EMPLOYEE");
    await prisma.session.create({ data: { id: "s1", token: "t1", userId: target.id, expiresAt: new Date(Date.now() + 3_600_000) } });

    await setUserActive(admin, target.id, false);
    expect(await loadUserContext(target.id)).toBeNull();
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    expect((await listUsers(admin, { active: "false" })).items.map((u) => u.id)).toEqual([target.id]);

    await setUserActive(admin, target.id, true);
    expect(await loadUserContext(target.id)).not.toBeNull();
  });

  it("won't let you deactivate yourself, the last active HR Admin, or revive archived employees", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: otherAdmin } = await createPerson("HR_ADMIN");
    await expect(setUserActive(admin, admin.id, false)).rejects.toThrow("your own account");

    // Defensive guard: even an admin acting from a stale session can't switch off the only active admin.
    await prisma.user.update({ where: { id: admin.id }, data: { isActive: false } });
    await expect(setUserActive(admin, otherAdmin.id, false)).rejects.toThrow("last active HR Admin");
    await prisma.user.update({ where: { id: admin.id }, data: { isActive: true } });
    await setUserActive(admin, otherAdmin.id, false); // fine: one admin remains

    const { user: gone, employee } = await createPerson("EMPLOYEE");
    await archiveEmployee(admin, employee.id);
    await expect(setUserActive(admin, gone.id, true)).rejects.toThrow("archived");
  });

  it("signs someone out everywhere without deactivating them", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: target } = await createPerson("EMPLOYEE");
    await prisma.session.createMany({
      data: [1, 2].map((i) => ({ id: `s${i}`, token: `t${i}`, userId: target.id, expiresAt: new Date(Date.now() + 3_600_000) })),
    });
    expect(await revokeUserSessions(admin, target.id)).toEqual({ sessions: 2 });
    expect(await loadUserContext(target.id)).not.toBeNull();
  });
});

describe("departments and designations", () => {
  it("creates, refuses duplicates, and only deletes empty departments", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const legal = await createDepartment(admin, { name: "Legal", code: "leg" });
    expect(legal.code).toBe("LEG");
    await expect(createDepartment(admin, { name: "Legal" })).rejects.toThrow("already exists");

    const counsel = await createDesignation(admin, { departmentId: legal.id, title: "Counsel" });
    await expect(createDesignation(admin, { departmentId: legal.id, title: "Counsel" })).rejects.toThrow("already has");

    await createEmployee(admin, { firstName: "L", lastName: "W", email: "lw@example.com", joiningDate: "2026-12-01", designationId: counsel.id });
    await expect(deleteDesignation(admin, counsel.id)).rejects.toThrow("still have");
    await expect(deleteDepartment(admin, legal.id)).rejects.toThrow("still has 1 people");

    const empty = await createDepartment(admin, { name: "Facilities" });
    await createDesignation(admin, { departmentId: empty.id, title: "Facilities Lead" });
    await deleteDepartment(admin, empty.id);
    expect((await listDepartments(admin)).map((d) => d.name)).not.toContain("Facilities");
  });

  it("is HR Admin only", async () => {
    const { user: hr } = await createPerson("HR_MANAGER");
    await expect(createDepartment(hr, { name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listDepartments(hr)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("document types", () => {
  it("applies new rules to uploads and only deletes unused types", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const photo = await createDocumentType(admin, { name: "ID photo", allowedMimeTypes: ["image/png"], maxSizeMb: 2 });
    expect(photo.maxSizeBytes).toBe(2 * 1024 * 1024);
    await expect(createDocumentType(admin, { name: "Bad", allowedMimeTypes: ["application/x-msdownload"] })).rejects.toThrow();

    await expect(
      uploadDocument(admin, { name: "photo.pdf", bytes: PDF }, { employeeId: admin.employeeId!, documentTypeId: photo.id }),
    ).rejects.toThrow("Upload PNG");

    const unused = await createDocumentType(admin, { name: "Unused", allowedMimeTypes: ["application/pdf"] });
    await deleteDocumentType(admin, unused.id);
    const inUse = await prisma.documentType.findUniqueOrThrow({ where: { name: "Government ID" } }); // used by the template
    await expect(deleteDocumentType(admin, inUse.id)).rejects.toThrow("in use");
  });
});

describe("audit log", () => {
  it("shows HR Admins who did what, including system jobs, and nobody else", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: hr } = await createPerson("HR_MANAGER");
    await createDepartment(admin, { name: "Legal" });
    await prisma.auditLog.create({ data: { actorId: null, action: "document.expire", entityType: "Document", entityId: "d1" } });

    const logs = await listAuditLogs(admin);
    expect(logs.items.map((l) => [l.action, l.actor?.name])).toEqual(
      expect.arrayContaining([["department.create", admin.name], ["document.expire", "System"]]),
    );
    expect((await listAuditLogs(admin, { action: "department." })).total).toBe(1);
    await expect(listAuditLogs(hr)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
