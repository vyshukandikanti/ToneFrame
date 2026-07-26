import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, varchar, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { speechRecognitionJobsTable, speechSegmentsTable } from "./speech-recognition";

export const projectGlossariesTable = pgTable("project_glossaries", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  sourceText: text("source_text").notNull(),
  targetText: text("target_text").notNull(),
  targetLanguage: varchar("target_language", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("project_glossaries_project_id_idx").on(table.projectId),
]);

export const translationJobsTable = pgTable("translation_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  speechJobId: uuid("speech_job_id").references(() => speechRecognitionJobsTable.id, { onDelete: "cascade" }).notNull(),
  sourceLanguage: varchar("source_language", { length: 10 }).notNull(),
  targetLanguage: varchar("target_language", { length: 10 }).notNull(),
  translatedText: text("translated_text").notNull(),
  confidence: doublePrecision("confidence"),
  provider: varchar("provider", { length: 50 }).notNull(),
  version: integer("version").default(1).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  processingTimeMs: integer("processing_time_ms"),
  tokenUsage: integer("token_usage"),
  retryCount: integer("retry_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("translation_jobs_project_id_idx").on(table.projectId),
  index("translation_jobs_is_current_idx").on(table.isCurrent),
]);

export const translatedSegmentsTable = pgTable("translated_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  translationJobId: uuid("translation_job_id").references(() => translationJobsTable.id, { onDelete: "cascade" }).notNull(),
  originalSegmentId: uuid("original_segment_id").references(() => speechSegmentsTable.id, { onDelete: "cascade" }).notNull(),
  text: text("text").notNull(),
  startTime: doublePrecision("start_time").notNull(),
  endTime: doublePrecision("end_time").notNull(),
  confidence: doublePrecision("confidence"),
  reviewStatus: varchar("review_status", { length: 20 }).default("ai-generated").notNull(), // ai-generated, human-reviewed, approved
  reviewerId: uuid("reviewer_id").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("translated_segments_job_id_idx").on(table.translationJobId),
]);

export const translatedWordsTable = pgTable("translated_words", {
  id: uuid("id").defaultRandom().primaryKey(),
  translationJobId: uuid("translation_job_id").references(() => translationJobsTable.id, { onDelete: "cascade" }).notNull(),
  segmentId: uuid("segment_id").references(() => translatedSegmentsTable.id, { onDelete: "cascade" }).notNull(),
  word: text("word").notNull(),
  startTime: doublePrecision("start_time").notNull(),
  endTime: doublePrecision("end_time").notNull(),
  confidence: doublePrecision("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("translated_words_job_id_idx").on(table.translationJobId),
  index("translated_words_segment_id_idx").on(table.segmentId),
]);

export type ProjectGlossary = typeof projectGlossariesTable.$inferSelect;
export type InsertProjectGlossary = typeof projectGlossariesTable.$inferInsert;

export type TranslationJob = typeof translationJobsTable.$inferSelect;
export type InsertTranslationJob = typeof translationJobsTable.$inferInsert;

export type TranslatedSegment = typeof translatedSegmentsTable.$inferSelect;
export type InsertTranslatedSegment = typeof translatedSegmentsTable.$inferInsert;

export type TranslatedWord = typeof translatedWordsTable.$inferSelect;
export type InsertTranslatedWord = typeof translatedWordsTable.$inferInsert;
