import { db, speechRecognitionJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const stt = await db.select().from(speechRecognitionJobsTable).where(eq(speechRecognitionJobsTable.projectId, "9b6e5752-3cb5-4033-943b-15e2acefeb57"));
  console.log("STT TRANSCRIPT:", JSON.stringify(stt, null, 2));
}
main();
