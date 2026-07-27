import { db, processingJobsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

async function main() {
  const jobs = await db.select().from(processingJobsTable).orderBy(desc(processingJobsTable.createdAt)).limit(10);
  console.log("LATEST JOBS:", JSON.stringify(jobs, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
