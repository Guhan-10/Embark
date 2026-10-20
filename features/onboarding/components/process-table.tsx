import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableCard } from "@/components/shared/table-card";
import { PROCESS_STATUS } from "@/lib/constants/employee-status";
import { formatShortDate, initials } from "@/lib/utils/format";
import type { ProcessListItem } from "../types";
import { ProgressBar } from "./progress-bar";

/** Onboarding in a table: who, which template, dates, and progress. Rows open the onboarding. */
export function ProcessTable({ items }: { items: ProcessListItem[] }) {
  return (
    <TableCard>
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-3.5 pr-3 pl-6 font-semibold">New hire</th>
            <th scope="col" className="px-3 font-semibold">Template</th>
            <th scope="col" className="px-3 font-semibold">Joins</th>
            <th scope="col" className="px-3 font-semibold">Started</th>
            <th scope="col" className="w-56 px-3 font-semibold">Progress</th>
            <th scope="col" className="pr-6 pl-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const name = `${p.employee.firstName} ${p.employee.lastName}`;
            const status = PROCESS_STATUS[p.status];
            return (
              <tr key={p.id} className="group border-b last:border-0 hover:bg-muted/50">
                <td className="py-3 pr-3 pl-6">
                  <Link href={`/onboarding/${p.id}`} className="flex items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-sky text-xs font-bold text-info-ink">{initials(name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold group-hover:text-primary">{name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[p.employee.designation?.title, p.employee.department?.name].filter(Boolean).join(" · ") || p.employee.employeeCode}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 text-muted-foreground">{p.template?.name ?? "Custom"}</td>
                <td className="px-3 whitespace-nowrap">{formatShortDate(p.employee.joiningDate)}</td>
                <td className="px-3 whitespace-nowrap">{formatShortDate(p.startDate)}</td>
                <td className="px-3">
                  <ProgressBar percent={p.progress.percent} overdue={p.status === "IN_PROGRESS" ? p.progress.overdue : 0} />
                  {p.status === "IN_PROGRESS" && p.progress.overdue > 0 ? (
                    <span className="mt-1 block pl-12 text-xs font-medium text-warning-ink">{p.progress.overdue} overdue</span>
                  ) : null}
                </td>
                <td className="pr-6 pl-3">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
