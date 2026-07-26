import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, varchar, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { voiceGenerationJobsTable } from "./voice-cloning";
import { speakerJobsTable, speakersTable } from "./speakers";

export const lipSyncJobsTable = pgTable("lip_sync_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  voiceGenerationJobId: uuid("voice_generation_job_id").references(() => voiceGenerationJobsTable.id, { onDelete: "cascade" }).notNull(),
  speakerJobId: uuid("speaker_job_id").references(() => speakerJobsTable.id, { onDelete: "cascade" }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  modelVersion: varchar("model_version", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull(),
  processingTimeMs: integer("processing_time_ms"),
  confidence: doublePrecision("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("lip_sync_jobs_project_id_idx").on(table.projectId),
]);

export const lipSyncSegmentsTable = pgTable("lip_sync_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  lipSyncJobId: uuid("lip_sync_job_id").references(() => lipSyncJobsTable.id, { onDelete: "cascade" }).notNull(),
  segmentId: uuid("segment_id").notNull(),
  speakerId: uuid("speaker_id").references(() => speakersTable.id, { onDelete: "cascade" }),
  startTime: doublePrecision("start_time").notNull(),
  endTime: doublePrecision("end_time").notNull(),
  inputVideoKey: text("input_video_key").notNull(),
  inputAudioKey: text("input_audio_key").notNull(),
  outputVideoKey: text("output_video_key").notNull(),
  faceTrackingId: varchar("face_tracking_id", { length: 50 }),
  qualityScore: doublePrecision("quality_score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("lip_sync_segments_job_id_idx").on(table.lipSyncJobId),
]);

export const lipSyncAssetsTable = pgTable("lip_sync_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  jobId: uuid("job_id").references(() => lipSyncJobsTable.id, { onDelete: "cascade" }).notNull(),
  format: varchar("format", { length: 10 }).notNull(), // mp4, mov, webm
  resolution: varchar("resolution", { length: 20 }),
  fps: doublePrecision("fps"),
  duration: doublePrecision("duration").notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: varchar("checksum", { length: 64 }),
  mimeType: varchar("mime_type", { length: 50 }),
  s3Key: text("s3_key").notNull(),
  version: integer("version").default(1).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("lip_sync_assets_project_id_idx").on(table.projectId),
  index("lip_sync_assets_job_id_idx").on(table.jobId),
]);

export type LipSyncJob = typeof lipSyncJobsTable.$inferSelect;
export type InsertLipSyncJob = typeof lipSyncJobsTable.$inferInsert;

export type LipSyncSegment = typeof lipSyncSegmentsTable.$inferSelect;
export type InsertLipSyncSegment = typeof lipSyncSegmentsTable.$inferInsert;

export type LipSyncAsset = typeof lipSyncAssetsTable.$inferSelect;
export type InsertLipSyncAsset = typeof lipSyncAssetsTable.$inferInsert;
