import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  NEXT_PUBLIC_APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  DAILY_JOBS_CRON: z.string().default("0 8 * * *"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
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
});

/**
 * Server-only environment, validated once on first import. During `next build` (e.g. in Docker, where
 * secrets aren't present yet) validation is relaxed; the real values are checked when the app starts.
 */
export const env =
  process.env.NEXT_PHASE === "phase-production-build"
    ? (schema.partial().parse(process.env) as z.infer<typeof schema>)
    : schema.parse(process.env);
