import { randomUUID } from "node:crypto";
import { loadUserContext } from "@/lib/auth/rbac";
import { createInvite, registerWithInvite, syncUserRole } from "@/lib/auth/registration";
import type { RoleKey } from "@/lib/constants/roles";
import { prisma } from "@/lib/db/prisma";
import { seedOrganisation, seedTemplate } from "@/prisma/seed-data";

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error("Tests must run against the test database");
}

/** Clears test data, keeping roles and permissions; re-creates departments, document types, and the standard template. */
export async function resetData() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE audit_logs, notifications, documents, task_status_history, task_assignments,
      onboarding_tasks, onboarding_process_steps, onboarding_processes,
      template_tasks, template_steps, onboarding_templates, designations, departments, document_types,
      employees, user_roles, sessions, accounts, verifications, users CASCADE`);
  await seedOrganisation();
  await seedTemplate();
}

let counter = 0;

/** Creates a registered person (employee record + login) with the given role and returns their CurrentUser. */
export async function createPerson(
  roleKey: RoleKey,
  overrides: {
    firstName?: string;
    lastName?: string;
    hrManagerId?: string;
    reportingManagerId?: string;
    departmentId?: string;
  } = {},
) {
  counter += 1;
  const userId = randomUUID();
  const firstName = overrides.firstName ?? `Test${counter}`;
  const lastName = overrides.lastName ?? roleKey.toLowerCase();
  const email = `${firstName}.${lastName}.${counter}@example.com`.toLowerCase();

  await prisma.user.create({
    data: { id: userId, name: `${firstName} ${lastName}`, email, emailVerified: true },
  });
  const employee = await prisma.employee.create({
    data: {
      employeeCode: `T-${counter}-${userId.slice(0, 6)}`,
      firstName,
      lastName,
      email,
      joiningDate: new Date("2026-01-05"),
      roleKey,
      userId,
      hrManagerId: overrides.hrManagerId,
      reportingManagerId: overrides.reportingManagerId,
      departmentId: overrides.departmentId,
    },
  });
  await syncUserRole(userId, roleKey);

  const user = await loadUserContext(userId);
  if (!user) throw new Error("Failed to load test user");
  return { user, employee };
}

export async function departmentWithDesignation(name: string) {
  return prisma.department.findUniqueOrThrow({
    where: { name },
    include: { designations: true },
  });
}

export { prisma };

/** Simulates someone creating their login from their welcome-email link. */
export async function register(email: string) {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { email } });
  const token = await createInvite(prisma, employee.id, null);
  const { userId } = await registerWithInvite({ token, password: "Correct-Horse-1", confirmPassword: "Correct-Horse-1" });
  const user = await loadUserContext(userId);
  if (!user) throw new Error("Failed to load registered user");
  return user;
}
