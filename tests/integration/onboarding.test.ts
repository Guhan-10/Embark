import { beforeEach, describe, expect, it } from "vitest";
import { createEmployee, updateEmployee } from "@/features/employees/service";
import { getProcess, listProcesses } from "@/features/onboarding/queries";
import {
  cancelOnboarding,
  createTemplate,
  setTemplateActive,
  startOnboarding,
  updateTemplate,
} from "@/features/onboarding/service";
import { getTask, listTasks } from "@/features/tasks/queries";
import { assignTask, changeTaskStatus, createTask } from "@/features/tasks/service";
import { loadUserContext } from "@/lib/auth/rbac";
import { addDays } from "@/lib/utils/date";
import { createPerson, prisma, register, resetData } from "../helpers/db";

const standardTemplate = () => prisma.onboardingTemplate.findFirstOrThrow({ where: { name: "Standard onboarding" } });

/** HR manager + reporting manager + a registered new hire, with onboarding started from the standard template. */
async function startedOnboarding() {
  const { user: hr } = await createPerson("HR_MANAGER");
  const { user: manager, employee: managerRecord } = await createPerson("REPORTING_MANAGER");
  const { user: hire, employee } = await createPerson("EMPLOYEE", {
    hrManagerId: hr.id,
    reportingManagerId: managerRecord.id,
  });
  const template = await standardTemplate();
  const process = await startOnboarding(hr, { employeeId: employee.id, templateId: template.id });
  const tasks = await prisma.onboardingTask.findMany({
    where: { processId: process.id },
    include: { assignments: true },
    orderBy: [{ dueDate: "asc" }, { order: "asc" }],
  });
  const byType = (type: string) => tasks.filter((t) => t.assigneeType === type);
  return { hr, manager, hire, employee, process, tasks, byType };
}

/** Closes every open task in a process as its assignee or HR. */
async function finishAll(processId: string, hr: Awaited<ReturnType<typeof createPerson>>["user"]) {
  const tasks = await prisma.onboardingTask.findMany({ where: { processId, status: { not: "DONE" } } });
  for (const task of tasks) {
    await changeTaskStatus(hr, task.id, task.documentTypeId ? { status: "SKIPPED", note: "Collected on paper" } : { status: "DONE" });
  }
}

beforeEach(resetData);

describe("startOnboarding", () => {
  it("copies the template with due dates from the joining date and auto-assigns tasks", async () => {
    const { hr, manager, hire, employee, process, tasks, byType } = await startedOnboarding();

    expect(process.status).toBe("IN_PROGRESS");
    expect(tasks).toHaveLength(12);
    expect(await prisma.onboardingProcessStep.count({ where: { processId: process.id } })).toBe(4);

    const idUpload = tasks.find((t) => t.title === "Upload government ID")!;
    expect(idUpload.dueDate).toEqual(addDays(employee.joiningDate, -3));

    expect(byType("HR_MANAGER").every((t) => t.assignments[0]?.userId === hr.id)).toBe(true);
    expect(byType("REPORTING_MANAGER").every((t) => t.assignments[0]?.userId === manager.id)).toBe(true);
    expect(byType("EMPLOYEE").every((t) => t.assignments[0]?.userId === hire.id)).toBe(true);
    expect(tasks.every((t) => t.assignments[0]?.assignedById === null)).toBe(true);

    expect((await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe("ONBOARDING");

    const notes = await prisma.notification.findMany();
    expect(notes.some((n) => n.userId === hr.id)).toBe(false); // the person who started it isn't notified
    expect(notes.filter((n) => n.userId === hire.id).map((n) => n.type).sort()).toEqual([
      "ONBOARDING_STARTED",
      "TASK_ASSIGNED",
    ]);
    expect(notes.find((n) => n.userId === manager.id)?.title).toContain("3 onboarding tasks");
  });

  it("refuses a second active onboarding, archived employees, other HR managers' people, and employees", async () => {
    const { hr, hire, employee } = await startedOnboarding();
    const template = await standardTemplate();
    await expect(startOnboarding(hr, { employeeId: employee.id, templateId: template.id })).rejects.toThrow(
      "already has onboarding",
    );

    const { user: otherHr } = await createPerson("HR_MANAGER");
    const theirs = await createEmployee(otherHr, { firstName: "A", lastName: "B", email: "ab@example.com", joiningDate: "2026-12-01" });
    await expect(startOnboarding(hr, { employeeId: theirs.id })).rejects.toThrow("not found");
    await expect(startOnboarding(hire, { employeeId: theirs.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses inactive templates", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const hire = await createEmployee(admin, { firstName: "N", lastName: "H", email: "nh@example.com", joiningDate: "2026-12-01" });
    const template = await standardTemplate();
    await setTemplateActive(admin, template.id, false);
    await expect(startOnboarding(admin, { employeeId: hire.id, templateId: template.id })).rejects.toThrow("inactive");
  });
});

describe("auto-assignment", () => {
  it("hands waiting tasks to people when they register", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const manager = await createEmployee(admin, {
      firstName: "Mira", lastName: "Lead", email: "mira@example.com", joiningDate: "2026-01-01", roleKey: "REPORTING_MANAGER",
    });
    const hire = await createEmployee(admin, {
      firstName: "Nik", lastName: "New", email: "nik@example.com", joiningDate: "2026-12-01", reportingManagerId: manager.id,
    });
    const process = await startOnboarding(admin, { employeeId: hire.id, templateId: (await standardTemplate()).id });
    expect(await prisma.taskAssignment.count({ where: { task: { processId: process.id } } })).toBe(0);

    await register("nik@example.com");
    await register("mira@example.com");

    const assigned = await prisma.taskAssignment.findMany({
      where: { task: { processId: process.id } },
      include: { task: true, user: true },
    });
    expect(assigned.filter((a) => a.user.email === "nik@example.com")).toHaveLength(6);
    expect(assigned.filter((a) => a.user.email === "mira@example.com")).toHaveLength(3);
    expect(await prisma.notification.count({ where: { type: "TASK_ASSIGNED" } })).toBe(2);
  });

  it("moves auto-assigned open tasks to a new reporting manager but keeps hand-picked ones", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { hr, manager, employee, byType } = await startedOnboarding();
    const { user: newManager, employee: newManagerRecord } = await createPerson("REPORTING_MANAGER");
    const [handPicked, ...rest] = byType("REPORTING_MANAGER");
    await assignTask(hr, handPicked.id, { userIds: [manager.id] });

    await updateEmployee(admin, employee.id, { reportingManagerId: newManagerRecord.id });

    const after = await prisma.taskAssignment.findMany({ where: { taskId: { in: byType("REPORTING_MANAGER").map((t) => t.id) } } });
    expect(after.find((a) => a.taskId === handPicked.id)?.userId).toBe(manager.id);
    expect(rest.every((t) => after.find((a) => a.taskId === t.id)?.userId === newManager.id)).toBe(true);
  });
});

describe("task status", () => {
  it("lets assignees update their own tasks and records history", async () => {
    const { hire, byType } = await startedOnboarding();
    const handbook = byType("EMPLOYEE").find((t) => t.title === "Read the employee handbook")!;

    await changeTaskStatus(hire, handbook.id, { status: "IN_PROGRESS" });
    await changeTaskStatus(hire, handbook.id, { status: "DONE" });

    const task = await getTask(hire, handbook.id);
    expect(task?.status).toBe("DONE");
    expect(task?.completedAt).not.toBeNull();
    expect(task?.history.map((h) => h.toStatus)).toEqual(["DONE", "IN_PROGRESS", "TODO"]);
  });

  it("stops people updating tasks that aren't theirs, and only HR can skip", async () => {
    const { hire, manager, byType } = await startedOnboarding();
    const hrTask = byType("HR_MANAGER")[0];
    const hireTask = byType("EMPLOYEE").find((t) => !t.documentTypeId)!;

    await expect(changeTaskStatus(hire, hrTask.id, { status: "DONE" })).rejects.toThrow();
    await expect(changeTaskStatus(manager, hireTask.id, { status: "DONE" })).rejects.toThrow("Only the people assigned");
    await expect(changeTaskStatus(hire, hireTask.id, { status: "SKIPPED", note: "nah" })).rejects.toThrow("Only HR");
  });

  it("requires a note to block or skip, and a document for document tasks", async () => {
    const { hr, hire, byType } = await startedOnboarding();
    const docTask = byType("EMPLOYEE").find((t) => t.documentTypeId)!;

    await expect(changeTaskStatus(hr, docTask.id, { status: "SKIPPED" })).rejects.toThrow();
    await expect(changeTaskStatus(hire, docTask.id, { status: "DONE" })).rejects.toThrow("Upload the required document");

    await prisma.document.create({
      data: {
        employeeId: (await prisma.onboardingProcess.findFirstOrThrow()).employeeId,
        taskId: docTask.id,
        fileName: "id.pdf",
        storageKey: "k1",
        mimeType: "application/pdf",
        fileSize: 100,
      },
    });
    await expect(changeTaskStatus(hire, docTask.id, { status: "DONE" })).resolves.toMatchObject({ status: "DONE" });
  });

  it("completes the process when every task is closed and reopens it if one is reopened", async () => {
    const { hr, hire, employee, process } = await startedOnboarding();
    await finishAll(process.id, hr);

    expect((await prisma.onboardingProcess.findUniqueOrThrow({ where: { id: process.id } })).status).toBe("COMPLETED");
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe("ACTIVE");
    expect(await prisma.notification.count({ where: { type: "ONBOARDING_COMPLETED", userId: hire.id } })).toBe(1);

    const anyTask = await prisma.onboardingTask.findFirstOrThrow({ where: { processId: process.id, status: "DONE" } });
    await changeTaskStatus(hr, anyTask.id, { status: "TODO" });
    expect((await prisma.onboardingProcess.findUniqueOrThrow({ where: { id: process.id } })).status).toBe("IN_PROGRESS");
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe("ONBOARDING");
  });

  it("notifies the HR manager when someone else completes a task", async () => {
    const { hr, hire, byType } = await startedOnboarding();
    const handbook = byType("EMPLOYEE").find((t) => t.title === "Read the employee handbook")!;
    await changeTaskStatus(hire, handbook.id, { status: "DONE" });
    expect(await prisma.notification.count({ where: { userId: hr.id, type: "TASK_COMPLETED" } })).toBe(1);
  });
});

describe("listTasks and getProcess", () => {
  it("scopes tasks per person and filters mine, overdue, and closed", async () => {
    const { hr, manager, hire, byType, process } = await startedOnboarding();
    const { user: stranger } = await createPerson("EMPLOYEE");

    expect((await listTasks(hr, { pageSize: 100 })).total).toBe(12);
    expect((await listTasks(manager, { pageSize: 100 })).total).toBe(12); // their report's onboarding
    expect((await listTasks(manager, { assignedToMe: true })).total).toBe(3);
    expect((await listTasks(hire, { assignedToMe: "true" })).total).toBe(6);
    expect((await listTasks(stranger)).total).toBe(0);

    const handbook = byType("EMPLOYEE").find((t) => t.title === "Read the employee handbook")!;
    await changeTaskStatus(hire, handbook.id, { status: "DONE" });
    expect((await listTasks(hire, { assignedToMe: true })).total).toBe(5);
    expect((await listTasks(hire, { assignedToMe: true, includeClosed: true })).total).toBe(6);

    // The test hire joined in January, so everything not done is overdue.
    expect((await listTasks(hr, { overdue: true, pageSize: 100 })).total).toBe(11);

    const detail = await getProcess(hr, process.id);
    expect(detail?.progress).toMatchObject({ total: 12, done: 1, percent: 8, overdue: 11 });
    expect(detail?.steps.map((s) => s.tasks.length)).toEqual([4, 3, 3, 2]);
    expect(await getProcess(stranger, process.id)).toBeNull();
  });

  it("shows progress in the process list", async () => {
    const { hr } = await startedOnboarding();
    const list = await listProcesses(hr);
    expect(list.total).toBe(1);
    expect(list.items[0].progress.total).toBe(12);
  });
});

describe("manual tasks and cancelling", () => {
  it("adds a hand-made task and reopens completed onboarding", async () => {
    const { hr, hire, process } = await startedOnboarding();
    await finishAll(process.id, hr);

    const task = await createTask(hr, { processId: process.id, title: "Return the welcome kit form", assigneeIds: [hire.id] });
    const assignment = await prisma.taskAssignment.findFirstOrThrow({ where: { taskId: task.id } });
    expect(assignment.assignedById).toBe(hr.id);
    expect((await prisma.onboardingProcess.findUniqueOrThrow({ where: { id: process.id } })).status).toBe("IN_PROGRESS");

    const detail = await getProcess(hr, process.id);
    expect(detail?.steps.at(-1)?.title).toBe("Other tasks");
  });

  it("cancels onboarding, hides its tasks, and blocks further changes", async () => {
    const { hr, hire, employee, process, byType } = await startedOnboarding();
    await cancelOnboarding(hr, process.id, "Offer withdrawn");

    expect((await prisma.employee.findUniqueOrThrow({ where: { id: employee.id } })).status).toBe("PRE_BOARDING");
    expect((await listTasks(hire, { assignedToMe: true })).total).toBe(0);
    const handbook = byType("EMPLOYEE").find((t) => !t.documentTypeId)!;
    await expect(changeTaskStatus(hire, handbook.id, { status: "DONE" })).rejects.toThrow("cancelled");
    await expect(cancelOnboarding(hr, process.id)).rejects.toThrow("in progress");
  });
});

describe("templates", () => {
  const template = {
    name: "Engineering onboarding",
    steps: [
      {
        title: "Week one",
        tasks: [
          { title: "Set up dev environment", assigneeType: "EMPLOYEE" as const, dueOffsetDays: 1 },
          { title: "Code walkthrough", assigneeType: "REPORTING_MANAGER" as const, dueOffsetDays: 3, priority: "HIGH" as const },
        ],
      },
    ],
  };

  it("creates and replaces templates, HR admins only", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const { user: hr } = await createPerson("HR_MANAGER");
    await expect(createTemplate(hr, template)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const created = await createTemplate(admin, template);
    await updateTemplate(admin, created.id, {
      ...template,
      steps: [...template.steps, { title: "Month one", tasks: [{ title: "Ship a fix", assigneeType: "EMPLOYEE", dueOffsetDays: 20 }] }],
    });
    const tasks = await prisma.templateTask.findMany({ where: { step: { templateId: created.id } } });
    expect(tasks.map((t) => t.title).sort()).toEqual(["Code walkthrough", "Set up dev environment", "Ship a fix"]);

    await expect(createTemplate(admin, { name: "Empty", steps: [] })).rejects.toThrow();
  });

  it("lets HR managers start onboarding from a template and staff see it", async () => {
    const { user: admin } = await createPerson("HR_ADMIN");
    const created = await createTemplate(admin, template);
    const { user: hr } = await createPerson("HR_MANAGER");
    const hire = await createEmployee(hr, { firstName: "E", lastName: "N", email: "en@example.com", joiningDate: "2026-12-01" });
    const process = await startOnboarding(hr, { employeeId: hire.id, templateId: created.id });
    expect((await getProcess(hr, process.id))?.progress.total).toBe(2);
    expect((await loadUserContext(hr.id))?.permissions.has("template:manage")).toBe(false);
  });
});
