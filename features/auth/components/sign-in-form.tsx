"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/shared/error-message";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PasswordInput } from "@/components/shared/password-input";
import { signIn } from "@/lib/auth/auth-client";
import { signInSchema } from "../schemas";
import type { SignInInput } from "../types";

function signInError(error: { status?: number; message?: string; code?: string }) {
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  if (error.status === 403) return error.message ?? "You can't sign in right now. Contact HR.";
  if (error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD") return "That email and password don't match.";
  return "We couldn't sign you in. Try again in a moment.";
}

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<SignInInput>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await signIn.email({ email: values.email, password: values.password });
    if (error) return setFormError(signInError(error));
    router.replace(next);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <ErrorMessage message={formError} />
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" placeholder="name@company.com" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={Boolean(errors.password)}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...form.register("password")} />
          <FieldError errors={[errors.password]} />
        </Field>
        <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? <LoadingSpinner label="Signing in" /> : null}
          Sign in
        </Button>
      </FieldGroup>
    </form>
  );
}
