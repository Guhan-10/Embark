import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadDocument } from "@/features/documents/service";
import { createEmployee, setDepartmentHr } from "@/features/employees/service";
import { listNotifications } from "@/features/notifications/queries";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/service";
import { startOnboarding } from "@/features/onboarding/service";
import { deliverEmail } from "@/lib/email/deliver";
import { runDailyJobs } from "@/lib/jobs/daily";
import { dispatchNotificationEmails } from "@/lib/jobs/notification-emails";
import { reconcileDepartmentHr } from "@/lib/jobs/reconcile";
import { isOverdueReminderDay, processDocumentExpiry, sendTaskReminders } from "@/lib/jobs/reminders";
import { addDays, startOfToday } from "@/lib/utils/date";
import { createPerson, prisma, register, resetData } from "../helpers/db";

const sent = vi.mocked(deliverEmail);
const PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"));

/** HR1 owns Engineering; Priya (registered) is mid-onboarding and joins on `joining`. */
async function onboarding(joining: Date) {
  const { user: hr, employee: hrRecord } = await createPerson("HR_MANAGER");
  const engineering = await prisma.department.findUniqueOrThrow({ where: { name: "Engineering" } });
  await setDepartmentHr(null, engineering.id, hrRecord.id);
  const emp = await createEmployee(hr, { firstName: "Priya", lastName: "S", email: "priya@example.com", joiningDate: joining });
  const user = await register("priya@example.com");
  const template = await prisma.onboardingTemplate.findFirstOrThrow({ where: { name: "Standard onboarding" } });
  const process = await startOnboarding(hr, { employeeId: emp.id, templateId: template.id });
  await prisma.notification.deleteMany(); // start each test from a clean inbox
  sent.mockClear(); // and forget the welcome email
  return { hr, hrRecord, emp, user, process, engineering };
}

const notes = (where: object = {}) => prisma.notification.findMany({ where, orderBy: { createdAt: "asc" } });

beforeEach(async () => {
  await resetData();
  sent.mockClear();
});

describe("task reminders", () => {
  it("reminds assignees the day before a task is due, once", async () => {
    const today = startOfToday();
    // "Welcome session" is due on the joining day, so joining tomorrow makes it due tomorrow.
    const { user, hr } = await onboarding(addDays(today, 1));

    await sendTaskReminders();
    await sendTaskReminders(); // a re-run the same day adds nothing

    const dueSoon = await notes({ type: "TASK_DUE_SOON" });
    expect(dueSoon.filter((n) => n.userId === user.id).map((n) => n.title).sort()).toEqual([
      "Due tomorrow: Read the employee handbook",
      "Due tomorrow: Submit bank details form",
    ]);
    expect(dueSoon.filter((n) => n.userId === hr.id).map((n) => n.title)).toEqual(["Due tomorrow: Welcome session and office tour"]);
    expect(dueSoon.every((n) => n.emailPending)).toBe(true);
  });

  it("sends overdue reminders on day 1 and then weekly, plus one summary for HR", async () => {
    expect([1, 2, 7, 8, 15].map(isOverdueReminderDay)).toEqual([true, false, false, true, true]);

    const today = startOfToday();
    const { user, hr } = await onboarding(addDays(today, 3)); // pre-boarding uploads due 3 days before → due today
    await sendTaskReminders(addDays(today, 1)); // day 1 overdue
    const day1 = await notes({ type: "TASK_OVERDUE" });
    expect(day1.filter((n) => n.userId === user.id)).toHaveLength(2); // ID and offer letter uploads
    expect(day1.filter((n) => n.userId === hr.id).map((n) => n.title)).toEqual(
      expect.arrayContaining(["2 onboarding tasks are overdue in your space"]),
    );

    // Track one task: "Upload government ID" is due 3 days before joining, i.e. today.
    const idReminders = () =>
      prisma.notification.count({ where: { userId: user.id, title: { endsWith: "Upload government ID" } } });
    expect(await idReminders()).toBe(1);
    await sendTaskReminders(addDays(today, 2)); // day 2 overdue: quiet for this task
    expect(await idReminders()).toBe(1);
    await sendTaskReminders(addDays(today, 8)); // day 8: the weekly reminder
    expect(await idReminders()).toBe(2);
  });

  it("ignores finished and cancelled onboarding", async () => {
    const today = startOfToday();
    const { process } = await onboarding(addDays(today, 1));
    await prisma.onboardingProcess.update({ where: { id: process.id }, data: { status: "CANCELLED" } });
    await sendTaskReminders();
    expect(await prisma.notification.count()).toBe(0);
  });
});

describe("document expiry", () => {
  it("warns at 30, 7, and 0 days, then marks the document expired", async () => {
    const today = startOfToday();
    const { user, hr, emp } = await onboarding(today);
    const passport = await prisma.documentType.findUniqueOrThrow({ where: { name: "Passport" } });
    const doc = await uploadDocument(user, { name: "passport.pdf", bytes: PDF }, {
      employeeId: emp.id,
      documentTypeId: passport.id,
      expiryDate: addDays(today, 30),
    });
    await prisma.notification.deleteMany();

    await processDocumentExpiry(today); // 30 days left
    await processDocumentExpiry(today); // re-run: no duplicates
    await processDocumentExpiry(addDays(today, 10)); // 20 days left: nothing
    await processDocumentExpiry(addDays(today, 23)); // 7 days left
    await processDocumentExpiry(addDays(today, 30)); // expires today
    const warnings = await notes({ type: "DOCUMENT_EXPIRING", userId: user.id });
    expect(warnings.map((n) => n.title)).toEqual([
      "Your Passport expires in 30 days",
      "Your Passport expires in 7 days",
      "Your Passport expires today",
    ]);
    expect(await prisma.notification.count({ where: { type: "DOCUMENT_EXPIRING", userId: hr.id } })).toBe(3);

    await processDocumentExpiry(addDays(today, 31));
    expect((await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })).status).toBe("EXPIRED");
    expect((await notes({ type: "DOCUMENT_EXPIRED" })).map((n) => n.userId).sort()).toEqual([hr.id, user.id].sort());

    await processDocumentExpiry(addDays(today, 32)); // already expired: nothing more
    expect(await prisma.notification.count({ where: { type: "DOCUMENT_EXPIRED" } })).toBe(2);
  });
});

describe("email outbox", () => {
  it("emails notifications flagged for email once, and skips in-app-only ones and deactivated users", async () => {
    const { user, hr } = await onboarding(addDays(startOfToday(), 1));
    await sendTaskReminders();
    await prisma.notification.create({ data: { userId: hr.id, type: "TASK_COMPLETED", title: "In-app only" } });

    const flagged = await prisma.notification.count({ where: { emailPending: true } });
    expect(flagged).toBeGreaterThan(0);
    const first = await dispatchNotificationEmails();
    expect(first.queued).toBe(flagged); // the TASK_COMPLETED one isn't emailed
    expect(sent.mock.calls.map(([email]) => email.subject)).toContain("Due tomorrow: Read the employee handbook");
    const [email, opts] = sent.mock.calls.find(([e]) => e.to === "priya@example.com")!;
    expect(email.text).toMatch(/http:\/\/localhost:3000\/tasks\//);
    expect(opts?.jobId).toMatch(/^notification-/);
    expect((await dispatchNotificationEmails()).queued).toBe(0); // nothing left

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    await prisma.notification.create({ data: { userId: user.id, type: "TASK_OVERDUE", title: "x", emailPending: true } });
    expect(await dispatchNotificationEmails()).toMatchObject({ queued: 0, skipped: 1 });
  });

  it("keeps a notification pending if queueing fails, and sends it next time", async () => {
    const { user } = await onboarding(addDays(startOfToday(), 1));
    await prisma.notification.create({ data: { userId: user.id, type: "TASK_OVERDUE", title: "Retry me", emailPending: true } });
    sent.mockRejectedValueOnce(new Error("Redis and SMTP both down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await dispatchNotificationEmails()).toMatchObject({ queued: 0, failed: 1 });
    expect(await dispatchNotificationEmails()).toMatchObject({ queued: 1, failed: 0 });
    spy.mockRestore();
  });
});

describe("department HR fix-up", () => {
  it("catches department HR changes made with raw SQL", async () => {
    const { emp, engineering, process } = await onboarding(addDays(startOfToday(), 5));
    const { user: newHr, employee: newHrRecord } = await createPerson("HR_MANAGER");
    await prisma.$executeRaw`UPDATE departments SET "hrEmployeeId" = ${newHrRecord.id} WHERE id = ${engineering.id}`;

    expect(await reconcileDepartmentHr()).toEqual({ employeesMoved: 1 });
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: emp.id } })).hrManagerId).toBe(newHr.id);
    const hrTasks = await prisma.onboardingTask.findMany({
      where: { processId: process.id, assigneeType: "HR_MANAGER" },
      include: { assignments: true },
    });
    expect(hrTasks.every((t) => t.assignments[0]?.userId === newHr.id)).toBe(true);
    expect(await reconcileDepartmentHr()).toEqual({ employeesMoved: 0 });
  });

  it("runs as part of the daily jobs", async () => {
    await onboarding(addDays(startOfToday(), 1));
    const result = await runDailyJobs();
    expect(result).toMatchObject({ reconcile: { employeesMoved: 0 }, documents: { expired: 0 } });
    expect(result.tasks.dueSoon).toBeGreaterThan(0);
  });
});

describe("notifications inbox", () => {
  it("lists only your own notifications and marks them read", async () => {
    const { user, hr } = await onboarding(addDays(startOfToday(), 1));
    await sendTaskReminders();

    const inbox = await listNotifications(user);
    expect(inbox.items.length).toBeGreaterThan(0);
    expect(inbox.unread).toBe(inbox.total);

    const hrNote = await prisma.notification.findFirstOrThrow({ where: { userId: hr.id } });
    expect(await markNotificationRead(user.id, hrNote.id)).toBe(0); // can't touch someone else's

    await markNotificationRead(user.id, inbox.items[0].id);
    expect((await listNotifications(user, { unreadOnly: true })).total).toBe(inbox.total - 1);
    await markAllNotificationsRead(user.id);
    expect((await listNotifications(user)).unread).toBe(0);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: hrNote.id } })).readAt).toBeNull();
  });
});
