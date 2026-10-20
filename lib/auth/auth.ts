import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db/prisma";
import { deliverEmail } from "@/lib/email/deliver";
import { resetPasswordTemplate } from "@/lib/email/templates";
import { env } from "@/lib/env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // Logins are only created from welcome-email links (lib/auth/registration.ts), never by public sign-up.
    disableSignUp: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await deliverEmail(resetPasswordTemplate(user.email, user.name, url));
    },
  },

  // Brute-force limits per IP (active in production). Sign-in: 5 tries a minute; reset emails: 3 per 5 minutes.
  rateLimit: {
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/reset-password": { window: 300, max: 5 },
    },
  },

  user: {
    additionalFields: {
      isActive: { type: "boolean", defaultValue: true, input: false },
    },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });
          if (!user?.isActive) {
            throw new APIError("FORBIDDEN", {
              message: "Your account has been deactivated. Contact HR.",
            });
          }
        },
      },
    },
  },

  // Must be last so cookies set during server actions reach the browser.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
