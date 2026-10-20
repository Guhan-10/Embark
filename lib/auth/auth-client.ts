"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

// No signUp: logins are created from welcome-email links via registerAction (features/auth/actions.ts).
export const { signIn, signOut, useSession, requestPasswordReset, resetPassword } = authClient;
