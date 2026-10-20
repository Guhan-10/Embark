"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { createDepartmentAction, updateDepartmentAction } from "../actions";

type Values = { name: string; code: string; description: string };
const EMPTY: Values = { name: "", code: "", description: "" };

/** Add a department, or rename one and change its code and description. */
export function DepartmentDialog({ trigger, department }: { trigger: React.ReactNode; department?: { id: string } & Values }) {
  const initial = department ? { name: department.name, code: department.code, description: department.description } : EMPTY;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      const result = department ? await updateDepartmentAction(department.id, values) : await createDepartmentAction(values);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        return setError(result.error);
      }
      toast.success(department ? "Department saved" : `${values.name} added`);
      setOpen(false);
    });

  const field = (name: keyof Values, label: string, hint?: string, input: React.ComponentProps<"input"> = {}) => (
    <Field data-invalid={Boolean(fieldErrors[name])}>
      <FieldLabel htmlFor={`department-${name}`}>{label}</FieldLabel>
      <Input
        id={`department-${name}`}
        className="h-11 rounded-xl"
        value={values[name]}
        aria-invalid={Boolean(fieldErrors[name])}
        onChange={(e) => setValues({ ...values, [name]: e.target.value })}
        {...input}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      <FieldError errors={fieldErrors[name]?.map((message) => ({ message }))} />
    </Field>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) {
          setValues(initial);
          setError(null);
          setFieldErrors({});
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{department ? `Edit ${department.name}` : "Add a department"}</DialogTitle>
          {department ? null : <DialogDescription>You can add designations and choose its HR next.</DialogDescription>}
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <ErrorMessage message={error} />
          {field("name", "Name", undefined, { placeholder: "Engineering", autoFocus: true })}
          {field("code", "Short code (optional)", "Up to 10 letters, numbers, or dashes, e.g. ENG.", { maxLength: 10, className: "h-11 rounded-xl uppercase" })}
          <Field>
            <FieldLabel htmlFor="department-description">Description (optional)</FieldLabel>
            <Textarea
              id="department-description"
              rows={3}
              className="rounded-xl"
              value={values.description}
              onChange={(e) => setValues({ ...values, description: e.target.value })}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="h-11 rounded-full px-6" disabled={pending}>
              {pending ? <LoadingSpinner label="Saving" /> : null}
              {department ? "Save" : "Add department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
