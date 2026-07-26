import { pgTable, text, timestamp, uuid, integer, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const processingJobsTable = pgTable("processing_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  queueName: text("queue_name").notNull(),
  stage: text("stage").notNull(), // video-preparation, speech-to-text, translation, emotion-detection, voice-cloning, lip-sync, rendering, export
  status: text("status").default("queued").notNull(), // queued, preparing, processing, completed, failed, cancelled
  progress: integer("progress").default(0).notNull(),
  priority: integer("priority").default(0).notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  workerId: text("worker_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("processing_jobs_project_id_idx").on(table.projectId),
  index("processing_jobs_status_idx").on(table.status),
]);

export type ProcessingJob = typeof processingJobsTable.$inferSelect;
export type InsertProcessingJob = typeof processingJobsTable.$inferInsert;
