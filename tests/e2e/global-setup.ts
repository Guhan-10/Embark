import { execSync, spawn } from "node:child_process";
import IORedis from "ioredis";
import { E2E_DOMAIN, MAILPIT_URL, e2eEnv } from "./env";

/**
 * Prepares a clean e2e world: migrates and seeds the e2e database, creates the fixtures, clears old e2e
 * emails and queued jobs, and starts the email worker (welcome emails reach Mailpit the real way).
 */
export default async function globalSetup() {
  const env = e2eEnv();
  if (!env.DATABASE_URL?.includes("_e2e")) throw new Error("Refusing to set up a non-e2e database");

  const redis = new IORedis(env.REDIS_URL!, { maxRetriesPerRequest: 1 });
  await redis.flushdb(); // database 1 is only for e2e runs
  redis.disconnect();
  await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${E2E_DOMAIN}"`)}`, { method: "DELETE" }).catch(() => {
    throw new Error(`Mailpit isn't reachable at ${MAILPIT_URL}. Start it with: docker compose up -d`);
  });

  const run = (command: string) => execSync(command, { env, stdio: "pipe" });
  run("npx prisma migrate deploy");
  run("npx prisma db seed");
  run("npx tsx --import ./scripts/server-only-hook.mjs tests/e2e/fixtures-seed.ts");

  const worker = spawn("npm", ["run", "worker"], { env, detached: true, stdio: "ignore" });
  return () => {
    if (worker.pid) process.kill(-worker.pid, "SIGTERM");
  };
}
