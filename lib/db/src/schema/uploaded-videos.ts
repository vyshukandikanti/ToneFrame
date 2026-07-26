import { pgTable, text, timestamp, uuid, integer, bigint, varchar, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const uploadedVideosTable = pgTable("uploaded_videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  fileName: text("file_name").notNull(),
  s3Key: text("s3_key").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  resolution: varchar("resolution", { length: 15 }), // e.g. '1920x1080'
  mimeType: varchar("mime_type", { length: 50 }).notNull(),
  width: integer("width"),
  height: integer("height"),
  fps: text("fps"),
  codec: varchar("codec", { length: 50 }),
  bitrate: integer("bitrate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("uploaded_videos_project_id_idx").on(table.projectId),
]);

export type UploadedVideo = typeof uploadedVideosTable.$inferSelect;
export type InsertUploadedVideo = typeof uploadedVideosTable.$inferInsert;
