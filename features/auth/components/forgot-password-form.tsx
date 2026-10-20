"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { requestPasswordReset } from "@/lib/auth/auth-client";
import { forgotPasswordSchema } from "../schemas";
import type { ForgotPasswordInput } from "../types";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFormError(null);
    const { error } = await requestPasswordReset({ email, redirectTo: "/reset-password" });
    if (error?.status === 429) return setFormError("Too many requests. Wait a few minutes, then try again.");
    // Same message whether or not the account exists, so this can't be used to find out who works here.
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <MailCheck className="mx-auto mb-3 size-8 text-primary" aria-hidden="true" />
        <p className="font-semibold">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">
          If an account exists for {sentTo}, we&apos;ve sent a link to reset your password. It expires in 1 hour.
        </p>
        <Button variant="link" asChild className="mt-3">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <ErrorMessage message={formError} />
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" placeholder="name@company.com" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? <LoadingSpinner label="Sending" /> : null}
          Send reset link
        </Button>
        <Button variant="link" asChild>
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </FieldGroup>
    </form>
  );
}
