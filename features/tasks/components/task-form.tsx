"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import type { TaskPriority } from "@/generated/prisma/enums";
import { TASK_PRIORITY } from "@/lib/constants/task-status";
import { createTaskAction } from "../actions";

const NONE = "none";

type Values = {
  title: string;
  description: string;
  stepId: string;
  priority: TaskPriority;
  dueDate: string;
  documentTypeId: string;
  assigneeIds: string[];
};

/** "Add task" button and dialog for adding a task by hand to an onboarding. */
export function AddTaskDialog({
  processId,
  steps,
  people,
  documentTypes,
}: {
  processId: string;
  steps: { id: string; title: string }[];
  people: { id: string; name: string; hint?: string }[];
  documentTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    defaultValues: { title: "", description: "", stepId: "", priority: "MEDIUM", dueDate: "", documentTypeId: "", assigneeIds: [] },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await createTaskAction({ ...values, processId, dueDate: values.dueDate || null });
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(field as keyof Values, { message: messages[0] });
      }
      return setFormError(result.error);
    }
    toast.success(`Added "${values.title}"`);
    form.reset();
    setOpen(false);
    router.refresh();
  });

  const select = (name: "stepId" | "priority" | "documentTypeId", label: string, items: { value: string; label: string }[], allowNone = true) => (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
            <SelectTrigger id={name} className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowNone ? <SelectItem value={NONE}>None</SelectItem> : null}
              {items.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && setOpen(next)}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-full px-5">
          <Plus /> Add task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a task</DialogTitle>
          <DialogDescription>For anything the template doesn&apos;t cover. Assignees are notified.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <ErrorMessage message={formError} />
          <Field data-invalid={Boolean(errors.title)}>
            <FieldLabel htmlFor="title">Task</FieldLabel>
            <Input
              id="title"
              className="h-11 rounded-xl"
              placeholder="Return the signed NDA"
              aria-invalid={Boolean(errors.title)}
              {...form.register("title", { required: "Enter a task title" })}
            />
            <FieldError errors={[errors.title]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Details (optional)</FieldLabel>
            <Textarea id="description" rows={2} className="rounded-xl" {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.length ? select("stepId", "Step", steps.map((s) => ({ value: s.id, label: s.title }))) : null}
            {select(
              "priority",
              "Priority",
              Object.entries(TASK_PRIORITY).map(([value, p]) => ({ value, label: p.label })),
              false,
            )}
            <Field>
              <FieldLabel htmlFor="dueDate">Due date (optional)</FieldLabel>
              <Input id="dueDate" type="date" className="h-11 rounded-xl" {...form.register("dueDate")} />
            </Field>
            {select("documentTypeId", "Needs a document", documentTypes.map((d) => ({ value: d.id, label: d.name })))}
          </div>
          {people.length ? (
            <Field>
              <FieldLabel>Assign to</FieldLabel>
              <Controller
                control={form.control}
                name="assigneeIds"
                render={({ field }) => (
                  <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
                    {people.map((p) => {
                      const checked = field.value.includes(p.id);
                      return (
                        <label key={p.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => field.onChange(c ? [...field.value, p.id] : field.value.filter((id) => id !== p.id))}
                          />
                          <span>
                            {p.name}
                            {p.hint ? <span className="block text-xs text-muted-foreground">{p.hint}</span> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            </Field>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="h-11 rounded-full px-6" disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner label="Adding" /> : null}
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
