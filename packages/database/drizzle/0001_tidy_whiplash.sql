-- Reconcile constraints already enforced by the original bootstrap migration.
ALTER TABLE "promotions" DROP CONSTRAINT IF EXISTS "promotions_valid_period";
--> statement-breakpoint
ALTER TABLE "promotions" DROP CONSTRAINT IF EXISTS "promotions_positive_price";
--> statement-breakpoint
ALTER TABLE "promotions" DROP CONSTRAINT IF EXISTS "promotions_original_price";
--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_valid_period" CHECK ("promotions"."ends_at" > "promotions"."starts_at");--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_positive_price" CHECK ("promotions"."price_cents" > 0);--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_original_price" CHECK ("promotions"."original_price_cents" IS NULL OR "promotions"."original_price_cents" >= "promotions"."price_cents");
