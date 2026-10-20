import "server-only";
import { prisma } from "@/lib/db/prisma";
import { notify } from "@/features/notifications/service";
import { newAssignmentNotifications, syncTaskAssignees } from "@/features/onboarding/assignment";

/**
 * Safety net for department HR changes made with raw SQL instead of `npm run department:set-hr`:
 * points each department's people at its current HR and moves their open auto-assigned HR tasks.
 */
export async function reconcileDepartmentHr() {
  const departments = await prisma.department.findMany({
    where: { hrEmployeeId: { not: null } },
    select: { id: true, hrEmployee: { select: { userId: true, archivedAt: true } } },
  });

  let moved = 0;
  for (const department of departments) {
    const hrUserId = department.hrEmployee && !department.hrEmployee.archivedAt ? department.hrEmployee.userId : null;
    const stale = await prisma.employee.findMany({
      where: { departmentId: department.id, hrManagerId: hrUserId ? { not: hrUserId } : { not: null } },
      select: { id: true },
    });
    if (!stale.length) continue;

    await prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({ where: { id: { in: stale.map((e) => e.id) } }, data: { hrManagerId: hrUserId } });
      const assigned = [];
      for (const { id } of stale) assigned.push(...(await syncTaskAssignees(tx, id)));
      await notify(tx, newAssignmentNotifications(assigned));
    });
    moved += stale.length;
  }
  return { employeesMoved: moved };
}
