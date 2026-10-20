"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FileText, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { StatusBadge } from "@/components/shared/status-badge";
import { ASSIGNEE_TYPE, TASK_PRIORITY } from "@/lib/constants/task-status";
import { addDays } from "@/lib/utils/date";
import { formatDate, formatShortDate, plural } from "@/lib/utils/format";
import { startOnboardingAction } from "../actions";
import type { listTemplatesForStart } from "../queries";

type Template = Awaited<ReturnType<typeof listTemplatesForStart>>[number];
type Employee = { id: string; name: string; code: string; joiningDate: string; departmentId: string | null };

const NO_TEMPLATE = "none";

/** Pick a person and a template, preview every task with its due date and owner, then start. */
export function StartOnboardingForm({
  employees,
  templates,
  defaultEmployeeId,
}: {
  employees: Employee[];
  templates: Template[];
  defaultEmployeeId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState(
    employees.some((e) => e.id === defaultEmployeeId) ? defaultEmployeeId! : (employees[0]?.id ?? ""),
  );
  const employee = employees.find((e) => e.id === employeeId);
  const suggested = templates.find((t) => t.departmentId && t.departmentId === employee?.departmentId) ?? templates[0];
  const [chosenTemplateId, setChosenTemplateId] = useState<string | null>(null);
  const templateId = chosenTemplateId ?? suggested?.id ?? NO_TEMPLATE;
  const template = templates.find((t) => t.id === templateId);

  const preview = useMemo(() => {
    if (!template || !employee) return null;
    const joining = new Date(employee.joiningDate);
    const steps = template.steps.map((s) => ({
      ...s,
      tasks: s.tasks.map((t) => ({ ...t, due: addDays(joining, t.dueOffsetDays) })),
    }));
    const all = steps.flatMap((s) => s.tasks);
    const last = all.reduce<Date | null>((max, t) => (!max || t.due > max ? t.due : max), null);
    return { steps, count: all.length, last };
  }, [template, employee]);

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={Rocket}
        title="Everyone already has onboarding"
        description="Add a new employee first, or wait for the current onboarding to finish."
      />
    );
  }

  const start = () =>
    startTransition(async () => {
      setError(null);
      const result = await startOnboardingAction({ employeeId, templateId: templateId === NO_TEMPLATE ? "" : templateId });
      if (!result.ok) return setError(result.error);
      toast.success(`Onboarding started for ${employee?.name}. Their tasks have been assigned.`);
      router.push(`/onboarding/${result.data.id}`);
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
      <DashboardCard title="Who and how" className="h-fit">
        <div className="flex flex-col gap-5">
          <ErrorMessage message={error} />
          <Field>
            <FieldLabel htmlFor="employee">New hire</FieldLabel>
            <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setChosenTemplateId(null); }}>
              <SelectTrigger id="employee" className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · joins {formatShortDate(e.joiningDate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="template">Template</FieldLabel>
            <Select value={templateId} onValueChange={setChosenTemplateId}>
              <SelectTrigger id="template" className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
                <SelectItem value={NO_TEMPLATE}>No template (add tasks by hand)</SelectItem>
              </SelectContent>
            </Select>
            {template?.description ? <FieldDescription>{template.description}</FieldDescription> : null}
          </Field>
          {employee ? (
            <p className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm text-accent-foreground">
              <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
              Joins {formatDate(employee.joiningDate)}. Due dates count from this day.
            </p>
          ) : null}
          <Button size="lg" className="h-11 rounded-full" onClick={start} disabled={pending || !employeeId}>
            {pending ? <LoadingSpinner label="Starting" /> : <Rocket />}
            Start onboarding
          </Button>
        </div>
      </DashboardCard>

      <DashboardCard
        title="Preview"
        action={
          preview ? (
            <span className="text-sm text-muted-foreground">
              {plural(preview.count, "task")}
              {preview.last ? ` · last due ${formatShortDate(preview.last)}` : ""}
            </span>
          ) : undefined
        }
      >
        {!preview ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks yet. You can add them by hand once onboarding has started.
          </p>
        ) : (
          <ol className="flex flex-col gap-5">
            {preview.steps.map((step, i) => (
              <li key={step.id}>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>
                  {step.title}
                </p>
                <ul className="flex flex-col gap-1.5 pl-8">
                  {step.tasks.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 font-medium">
                        {t.documentType ? <FileText className="mr-1.5 inline size-3.5 text-muted-foreground" aria-label="Needs a document" /> : null}
                        {t.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{ASSIGNEE_TYPE[t.assigneeType].short}</span>
                      {t.priority === "HIGH" || t.priority === "URGENT" ? (
                        <StatusBadge tone={TASK_PRIORITY[t.priority].tone}>{TASK_PRIORITY[t.priority].label}</StatusBadge>
                      ) : null}
                      <span className="w-16 text-right text-xs font-semibold tabular-nums">{formatShortDate(t.due)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </DashboardCard>
    </div>
  );
}
