ALTER TABLE "pets" ADD COLUMN "breed" varchar(100);--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "birth_month" integer;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_valid_birth_month" CHECK ("pets"."birth_month" IS NULL OR ("pets"."birth_month" BETWEEN 1 AND 12));--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_valid_birth_year" CHECK ("pets"."birth_year" IS NULL OR ("pets"."birth_year" BETWEEN 1900 AND 2100));--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_complete_birth_date" CHECK (("pets"."birth_month" IS NULL AND "pets"."birth_year" IS NULL) OR ("pets"."birth_month" IS NOT NULL AND "pets"."birth_year" IS NOT NULL));