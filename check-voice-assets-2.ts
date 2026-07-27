import { db, voiceAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const assets = await db.select().from(voiceAssetsTable).where(eq(voiceAssetsTable.projectId, "6a6bccbe-2cf2-4533-8fb0-fcb9222894ee"));
  console.log("VOICE ASSETS:", JSON.stringify(assets, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
