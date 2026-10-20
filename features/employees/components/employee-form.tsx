"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { createEmployeeAction, updateEmployeeAction } from "../actions";
import { employeeCreateSchema, employeeUpdateSchema } from "../schemas";
import type { EmployeeFormOptions } from "../types";

const NONE = "none";

export type EmployeeFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeCode: string;
  joiningDate: string;
  departmentId: string;
  designationId: string;
  roleKey: string;
  reportingManagerId: string;
  hrManagerId: string;
};

type EmployeeFormProps = {
  options: EmployeeFormOptions;
} & (
  | { mode: "create"; employeeId?: undefined; defaults?: undefined; emailLocked?: undefined; isSelf?: undefined }
  | { mode: "edit"; employeeId: string; defaults: EmployeeFormValues; emailLocked: boolean; isSelf: boolean }
);

const EMPTY: EmployeeFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  employeeCode: "",
  joiningDate: "",
  departmentId: "",
  designationId: "",
  roleKey: "EMPLOYEE",
  reportingManagerId: "",
  hrManagerId: "",
};

/** Add or edit an employee. Values are checked here and again on the server. */
export function EmployeeForm(props: EmployeeFormProps) {
  const { options, mode } = props;
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // Validate with the server's schema but keep the form's plain string values (raw); the server parses
  // them into dates and nulls. The cast is because the schema's input types are looser than these strings.
  const schema = (mode === "create" ? employeeCreateSchema : employeeUpdateSchema) as unknown as z.ZodType<
    EmployeeFormValues,
    EmployeeFormValues
  >;

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: props.defaults ?? EMPTY,
  });
  const { errors, isSubmitting } = form.formState;
  const departmentId = useWatch({ control: form.control, name: "departmentId" });
  const roleKey = useWatch({ control: form.control, name: "roleKey" });
  const department = options.departments.find((d) => d.id === departmentId);
  const departmentHr = department?.hrEmployee ? `${department.hrEmployee.firstName} ${department.hrEmployee.lastName}` : null;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    // Only HR Admins choose the HR manager; nobody changes their own role; a registered email stays put.
    const hrManagerId = options.canChooseHrManager ? values.hrManagerId : undefined;
    const result =
      mode === "create"
        ? await createEmployeeAction({ ...values, hrManagerId })
        : await updateEmployeeAction(props.employeeId, {
            ...values,
            hrManagerId,
            roleKey: props.isSelf ? undefined : values.roleKey,
            email: props.emailLocked ? undefined : values.email,
          });

    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(field as keyof EmployeeFormValues, { message: messages[0] });
      }
      setFormError(result.error);
      return;
    }
    toast.success(
      mode === "create"
        ? `${values.firstName} added. We've emailed them a link to set up their login.`
        : "Changes saved",
    );
    router.push(`/employees/${result.data.id}`);
    router.refresh();
  });

  const text = (name: keyof EmployeeFormValues, label: string, inputProps: React.ComponentProps<"input"> = {}, hint?: string) => (
    <Field data-invalid={Boolean(errors[name])}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} aria-invalid={Boolean(errors[name])} className="h-11 rounded-xl" {...inputProps} {...form.register(name)} />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      <FieldError errors={[errors[name]]} />
    </Field>
  );

  const select = (
    name: keyof EmployeeFormValues,
    label: string,
    items: { value: string; label: string }[],
    { allowNone = true, disabled = false, hint }: { allowNone?: boolean; disabled?: boolean; hint?: React.ReactNode } = {},
  ) => (
    <Field data-invalid={Boolean(errors[name])}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value || NONE}
            onValueChange={(v) => {
              field.onChange(v === NONE ? "" : v);
              if (name === "departmentId") {
                const next = options.departments.find((d) => d.id === v);
                if (!next?.designations.some((d) => d.id === form.getValues("designationId"))) form.setValue("designationId", "");
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger id={name} aria-invalid={Boolean(errors[name])} className="h-11 w-full rounded-xl">
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
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      <FieldError errors={[errors[name]]} />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <ErrorMessage message={formError} />

      <DashboardCard title="Personal details">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("firstName", "First name", { autoComplete: "off" })}
          {text("lastName", "Last name", { autoComplete: "off" })}
          {text(
            "email",
            "Work email",
            { type: "email", placeholder: "name@company.com", disabled: mode === "edit" && props.emailLocked },
            mode === "edit" && props.emailLocked
              ? "Locked: they've already created their login with this email."
              : mode === "create"
                ? "Their welcome email and sign-up link go here."
                : undefined,
          )}
          {text("phone", "Phone (optional)", { type: "tel", placeholder: "+91 98765 43210" })}
        </div>
      </DashboardCard>

      <DashboardCard title="Role and team">
        <div className="grid gap-5 sm:grid-cols-2">
          {select(
            "departmentId",
            "Department",
            options.departments.map((d) => ({ value: d.id, label: d.name })),
            { hint: departmentHr ? `HR for this department: ${departmentHr}` : undefined },
          )}
          {select(
            "designationId",
            "Designation",
            (department?.designations ?? options.departments.flatMap((d) => d.designations)).map((d) => ({ value: d.id, label: d.title })),
          )}
          {select(
            "roleKey",
            "Role in Embark",
            options.roles.map((r) => ({ value: r.key, label: r.name })),
            {
              allowNone: false,
              disabled: mode === "edit" && props.isSelf,
              hint: mode === "edit" && props.isSelf ? "You can't change your own role." : options.roles.find((r) => r.key === roleKey)?.description,
            },
          )}
          {select(
            "reportingManagerId",
            "Reporting manager",
            options.reportingManagers
              .filter((m) => m.id !== props.employeeId)
              .map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName} · ${m.employeeCode}` })),
          )}
          {options.canChooseHrManager
            ? departmentHr
              ? (
                  <Field>
                    <FieldLabel>HR manager</FieldLabel>
                    <p className="flex h-11 items-center rounded-xl border bg-muted px-3 text-sm">{departmentHr}</p>
                    <FieldDescription>Set by the department.</FieldDescription>
                  </Field>
                )
              : select(
                  "hrManagerId",
                  "HR manager",
                  options.hrManagers.map((h) => ({ value: h.id, label: h.name })),
                  { hint: "Who looks after their onboarding." },
                )
            : null}
        </div>
      </DashboardCard>

      <DashboardCard title="Joining">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("joiningDate", "Joining date", { type: "date" })}
          {text(
            "employeeCode",
            mode === "create" ? "Employee code (optional)" : "Employee code",
            { placeholder: mode === "create" ? "EMB-0042" : undefined, autoComplete: "off" },
            mode === "create" ? "Leave blank to use the next number." : undefined,
          )}
        </div>
      </DashboardCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" asChild className="h-11 rounded-full bg-card px-5">
          <Link href={mode === "edit" ? `/employees/${props.employeeId}` : "/employees"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting} className="h-11 rounded-full px-6">
          {isSubmitting ? <LoadingSpinner label="Saving" /> : null}
          {mode === "create" ? "Add employee" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
