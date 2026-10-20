"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import type { TaskPriority } from "@/generated/prisma/enums";
import { TASK_PRIORITY } from "@/lib/constants/task-status";
import { updateTaskAction } from "../actions";

/** HR edits a task's title, details, priority, and due date. */
export function TaskEditDialog({
  taskId,
  initial,
}: {
  taskId: string;
  initial: { title: string; description: string; priority: TaskPriority; dueDate: string };
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await updateTaskAction(taskId, { ...values, dueDate: values.dueDate || null });
      if (!result.ok) return setError(result.fieldErrors?.title?.[0] ?? result.error);
      toast.success("Task updated");
      setOpen(false);
    });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && (setOpen(next), next && setValues(initial))}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 rounded-full bg-card px-4">
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <ErrorMessage message={error} />
          <Field>
            <FieldLabel htmlFor="edit-title">Task</FieldLabel>
            <Input id="edit-title" className="h-11 rounded-xl" value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-description">Details</FieldLabel>
            <Textarea id="edit-description" rows={3} className="rounded-xl" value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-priority">Priority</FieldLabel>
              <Select value={values.priority} onValueChange={(v) => setValues({ ...values, priority: v as TaskPriority })}>
                <SelectTrigger id="edit-priority" className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY).map(([value, p]) => (
                    <SelectItem key={value} value={value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-due">Due date</FieldLabel>
              <Input id="edit-due" type="date" className="h-11 rounded-xl" value={values.dueDate} onChange={(e) => setValues({ ...values, dueDate: e.target.value })} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11 rounded-full" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button className="h-11 rounded-full px-6" onClick={save} disabled={pending}>
            {pending ? <LoadingSpinner /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
