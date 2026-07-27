import { db, processingJobsTable, voiceAssetsTable, renderedAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const pId = "8ec439d6-f44a-432f-ad07-d05b849b6d47";
  
  const jobs = await db.select().from(processingJobsTable).where(eq(processingJobsTable.projectId, pId));
  console.log("JOBS:", JSON.stringify(jobs, null, 2));

  const voices = await db.select().from(voiceAssetsTable).where(eq(voiceAssetsTable.projectId, pId));
  console.log("VOICES:", JSON.stringify(voices, null, 2));

  const renders = await db.select().from(renderedAssetsTable).where(eq(renderedAssetsTable.projectId, pId));
  console.log("RENDERS:", JSON.stringify(renders, null, 2));
}
main();
