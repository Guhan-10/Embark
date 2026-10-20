// Runs the daily jobs once, right now: department HR fix-up, task reminders, document expiry.
//   npm run jobs:daily
import "dotenv/config";
import { prisma } from "@/lib/db/prisma";
import { runDailyJobs } from "@/lib/jobs/daily";

runDailyJobs()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
