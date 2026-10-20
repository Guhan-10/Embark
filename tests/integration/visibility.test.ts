import { beforeEach, describe, expect, it } from "vitest";
import { listDocuments } from "@/features/documents/queries";
import { getEmployee, listEmployees } from "@/features/employees/queries";
import { createEmployee, setDepartmentHr } from "@/features/employees/service";
import { getProcess, listTeamProgress } from "@/features/onboarding/queries";
import { startOnboarding } from "@/features/onboarding/service";
import { getTask, listTasks } from "@/features/tasks/queries";
import { changeTaskStatus } from "@/features/tasks/service";
import { createPerson, prisma, register, resetData } from "../helpers/db";

/**
 * Engineering (HR1): a reporting manager, EMP01 (reports to them), and EMP02.
 * Design (HR2): EMP11. Everyone is registered and onboarding has started for the three new hires.
 */
async function company() {
  const engineering = await prisma.department.findUniqueOrThrow({ where: { name: "Engineering" } });
  const design = await prisma.department.findUniqueOrThrow({ where: { name: "Design" } });
  const { user: admin } = await createPerson("HR_ADMIN");
  const { user: hr1, employee: hr1Record } = await createPerson("HR_MANAGER");
  const { user: hr2, employee: hr2Record } = await createPerson("HR_MANAGER");
  await setDepartmentHr(null, engineering.id, hr1Record.id);
  await setDepartmentHr(null, design.id, hr2Record.id);

  const add = (by: typeof hr1, email: string, extra: Record<string, unknown> = {}) =>
    createEmployee(by, { firstName: email.split("@")[0], lastName: "X", email, joiningDate: "2026-11-02", ...extra });
  const lead = await add(hr1, "lead@example.com", { roleKey: "REPORTING_MANAGER" });
  const emp01 = await add(hr1, "emp01@example.com", { reportingManagerId: lead.id });
  const emp02 = await add(hr1, "emp02@example.com");
  const emp11 = await add(hr2, "emp11@example.com");
  const [leadUser, emp01User, emp02User, emp11User] = await Promise.all(
    ["lead", "emp01", "emp02", "emp11"].map((n) => register(`${n}@example.com`)),
  );

  const template = await prisma.onboardingTemplate.findFirstOrThrow({ where: { name: "Standard onboarding" } });
  const p01 = await startOnboarding(hr1, { employeeId: emp01.id, templateId: template.id });
  const p02 = await startOnboarding(hr1, { employeeId: emp02.id, templateId: template.id });
  await startOnboarding(hr2, { employeeId: emp11.id, templateId: template.id });

  // EMP02 finishes one of their tasks so their progress isn't zero.
  const handbook02 = await prisma.onboardingTask.findFirstOrThrow({ where: { processId: p02.id, title: "Read the employee handbook" } });
  await changeTaskStatus(emp02User, handbook02.id, { status: "DONE" });

  return { admin, hr1, hr2, lead, emp01, emp02, emp11, leadUser, emp01User, emp02User, emp11User, p01, p02, handbook02 };
}

const names = (items: { name: string }[]) => items.map((i) => i.name);

beforeEach(resetData);

describe("employees see colleagues' progress only", () => {
  it("shows EMP01 their space's names and progress, nothing else, and nothing from other spaces", async () => {
    const { emp01User } = await company();
    const team = await listTeamProgress(emp01User);

    expect(names(team.items)).toEqual(expect.arrayContaining(["emp01 X", "emp02 X", "lead X"]));
    expect(names(team.items)).not.toContain("emp11 X");

    const emp02 = team.items.find((i) => i.name === "emp02 X")!;
    expect(Object.keys(emp02).sort()).toEqual(["department", "designation", "id", "isMe", "joiningDate", "name", "onboarding"]);
    expect(emp02.onboarding).toMatchObject({ status: "IN_PROGRESS", done: 1, total: 12, percent: 8 });
    expect(emp02.onboarding?.processId).toBeUndefined();
    expect(team.items.find((i) => i.name === "emp01 X")?.isMe).toBe(true);
  });

  it("hides colleagues' profiles, onboarding detail, tasks, and documents", async () => {
    const { emp01User, emp02, p01, p02, handbook02 } = await company();

    expect(await getEmployee(emp01User, emp02.id)).toBeNull();
    expect(await getProcess(emp01User, p02.id)).toBeNull();
    expect(await getTask(emp01User, handbook02.id)).toBeNull();
    expect((await listEmployees(emp01User)).items.map((e) => e.email)).toEqual(["emp01@example.com"]);

    const tasks = await listTasks(emp01User, { pageSize: 100, includeClosed: true });
    expect(tasks.items.every((t) => t.process.id === p01.id)).toBe(true);
    expect((await listDocuments(emp01User)).items).toHaveLength(0);
  });

  it("gives employees their own full onboarding but not login or admin details", async () => {
    const { emp01User, emp01, p01 } = await company();
    const me = await getEmployee(emp01User, emp01.id);
    expect(me?.email).toBe("emp01@example.com");
    expect(me?.account).toBeUndefined();
    expect(me?.createdBy).toBeUndefined();
    expect((await getProcess(emp01User, p01.id))?.progress.total).toBe(12);
  });

  it("keeps someone with no department or HR to themselves", async () => {
    await company();
    const { user: loner } = await createPerson("EMPLOYEE");
    expect((await listTeamProgress(loner)).items.map((i) => i.isMe)).toEqual([true]);
  });
});

describe("reporting managers", () => {
  it("see their direct reports in detail but only progress for other colleagues", async () => {
    const { leadUser, emp01, emp02, p01, p02 } = await company();

    const report = await getEmployee(leadUser, emp01.id);
    expect(report?.email).toBe("emp01@example.com");
    expect(report?.account).toBeUndefined();
    expect(report?.hrManager && "email" in report.hrManager).toBe(false);
    expect(await getProcess(leadUser, p01.id)).not.toBeNull();

    expect(await getEmployee(leadUser, emp02.id)).toBeNull();
    expect(await getProcess(leadUser, p02.id)).toBeNull();
    expect(names((await listTeamProgress(leadUser)).items)).toContain("emp02 X");
    await expect(listDocuments(leadUser)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("HR", () => {
  it("HR managers see their whole space in full, and nothing of other spaces", async () => {
    const { hr1, hr2, emp01, emp11 } = await company();

    const team1 = await listTeamProgress(hr1);
    expect(names(team1.items)).toEqual(expect.arrayContaining(["emp01 X", "emp02 X", "lead X"]));
    expect(names(team1.items)).not.toContain("emp11 X");
    expect(team1.items.find((i) => i.name === "emp01 X")?.onboarding?.processId).toBeTruthy();
    expect((await getEmployee(hr1, emp01.id))?.account).toBeDefined();

    expect(names((await listTeamProgress(hr2)).items)).toEqual(expect.arrayContaining(["emp11 X"]));
    expect(names((await listTeamProgress(hr2)).items)).not.toContain("emp01 X");
    expect(await getEmployee(hr2, emp01.id)).toBeNull();
    expect(await getEmployee(hr1, emp11.id)).toBeNull();
  });

  it("HR admins see everyone", async () => {
    const { admin } = await company();
    expect(names((await listTeamProgress(admin)).items)).toEqual(
      expect.arrayContaining(["emp01 X", "emp02 X", "emp11 X", "lead X"]),
    );
  });
});
