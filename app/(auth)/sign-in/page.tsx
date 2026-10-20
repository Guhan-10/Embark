import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { getCurrentUser } from "@/lib/auth/rbac";
import { safeRedirectPath } from "@/lib/utils/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeRedirectPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <>
      <AuthHeading title="Welcome back" description="Sign in to see your onboarding." />
      <SignInForm next={next} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New here? Your HR will email you a link to set up your login.
      </p>
    </>
  );
}
