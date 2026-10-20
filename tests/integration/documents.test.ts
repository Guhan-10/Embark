import { beforeEach, describe, expect, it } from "vitest";
import { getDocument, getDocumentChecklist, listDocuments } from "@/features/documents/queries";
import { deleteDocument, openDocument, reviewDocument, uploadDocument } from "@/features/documents/service";
import { createEmployee, setDepartmentHr } from "@/features/employees/service";
import { startOnboarding } from "@/features/onboarding/service";
import { addDays, startOfToday } from "@/lib/utils/date";
import { createPerson, prisma, register, resetData } from "../helpers/db";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200), Buffer.from("PE\0\0")]);

const file = (name: string, bytes: Buffer) => ({ name, bytes: new Uint8Array(bytes) });

async function readAll(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

/** Engineering (HR1) with a registered new hire mid-onboarding, and Design (HR2) with another. */
async function setup() {
  const { user: hr1, employee: hr1Record } = await createPerson("HR_MANAGER");
  const { user: hr2, employee: hr2Record } = await createPerson("HR_MANAGER");
  const engineering = await prisma.department.findUniqueOrThrow({ where: { name: "Engineering" } });
  const design = await prisma.department.findUniqueOrThrow({ where: { name: "Design" } });
  await setDepartmentHr(null, engineering.id, hr1Record.id);
  await setDepartmentHr(null, design.id, hr2Record.id);

  const emp = await createEmployee(hr1, { firstName: "Priya", lastName: "S", email: "priya@example.com", joiningDate: "2026-11-02" });
  const other = await createEmployee(hr2, { firstName: "Omar", lastName: "D", email: "omar@example.com", joiningDate: "2026-11-02" });
  const empUser = await register("priya@example.com");
  const otherUser = await register("omar@example.com");

  const template = await prisma.onboardingTemplate.findFirstOrThrow({ where: { name: "Standard onboarding" } });
  const process = await startOnboarding(hr1, { employeeId: emp.id, templateId: template.id });
  const otherProcess = await startOnboarding(hr2, { employeeId: other.id, templateId: template.id });
  const task = (processId: string, title: string) =>
    prisma.onboardingTask.findFirstOrThrow({ where: { processId, title } });

  return {
    hr1, hr2, emp, other, empUser, otherUser, process,
    idTask: await task(process.id, "Upload government ID"),
    offerTask: await task(process.id, "Upload signed offer letter"),
    otherIdTask: await task(otherProcess.id, "Upload government ID"),
  };
}

beforeEach(resetData);

describe("uploading", () => {
  it("stores the file privately, completes the task, and tells HR", async () => {
    const { hr1, empUser, idTask, process } = await setup();
    const doc = await uploadDocument(empUser, file("../../My ID?.pdf", PDF), { taskId: idTask.id });

    expect(doc).toMatchObject({ status: "PENDING", mimeType: "application/pdf", fileName: "My ID_.pdf" });
    expect(doc.storageKey).toMatch(new RegExp(`^employees/${doc.employeeId}/`));
    expect(await readAll((await openDocument(hr1, doc.id)).stream)).toEqual(PDF);

    const task = await prisma.onboardingTask.findUniqueOrThrow({ where: { id: idTask.id } });
    expect(task.status).toBe("DONE");
    expect(await prisma.notification.count({ where: { userId: hr1.id, type: "DOCUMENT_UPLOADED" } })).toBe(1);
    expect((await listDocuments(empUser)).items.map((d) => d.id)).toEqual([doc.id]);
    expect((await prisma.onboardingProcess.findUniqueOrThrow({ where: { id: process.id } })).status).toBe("IN_PROGRESS");
  });

  it("checks the real file type, not the name", async () => {
    const { empUser, idTask, offerTask } = await setup();
    await expect(uploadDocument(empUser, file("totally-a.pdf", EXE), { taskId: idTask.id })).rejects.toThrow("isn't allowed");
    await expect(uploadDocument(empUser, file("notes.pdf", Buffer.from("just text")), { taskId: idTask.id })).rejects.toThrow("isn't allowed");
    await expect(uploadDocument(empUser, file("empty.pdf", Buffer.alloc(0)), { taskId: idTask.id })).rejects.toThrow("empty");
    // The offer letter must be a PDF; a PNG is a real image but not accepted for this type.
    await expect(uploadDocument(empUser, file("offer.png", PNG), { taskId: offerTask.id })).rejects.toThrow("Upload PDF");
    const png = await uploadDocument(empUser, file("photo.jpeg", PNG), { taskId: idTask.id });
    expect(png).toMatchObject({ mimeType: "image/png", fileName: "photo.png" });
  });

  it("rejects files over the size limit", async () => {
    const { empUser, idTask } = await setup();
    const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    await expect(uploadDocument(empUser, file("big.pdf", big), { taskId: idTask.id })).rejects.toThrow("too large");
  });

  it("requires a future expiry date for documents that expire", async () => {
    const { empUser, emp } = await setup();
    const passport = await prisma.documentType.findUniqueOrThrow({ where: { name: "Passport" } });
    const meta = { employeeId: emp.id, documentTypeId: passport.id };
    await expect(uploadDocument(empUser, file("p.pdf", PDF), meta)).rejects.toThrow("expiry date");
    await expect(
      uploadDocument(empUser, file("p.pdf", PDF), { ...meta, expiryDate: "2020-01-01" }),
    ).rejects.toThrow("already expired");
    const ok = await uploadDocument(empUser, file("p.pdf", PDF), { ...meta, expiryDate: addDays(startOfToday(), 20) });
    expect(ok.expiryDate).not.toBeNull();

    const expiring = await listDocuments(empUser, { expiringWithinDays: 30 });
    expect(expiring.items.map((d) => d.id)).toEqual([ok.id]);
    expect(expiring.items[0].expiry).toMatchObject({ daysLeft: 20, isExpiringSoon: true });
  });

  it("keeps uploads and documents inside each person's space", async () => {
    const { hr2, empUser, other, otherIdTask, idTask } = await setup();
    await expect(uploadDocument(empUser, file("x.pdf", PDF), { taskId: otherIdTask.id })).rejects.toThrow("not found");
    await expect(uploadDocument(empUser, file("x.pdf", PDF), { employeeId: other.id })).rejects.toThrow("not found");

    const doc = await uploadDocument(empUser, file("id.pdf", PDF), { taskId: idTask.id });
    expect(await getDocument(hr2, doc.id)).toBeNull();
    await expect(openDocument(hr2, doc.id)).rejects.toThrow("not found");
    expect((await listDocuments(hr2)).items).toHaveLength(0);

    const { user: manager } = await createPerson("REPORTING_MANAGER");
    await expect(uploadDocument(manager, file("x.pdf", PDF), { taskId: idTask.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listDocuments(manager)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("reviewing", () => {
  it("approves, and tells the employee", async () => {
    const { hr1, empUser, idTask } = await setup();
    const doc = await uploadDocument(empUser, file("id.pdf", PDF), { taskId: idTask.id });
    await reviewDocument(hr1, doc.id, { decision: "APPROVE" });

    expect((await getDocument(hr1, doc.id))?.status).toBe("APPROVED");
    expect(await prisma.notification.count({ where: { userId: empUser.id, type: "DOCUMENT_APPROVED" } })).toBe(1);
    await expect(reviewDocument(hr1, doc.id, { decision: "REJECT", reason: "x" })).rejects.toThrow("waiting for review");
  });

  it("rejects with a reason, reopens the task, and a re-upload closes it again", async () => {
    const { hr1, empUser, idTask } = await setup();
    const doc = await uploadDocument(empUser, file("id.pdf", PDF), { taskId: idTask.id });
    await expect(reviewDocument(hr1, doc.id, { decision: "REJECT" })).rejects.toThrow();
    await reviewDocument(hr1, doc.id, { decision: "REJECT", reason: "Photo is blurry" });

    const task = await prisma.onboardingTask.findUniqueOrThrow({ where: { id: idTask.id } });
    expect(task.status).toBe("TODO");
    const note = await prisma.notification.findFirstOrThrow({ where: { userId: empUser.id, type: "DOCUMENT_REJECTED" } });
    expect(note.body).toBe("Photo is blurry");
    expect(note.link).toBe(`/tasks/${idTask.id}`);

    await uploadDocument(empUser, file("id-v2.pdf", PDF), { taskId: idTask.id });
    expect((await prisma.onboardingTask.findUniqueOrThrow({ where: { id: idTask.id } })).status).toBe("DONE");
  });

  it("doesn't let people review their own documents or without permission", async () => {
    const { hr1, empUser, idTask } = await setup();
    const own = await uploadDocument(hr1, file("mine.pdf", PDF), { employeeId: hr1.employeeId! });
    await expect(reviewDocument(hr1, own.id, { decision: "APPROVE" })).rejects.toThrow("Someone else");

    const doc = await uploadDocument(empUser, file("id.pdf", PDF), { taskId: idTask.id });
    await expect(reviewDocument(empUser, doc.id, { decision: "APPROVE" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getDocument(empUser, doc.id))?.permissions.review).toBe(false);
    expect((await getDocument(hr1, doc.id))?.permissions.review).toBe(true);
  });
});

describe("removing", () => {
  it("lets uploaders remove pending uploads, reopening the task, but not reviewed ones", async () => {
    const { hr1, empUser, idTask, offerTask } = await setup();
    const doc = await uploadDocument(empUser, file("id.pdf", PDF), { taskId: idTask.id });
    await deleteDocument(empUser, doc.id);
    expect(await getDocument(empUser, doc.id)).toBeNull();
    expect((await prisma.onboardingTask.findUniqueOrThrow({ where: { id: idTask.id } })).status).toBe("TODO");
    expect(await prisma.document.count({ where: { id: doc.id } })).toBe(1); // kept for the audit trail

    const approved = await uploadDocument(empUser, file("offer.pdf", PDF), { taskId: offerTask.id });
    await reviewDocument(hr1, approved.id, { decision: "APPROVE" });
    await expect(deleteDocument(empUser, approved.id)).rejects.toThrow("waiting for review");

    const { user: admin } = await createPerson("HR_ADMIN");
    await deleteDocument(admin, approved.id);
    expect(await getDocument(admin, approved.id)).toBeNull();
  });
});

describe("checklist", () => {
  it("shows each required document as missing, pending, or approved", async () => {
    const { hr1, empUser, emp, idTask } = await setup();
    const before = await getDocumentChecklist(hr1, emp.id);
    expect(before?.items.every((i) => i.status === "MISSING")).toBe(true);
    expect(before?.complete).toBe(false);

    const doc = await uploadDocument(empUser, file("id.pdf", PDF), { taskId: idTask.id });
    await reviewDocument(hr1, doc.id, { decision: "APPROVE" });
    const after = await getDocumentChecklist(empUser, emp.id);
    const byName = Object.fromEntries(after!.items.map((i) => [i.documentType.name, i.status]));
    expect(byName["Government ID"]).toBe("APPROVED");
    expect(byName["Signed offer letter"]).toBe("MISSING");
  });
});
