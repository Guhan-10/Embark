import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/queue/redis";
import { bucket, s3 } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

async function check(fn: () => Promise<unknown>) {
  try {
    await fn();
    return "ok" as const;
  } catch {
    return "down" as const;
  }
}

export async function GET() {
  const [database, cache, storage] = await Promise.all([
    check(() => prisma.$queryRaw`SELECT 1`),
    env.REDIS_URL ? check(() => getRedis().ping()) : Promise.resolve("not used" as const),
    check(() => s3.send(new HeadBucketCommand({ Bucket: bucket }))),
  ]);
  const healthy = database === "ok" && cache !== "down" && storage === "ok";

  return Response.json(
    { status: healthy ? "ok" : "degraded", database, redis: cache, storage },
    { status: healthy ? 200 : 503 },
  );
}
