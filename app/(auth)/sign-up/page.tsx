import type { Metadata } from "next";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { InvalidLink } from "@/features/auth/components/invalid-link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getInviteDetails } from "@/lib/auth/registration";

export const metadata: Metadata = { title: "Create your login" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const invite = token ? await getInviteDetails(token) : null;

  if (!token || !invite) {
    return (
      <InvalidLink
        title={token ? "This link has expired" : "You need an invitation"}
        description={
          token
            ? "Sign-up links work once and expire after 7 days. Ask your HR to send you a new one."
            : "Embark logins are created from the welcome email your HR sends. Ask them to add you."
        }
        action={{ href: "/sign-in", label: "Go to sign in" }}
      />
    );
  }

  return (
    <>
      <AuthHeading
        title={`Welcome, ${invite.firstName}`}
        description="Choose a password to create your Embark login."
      />
      <RegisterForm token={token} email={invite.email} />
    </>
  );
}
