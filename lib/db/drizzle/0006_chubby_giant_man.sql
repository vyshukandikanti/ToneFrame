CREATE TABLE "speaker_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"speech_job_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"speaker_count" integer NOT NULL,
	"avg_confidence" double precision,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speaker_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"speaker_job_id" uuid NOT NULL,
	"speaker_id" uuid NOT NULL,
	"start_time" double precision NOT NULL,
	"end_time" double precision NOT NULL,
	"confidence" double precision NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speakers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"speaker_job_id" uuid NOT NULL,
	"speaker_label" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"gender" varchar(20),
	"estimated_age" varchar(20),
	"dominant_language" varchar(10),
	"voice_profile_id" uuid,
	"sample_audio_path" text,
	"speaker_embedding" text,
	"face_id" varchar(50),
	"avatar_thumbnail" text,
	"notes" text,
	"created_by_user" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"total_speaking_time" double precision DEFAULT 0 NOT NULL,
	"number_of_segments" integer DEFAULT 0 NOT NULL,
	"average_confidence" double precision DEFAULT 0 NOT NULL,
	"first_appearance" double precision DEFAULT 0 NOT NULL,
	"last_appearance" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"speaker_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"voice_name" varchar(100) NOT NULL,
	"model" varchar(100),
	"language" varchar(10),
	"emotion_preset" varchar(50),
	"speed" double precision DEFAULT 1,
	"pitch" double precision DEFAULT 0,
	"sample_rate" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "speaker_jobs" ADD CONSTRAINT "speaker_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_jobs" ADD CONSTRAINT "speaker_jobs_speech_job_id_speech_recognition_jobs_id_fk" FOREIGN KEY ("speech_job_id") REFERENCES "public"."speech_recognition_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_segments" ADD CONSTRAINT "speaker_segments_speaker_job_id_speaker_jobs_id_fk" FOREIGN KEY ("speaker_job_id") REFERENCES "public"."speaker_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_segments" ADD CONSTRAINT "speaker_segments_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_speaker_job_id_speaker_jobs_id_fk" FOREIGN KEY ("speaker_job_id") REFERENCES "public"."speaker_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "speaker_jobs_project_id_idx" ON "speaker_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "speaker_jobs_is_current_idx" ON "speaker_jobs" USING btree ("is_current");--> statement-breakpoint
CREATE INDEX "speaker_segments_job_id_idx" ON "speaker_segments" USING btree ("speaker_job_id");--> statement-breakpoint
CREATE INDEX "speaker_segments_speaker_id_idx" ON "speaker_segments" USING btree ("speaker_id");--> statement-breakpoint
CREATE INDEX "speakers_project_id_idx" ON "speakers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "speakers_label_idx" ON "speakers" USING btree ("speaker_label");--> statement-breakpoint
CREATE INDEX "voice_profiles_speaker_id_idx" ON "voice_profiles" USING btree ("speaker_id");