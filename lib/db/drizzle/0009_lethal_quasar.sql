CREATE TABLE "export_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"export_job_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"format" varchar(10) NOT NULL,
	"file_size" integer NOT NULL,
	"checksum" varchar(64),
	"mime_type" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"render_job_id" uuid,
	"status" varchar(50) NOT NULL,
	"export_type" varchar(50) NOT NULL,
	"error_message" text,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "render_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"lip_sync_job_id" uuid,
	"provider" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"resolution" varchar(20) NOT NULL,
	"format" varchar(10) NOT NULL,
	"codec" varchar(20) NOT NULL,
	"has_subtitles" boolean DEFAULT false NOT NULL,
	"has_watermark" boolean DEFAULT false NOT NULL,
	"processing_time_ms" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rendered_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"render_job_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"format" varchar(10) NOT NULL,
	"resolution" varchar(20) NOT NULL,
	"fps" double precision,
	"duration" double precision NOT NULL,
	"file_size" integer NOT NULL,
	"checksum" varchar(64),
	"mime_type" varchar(50),
	"thumbnail_s3_key" text,
	"waveform_s3_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "export_assets" ADD CONSTRAINT "export_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_assets" ADD CONSTRAINT "export_assets_export_job_id_export_jobs_id_fk" FOREIGN KEY ("export_job_id") REFERENCES "public"."export_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_render_job_id_render_jobs_id_fk" FOREIGN KEY ("render_job_id") REFERENCES "public"."render_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_lip_sync_job_id_lip_sync_jobs_id_fk" FOREIGN KEY ("lip_sync_job_id") REFERENCES "public"."lip_sync_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendered_assets" ADD CONSTRAINT "rendered_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendered_assets" ADD CONSTRAINT "rendered_assets_render_job_id_render_jobs_id_fk" FOREIGN KEY ("render_job_id") REFERENCES "public"."render_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "export_assets_project_id_idx" ON "export_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "export_assets_job_id_idx" ON "export_assets" USING btree ("export_job_id");--> statement-breakpoint
CREATE INDEX "export_jobs_project_id_idx" ON "export_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "render_jobs_project_id_idx" ON "render_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "rendered_assets_project_id_idx" ON "rendered_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "rendered_assets_job_id_idx" ON "rendered_assets" USING btree ("render_job_id");