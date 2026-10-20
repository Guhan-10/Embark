"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Blue for started, green for completed: theme tokens (app/globals.css) with a pair validated for
// colour-vision deficiency against each theme's card surface, so the chart follows light/dark.
const STARTED = "var(--chart-started)";
const COMPLETED = "var(--chart-completed)";

const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });
const fullMonth = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

type Month = { month: string; started: number; completed: number };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  const value = (key: string) => payload.find((p) => p.dataKey === key)?.value ?? 0;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold">{fullMonth.format(new Date(`${label}-01T00:00:00Z`))}</p>
      <p className="flex items-center gap-2">
        <span className="size-2.5 rounded-sm" style={{ background: STARTED }} aria-hidden="true" /> Started{" "}
        <span className="ml-auto pl-4 font-semibold tabular-nums">{value("started")}</span>
      </p>
      <p className="flex items-center gap-2">
        <span className="size-2.5 rounded-sm" style={{ background: COMPLETED }} aria-hidden="true" /> Completed{" "}
        <span className="ml-auto pl-4 font-semibold tabular-nums">{value("completed")}</span>
      </p>
    </div>
  );
}

/** Onboarding started vs completed per month: grouped bars, one axis, legend above, hover for exact numbers. */
export function OnboardingChart({ months }: { months: Month[] }) {
  const total = months.reduce((s, m) => s + m.started + m.completed, 0);
  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ background: STARTED }} /> Started
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ background: COMPLETED }} /> Completed
        </span>
      </div>
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No onboarding started or finished in this period.</p>
      ) : (
        <div className="h-64" role="img" aria-label={`Onboarding started and completed per month: ${months.map((m) => `${fullMonth.format(new Date(`${m.month}-01T00:00:00Z`))} ${m.started} started, ${m.completed} completed`).join("; ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={(m: string) => monthLabel.format(new Date(`${m}-01T00:00:00Z`))}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
              <Bar dataKey="started" name="Started" fill={STARTED} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="completed" name="Completed" fill={COMPLETED} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className="sr-only">Onboarding started and completed per month</figcaption>
    </figure>
  );
}
