// Run by tests/e2e/global-setup.ts (never directly): resets the e2e database and creates two HR spaces.
//   Engineering → HR Hari (HR Manager): Anil and Bina (new hires, onboarding), Rahul (their reporting manager)
//   Design      → HR Meera (HR Manager): Chen (new hire, onboarding)
// Ada is the HR Admin who set the departments' HR. Writes the ids the tests need to tests/e2e/.state/fixtures.json.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { uploadDocument } from "@/features/documents/service";
import { createEmployee, setDepartmentHr } from "@/features/employees/service";
import { startOnboarding } from "@/features/onboarding/service";
import { createInvite, registerWithInvite } from "@/lib/auth/registration";
import { loadUserContext, type CurrentUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { addDays, startOfToday } from "@/lib/utils/date";
import { seedOrganisation, seedTemplate } from "@/prisma/seed-data";
import { E2E_DOMAIN, PASSWORD } from "./env";

if (!process.env.DATABASE_URL?.includes("_e2e")) throw new Error("Refusing to reset a non-e2e database");

const email = (name: string) => `${name}@${E2E_DOMAIN}`;

async function register(address: string) {
  const e = await prisma.employee.findUniqueOrThrow({ where: { email: address } });
  const token = await createInvite(prisma, e.id, null);
  const { userId } = await registerWithInvite({ token, password: PASSWORD, confirmPassword: PASSWORD });
  return (await loadUserContext(userId))!;
}

async function main() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE audit_logs, notifications, documents, task_status_history, task_assignments,
      onboarding_tasks, onboarding_process_steps, onboarding_processes,
      template_tasks, template_steps, onboarding_templates, designations, departments, document_types,
      employees, user_roles, sessions, accounts, verifications, users CASCADE`);
  await seedOrganisation();
  await seedTemplate();

  const today = startOfToday();
  const dept = (name: string) => prisma.department.findUniqueOrThrow({ where: { name }, include: { designations: true } });
  const [eng, des, hrDept] = await Promise.all([dept("Engineering"), dept("Design"), dept("Human Resources")]);
  const title = (d: typeof eng, t: string) => d.designations.find((x) => x.title === t)!.id;
  const template = await prisma.onboardingTemplate.findFirstOrThrow({ where: { name: "Standard onboarding" } });

  // The HR Admin is entered by the database admin, as in a real install.
  await prisma.employee.create({
    data: { employeeCode: "E2E-0001", firstName: "Ada", lastName: "Admin", email: email("ada"), joiningDate: addDays(today, -500), roleKey: "HR_ADMIN", status: "ACTIVE", departmentId: hrDept.id },
  });
  const ada = await register(email("ada"));

  const add = (by: CurrentUser, first: string, last: string, extra: Record<string, unknown>) =>
    createEmployee(by, { firstName: first, lastName: last, email: email(first.toLowerCase()), joiningDate: addDays(today, -2), ...extra });

  const hari = await add(ada, "Hari", "Prasad", { roleKey: "HR_MANAGER", departmentId: hrDept.id, designationId: title(hrDept, "HR Manager") });
  const meera = await add(ada, "Meera", "Iyer", { roleKey: "HR_MANAGER", departmentId: hrDept.id, designationId: title(hrDept, "HR Manager") });
  const hariUser = await register(email("hari"));
  const meeraUser = await register(email("meera"));
  await setDepartmentHr(ada, eng.id, hari.id);
  await setDepartmentHr(ada, des.id, meera.id);

  const rahul = await add(hariUser, "Rahul", "Verma", { roleKey: "REPORTING_MANAGER", departmentId: eng.id, designationId: title(eng, "Engineering Manager") });
  const anil = await add(hariUser, "Anil", "Kumar", { departmentId: eng.id, designationId: title(eng, "Frontend Developer"), reportingManagerId: rahul.id });
  const bina = await add(hariUser, "Bina", "Das", { departmentId: eng.id, designationId: title(eng, "Backend Developer"), reportingManagerId: rahul.id });
  const chen = await add(meeraUser, "Chen", "Li", { departmentId: des.id, designationId: title(des, "UI/UX Designer") });
  for (const name of ["rahul", "anil", "bina"]) await register(email(name));
  const chenUser = await register(email("chen"));

  const anilProcess = await startOnboarding(hariUser, { employeeId: anil.id, templateId: template.id });
  const binaProcess = await startOnboarding(hariUser, { employeeId: bina.id, templateId: template.id });
  const chenProcess = await startOnboarding(meeraUser, { employeeId: chen.id, templateId: template.id });
  const task = (processId: string, t: string) => prisma.onboardingTask.findFirstOrThrow({ where: { processId, title: t }, select: { id: true } });

  const chenId = await task(chenProcess.id, "Upload government ID");
  const pdf = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"));
  const chenDocument = await uploadDocument(chenUser, { name: "chen-id.pdf", bytes: pdf }, { taskId: chenId.id });

  const fixtures = {
    employees: { anil: anil.id, bina: bina.id, chen: chen.id, rahul: rahul.id, hari: hari.id, meera: meera.id },
    processes: { anil: anilProcess.id, bina: binaProcess.id, chen: chenProcess.id },
    tasks: {
      anilHandbook: (await task(anilProcess.id, "Read the employee handbook")).id,
      binaHandbook: (await task(binaProcess.id, "Read the employee handbook")).id,
      chenHandbook: (await task(chenProcess.id, "Read the employee handbook")).id,
    },
    documents: { chen: chenDocument.id },
  };
  const dir = path.join(import.meta.dirname, ".state");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "fixtures.json"), JSON.stringify(fixtures, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
