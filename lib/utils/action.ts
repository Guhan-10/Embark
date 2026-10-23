import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AuthError } from "@/lib/auth/rbac";
import { flushNotificationEmailsAfterResponse } from "@/lib/jobs/notification-emails";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** An expected failure whose message is safe to show to the user. */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

/** Runs a server action body and turns known failures into a user-facing ActionResult. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    flushNotificationEmailsAfterResponse();
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error); // let Next.js redirect() and notFound() through
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>,
      };
    }
    if (error instanceof AuthError || error instanceof ActionError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "That conflicts with an existing record." };
    }
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
