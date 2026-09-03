CREATE TABLE "shared_video" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"title" text DEFAULT 'Untitled video' NOT NULL,
	"components_used" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_video_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
ALTER TABLE "shared_video" ADD CONSTRAINT "shared_video_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_video_user_created_idx" ON "shared_video" USING btree ("user_id","created_at");