import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, varchar, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { speechRecognitionJobsTable, speechSegmentsTable } from "./speech-recognition";
import { translationJobsTable } from "./translation";

export const emotionJobsTable = pgTable("emotion_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  speechJobId: uuid("speech_job_id").references(() => speechRecognitionJobsTable.id, { onDelete: "cascade" }).notNull(),
  translationJobId: uuid("translation_job_id").references(() => translationJobsTable.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  version: integer("version").default(1).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  avgConfidence: doublePrecision("avg_confidence"),
  modelVersion: varchar("model_version", { length: 50 }),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("emotion_jobs_project_id_idx").on(table.projectId),
  index("emotion_jobs_is_current_idx").on(table.isCurrent),
]);

export const emotionSegmentsTable = pgTable("emotion_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  emotionJobId: uuid("emotion_job_id").references(() => emotionJobsTable.id, { onDelete: "cascade" }).notNull(),
  segmentId: uuid("segment_id").references(() => speechSegmentsTable.id, { onDelete: "cascade" }).notNull(),
  textEmotion: varchar("text_emotion", { length: 20 }).notNull(),
  audioEmotion: varchar("audio_emotion", { length: 20 }).notNull(),
  finalEmotion: varchar("final_emotion", { length: 20 }).notNull(),
  confidence: doublePrecision("confidence").notNull(),
  intensity: doublePrecision("intensity").notNull(),
  startTime: doublePrecision("start_time").notNull(),
  endTime: doublePrecision("end_time").notNull(),
  speakerId: varchar("speaker_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("emotion_segments_job_id_idx").on(table.emotionJobId),
  index("emotion_segments_start_time_idx").on(table.startTime),
]);

export type EmotionJob = typeof emotionJobsTable.$inferSelect;
export type InsertEmotionJob = typeof emotionJobsTable.$inferInsert;

export type EmotionSegment = typeof emotionSegmentsTable.$inferSelect;
export type InsertEmotionSegment = typeof emotionSegmentsTable.$inferInsert;
