import { z } from "zod";

/** A blank value (e.g. an empty setting in a hosting dashboard) counts as not set. */
const optional = <T extends z.ZodType>(type: T) => z.preprocess((v) => (v === "" ? undefined : v), type.optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  NEXT_PUBLIC_APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  DAILY_JOBS_CRON: z.string().default("0 8 * * *"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  DATABASE_URL: z.url(),
  // Optional: without Redis (e.g. on Vercel) e-mails are sent during the request and there is no worker.
  REDIS_URL: optional(z.url()),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(8),
  S3_BUCKET: z.string().min(3),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(1),
  // Protects /api/cron/daily (Vercel Cron sends it as a bearer token).
  CRON_SECRET: optional(z.string().min(16)),
});

/**
 * Server-only environment, validated once on first import. During `next build` (e.g. in Docker, where
 * secrets aren't present yet) validation is relaxed; the real values are checked when the app starts.
 */
export const env =
  process.env.NEXT_PHASE === "phase-production-build"
    ? (schema.partial().parse(process.env) as z.infer<typeof schema>)
    : schema.parse(process.env);
