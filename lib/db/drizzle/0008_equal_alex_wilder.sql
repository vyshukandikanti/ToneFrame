CREATE TABLE "lip_sync_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"format" varchar(10) NOT NULL,
	"resolution" varchar(20),
	"fps" double precision,
	"duration" double precision NOT NULL,
	"file_size" integer NOT NULL,
	"checksum" varchar(64),
	"mime_type" varchar(50),
	"s3_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lip_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"voice_generation_job_id" uuid NOT NULL,
	"speaker_job_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model_version" varchar(50),
	"status" varchar(50) NOT NULL,
	"processing_time_ms" integer,
	"confidence" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lip_sync_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lip_sync_job_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"speaker_id" uuid,
	"start_time" double precision NOT NULL,
	"end_time" double precision NOT NULL,
	"input_video_key" text NOT NULL,
	"input_audio_key" text NOT NULL,
	"output_video_key" text NOT NULL,
	"face_tracking_id" varchar(50),
	"quality_score" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lip_sync_assets" ADD CONSTRAINT "lip_sync_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lip_sync_assets" ADD CONSTRAINT "lip_sync_assets_job_id_lip_sync_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."lip_sync_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lip_sync_jobs" ADD CONSTRAINT "lip_sync_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lip_sync_jobs" ADD CONSTRAINT "lip_sync_jobs_voice_generation_job_id_voice_generation_jobs_id_fk" FOREIGN KEY ("voice_generation_job_id") REFERENCES "public"."voice_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lip_sync_jobs" ADD CONSTRAINT "lip_sync_jobs_speaker_job_id_speaker_jobs_id_fk" FOREIGN KEY ("speaker_job_id") REFERENCES "public"."speaker_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lip_sync_segments" ADD CONSTRAINT "lip_sync_segments_lip_sync_job_id_lip_sync_jobs_id_fk" FOREIGN KEY ("lip_sync_job_id") REFERENCES "public"."lip_sync_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lip_sync_segments" ADD CONSTRAINT "lip_sync_segments_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lip_sync_assets_project_id_idx" ON "lip_sync_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "lip_sync_assets_job_id_idx" ON "lip_sync_assets" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "lip_sync_jobs_project_id_idx" ON "lip_sync_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "lip_sync_segments_job_id_idx" ON "lip_sync_segments" USING btree ("lip_sync_job_id");