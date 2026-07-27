import { db, voiceAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const assets = await db.select().from(voiceAssetsTable).where(eq(voiceAssetsTable.projectId, "f5df4bf5-58b5-4778-ae32-32a881eae87a"));
  console.log("VOICE ASSETS:", JSON.stringify(assets, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
