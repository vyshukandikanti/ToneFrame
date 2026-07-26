CREATE TABLE "project_glossaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_text" text NOT NULL,
	"target_text" text NOT NULL,
	"target_language" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translated_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"translation_job_id" uuid NOT NULL,
	"original_segment_id" uuid NOT NULL,
	"text" text NOT NULL,
	"start_time" double precision NOT NULL,
	"end_time" double precision NOT NULL,
	"confidence" double precision,
	"review_status" varchar(20) DEFAULT 'ai-generated' NOT NULL,
	"reviewer_id" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translated_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"translation_job_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"word" text NOT NULL,
	"start_time" double precision NOT NULL,
	"end_time" double precision NOT NULL,
	"confidence" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"speech_job_id" uuid NOT NULL,
	"source_language" varchar(10) NOT NULL,
	"target_language" varchar(10) NOT NULL,
	"translated_text" text NOT NULL,
	"confidence" double precision,
	"provider" varchar(50) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"processing_time_ms" integer,
	"token_usage" integer,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_glossaries" ADD CONSTRAINT "project_glossaries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translated_segments" ADD CONSTRAINT "translated_segments_translation_job_id_translation_jobs_id_fk" FOREIGN KEY ("translation_job_id") REFERENCES "public"."translation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translated_segments" ADD CONSTRAINT "translated_segments_original_segment_id_speech_segments_id_fk" FOREIGN KEY ("original_segment_id") REFERENCES "public"."speech_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translated_segments" ADD CONSTRAINT "translated_segments_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translated_words" ADD CONSTRAINT "translated_words_translation_job_id_translation_jobs_id_fk" FOREIGN KEY ("translation_job_id") REFERENCES "public"."translation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translated_words" ADD CONSTRAINT "translated_words_segment_id_translated_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."translated_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_jobs" ADD CONSTRAINT "translation_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_jobs" ADD CONSTRAINT "translation_jobs_speech_job_id_speech_recognition_jobs_id_fk" FOREIGN KEY ("speech_job_id") REFERENCES "public"."speech_recognition_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_glossaries_project_id_idx" ON "project_glossaries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "translated_segments_job_id_idx" ON "translated_segments" USING btree ("translation_job_id");--> statement-breakpoint
CREATE INDEX "translated_words_job_id_idx" ON "translated_words" USING btree ("translation_job_id");--> statement-breakpoint
CREATE INDEX "translated_words_segment_id_idx" ON "translated_words" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "translation_jobs_project_id_idx" ON "translation_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "translation_jobs_is_current_idx" ON "translation_jobs" USING btree ("is_current");