CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text DEFAULT 'Default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_key_user_idx" ON "api_key" USING btree ("user_id","created_at");--> statement-breakpoint
-- Every key already handed out keeps working: copied across under its old value.
INSERT INTO "api_key" ("user_id", "key", "name")
SELECT "user_id", "api_key", 'Default' FROM "billing_subscription"
WHERE "api_key" IS NOT NULL
ON CONFLICT ("key") DO NOTHING;
