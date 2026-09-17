DO $$ BEGIN
 CREATE TYPE "public"."promotion_status" AS ENUM('draft', 'published');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"image_url" text,
	"store" varchar(100) NOT NULL,
	"price_cents" integer NOT NULL,
	"original_price_cents" integer,
	"affiliate_url" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "promotion_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"password_expired" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 0 NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promotions_active_idx" ON "promotions" ("status","starts_at","ends_at");
--> statement-breakpoint
-- Drizzle Kit 0.21 does not emit CHECK constraints; keep these aligned with schema.ts.
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_valid_period" CHECK ("ends_at" > "starts_at");
--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_positive_price" CHECK ("price_cents" > 0);
--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_original_price" CHECK ("original_price_cents" IS NULL OR "original_price_cents" >= "price_cents");
