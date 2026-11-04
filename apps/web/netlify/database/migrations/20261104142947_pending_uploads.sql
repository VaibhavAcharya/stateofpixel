CREATE TABLE "pending_uploads" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"blob_key" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pending_uploads_blob_key_index" ON "pending_uploads" USING btree ("blob_key");--> statement-breakpoint
CREATE INDEX "pending_uploads_created_at_index" ON "pending_uploads" USING btree ("created_at");