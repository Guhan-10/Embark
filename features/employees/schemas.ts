import { z } from "zod";
import { EmployeeStatus } from "@/generated/prisma/enums";
import { ROLES } from "@/lib/constants/roles";

const optionalId = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .optional();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

const roleKey = z.enum(Object.values(ROLES) as [string, ...string[]], {
  error: "Choose a role",
});

export const employeeCreateSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(80),
  lastName: z.string().trim().min(1, "Enter a last name").max(80),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  phone: optionalText(30),
  /** Leave blank to generate the next EMB-#### code. */
  employeeCode: optionalText(30),
  departmentId: optionalId,
  designationId: optionalId,
  hrManagerId: optionalId,
  reportingManagerId: optionalId,
  joiningDate: z.coerce.date({ error: "Enter a joining date" }),
  roleKey: roleKey.default(ROLES.EMPLOYEE),
});

export const employeeUpdateSchema = employeeCreateSchema
  .omit({ employeeCode: true })
  .extend({
    employeeCode: z.string().trim().min(1, "Enter an employee code").max(30),
    status: z.enum(EmployeeStatus).optional(),
  })
  .partial();

export const EMPLOYEE_SORT_FIELDS = ["name", "joiningDate", "createdAt", "employeeCode"] as const;

export const employeeListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  departmentId: z.string().optional(),
  status: z.enum(EmployeeStatus).optional(),
  roleKey: roleKey.optional(),
  hrManagerId: z.string().optional(),
  archived: z.union([z.boolean(), z.stringbool()]).default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(EMPLOYEE_SORT_FIELDS).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
