import { db, translationJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const translations = await db.select().from(translationJobsTable).where(eq(translationJobsTable.projectId, "9b6e5752-3cb5-4033-943b-15e2acefeb57"));
  console.log("TRANSLATIONS:", JSON.stringify(translations, null, 2));
}
main();
