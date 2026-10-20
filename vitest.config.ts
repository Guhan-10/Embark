import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ quiet: true });

// Integration tests use a separate database next to the dev one: <db>_test.
const testDatabaseUrl = process.env.DATABASE_URL!.replace(/\/([^/?]+)(\?|$)/, "/$1_test$2");
process.env.TEST_DATABASE_URL = testDatabaseUrl; // read by tests/global-setup.ts
// Uploaded files in tests go to their own bucket.
const testBucket = `${process.env.S3_BUCKET}-test`;
process.env.TEST_S3_BUCKET = testBucket;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    env: { DATABASE_URL: testDatabaseUrl, S3_BUCKET: testBucket, NODE_ENV: "test" },
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
});
