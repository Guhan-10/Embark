import "dotenv/config";
import { prisma } from "@/lib/db/prisma";
import { ensureBucket } from "@/lib/storage/s3";
import { seedOrganisation, seedRolesAndPermissions, seedTemplate } from "./seed-data";

async function main() {
  await seedRolesAndPermissions();
  await seedOrganisation();
  await seedTemplate();
  await ensureBucket();
  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
