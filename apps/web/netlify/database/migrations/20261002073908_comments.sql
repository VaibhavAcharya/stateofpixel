CREATE TABLE "comments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"snapshot_id" text NOT NULL,
	"build_id" text NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "comments_snapshot_id_index" ON "comments" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "comments_build_id_index" ON "comments" USING btree ("build_id");