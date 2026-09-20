CREATE TYPE "public"."tip_category" AS ENUM('wellness', 'training');--> statement-breakpoint
CREATE TYPE "public"."tip_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"category" "tip_category" NOT NULL,
	"status" "tip_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tips_published_idx" ON "tips" USING btree ("status","category");