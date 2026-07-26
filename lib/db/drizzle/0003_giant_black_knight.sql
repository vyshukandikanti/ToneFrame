CREATE TABLE "speech_recognition_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"job_id" uuid,
	"transcript" text NOT NULL,
	"language" varchar(10),
	"language_confidence" double precision,
	"language_metadata" jsonb,
	"confidence" double precision,
	"srt_key" text,
	"vtt_key" text,
	"json_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speech_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"speech_job_id" uuid NOT NULL,
	"text" text NOT NULL,
	"start_time" double precision NOT NULL,
	"end_time" double precision NOT NULL,
	"confidence" double precision,
	"speaker_id" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speech_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"speech_job_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"word" text NOT NULL,
	"start_time" double precision NOT NULL,
	"end_time" double precision NOT NULL,
	"confidence" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "speech_recognition_jobs" ADD CONSTRAINT "speech_recognition_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speech_recognition_jobs" ADD CONSTRAINT "speech_recognition_jobs_job_id_processing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."processing_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speech_segments" ADD CONSTRAINT "speech_segments_speech_job_id_speech_recognition_jobs_id_fk" FOREIGN KEY ("speech_job_id") REFERENCES "public"."speech_recognition_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speech_words" ADD CONSTRAINT "speech_words_speech_job_id_speech_recognition_jobs_id_fk" FOREIGN KEY ("speech_job_id") REFERENCES "public"."speech_recognition_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speech_words" ADD CONSTRAINT "speech_words_segment_id_speech_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."speech_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "speech_recognition_jobs_project_id_idx" ON "speech_recognition_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "speech_recognition_jobs_is_current_idx" ON "speech_recognition_jobs" USING btree ("is_current");--> statement-breakpoint
CREATE INDEX "speech_segments_job_id_idx" ON "speech_segments" USING btree ("speech_job_id");--> statement-breakpoint
CREATE INDEX "speech_words_job_id_idx" ON "speech_words" USING btree ("speech_job_id");--> statement-breakpoint
CREATE INDEX "speech_words_segment_id_idx" ON "speech_words" USING btree ("segment_id");