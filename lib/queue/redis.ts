import IORedis from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as { redis?: IORedis };

/**
 * Shared Redis connection, opened on first use (not on import, so builds never try to connect).
 * BullMQ requires maxRetriesPerRequest: null.
 */
export function getRedis() {
  if (!env.REDIS_URL) throw new Error("REDIS_URL is not set.");
  globalForRedis.redis ??= new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return globalForRedis.redis;
}
