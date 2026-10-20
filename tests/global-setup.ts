import { execSync } from "node:child_process";

/** Brings the test database up to date, seeds reference data, and creates the test storage bucket. */
export default function setup() {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    S3_BUCKET: process.env.TEST_S3_BUCKET,
  };
  if (!env.DATABASE_URL?.includes("_test")) throw new Error("Refusing to set up a non-test database");
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx prisma db seed", { env, stdio: "pipe" });
}
