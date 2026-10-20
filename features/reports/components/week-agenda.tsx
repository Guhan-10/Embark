"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck2, ListChecks, UserPlus } from "lucide-react";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TASK_PRIORITY } from "@/lib/constants/task-status";
import type { TaskPriority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils/cn";

export type AgendaDay = { date: string; isToday: boolean; isPast: boolean; joiners: number; tasks: number };
export type AgendaEvent = {
  id: string;
  kind: "joiner" | "task";
  date: string;
  title: string;
  subtitle: string;
  href: string;
  priority?: TaskPriority;
};

const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });
const dayNumber = new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

/** This week as a strip of days; pick a day to see who joins and what's due. */
export function WeekAgenda({ days, events, emptyHint }: { days: AgendaDay[]; events: AgendaEvent[]; emptyHint: string }) {
  const todayIndex = Math.max(0, days.findIndex((d) => d.isToday));
  const [selected, setSelected] = useState(todayIndex);
  const day = days[selected];
  const dayEvents = events.filter((e) => e.date.slice(0, 10) === day.date.slice(0, 10));

  return (
    <DashboardCard title={monthYear.format(new Date(days[todayIndex].date))}>
      <div role="tablist" aria-label="Days this week" className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const active = i === selected;
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${longDay.format(new Date(d.date))}: ${d.joiners} joining, ${d.tasks} due`}
              onClick={() => setSelected(i)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                active ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted",
                !active && d.isPast && "text-muted-foreground",
              )}
            >
              <span className={cn("font-medium", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{weekday.format(new Date(d.date))}</span>
              <span className={cn("text-sm font-bold", d.isToday && !active && "text-primary")}>{dayNumber.format(new Date(d.date))}</span>
              <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                {d.joiners ? <span className={cn("size-1.5 rounded-full", active ? "bg-mint" : "bg-success")} /> : null}
                {d.tasks ? <span className={cn("size-1.5 rounded-full", active ? "bg-sun" : "bg-warning")} /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 mb-2 flex items-center gap-2 text-sm font-semibold">
        {longDay.format(new Date(day.date))}
        <span className="h-px flex-1 border-t border-dashed" aria-hidden="true" />
      </p>
      {dayEvents.length === 0 ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <CalendarCheck2 className="size-4" aria-hidden="true" /> {emptyHint}
        </p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
          {dayEvents.map((e) => (
            <li key={e.id}>
              <Link href={e.href} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    e.kind === "joiner" ? "bg-mint text-success-ink" : "bg-accent text-primary-ink",
                  )}
                  aria-hidden="true"
                >
                  {e.kind === "joiner" ? <UserPlus className="size-4" /> : <ListChecks className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{e.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{e.subtitle}</span>
                </span>
                {e.priority && (e.priority === "HIGH" || e.priority === "URGENT") ? (
                  <StatusBadge tone={TASK_PRIORITY[e.priority].tone}>{TASK_PRIORITY[e.priority].label}</StatusBadge>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
