import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { processingJobsTable } from "./processing-jobs";

export const speechRecognitionJobsTable = pgTable("speech_recognition_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  jobId: uuid("job_id").references(() => processingJobsTable.id, { onDelete: "cascade" }),
  transcript: text("transcript").notNull(),
  language: varchar("language", { length: 10 }),
  languageConfidence: doublePrecision("language_confidence"),
  languageMetadata: jsonb("language_metadata"),
  confidence: doublePrecision("confidence"),
  srtKey: text("srt_key"),
  vttKey: text("vtt_key"),
  jsonKey: text("json_key"),
  version: integer("version").default(1).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("speech_recognition_jobs_project_id_idx").on(table.projectId),
  index("speech_recognition_jobs_is_current_idx").on(table.isCurrent),
]);

export const speechSegmentsTable = pgTable("speech_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  speechJobId: uuid("speech_job_id").references(() => speechRecognitionJobsTable.id, { onDelete: "cascade" }).notNull(),
  text: text("text").notNull(),
  startTime: doublePrecision("start_time").notNull(),
  endTime: doublePrecision("end_time").notNull(),
  confidence: doublePrecision("confidence"),
  speakerId: varchar("speaker_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("speech_segments_job_id_idx").on(table.speechJobId),
]);

export const speechWordsTable = pgTable("speech_words", {
  id: uuid("id").defaultRandom().primaryKey(),
  speechJobId: uuid("speech_job_id").references(() => speechRecognitionJobsTable.id, { onDelete: "cascade" }).notNull(),
  segmentId: uuid("segment_id").references(() => speechSegmentsTable.id, { onDelete: "cascade" }).notNull(),
  word: text("word").notNull(),
  startTime: doublePrecision("start_time").notNull(),
  endTime: doublePrecision("end_time").notNull(),
  confidence: doublePrecision("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("speech_words_job_id_idx").on(table.speechJobId),
  index("speech_words_segment_id_idx").on(table.segmentId),
]);

export type SpeechRecognitionJob = typeof speechRecognitionJobsTable.$inferSelect;
export type InsertSpeechRecognitionJob = typeof speechRecognitionJobsTable.$inferInsert;

export type SpeechSegment = typeof speechSegmentsTable.$inferSelect;
export type InsertSpeechSegment = typeof speechSegmentsTable.$inferInsert;

export type SpeechWord = typeof speechWordsTable.$inferSelect;
export type InsertSpeechWord = typeof speechWordsTable.$inferInsert;
