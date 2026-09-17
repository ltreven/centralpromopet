CREATE TABLE "google_login_challenges" (
	"nonce_hash" varchar(64) PRIMARY KEY NOT NULL,
	"purpose" varchar(10) NOT NULL,
	"user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_subject" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "google_login_challenges" ADD CONSTRAINT "google_login_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "google_login_challenges_expiry_idx" ON "google_login_challenges" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_subject_unique" UNIQUE("google_subject");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_has_login_method" CHECK ("users"."password_hash" IS NOT NULL OR "users"."google_subject" IS NOT NULL);