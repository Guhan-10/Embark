import { config } from "dotenv";

config({ quiet: true });

export const E2E_PORT = 3100;
export const BASE_URL = `http://localhost:${E2E_PORT}`;
/** Every person the e2e fixtures create uses this domain, so their emails are easy to find (and clear) in Mailpit. */
export const E2E_DOMAIN = "e2e.embark.test";
export const PASSWORD = "E2e-Pass-2026";
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set in .env to run the e2e tests`);
  return value;
}

/**
 * The app, worker, and fixtures in e2e runs share this environment: their own database (<db>_e2e), storage
 * bucket, and Redis database, so a run never touches development data or queues.
 */
export function e2eEnv(): NodeJS.ProcessEnv {
  const redis = new URL(required("REDIS_URL"));
  redis.pathname = "/1";
  return {
    ...process.env,
    DATABASE_URL: required("DATABASE_URL").replace(/\/([^/?]+)(\?|$)/, "/$1_e2e$2"),
    S3_BUCKET: `${required("S3_BUCKET")}-e2e`,
    REDIS_URL: redis.toString(),
    APP_URL: BASE_URL,
    BETTER_AUTH_URL: BASE_URL,
  };
}
