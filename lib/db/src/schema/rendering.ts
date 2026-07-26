import { pgTable, text, timestamp, uuid, doublePrecision, integer, boolean, varchar, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { lipSyncJobsTable } from "./lipsync";

export const renderJobsTable = pgTable("render_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  lipSyncJobId: uuid("lip_sync_job_id").references(() => lipSyncJobsTable.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // pending, rendering, completed, failed
  resolution: varchar("resolution", { length: 20 }).notNull(),
  format: varchar("format", { length: 10 }).notNull(),
  codec: varchar("codec", { length: 20 }).notNull(),
  hasSubtitles: boolean("has_subtitles").default(false).notNull(),
  hasWatermark: boolean("has_watermark").default(false).notNull(),
  processingTimeMs: integer("processing_time_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("render_jobs_project_id_idx").on(table.projectId),
]);

export const renderedAssetsTable = pgTable("rendered_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  renderJobId: uuid("render_job_id").references(() => renderJobsTable.id, { onDelete: "cascade" }).notNull(),
  s3Key: text("s3_key").notNull(),
  format: varchar("format", { length: 10 }).notNull(),
  resolution: varchar("resolution", { length: 20 }).notNull(),
  fps: doublePrecision("fps"),
  duration: doublePrecision("duration").notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: varchar("checksum", { length: 64 }),
  mimeType: varchar("mime_type", { length: 50 }),
  thumbnailS3Key: text("thumbnail_s3_key"),
  previewS3Key: text("preview_s3_key"),
  waveformS3Key: text("waveform_s3_key"),
  version: integer("version").default(1).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("rendered_assets_project_id_idx").on(table.projectId),
  index("rendered_assets_job_id_idx").on(table.renderJobId),
]);

export const exportJobsTable = pgTable("export_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  renderJobId: uuid("render_job_id").references(() => renderJobsTable.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull(), // pending, completed, failed
  exportType: varchar("export_type", { length: 50 }).notNull(), // video_package, audio_only, subtitles, project_archive, metadata_json
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("export_jobs_project_id_idx").on(table.projectId),
]);

export const exportAssetsTable = pgTable("export_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }).notNull(),
  exportJobId: uuid("export_job_id").references(() => exportJobsTable.id, { onDelete: "cascade" }).notNull(),
  s3Key: text("s3_key").notNull(),
  format: varchar("format", { length: 10 }).notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: varchar("checksum", { length: 64 }),
  mimeType: varchar("mime_type", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("export_assets_project_id_idx").on(table.projectId),
  index("export_assets_job_id_idx").on(table.exportJobId),
]);

export type RenderJob = typeof renderJobsTable.$inferSelect;
export type InsertRenderJob = typeof renderJobsTable.$inferInsert;

export type RenderedAsset = typeof renderedAssetsTable.$inferSelect;
export type InsertRenderedAsset = typeof renderedAssetsTable.$inferInsert;

export type ExportJob = typeof exportJobsTable.$inferSelect;
export type InsertExportJob = typeof exportJobsTable.$inferInsert;

export type ExportAsset = typeof exportAssetsTable.$inferSelect;
export type InsertExportAsset = typeof exportAssetsTable.$inferInsert;
