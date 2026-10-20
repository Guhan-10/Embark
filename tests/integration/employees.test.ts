import { beforeEach, describe, expect, it } from "vitest";
import { listEmployees, getEmployee } from "@/features/employees/queries";
import {
  archiveEmployee,
  createEmployee,
  restoreEmployee,
  updateEmployee,
} from "@/features/employees/service";
import { loadUserContext } from "@/lib/auth/rbac";
import { createPerson, departmentWithDesignation, prisma, resetData } from "../helpers/db";

const newHire = (overrides: Record<string, unknown> = {}) => ({
  firstName: "Priya",
  lastName: "Sharma",
  email: "Priya.Sharma@Example.com",
  joiningDate: "2026-11-02",
  ...overrides,
});

beforeEach(resetData);

describe("createEmployee", () => {
  it("generates sequential codes and lowercases email", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const first = await createEmployee(admin, newHire());
    const second = await createEmployee(admin, newHire({ email: "arjun@example.com", firstName: "Arjun" }));

    expect(first.employeeCode).toBe("EMB-0001");
    expect(second.employeeCode).toBe("EMB-0002");
    expect(first.email).toBe("priya.sharma@example.com");
    expect(first.status).toBe("PRE_BOARDING");
    expect(first.roleKey).toBe("EMPLOYEE");
  });

  it("rejects a duplicate email regardless of case", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    await createEmployee(admin, newHire());
    await expect(createEmployee(admin, newHire({ email: "PRIYA.SHARMA@example.com" }))).rejects.toThrow(
      "already exists",
    );
  });

  it("makes the HR manager who adds someone their HR manager", async () => {
    const { user: hrAdmin } = await createPerson("HR_ADMIN");
    const { user: hrManager } = await createPerson("HR_MANAGER");
    const employee = await createEmployee(hrManager, newHire({ hrManagerId: hrAdmin.id }));
    expect(employee.hrManagerId).toBe(hrManager.id);
  });

  it("lets HR managers assign only Employee and Reporting Manager roles", async () => {
    const { user: hrManager } = await createPerson("HR_MANAGER");
    await expect(createEmployee(hrManager, newHire({ roleKey: "HR_ADMIN" }))).rejects.toThrow(
      "Only an HR Admin",
    );
    const manager = await createEmployee(hrManager, newHire({ roleKey: "REPORTING_MANAGER" }));
    expect(manager.roleKey).toBe("REPORTING_MANAGER");
  });

  it("refuses people without employee:create", async () => {
    const { user: employee } = await createPerson("EMPLOYEE");
    await expect(createEmployee(employee, newHire())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates field input", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    await expect(createEmployee(admin, newHire({ email: "not-an-email", firstName: "" }))).rejects.toThrow();
  });

  it("fills the department from the designation and rejects mismatches", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const engineering = await departmentWithDesignation("Engineering");
    const design = await departmentWithDesignation("Design");

    const employee = await createEmployee(admin, newHire({ designationId: engineering.designations[0].id }));
    expect(employee.departmentId).toBe(engineering.id);

    await expect(
      createEmployee(
        admin,
        newHire({
          email: "x@example.com",
          departmentId: design.id,
          designationId: engineering.designations[0].id,
        }),
      ),
    ).rejects.toThrow("different department");
  });
});

describe("reporting line", () => {
  it("requires the reporting manager to have a manager role", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { employee: plainEmployee } = await createPerson("EMPLOYEE");
    await expect(
      createEmployee(admin, newHire({ reportingManagerId: plainEmployee.id })),
    ).rejects.toThrow("reporting manager must be");
  });

  it("prevents loops", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { employee: boss } = await createPerson("REPORTING_MANAGER");
    const { employee: lead } = await createPerson("REPORTING_MANAGER", { reportingManagerId: boss.id });

    await expect(updateEmployee(admin, boss.id, { reportingManagerId: lead.id })).rejects.toThrow("loop");
    await expect(updateEmployee(admin, boss.id, { reportingManagerId: boss.id })).rejects.toThrow(
      "own reporting manager",
    );
  });
});

describe("scoping", () => {
  it("shows each role only the people they should see", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: hrA } = await createPerson("HR_MANAGER");
    const { user: hrB } = await createPerson("HR_MANAGER");
    const { user: manager, employee: managerRecord } = await createPerson("REPORTING_MANAGER", { hrManagerId: hrA.id });

    const mine = await createEmployee(hrA, newHire({ reportingManagerId: managerRecord.id }));
    await createEmployee(hrB, newHire({ email: "other@example.com", firstName: "Other" }));
    const { user: employee } = await createPerson("EMPLOYEE");

    const ids = async (u: typeof admin) => (await listEmployees(u, { pageSize: 100 })).items.map((e) => e.id);

    expect((await ids(admin)).length).toBe(7);
    expect(await ids(hrA)).toEqual(expect.arrayContaining([mine.id, hrA.employeeId, managerRecord.id]));
    expect((await ids(hrA)).length).toBe(3);
    expect(await ids(manager)).toEqual(expect.arrayContaining([mine.id, manager.employeeId]));
    expect((await ids(manager)).length).toBe(2);
    expect(await ids(employee)).toEqual([employee.employeeId]);

    expect(await getEmployee(hrB, mine.id)).toBeNull();
    await expect(updateEmployee(hrB, mine.id, { phone: "123" })).rejects.toThrow("not found");
  });
});

describe("updateEmployee", () => {
  it("syncs a registered user's role and blocks changing your own", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: target, employee } = await createPerson("EMPLOYEE");

    await updateEmployee(admin, employee.id, { roleKey: "HR_MANAGER" });
    const reloaded = await loadUserContext(target.id);
    expect(reloaded?.roles).toEqual(["HR_MANAGER"]);

    await expect(updateEmployee(admin, admin.employeeId!, { roleKey: "EMPLOYEE" })).rejects.toThrow(
      "own role",
    );
  });

  it("blocks email changes after registration and keeps the login name in sync", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: target, employee } = await createPerson("EMPLOYEE");

    await expect(updateEmployee(admin, employee.id, { email: "new@example.com" })).rejects.toThrow(
      "already registered",
    );
    await updateEmployee(admin, employee.id, { firstName: "Renamed" });
    const login = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(login.name).toBe(`Renamed ${employee.lastName}`);
  });

  it("only lets HR admins reassign the HR manager", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: hrManager } = await createPerson("HR_MANAGER");
    const hire = await createEmployee(hrManager, newHire());
    await expect(updateEmployee(hrManager, hire.id, { hrManagerId: admin.id })).rejects.toThrow(
      "Only an HR Admin",
    );
    const moved = await updateEmployee(admin, hire.id, { hrManagerId: admin.id });
    expect(moved.hrManagerId).toBe(admin.id);
  });
});

describe("archive and restore", () => {
  it("blocks login, ends sessions, cancels onboarding, and can be undone", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: target, employee } = await createPerson("EMPLOYEE");
    await prisma.session.create({
      data: { id: "s1", token: "t1", userId: target.id, expiresAt: new Date(Date.now() + 3600_000) },
    });
    await prisma.onboardingProcess.create({
      data: { employeeId: employee.id, status: "IN_PROGRESS", startDate: new Date() },
    });

    await archiveEmployee(admin, employee.id);

    expect(await loadUserContext(target.id)).toBeNull();
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    expect((await prisma.onboardingProcess.findFirstOrThrow()).status).toBe("CANCELLED");
    expect((await listEmployees(admin)).items.map((e) => e.id)).not.toContain(employee.id);
    expect((await listEmployees(admin, { archived: "true" })).items.map((e) => e.id)).toEqual([employee.id]);
    await expect(updateEmployee(admin, employee.id, { phone: "1" })).rejects.toThrow("Restore");

    await restoreEmployee(admin, employee.id);
    expect(await loadUserContext(target.id)).not.toBeNull();
  });

  it("refuses to archive yourself or without permission", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: hrManager } = await createPerson("HR_MANAGER");
    await expect(archiveEmployee(admin, admin.employeeId!)).rejects.toThrow("yourself");
    await expect(archiveEmployee(hrManager, admin.employeeId!)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("listEmployees", () => {
  it("searches across name words, filters, and paginates", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const engineering = await departmentWithDesignation("Engineering");
    await createEmployee(admin, newHire({ departmentId: engineering.id }));
    for (let i = 0; i < 4; i++) {
      await createEmployee(admin, newHire({ email: `p${i}@example.com`, firstName: `Person${i}` }));
    }

    const search = await listEmployees(admin, { q: "priya sha" });
    expect(search.items.map((e) => e.email)).toEqual(["priya.sharma@example.com"]);

    const byDept = await listEmployees(admin, { departmentId: engineering.id });
    expect(byDept.total).toBe(1);

    const page2 = await listEmployees(admin, { pageSize: 2, page: 2, sort: "employeeCode", order: "asc" });
    expect(page2.total).toBe(6);
    expect(page2.pageCount).toBe(3);
    expect(page2.items).toHaveLength(2);
  });
});
