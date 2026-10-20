// Development only: a small demo company so you can click around Embark with realistic data.
//   npm run demo:seed    → creates it (password for every demo login: Demo-Pass-2026)
//   npm run demo:clean   → removes it, including uploaded files and any emails still queued
// Logins: priya@ (HR Admin, owns Engineering), rahul@ (Reporting Manager), asha@ / dev@ (new hires),
// all @demo.embark.local. Everything it creates uses that email domain, so clean never touches real data.
import "dotenv/config";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Queue } from "bullmq";
import { QUEUE_PREFIX, QUEUES, workerConnection } from "@/lib/queue/bullmq";
import { bucket, s3 } from "@/lib/storage/s3";
import { uploadDocument } from "@/features/documents/service";
import { createEmployee, setDepartmentHr } from "@/features/employees/service";
import { startOnboarding } from "@/features/onboarding/service";
import { changeTaskStatus } from "@/features/tasks/service";
import { createInvite, registerWithInvite } from "@/lib/auth/registration";
import { loadUserContext } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { addDays, startOfToday } from "@/lib/utils/date";

const PASSWORD = "Demo-Pass-2026";

/** A tiny one-page PDF with a line of text, so previews in the app show something real. */
function demoPdf(text: string) {
  const content = `BT /F1 20 Tf 40 80 Td (${text}) Tj ET`;
  const pdf = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 180]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
    `4 0 obj<</Length ${content.length}>>stream`,
    content,
    "endstream endobj",
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n");
  return new Uint8Array(Buffer.from(pdf));
}
const DEMO = "@demo.embark.local";

async function register(email: string) {
  const e = await prisma.employee.findUniqueOrThrow({ where: { email } });
  const token = await createInvite(prisma, e.id, null);
  const { userId } = await registerWithInvite({ token, password: PASSWORD, confirmPassword: PASSWORD });
  return (await loadUserContext(userId))!;
}

async function clean() {
  const ids = (await prisma.employee.findMany({ where: { email: { endsWith: DEMO } }, select: { id: true } })).map((e) => e.id);
  for (const id of ids) {
    const objects = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `employees/${id}/` }));
    for (const o of objects.Contents ?? []) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.Key }));
  }
  await prisma.department.updateMany({ where: { hrEmployeeId: { in: ids } }, data: { hrEmployeeId: null } });
  await prisma.document.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.onboardingProcess.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.employee.updateMany({ where: { id: { in: ids } }, data: { reportingManagerId: null } });
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: DEMO } } });
  // Drop queued emails to demo addresses so a later `npm run worker` doesn't send them.
  const emails = new Queue(QUEUES.EMAIL, { prefix: QUEUE_PREFIX, connection: workerConnection() });
  for (const job of await emails.getJobs(["waiting", "delayed", "failed"])) {
    if (String(job?.data?.to ?? "").endsWith(DEMO)) await job.remove();
  }
  await emails.close();
  console.log(`Removed the demo company (${ids.length} employees).`);
}

async function seed() {
  const today = startOfToday();
  const eng = await prisma.department.findUniqueOrThrow({ where: { name: "Engineering" }, include: { designations: true } });
  const des = await prisma.department.findUniqueOrThrow({ where: { name: "Design" }, include: { designations: true } });
  const t = (d: typeof eng, title: string) => d.designations.find((x) => x.title === title)!.id;

  const hrRec = await prisma.employee.create({ data: { employeeCode: "EMB-0001", firstName: "Priya", lastName: "Sharma", email: `priya${DEMO}`, joiningDate: addDays(today, -400), roleKey: "HR_ADMIN", status: "ACTIVE" } });
  const priya = await register(`priya${DEMO}`);
  await setDepartmentHr(null, eng.id, hrRec.id);
  const add = (first: string, last: string, joining: Date, extra: Record<string, unknown> = {}) =>
    createEmployee(priya, { firstName: first, lastName: last, email: `${first.toLowerCase()}${DEMO}`, joiningDate: joining, ...extra });

  const rahul = await add("Rahul", "Verma", addDays(today, -300), { roleKey: "REPORTING_MANAGER", designationId: t(eng, "Engineering Manager"), phone: "+91 98450 12345" });
  await prisma.employee.update({ where: { id: rahul.id }, data: { status: "ACTIVE" } });
  const asha = await add("Asha", "Nair", addDays(today, -3), { designationId: t(eng, "Frontend Developer"), reportingManagerId: rahul.id });
  const bala = await add("Bala", "Krishnan", addDays(today, 2), { designationId: t(eng, "Backend Developer"), reportingManagerId: rahul.id });
  await add("Chitra", "Iyer", addDays(today, 4), { designationId: t(des, "UI/UX Designer") });
  const dev = await add("Dev", "Menon", addDays(today, -40), { designationId: t(eng, "QA Engineer"), reportingManagerId: rahul.id });
  const old = await add("Farah", "Khan", addDays(today, -200), { designationId: t(eng, "QA Engineer") });

  await register(`rahul${DEMO}`);
  const ashaUser = await register(`asha${DEMO}`);
  await register(`dev${DEMO}`);

  const template = await prisma.onboardingTemplate.findFirstOrThrow({ where: { name: "Standard onboarding" } });
  const pAsha = await startOnboarding(priya, { employeeId: asha.id, templateId: template.id });
  await startOnboarding(priya, { employeeId: bala.id, templateId: template.id });
  const pDev = await startOnboarding(priya, { employeeId: dev.id, templateId: template.id });
  for (const task of await prisma.onboardingTask.findMany({ where: { processId: pDev.id } })) {
    await changeTaskStatus(priya, task.id, task.documentTypeId ? { status: "SKIPPED", note: "Collected on paper" } : { status: "DONE" });
  }
  // Dev joined 40 days ago and finished four weeks later, so reports show a realistic duration.
  await prisma.onboardingProcess.update({ where: { id: pDev.id }, data: { startDate: addDays(today, -40), completedAt: addDays(today, -12) } });
  const handbook = await prisma.onboardingTask.findFirstOrThrow({ where: { processId: pAsha.id, title: "Read the employee handbook" } });
  await changeTaskStatus(ashaUser, handbook.id, { status: "DONE" });
  for (const [title, file] of [["Upload signed offer letter", "offer-letter-signed.pdf"], ["Upload government ID", "aadhaar-card.pdf"]]) {
    const task = await prisma.onboardingTask.findFirstOrThrow({ where: { processId: pAsha.id, title } });
    await uploadDocument(ashaUser, { name: file, bytes: demoPdf(`Demo: ${title.replace("Upload ", "")}`) }, { taskId: task.id });
  }
  await prisma.employee.update({ where: { id: old.id }, data: { archivedAt: new Date(), status: "INACTIVE" } });
  console.log("Demo company ready. Sign in as priya@demo.embark.local with Demo-Pass-2026.");
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to create or remove demo data in production.");
  process.exit(1);
}

(process.argv[2] === "clean" ? clean() : seed())
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0); // the email queue's Redis connection would otherwise keep the script alive
  });
