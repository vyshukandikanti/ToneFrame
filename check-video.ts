import { db, uploadedVideosTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const videos = await db.select().from(uploadedVideosTable).where(eq(uploadedVideosTable.projectId, "edd22959-840a-4fcb-ae92-7b1769ccc4a2"));
  console.log("PROJECT VIDEOS:", JSON.stringify(videos, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
