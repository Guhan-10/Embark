// Reference data shared by the seed script and the integration tests.
import type { AssigneeType, TaskPriority } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  type PermissionKey,
} from "@/lib/constants/permissions";
import { ROLE_DETAILS, ROLES, type RoleKey } from "@/lib/constants/roles";

const PDF = "application/pdf";
const PNG = "image/png";
const JPEG = "image/jpeg";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const DEPARTMENTS: { name: string; code: string; designations: string[] }[] = [
  { name: "Engineering", code: "ENG", designations: ["Frontend Developer", "Backend Developer", "QA Engineer", "Engineering Manager"] },
  { name: "Design", code: "DES", designations: ["UI/UX Designer", "Product Designer"] },
  { name: "Human Resources", code: "HR", designations: ["HR Associate", "HR Manager"] },
  { name: "Sales", code: "SAL", designations: ["Sales Executive", "Account Manager"] },
  { name: "Operations", code: "OPS", designations: ["Operations Associate", "Office Administrator"] },
];

const DOCUMENT_TYPES = [
  { name: "Government ID", description: "Aadhaar, PAN, or another government-issued ID", isRequired: true, hasExpiry: false, allowedMimeTypes: [PDF, PNG, JPEG] },
  { name: "Passport", description: "Passport photo page", isRequired: false, hasExpiry: true, allowedMimeTypes: [PDF, PNG, JPEG] },
  { name: "Educational certificates", description: "Highest qualification certificate", isRequired: true, hasExpiry: false, allowedMimeTypes: [PDF, PNG, JPEG] },
  { name: "Signed offer letter", description: "Offer letter signed by the employee", isRequired: true, hasExpiry: false, allowedMimeTypes: [PDF] },
  { name: "Bank details form", description: "Completed bank account details form", isRequired: true, hasExpiry: false, allowedMimeTypes: [PDF, DOCX] },
  { name: "Work visa", description: "Valid work permit or visa", isRequired: false, hasExpiry: true, allowedMimeTypes: [PDF, PNG, JPEG] },
];

type SeedTask = {
  title: string;
  assigneeType: AssigneeType;
  dueOffsetDays: number;
  priority?: TaskPriority;
  documentType?: string;
};

const STANDARD_TEMPLATE: { title: string; tasks: SeedTask[] }[] = [
  {
    title: "Before day one",
    tasks: [
      { title: "Upload government ID", assigneeType: "EMPLOYEE", dueOffsetDays: -3, priority: "HIGH", documentType: "Government ID" },
      { title: "Upload signed offer letter", assigneeType: "EMPLOYEE", dueOffsetDays: -3, priority: "HIGH", documentType: "Signed offer letter" },
      { title: "Upload educational certificates", assigneeType: "EMPLOYEE", dueOffsetDays: -2, documentType: "Educational certificates" },
      { title: "Prepare laptop and accounts", assigneeType: "HR_MANAGER", dueOffsetDays: -1, priority: "HIGH" },
    ],
  },
  {
    title: "First day",
    tasks: [
      { title: "Welcome session and office tour", assigneeType: "HR_MANAGER", dueOffsetDays: 0 },
      { title: "Submit bank details form", assigneeType: "EMPLOYEE", dueOffsetDays: 0, documentType: "Bank details form" },
      { title: "Read the employee handbook", assigneeType: "EMPLOYEE", dueOffsetDays: 0, priority: "LOW" },
    ],
  },
  {
    title: "First week",
    tasks: [
      { title: "Complete compliance training", assigneeType: "EMPLOYEE", dueOffsetDays: 5 },
      { title: "Introduce to the team and assign a buddy", assigneeType: "REPORTING_MANAGER", dueOffsetDays: 1 },
      { title: "Set 30-day goals", assigneeType: "REPORTING_MANAGER", dueOffsetDays: 3 },
    ],
  },
  {
    title: "First month",
    tasks: [
      { title: "30-day HR check-in", assigneeType: "HR_MANAGER", dueOffsetDays: 30 },
      { title: "30-day goals review", assigneeType: "REPORTING_MANAGER", dueOffsetDays: 30 },
    ],
  },
];

/**
 * Creates roles and permissions. Default role permissions are granted only when a role is first created,
 * or when a permission is new to the system — so anything an HR Admin removed in Settings stays removed.
 */
export async function seedRolesAndPermissions() {
  const existing = new Set((await prisma.permission.findMany({ select: { key: true } })).map((p) => p.key));
  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description },
      update: { description },
    });
  }

  const permissions = await prisma.permission.findMany();
  const permissionId = new Map(permissions.map((p) => [p.key as PermissionKey, p.id]));

  for (const key of Object.values(ROLES) as RoleKey[]) {
    const roleExisted = Boolean(await prisma.role.findUnique({ where: { key } }));
    const role = await prisma.role.upsert({
      where: { key },
      create: { key, ...ROLE_DETAILS[key], isSystem: true },
      update: { ...ROLE_DETAILS[key], isSystem: true },
    });
    const grant = DEFAULT_ROLE_PERMISSIONS[key].filter((perm) => !roleExisted || !existing.has(perm));
    await prisma.rolePermission.createMany({
      data: grant.map((perm) => ({ roleId: role.id, permissionId: permissionId.get(perm)! })),
      skipDuplicates: true,
    });
  }
}

export async function seedOrganisation() {
  for (const dept of DEPARTMENTS) {
    const department = await prisma.department.upsert({
      where: { name: dept.name },
      create: { name: dept.name, code: dept.code },
      update: {},
    });
    for (const title of dept.designations) {
      await prisma.designation.upsert({
        where: { departmentId_title: { departmentId: department.id, title } },
        create: { departmentId: department.id, title },
        update: {},
      });
    }
  }

  for (const type of DOCUMENT_TYPES) {
    await prisma.documentType.upsert({
      where: { name: type.name },
      create: type,
      update: {},
    });
  }
}

export async function seedTemplate() {
  const name = "Standard onboarding";
  if (await prisma.onboardingTemplate.findFirst({ where: { name } })) return;

  const documentTypes = await prisma.documentType.findMany();
  const documentTypeId = new Map(documentTypes.map((t) => [t.name, t.id]));

  await prisma.onboardingTemplate.create({
    data: {
      name,
      description: "Default checklist for every new hire",
      steps: {
        create: STANDARD_TEMPLATE.map((step, stepIndex) => ({
          title: step.title,
          order: stepIndex,
          tasks: {
            create: step.tasks.map((task, taskIndex) => ({
              title: task.title,
              assigneeType: task.assigneeType,
              dueOffsetDays: task.dueOffsetDays,
              priority: task.priority ?? "MEDIUM",
              order: taskIndex,
              documentTypeId: task.documentType ? documentTypeId.get(task.documentType) : undefined,
            })),
          },
        })),
      },
    },
  });
}
