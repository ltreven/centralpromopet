DROP INDEX "tips_published_idx";--> statement-breakpoint
CREATE INDEX "tips_category_idx" ON "tips" USING btree ("category");--> statement-breakpoint
ALTER TABLE "tips" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."tip_status";