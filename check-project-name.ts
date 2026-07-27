import { db, projectsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

async function main() {
  const p = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt)).limit(5);
  console.log("PROJECTS:", JSON.stringify(p, null, 2));
}
main();
