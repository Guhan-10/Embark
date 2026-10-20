import Link from "next/link";
import { CircleCheck, MailQuestion } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableCard } from "@/components/shared/table-card";
import { EMPLOYEE_STATUS } from "@/lib/constants/employee-status";
import { ROLE_DETAILS, type RoleKey } from "@/lib/constants/roles";
import { formatShortDate, initials } from "@/lib/utils/format";
import type { EmployeeListItem } from "../types";

/** The employee list. Each row opens the profile; `actions` adds a cell on the right (e.g. Restore). */
export function EmployeeTable({
  items,
  currentEmployeeId,
  actions,
}: {
  items: EmployeeListItem[];
  currentEmployeeId?: string | null;
  actions?: (employee: EmployeeListItem) => React.ReactNode;
}) {
  return (
    <TableCard>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold text-muted-foreground">
            <th scope="col" className="py-3.5 pr-3 pl-6 font-semibold">Employee</th>
            <th scope="col" className="px-3 font-semibold">Code</th>
            <th scope="col" className="px-3 font-semibold">Department</th>
            <th scope="col" className="px-3 font-semibold">Role</th>
            <th scope="col" className="px-3 font-semibold">Joins</th>
            <th scope="col" className="px-3 font-semibold">Status</th>
            <th scope="col" className="px-3 font-semibold">Login</th>
            {actions ? <th scope="col" className="pr-6 pl-3"><span className="sr-only">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((e) => {
            const name = `${e.firstName} ${e.lastName}`;
            const status = EMPLOYEE_STATUS[e.status];
            return (
              <tr key={e.id} className="group border-b last:border-0 hover:bg-muted/50">
                <td className="py-3 pr-3 pl-6">
                  <Link href={`/employees/${e.id}`} className="flex items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-sky text-xs font-bold text-info-ink">{initials(name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold group-hover:text-primary">
                        {name}
                        {e.id === currentEmployeeId ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span> : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{e.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 font-mono text-xs text-muted-foreground">{e.employeeCode}</td>
                <td className="px-3">
                  <span className="block truncate">{e.department?.name ?? "—"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{e.designation?.title ?? ""}</span>
                </td>
                <td className="px-3 whitespace-nowrap">{ROLE_DETAILS[e.roleKey as RoleKey]?.name ?? e.roleKey}</td>
                <td className="px-3 whitespace-nowrap">{formatShortDate(e.joiningDate)}</td>
                <td className="px-3">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </td>
                <td className="px-3">
                  {e.isRegistered ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-ink">
                      <CircleCheck className="size-4" aria-hidden="true" /> Registered
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MailQuestion className="size-4" aria-hidden="true" /> Invited
                    </span>
                  )}
                </td>
                {actions ? <td className="pr-6 pl-3 text-right">{actions(e)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
