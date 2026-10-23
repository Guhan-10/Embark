import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  // Hosted Postgres (Neon) adds network latency and can wake from scale-to-zero mid-request, so give
  // interactive transactions more room than Prisma's 5s default.
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 180_000 } });
}

// Reuse one client across hot reloads in development.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
