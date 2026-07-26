CREATE TABLE "generated_voice_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_job_id" uuid NOT NULL,
	"translated_segment_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"duration" double precision NOT NULL,
	"sample_rate" integer NOT NULL,
	"confidence" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"voice_job_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"format" varchar(10) NOT NULL,
	"duration" double precision NOT NULL,
	"sample_rate" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"translation_job_id" uuid NOT NULL,
	"emotion_job_id" uuid,
	"provider" varchar(50) NOT NULL,
	"model_version" varchar(50),
	"is_current" boolean DEFAULT true NOT NULL,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD COLUMN "is_fine_tuned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "generated_voice_segments" ADD CONSTRAINT "generated_voice_segments_voice_job_id_voice_generation_jobs_id_fk" FOREIGN KEY ("voice_job_id") REFERENCES "public"."voice_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_voice_segments" ADD CONSTRAINT "generated_voice_segments_translated_segment_id_translated_segments_id_fk" FOREIGN KEY ("translated_segment_id") REFERENCES "public"."translated_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_assets" ADD CONSTRAINT "voice_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_assets" ADD CONSTRAINT "voice_assets_voice_job_id_voice_generation_jobs_id_fk" FOREIGN KEY ("voice_job_id") REFERENCES "public"."voice_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_generation_jobs" ADD CONSTRAINT "voice_generation_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_generation_jobs" ADD CONSTRAINT "voice_generation_jobs_translation_job_id_translation_jobs_id_fk" FOREIGN KEY ("translation_job_id") REFERENCES "public"."translation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_generation_jobs" ADD CONSTRAINT "voice_generation_jobs_emotion_job_id_emotion_jobs_id_fk" FOREIGN KEY ("emotion_job_id") REFERENCES "public"."emotion_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_voice_segments_job_id_idx" ON "generated_voice_segments" USING btree ("voice_job_id");--> statement-breakpoint
CREATE INDEX "voice_assets_project_id_idx" ON "voice_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "voice_assets_job_id_idx" ON "voice_assets" USING btree ("voice_job_id");--> statement-breakpoint
CREATE INDEX "voice_generation_jobs_project_id_idx" ON "voice_generation_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "voice_generation_jobs_is_current_idx" ON "voice_generation_jobs" USING btree ("is_current");