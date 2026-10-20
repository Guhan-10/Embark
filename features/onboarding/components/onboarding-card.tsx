import Link from "next/link";
import { Route } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatShortDate, initials, plural } from "@/lib/utils/format";
import type { ProcessListItem } from "../types";
import { ProgressBar } from "./progress-bar";

/** Onboarding in progress: who, when they started, and how far along they are. */
export function OnboardingCard({ items, total }: { items: ProcessListItem[]; total: number }) {
  const people = items.map((p) => `${p.employee.firstName} ${p.employee.lastName}`);
  return (
    <DashboardCard
      title="Onboarding in progress"
      action={
        <span className="flex items-center gap-3">
          <span className="flex -space-x-2" aria-hidden="true">
            {people.slice(0, 3).map((name) => (
              <Avatar key={name} className="size-7 border-2 border-card">
                <AvatarFallback className="bg-sky text-[10px] font-bold text-info-ink">{initials(name)}</AvatarFallback>
              </Avatar>
            ))}
            {total > 3 ? (
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-[10px] font-bold text-primary-foreground">
                +{total - 3}
              </span>
            ) : null}
          </span>
          <Link href="/onboarding" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </span>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
          <Route className="mb-2 size-6" aria-hidden="true" />
          No onboarding in progress right now.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/onboarding/${p.id}`}
                className={
                  "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-2xl p-3.5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_auto] " +
                  (i === 0 ? "bg-card shadow-raised ring-1 ring-border" : "hover:bg-muted/70")
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {p.employee.firstName} {p.employee.lastName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{p.employee.designation?.title ?? p.employee.department?.name ?? "New hire"}</span>
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block text-xs text-muted-foreground">Joins</span>
                  <span className="block text-sm font-semibold">{formatShortDate(p.employee.joiningDate)}</span>
                </span>
                <ProgressBar percent={p.progress.percent} overdue={p.progress.overdue} className="col-span-2 sm:col-span-1" />
                <span className="row-start-1 col-start-2 justify-self-end sm:row-auto sm:col-auto">
                  {p.progress.overdue > 0 ? (
                    <StatusBadge tone="warning">{p.progress.overdue} overdue</StatusBadge>
                  ) : (
                    <span className="text-xs text-muted-foreground tabular-nums">{plural(p.progress.done, "task")} done</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
