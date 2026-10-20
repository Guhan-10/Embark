import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEmployee, getEmployeeFormOptions, listEmployees } from "@/features/employees/queries";
import {
  createEmployee,
  resendWelcomeEmail,
  setDepartmentHr,
  updateEmployee,
} from "@/features/employees/service";
import { getProcess } from "@/features/onboarding/queries";
import { startOnboarding } from "@/features/onboarding/service";
import { getAssignableUsers, getTask, listTasks } from "@/features/tasks/queries";
import { assignTask, changeTaskStatus, createTask } from "@/features/tasks/service";
import { deliverEmail } from "@/lib/email/deliver";
import { createPerson, prisma, register, resetData } from "../helpers/db";

const sent = vi.mocked(deliverEmail);
const dept = (name: string) => prisma.department.findUniqueOrThrow({ where: { name } });
const template = () => prisma.onboardingTemplate.findFirstOrThrow({ where: { name: "Standard onboarding" } });

/**
 * Engineering is owned by HR1 and Design by HR2. Each adds a new hire (EMP01, EMP11),
 * who registers, and starts their onboarding.
 */
async function twoSpaces() {
  const engineering = await dept("Engineering");
  const design = await dept("Design");
  const { user: admin } = await createPerson("HR_ADMIN");
  const { user: hr1, employee: hr1Record } = await createPerson("HR_MANAGER", { firstName: "Hana", lastName: "One" });
  const { user: hr2, employee: hr2Record } = await createPerson("HR_MANAGER", { firstName: "Hari", lastName: "Two" });
  await setDepartmentHr(null, engineering.id, hr1Record.id);
  await setDepartmentHr(null, design.id, hr2Record.id);

  const emp01 = await createEmployee(hr1, { firstName: "Emp", lastName: "Zero1", email: "emp01@example.com", joiningDate: "2026-11-02" });
  const emp11 = await createEmployee(hr2, { firstName: "Emp", lastName: "Eleven", email: "emp11@example.com", joiningDate: "2026-11-02" });
  const emp01User = await register("emp01@example.com");
  const emp11User = await register("emp11@example.com");

  const t = await template();
  const p01 = await startOnboarding(hr1, { employeeId: emp01.id, templateId: t.id });
  const p11 = await startOnboarding(hr2, { employeeId: emp11.id, templateId: t.id });
  const tasks11 = await prisma.onboardingTask.findMany({ where: { processId: p11.id } });

  return { engineering, design, admin, hr1, hr2, hr1Record, hr2Record, emp01, emp11, emp01User, emp11User, p01, p11, tasks11 };
}

beforeEach(async () => {
  await resetData();
  sent.mockClear();
});

describe("HR spaces", () => {
  it("puts people into the adding HR's department and space automatically", async () => {
    const { engineering, design, hr1, hr2, emp01, emp11 } = await twoSpaces();
    expect(emp01).toMatchObject({ departmentId: engineering.id, hrManagerId: hr1.id });
    expect(emp11).toMatchObject({ departmentId: design.id, hrManagerId: hr2.id });
  });

  it("keeps each HR's employees, onboarding, and tasks invisible to the other HR", async () => {
    const { hr1, hr2, emp11, p01, p11, tasks11 } = await twoSpaces();

    const seen = async (u: typeof hr1) => (await listEmployees(u, { pageSize: 100 })).items.map((e) => e.email);
    expect(await seen(hr1)).not.toContain("emp11@example.com");
    expect(await seen(hr2)).not.toContain("emp01@example.com");

    expect(await getEmployee(hr1, emp11.id)).toBeNull();
    expect(await getProcess(hr1, p11.id)).toBeNull();
    expect(await getProcess(hr2, p01.id)).toBeNull();
    expect(await getTask(hr1, tasks11[0].id)).toBeNull();
    expect((await listTasks(hr1, { pageSize: 100 })).items.every((t) => t.process.id === p01.id)).toBe(true);

    await expect(updateEmployee(hr1, emp11.id, { phone: "1" })).rejects.toThrow("not found");
    await expect(changeTaskStatus(hr1, tasks11[0].id, { status: "DONE" })).rejects.toThrow("not found");
    await expect(createTask(hr1, { processId: p11.id, title: "Sneaky" })).rejects.toThrow("not found");
    await expect(startOnboarding(hr1, { employeeId: emp11.id })).rejects.toThrow("not found");
  });

  it("keeps new hires out of each other's tasks", async () => {
    const { emp01User, emp11User, p01, p11, tasks11 } = await twoSpaces();

    const mine = await listTasks(emp01User, { pageSize: 100 });
    expect(mine.total).toBeGreaterThan(0);
    expect(mine.items.every((t) => t.process.id === p01.id)).toBe(true);
    expect((await listTasks(emp11User, { pageSize: 100 })).items.every((t) => t.process.id === p11.id)).toBe(true);
    expect(await getTask(emp01User, tasks11[0].id)).toBeNull();
    expect(await getProcess(emp01User, p11.id)).toBeNull();
  });

  it("stops HR managers placing people in another HR's department", async () => {
    const { design, hr1 } = await twoSpaces();
    await expect(
      createEmployee(hr1, { firstName: "X", lastName: "Y", email: "xy@example.com", joiningDate: "2026-11-02", departmentId: design.id }),
    ).rejects.toThrow("managed by another HR");
  });

  it("only offers HR managers their own departments, managers, and assignees", async () => {
    const { engineering, admin, hr1, hr2, design, p01 } = await twoSpaces();
    const { employee: designLead } = await createPerson("REPORTING_MANAGER", { departmentId: design.id });
    const { employee: engLead } = await createPerson("REPORTING_MANAGER", { departmentId: engineering.id });

    const options = await getEmployeeFormOptions(hr1);
    expect(options.departments.map((d) => d.name)).toEqual(["Engineering"]);
    const managers = options.reportingManagers.map((m) => m.id);
    expect(managers).toContain(engLead.id);
    expect(managers).toContain(hr1.employeeId); // HR staff can be someone's line manager too
    expect(managers).not.toContain(designLead.id);

    const assignable = (await getAssignableUsers(hr1, p01.id)).map((u) => u.id);
    expect(assignable).not.toContain(hr2.id);
    expect(assignable).not.toContain(admin.id);
    const task = await prisma.onboardingTask.findFirstOrThrow({ where: { processId: p01.id } });
    await expect(assignTask(hr1, task.id, { userIds: [hr2.id] })).rejects.toThrow("involved in this onboarding");
  });

  it("gives people an HR Admin adds to a department that department's HR, and won't let it be overridden", async () => {
    const { admin, design, hr1, hr2 } = await twoSpaces();
    const hire = await createEmployee(admin, { firstName: "D", lastName: "Hire", email: "dh@example.com", joiningDate: "2026-11-02", departmentId: design.id });
    expect(hire.hrManagerId).toBe(hr2.id);
    await expect(
      createEmployee(admin, { firstName: "D", lastName: "Two", email: "d2@example.com", joiningDate: "2026-11-02", departmentId: design.id, hrManagerId: hr1.id }),
    ).rejects.toThrow("always managed by them");
  });

  it("moves people, visibility, and open HR tasks when a department changes HR", async () => {
    const { design, hr1, hr2, hr1Record, emp11, p11 } = await twoSpaces();
    const result = await setDepartmentHr(null, design.id, hr1Record.id);
    expect(result.employees).toBeGreaterThanOrEqual(1);

    expect(await getEmployee(hr1, emp11.id)).not.toBeNull();
    expect(await getEmployee(hr2, emp11.id)).toBeNull();
    const hrTasks = await prisma.onboardingTask.findMany({
      where: { processId: p11.id, assigneeType: "HR_MANAGER" },
      include: { assignments: true },
    });
    expect(hrTasks.every((t) => t.assignments[0]?.userId === hr1.id)).toBe(true);
  });

  it("holds HR tasks until a department's HR registers, then hands them over", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const sales = await dept("Sales");
    const hrRecord = await createEmployee(admin, { firstName: "Sam", lastName: "Sales", email: "sam@example.com", joiningDate: "2026-01-01", roleKey: "HR_MANAGER" });
    await setDepartmentHr(null, sales.id, hrRecord.id);

    const hire = await createEmployee(admin, { firstName: "S", lastName: "Hire", email: "sh@example.com", joiningDate: "2026-11-02", departmentId: sales.id });
    const process = await startOnboarding(admin, { employeeId: hire.id, templateId: (await template()).id });
    const hrTasks = () =>
      prisma.onboardingTask.findMany({ where: { processId: process.id, assigneeType: "HR_MANAGER" }, include: { assignments: true } });
    expect((await hrTasks()).every((t) => t.assignments.length === 0)).toBe(true);

    const sam = await register("sam@example.com");
    expect((await hrTasks()).every((t) => t.assignments[0]?.userId === sam.id)).toBe(true);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: hire.id } })).hrManagerId).toBe(sam.id);
    expect((await listEmployees(sam)).items.map((e) => e.id)).toContain(hire.id);
  });
});

describe("welcome email", () => {
  it("emails new people a sign-up link and can resend it until they register", async () => {
    const { user: hr } = await createPerson("HR_MANAGER", { firstName: "Hana", lastName: "One" });
    const hire = await createEmployee(hr, { firstName: "Priya", lastName: "S", email: "Priya@Example.com", joiningDate: "2026-11-02" });

    expect(sent).toHaveBeenCalledTimes(1);
    const email = sent.mock.calls[0][0];
    expect(email.to).toBe("priya@example.com");
    expect(email.text).toContain("Hana One has added you");
    expect(email.text).toMatch(/\/sign-up\?token=[\w-]{40,}/);

    await resendWelcomeEmail(hr, hire.id);
    expect(sent).toHaveBeenCalledTimes(2);

    await register("priya@example.com");
    await expect(resendWelcomeEmail(hr, hire.id)).rejects.toThrow("already created their login");
  });

  it("still adds the person if the email fails", async () => {
    const { user: hr } = await createPerson("HR_MANAGER");
    sent.mockRejectedValueOnce(new Error("SMTP down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const hire = await createEmployee(hr, { firstName: "A", lastName: "B", email: "ab@example.com", joiningDate: "2026-11-02" });
    expect(hire.id).toBeTruthy();
    spy.mockRestore();
  });
});
