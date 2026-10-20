import type { Metadata } from "next";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { InvalidLink } from "@/features/auth/components/invalid-link";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  if (!token || error) {
    return (
      <InvalidLink
        title="This reset link has expired"
        description="Reset links work once and expire after 1 hour. Request a new one."
        action={{ href: "/forgot-password", label: "Request a new link" }}
      />
    );
  }
  return (
    <>
      <AuthHeading title="Set a new password" description="You'll be signed out on all other devices." />
      <ResetPasswordForm token={token} />
    </>
  );
}
