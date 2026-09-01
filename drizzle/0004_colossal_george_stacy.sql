ALTER TABLE "billing_subscription" ADD COLUMN "api_key" text;--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_api_key_unique" UNIQUE("api_key");