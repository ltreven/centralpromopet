CREATE TYPE "public"."promotion_pet_type" AS ENUM('dogs', 'cats', 'birds', 'other');--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "coupon" varchar(100);--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "store_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "pet_types" "promotion_pet_type"[] DEFAULT ARRAY['other']::promotion_pet_type[] NOT NULL;