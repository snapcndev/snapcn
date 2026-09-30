CREATE TABLE "team_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD COLUMN "licence" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_member_owner_email" ON "team_member" USING btree ("owner_id","email");--> statement-breakpoint
CREATE INDEX "team_member_email_idx" ON "team_member" USING btree ("email");--> statement-breakpoint
-- The September offer, honoured in data: Pro or Lifetime bought by 30 Sep 2026
-- (23:59 anywhere on Earth = 1 Oct 12:00 UTC) carries the Commercial terms.
-- Every paid row created before then was bought inside the offer.
UPDATE "billing_subscription" SET "licence" = 'commercial' WHERE "plan" <> 'free' AND "created_at" < '2026-10-01T12:00:00Z';
