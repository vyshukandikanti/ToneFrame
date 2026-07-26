import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, varchar, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { translationJobsTable, translatedSegmentsTable } from "./translation";
import { emotionJobsTable } from "./emotions";

export const voiceGenerationJobsTable = pgTable("voice_generation_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  translationJobId: uuid("translation_job_id").references(() => translationJobsTable.id, { onDelete: "cascade" }).notNull(),
  emotionJobId: uuid("emotion_job_id").references(() => emotionJobsTable.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  modelVersion: varchar("model_version", { length: 50 }),
  isCurrent: boolean("is_current").default(true).notNull(),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("voice_generation_jobs_project_id_idx").on(table.projectId),
  index("voice_generation_jobs_is_current_idx").on(table.isCurrent),
]);

export const generatedVoiceSegmentsTable = pgTable("generated_voice_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  voiceJobId: uuid("voice_job_id").references(() => voiceGenerationJobsTable.id, { onDelete: "cascade" }).notNull(),
  translatedSegmentId: uuid("translated_segment_id").references(() => translatedSegmentsTable.id, { onDelete: "cascade" }).notNull(),
  s3Key: text("s3_key").notNull(),
  duration: doublePrecision("duration").notNull(),
  sampleRate: integer("sample_rate").notNull(),
  confidence: doublePrecision("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("generated_voice_segments_job_id_idx").on(table.voiceJobId),
]);

export const voiceAssetsTable = pgTable("voice_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  voiceJobId: uuid("voice_job_id").references(() => voiceGenerationJobsTable.id, { onDelete: "cascade" }).notNull(),
  s3Key: text("s3_key").notNull(),
  format: varchar("format", { length: 10 }).notNull(), // wav, mp3, flac
  duration: doublePrecision("duration").notNull(),
  sampleRate: integer("sample_rate").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("voice_assets_project_id_idx").on(table.projectId),
  index("voice_assets_job_id_idx").on(table.voiceJobId),
]);

export type VoiceGenerationJob = typeof voiceGenerationJobsTable.$inferSelect;
export type InsertVoiceGenerationJob = typeof voiceGenerationJobsTable.$inferInsert;

export type GeneratedVoiceSegment = typeof generatedVoiceSegmentsTable.$inferSelect;
export type InsertGeneratedVoiceSegment = typeof generatedVoiceSegmentsTable.$inferInsert;

export type VoiceAsset = typeof voiceAssetsTable.$inferSelect;
export type InsertVoiceAsset = typeof voiceAssetsTable.$inferInsert;
