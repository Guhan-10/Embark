// Database-admin command: make an HR person the owner of a department.
//   npm run department:set-hr -- "Engineering" hr1@company.com
//   npm run department:set-hr -- "Engineering" none        (remove the department's HR)
import "dotenv/config";
import { setDepartmentHr } from "@/features/employees/service";
import { prisma } from "@/lib/db/prisma";

async function main() {
  const [departmentName, hrEmail] = process.argv.slice(2);
  if (!departmentName || !hrEmail) {
    console.error('Usage: npm run department:set-hr -- "<department name>" <hr email | none>');
    process.exit(1);
  }

  const department = await prisma.department.findFirst({
    where: { name: { equals: departmentName, mode: "insensitive" } },
  });
  if (!department) throw new Error(`No department named "${departmentName}"`);

  let hrEmployeeId: string | null = null;
  if (hrEmail.toLowerCase() !== "none") {
    const hr = await prisma.employee.findFirst({
      where: { email: { equals: hrEmail, mode: "insensitive" } },
    });
    if (!hr) throw new Error(`No employee with email ${hrEmail}. Add them to the employees table first.`);
    hrEmployeeId = hr.id;
  }

  const result = await setDepartmentHr(null, department.id, hrEmployeeId);
  console.log(
    `${department.name}: HR set to ${hrEmployeeId ? hrEmail : "nobody"}. ` +
      `${result.employees} employees moved, ${result.tasksReassigned} open tasks reassigned.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
