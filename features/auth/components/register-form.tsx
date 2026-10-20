"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PasswordInput } from "@/components/shared/password-input";
import { registerAction } from "../actions";
import { registerSchema } from "../schemas";
import type { RegisterInput } from "../types";

/** Sets the password for a login HR invited by email. The email comes from the link, not the form. */
export function RegisterForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await registerAction(values);
    if (!result.ok) return setFormError(result.error);
    router.replace("/dashboard");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <ErrorMessage message={formError} />
        <Field>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input id="email" value={email} readOnly autoComplete="username" className="bg-muted" />
        </Field>
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password">Choose a password</FieldLabel>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...form.register("password")} />
          <FieldDescription>At least 8 characters.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
        <Field data-invalid={Boolean(errors.confirmPassword)}>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...form.register("confirmPassword")} />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>
        <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? <LoadingSpinner label="Creating your login" /> : null}
          Create login
        </Button>
      </FieldGroup>
    </form>
  );
}
