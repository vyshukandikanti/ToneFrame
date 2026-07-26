import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, varchar, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { speechRecognitionJobsTable } from "./speech-recognition";

export const speakerJobsTable = pgTable("speaker_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  speechJobId: uuid("speech_job_id").references(() => speechRecognitionJobsTable.id, { onDelete: "cascade" }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  version: integer("version").default(1).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  speakerCount: integer("speaker_count").notNull(),
  avgConfidence: doublePrecision("avg_confidence"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("speaker_jobs_project_id_idx").on(table.projectId),
  index("speaker_jobs_is_current_idx").on(table.isCurrent),
]);

export const speakersTable = pgTable("speakers", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  speakerJobId: uuid("speaker_job_id").references(() => speakerJobsTable.id, { onDelete: "cascade" }).notNull(),
  speakerLabel: varchar("speaker_label", { length: 50 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  gender: varchar("gender", { length: 20 }),
  estimatedAge: varchar("estimated_age", { length: 20 }),
  dominantLanguage: varchar("dominant_language", { length: 10 }),
  voiceProfileId: uuid("voice_profile_id"), // link placeholder
  sampleAudioPath: text("sample_audio_path"),
  speakerEmbedding: text("speaker_embedding"),
  faceId: varchar("face_id", { length: 50 }),
  avatarThumbnail: text("avatar_thumbnail"),
  notes: text("notes"),
  createdByUser: boolean("created_by_user").default(false).notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  // Stats
  totalSpeakingTime: doublePrecision("total_speaking_time").default(0).notNull(),
  numberOfSegments: integer("number_of_segments").default(0).notNull(),
  averageConfidence: doublePrecision("average_confidence").default(0).notNull(),
  firstAppearance: doublePrecision("first_appearance").default(0).notNull(),
  lastAppearance: doublePrecision("last_appearance").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("speakers_project_id_idx").on(table.projectId),
  index("speakers_label_idx").on(table.speakerLabel),
]);

export const speakerSegmentsTable = pgTable("speaker_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  speakerJobId: uuid("speaker_job_id").references(() => speakerJobsTable.id, { onDelete: "cascade" }).notNull(),
  speakerId: uuid("speaker_id").references(() => speakersTable.id, { onDelete: "cascade" }).notNull(),
  startTime: doublePrecision("start_time").notNull(),
  endTime: doublePrecision("end_time").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("speaker_segments_job_id_idx").on(table.speakerJobId),
  index("speaker_segments_speaker_id_idx").on(table.speakerId),
]);

export const voiceProfilesTable = pgTable("voice_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  speakerId: uuid("speaker_id").references(() => speakersTable.id, { onDelete: "cascade" }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  voiceName: varchar("voice_name", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }),
  language: varchar("language", { length: 10 }),
  emotionPreset: varchar("emotion_preset", { length: 50 }),
  speed: doublePrecision("speed").default(1.0),
  pitch: doublePrecision("pitch").default(0.0),
  sampleRate: integer("sample_rate"),
  isDefault: boolean("is_default").default(false).notNull(),
  isFineTuned: boolean("is_fine_tuned").default(false).notNull(),
  version: integer("version").default(1).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("voice_profiles_speaker_id_idx").on(table.speakerId),
]);

export type SpeakerJob = typeof speakerJobsTable.$inferSelect;
export type InsertSpeakerJob = typeof speakerJobsTable.$inferInsert;

export type Speaker = typeof speakersTable.$inferSelect;
export type InsertSpeaker = typeof speakersTable.$inferInsert;

export type SpeakerSegment = typeof speakerSegmentsTable.$inferSelect;
export type InsertSpeakerSegment = typeof speakerSegmentsTable.$inferInsert;

export type VoiceProfile = typeof voiceProfilesTable.$inferSelect;
export type InsertVoiceProfile = typeof voiceProfilesTable.$inferInsert;
