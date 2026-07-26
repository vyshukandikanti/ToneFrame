ALTER TABLE "uploaded_videos" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "uploaded_videos" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "uploaded_videos" ADD COLUMN "fps" text;--> statement-breakpoint
ALTER TABLE "uploaded_videos" ADD COLUMN "codec" varchar(50);--> statement-breakpoint
ALTER TABLE "uploaded_videos" ADD COLUMN "bitrate" integer;