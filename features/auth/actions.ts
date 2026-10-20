"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { registerWithInvite } from "@/lib/auth/registration";
import { runAction, type ActionResult } from "@/lib/utils/action";
import { registerSchema } from "./schemas";
import type { RegisterInput } from "./types";

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}

/** Creates the login from a welcome-email link and signs the new person in. */
export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  return runAction(async () => {
    const { password } = registerSchema.parse(input);
    const { email } = await registerWithInvite(input);
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  });
}
