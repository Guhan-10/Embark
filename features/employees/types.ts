import type { z } from "zod";
import type { employeeCreateSchema, employeeListSchema, employeeUpdateSchema } from "./schemas";
import type { getEmployee, getEmployeeFormOptions, listEmployees } from "./queries";

export type EmployeeCreateInput = z.input<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.input<typeof employeeUpdateSchema>;
export type EmployeeListFilters = z.input<typeof employeeListSchema>;

export type EmployeeList = Awaited<ReturnType<typeof listEmployees>>;
export type EmployeeListItem = EmployeeList["items"][number];
export type EmployeeDetail = NonNullable<Awaited<ReturnType<typeof getEmployee>>>;
export type EmployeeFormOptions = Awaited<ReturnType<typeof getEmployeeFormOptions>>;
