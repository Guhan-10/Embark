import "dotenv/config";
import { prisma } from "@/lib/db/prisma";
import { ensureBucket } from "@/lib/storage/s3";
import { seedOrganisation, seedRolesAndPermissions, seedTemplate } from "./seed-data";

async function main() {
  await seedRolesAndPermissions();
  await seedOrganisation();
  await seedTemplate();
  try {
    await ensureBucket();
  } catch (error) {
    // Hosted storage (e.g. Cloudflare R2) often uses keys that can't create buckets: create it in the dashboard.
    console.warn(`Couldn't check or create the storage bucket; make sure it exists. (${(error as Error).message})`);
  }
  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
