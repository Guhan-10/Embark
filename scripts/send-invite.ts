// Database-admin command: send someone added directly in Postgres (e.g. the first HR Admin) their sign-up link.
//   npm run invite -- priya.sharma@company.com
//   npm run invite -- priya.sharma@company.com --print-link   (also print the link, e.g. if email isn't set up yet)
// Emails go through the worker queue, so keep `npm run worker` running (or the worker service in production).
import "dotenv/config";
import { inviteFromDatabaseAdmin } from "@/features/employees/service";
import { prisma } from "@/lib/db/prisma";

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: npm run invite -- <email> [--print-link]");
    process.exit(1);
  }
  const result = await inviteFromDatabaseAdmin(email);
  console.log(
    result.emailed
      ? `Welcome email with a sign-up link is on its way to ${result.email} (the worker sends it). The link works once and expires in 7 days.`
      : `Couldn't send the email to ${result.email}. Check the SMTP settings, or rerun with --print-link.`,
  );
  if (flag === "--print-link") console.log(`Sign-up link (share it privately): ${result.url}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(); // the email queue's Redis connection would otherwise keep the script alive
  });
