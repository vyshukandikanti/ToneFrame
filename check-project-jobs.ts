import { db, processingJobsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

async function main() {
  const jobs = await db.select().from(processingJobsTable).where(eq(processingJobsTable.projectId, "6a6bccbe-2cf2-4533-8fb0-fcb9222894ee")).orderBy(desc(processingJobsTable.createdAt));
  console.log("PROJECT JOBS:", JSON.stringify(jobs, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
