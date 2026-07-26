CREATE TABLE "emotion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"speech_job_id" uuid NOT NULL,
	"translation_job_id" uuid,
	"provider" varchar(50) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"avg_confidence" double precision,
	"model_version" varchar(50),
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotion_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"emotion_job_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"text_emotion" varchar(20) NOT NULL,
	"audio_emotion" varchar(20) NOT NULL,
	"final_emotion" varchar(20) NOT NULL,
	"confidence" double precision NOT NULL,
	"intensity" double precision NOT NULL,
	"start_time" double precision NOT NULL,
	"end_time" double precision NOT NULL,
	"speaker_id" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emotion_jobs" ADD CONSTRAINT "emotion_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_jobs" ADD CONSTRAINT "emotion_jobs_speech_job_id_speech_recognition_jobs_id_fk" FOREIGN KEY ("speech_job_id") REFERENCES "public"."speech_recognition_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_jobs" ADD CONSTRAINT "emotion_jobs_translation_job_id_translation_jobs_id_fk" FOREIGN KEY ("translation_job_id") REFERENCES "public"."translation_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_segments" ADD CONSTRAINT "emotion_segments_emotion_job_id_emotion_jobs_id_fk" FOREIGN KEY ("emotion_job_id") REFERENCES "public"."emotion_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion_segments" ADD CONSTRAINT "emotion_segments_segment_id_speech_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."speech_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emotion_jobs_project_id_idx" ON "emotion_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "emotion_jobs_is_current_idx" ON "emotion_jobs" USING btree ("is_current");--> statement-breakpoint
CREATE INDEX "emotion_segments_job_id_idx" ON "emotion_segments" USING btree ("emotion_job_id");--> statement-breakpoint
CREATE INDEX "emotion_segments_start_time_idx" ON "emotion_segments" USING btree ("start_time");