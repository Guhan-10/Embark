"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileText, Plus, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import type { AssigneeType, TaskPriority } from "@/generated/prisma/enums";
import { ASSIGNEE_TYPE, TASK_PRIORITY } from "@/lib/constants/task-status";
import { cn } from "@/lib/utils/cn";
import { createTemplateAction, updateTemplateAction } from "../actions";
import { templateSchema } from "../schemas";

const NONE = "none";

export type TaskDraft = {
  key: string;
  title: string;
  description: string;
  assigneeType: AssigneeType;
  dueOffsetDays: string;
  priority: TaskPriority;
  documentTypeId: string;
};
export type StepDraft = { key: string; title: string; tasks: TaskDraft[] };
export type TemplateDraft = { name: string; description: string; departmentId: string; steps: StepDraft[] };

// Rows added in the browser get random keys; the starting rows use fixed ones so server and browser match.
const newTask = (key: string = crypto.randomUUID()): TaskDraft => ({
  key,
  title: "",
  description: "",
  assigneeType: "EMPLOYEE",
  dueOffsetDays: "0",
  priority: "MEDIUM",
  documentTypeId: "",
});
const newStep = (key: string = crypto.randomUUID()): StepDraft => ({ key, title: "", tasks: [newTask(`${key}-t0`)] });

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function dayLabel(offset: string) {
  const n = Number(offset);
  if (!Number.isFinite(n) || offset === "") return "";
  if (n === 0) return "Joining day";
  return n < 0 ? `${-n} ${n === -1 ? "day" : "days"} before joining` : `${n} ${n === 1 ? "day" : "days"} after joining`;
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function toInput(draft: TemplateDraft) {
  return {
    name: draft.name,
    description: draft.description,
    departmentId: draft.departmentId,
    steps: draft.steps.map((s) => ({
      title: s.title,
      tasks: s.tasks.map((t) => ({
        title: t.title,
        description: t.description,
        assigneeType: t.assigneeType,
        dueOffsetDays: t.dueOffsetDays,
        priority: t.priority,
        documentTypeId: t.documentTypeId,
      })),
    })),
  };
}

/** Build or edit an onboarding template: steps, and the tasks in each step. */
export function WorkflowBuilder({
  templateId,
  initial,
  departments,
  documentTypes,
}: {
  templateId?: string;
  initial?: TemplateDraft;
  departments: { id: string; name: string }[];
  documentTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<TemplateDraft>(initial ?? { name: "", description: "", departmentId: "", steps: [newStep("s0")] });
  // After the first save attempt, problems are re-checked on every change, so fixed fields clear right away.
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set(initial?.steps.flatMap((s) => s.tasks.filter((t) => t.description).map((t) => t.key)) ?? []));
  const [pending, startTransition] = useTransition();

  const setSteps = (fn: (steps: StepDraft[]) => StepDraft[]) => setDraft((d) => ({ ...d, steps: fn(d.steps) }));
  const updateStep = (si: number, patch: Partial<StepDraft>) => setSteps((steps) => steps.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const updateTask = (si: number, ti: number, patch: Partial<TaskDraft>) =>
    setSteps((steps) => steps.map((s, i) => (i === si ? { ...s, tasks: s.tasks.map((t, j) => (j === ti ? { ...t, ...patch } : t)) } : s)));
  const input = toInput(draft);
  const check = templateSchema.safeParse(input);
  const errors: Record<string, string> =
    submitted && !check.success ? Object.fromEntries(check.error.issues.map((i) => [i.path.join("."), i.message])) : {};
  const err = (path: string) => errors[path];
  const taskCount = draft.steps.reduce((sum, s) => sum + s.tasks.length, 0);

  const save = () => {
    setFormError(null);
    setSubmitted(true);
    if (!check.success) return;
    startTransition(async () => {
      const result = templateId ? await updateTemplateAction(templateId, input) : await createTemplateAction(input);
      if (!result.ok) return setFormError(result.error);
      toast.success(templateId ? "Template saved" : `Created "${draft.name}"`);
      router.push("/onboarding/templates");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <ErrorMessage message={formError ?? (Object.keys(errors).length ? "Some fields need attention." : null)} />

      <DashboardCard title="About this template">
        <div className="grid gap-5 md:grid-cols-[1fr_260px]">
          <Field data-invalid={Boolean(err("name"))}>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" className="h-11 rounded-xl" placeholder="Engineering onboarding" value={draft.name} aria-invalid={Boolean(err("name"))} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <FieldError>{err("name")}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="department">Suggested for</FieldLabel>
            <Select value={draft.departmentId || NONE} onValueChange={(v) => setDraft({ ...draft, departmentId: v === NONE ? "" : v })}>
              <SelectTrigger id="department" className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Any department</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
            <Textarea id="description" rows={2} className="rounded-xl" placeholder="Who it's for and what it covers" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
        </div>
      </DashboardCard>

      {draft.steps.map((step, si) => (
        <DashboardCard key={step.key}>
          <div className="mb-4 flex items-start gap-3">
            <span className="mt-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{si + 1}</span>
            <Field className="flex-1" data-invalid={Boolean(err(`steps.${si}.title`))}>
              <FieldLabel htmlFor={`step-${step.key}`} className="sr-only">
                Step {si + 1} title
              </FieldLabel>
              <Input
                id={`step-${step.key}`}
                className="h-11 rounded-xl text-base font-semibold"
                placeholder="Step name, e.g. Before day one"
                value={step.title}
                aria-invalid={Boolean(err(`steps.${si}.title`))}
                onChange={(e) => updateStep(si, { title: e.target.value })}
              />
              <FieldError>{err(`steps.${si}.title`) ?? err(`steps.${si}.tasks`)}</FieldError>
            </Field>
            <div className="mt-1.5 flex">
              <IconButton label="Move step up" onClick={() => setSteps((s) => move(s, si, si - 1))} disabled={si === 0}>
                <ArrowUp />
              </IconButton>
              <IconButton label="Move step down" onClick={() => setSteps((s) => move(s, si, si + 1))} disabled={si === draft.steps.length - 1}>
                <ArrowDown />
              </IconButton>
              <IconButton label="Remove step" onClick={() => setSteps((s) => s.filter((_, i) => i !== si))} disabled={draft.steps.length === 1}>
                <Trash2 />
              </IconButton>
            </div>
          </div>

          <ul className="flex flex-col gap-3 sm:pl-11">
            {step.tasks.map((task, ti) => {
              const p = `steps.${si}.tasks.${ti}`;
              const notesOpen = openNotes.has(task.key);
              return (
                <li key={task.key} className="rounded-2xl bg-muted/60 p-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_110px_130px_auto]">
                    <Field data-invalid={Boolean(err(`${p}.title`))}>
                      <FieldLabel htmlFor={`task-${task.key}`} className="text-xs">Task</FieldLabel>
                      <Input
                        id={`task-${task.key}`}
                        className="h-11 rounded-xl bg-card"
                        placeholder="Upload government ID"
                        value={task.title}
                        aria-invalid={Boolean(err(`${p}.title`))}
                        onChange={(e) => updateTask(si, ti, { title: e.target.value })}
                      />
                      <FieldError>{err(`${p}.title`)}</FieldError>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`owner-${task.key}`} className="text-xs">Done by</FieldLabel>
                      <Select value={task.assigneeType} onValueChange={(v) => updateTask(si, ti, { assigneeType: v as AssigneeType })}>
                        <SelectTrigger id={`owner-${task.key}`} className="w-full rounded-xl bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ASSIGNEE_TYPE).map(([value, a]) => (
                            <SelectItem key={value} value={value}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field data-invalid={Boolean(err(`${p}.dueOffsetDays`))}>
                      <FieldLabel htmlFor={`day-${task.key}`} className="text-xs">Due on day</FieldLabel>
                      <Input
                        id={`day-${task.key}`}
                        type="number"
                        min={-90}
                        max={365}
                        className="h-11 rounded-xl bg-card"
                        value={task.dueOffsetDays}
                        aria-invalid={Boolean(err(`${p}.dueOffsetDays`))}
                        aria-describedby={`day-hint-${task.key}`}
                        onChange={(e) => updateTask(si, ti, { dueOffsetDays: e.target.value })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`priority-${task.key}`} className="text-xs">Priority</FieldLabel>
                      <Select value={task.priority} onValueChange={(v) => updateTask(si, ti, { priority: v as TaskPriority })}>
                        <SelectTrigger id={`priority-${task.key}`} className="w-full rounded-xl bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TASK_PRIORITY).map(([value, pr]) => (
                            <SelectItem key={value} value={value}>
                              {pr.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="flex items-end pb-1.5">
                      <IconButton label="Move task up" onClick={() => updateStep(si, { tasks: move(step.tasks, ti, ti - 1) })} disabled={ti === 0}>
                        <ArrowUp />
                      </IconButton>
                      <IconButton label="Move task down" onClick={() => updateStep(si, { tasks: move(step.tasks, ti, ti + 1) })} disabled={ti === step.tasks.length - 1}>
                        <ArrowDown />
                      </IconButton>
                      <IconButton label="Remove task" onClick={() => updateStep(si, { tasks: step.tasks.filter((_, j) => j !== ti) })} disabled={step.tasks.length === 1}>
                        <Trash2 />
                      </IconButton>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span id={`day-hint-${task.key}`} className={cn("text-muted-foreground", err(`${p}.dueOffsetDays`) && "text-destructive")}>
                      {err(`${p}.dueOffsetDays`) ?? dayLabel(task.dueOffsetDays)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <Select value={task.documentTypeId || NONE} onValueChange={(v) => updateTask(si, ti, { documentTypeId: v === NONE ? "" : v })}>
                        <SelectTrigger aria-label="Document this task needs" className="h-7! rounded-full border-none bg-card px-2.5 text-xs shadow-none" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>No document needed</SelectItem>
                          {documentTypes.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              Needs: {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </span>
                    {!notesOpen ? (
                      <button type="button" className="flex items-center gap-1 font-medium text-primary hover:underline" onClick={() => setOpenNotes((s) => new Set(s).add(task.key))}>
                        <StickyNote className="size-3.5" aria-hidden="true" /> Add details
                      </button>
                    ) : null}
                  </div>
                  {notesOpen ? (
                    <Textarea
                      aria-label="Task details"
                      rows={2}
                      className="mt-2 rounded-xl bg-card"
                      placeholder="Instructions the assignee will see"
                      value={task.description}
                      onChange={(e) => updateTask(si, ti, { description: e.target.value })}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 sm:pl-11">
            <Button type="button" variant="ghost" className="rounded-full text-primary" onClick={() => updateStep(si, { tasks: [...step.tasks, newTask()] })}>
              <Plus /> Add task
            </Button>
          </div>
        </DashboardCard>
      ))}

      <button
        type="button"
        onClick={() => setSteps((s) => [...s, newStep()])}
        className="flex items-center justify-center gap-2 rounded-[1.75rem] border-2 border-dashed border-primary/30 bg-accent/40 py-5 text-sm font-semibold text-primary-ink hover:border-primary/60 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <Plus className="size-4" aria-hidden="true" /> Add step
      </button>

      <div className="sticky bottom-4 z-10 flex flex-col-reverse items-center gap-3 rounded-full bg-card/95 p-2 pl-5 shadow-lg ring-1 ring-border backdrop-blur sm:flex-row sm:justify-between">
        <FieldDescription className="text-sm">
          {draft.steps.length} {draft.steps.length === 1 ? "step" : "steps"} · {taskCount} {taskCount === 1 ? "task" : "tasks"}
          {templateId ? " · changes apply to onboarding started from now on" : ""}
        </FieldDescription>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild className="h-11 rounded-full px-5">
            <Link href="/onboarding/templates">Cancel</Link>
          </Button>
          <Button type="button" onClick={save} disabled={pending} className="h-11 rounded-full px-6">
            {pending ? <LoadingSpinner label="Saving" /> : null}
            {templateId ? "Save template" : "Create template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
