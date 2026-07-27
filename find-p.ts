import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const p = await db.select().from(projectsTable).where(eq(projectsTable.id, "edd22959-840a-4fcb-ae92-7b1769ccc4a2"));
  console.log("PROJECT FIND:", JSON.stringify(p, null, 2));
}
main();
