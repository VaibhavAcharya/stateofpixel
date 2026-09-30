CREATE TABLE "account_members" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"role" text
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"provider" text DEFAULT 'github' NOT NULL,
	"provider_account_id" bigint NOT NULL,
	"login" text NOT NULL,
	"type" text NOT NULL,
	"installation_id" bigint,
	"plan" text NOT NULL,
	"storage_limit_bytes" bigint NOT NULL,
	"storage_bytes" bigint NOT NULL,
	"over_limit_since" bigint,
	"billing_customer_id" text,
	"billing_subscription_id" text,
	"billing_status" text,
	"billing_interval" text,
	"billing_period_ends_at" bigint,
	"billing_cancels_at_period_end" boolean,
	"deleted_at" bigint
);
--> statement-breakpoint
CREATE TABLE "approved_images" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"project_id" text NOT NULL,
	"build_name" text NOT NULL,
	"pr_number" integer NOT NULL,
	"image_id" text NOT NULL,
	"review_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builds" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"project_id" text NOT NULL,
	"number" integer NOT NULL,
	"build_name" text NOT NULL,
	"commit_sha" text NOT NULL,
	"commit_message" text NOT NULL,
	"branch" text NOT NULL,
	"baseline_branch" text NOT NULL,
	"merge_base_sha" text,
	"ancestors" text[] NOT NULL,
	"pr_number" integer,
	"pr_closed_at" bigint,
	"merged_pr_number" integer,
	"nonce" text NOT NULL,
	"shards_total" integer,
	"done_shard_indexes" integer[] NOT NULL,
	"shards_joined" integer,
	"subset" boolean NOT NULL,
	"status" text NOT NULL,
	"conclusion" text,
	"auto_approved" boolean NOT NULL,
	"full_rows" boolean NOT NULL,
	"baseline_build_id" text,
	"superseded_by_id" text,
	"counts" jsonb NOT NULL,
	"storage_blocked" boolean NOT NULL,
	"expiry_job_id" text,
	"github_check_run_id" bigint,
	"check_version" integer NOT NULL,
	"check_out_of_sync" boolean NOT NULL,
	"check_sync_scheduled_at" bigint,
	"ci_provider" text,
	"ci_run_url" text,
	"finalized_at" bigint
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" bigint NOT NULL,
	"login" text NOT NULL,
	"access_token" text NOT NULL,
	"access_token_expires_at" bigint,
	"refresh_token" text,
	"refresh_token_expires_at" bigint
);
--> statement-breakpoint
CREATE TABLE "deleted_builds" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"project_id" text NOT NULL,
	"number" integer NOT NULL,
	"branch" text NOT NULL,
	"pr_number" integer,
	"reason" text NOT NULL,
	"retention_days" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"delivery_id" text NOT NULL,
	"event" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"account_id" text NOT NULL,
	"hash" text NOT NULL,
	"kind" text NOT NULL,
	"bytes" bigint NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"blob_key" text NOT NULL,
	"last_referenced_at" bigint NOT NULL,
	"project_id" text,
	"baseline" boolean
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"name" text NOT NULL,
	"args" jsonb NOT NULL,
	"run_at" bigint NOT NULL,
	"locked_until" bigint,
	"failed_at" bigint,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "project_tokens" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"last_used_at" bigint,
	"revoked_at" bigint
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"account_id" text NOT NULL,
	"provider" text DEFAULT 'github' NOT NULL,
	"provider_repo_id" bigint NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"private" boolean NOT NULL,
	"default_branch" text NOT NULL,
	"auto_approve_branches" text[] NOT NULL,
	"diff_threshold" double precision NOT NULL,
	"diff_include_aa" boolean NOT NULL,
	"pr_retention_days" integer NOT NULL,
	"next_build_number" integer NOT NULL,
	"last_build_at" bigint,
	"archived_at" bigint
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"name" text NOT NULL,
	"key" text NOT NULL,
	"value" double precision NOT NULL,
	"ts" bigint NOT NULL,
	CONSTRAINT "rate_limits_name_key_pk" PRIMARY KEY("name","key")
);
--> statement-breakpoint
CREATE TABLE "repo_permissions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"permission" text NOT NULL,
	"org_owner" boolean NOT NULL,
	"checked_at" bigint NOT NULL,
	"freshness" text,
	"freshness_job_id" text
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"snapshot_id" text NOT NULL,
	"build_id" text NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"source" text NOT NULL,
	"source_review_id" text,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"build_id" text NOT NULL,
	"shard_index" integer NOT NULL,
	"name" text NOT NULL,
	"image_id" text,
	"baseline_snapshot_id" text,
	"baseline_image_id" text,
	"diff_image_id" text,
	"diff_status" text NOT NULL,
	"diff_ratio" double precision,
	"diff_pixels" bigint,
	"review_state" text NOT NULL,
	"metadata" jsonb NOT NULL,
	CONSTRAINT "snapshots_diff_status_check" CHECK ("snapshots"."diff_status" in ('unchanged', 'changed', 'added', 'removed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"account_id" text NOT NULL,
	"project_id" text NOT NULL,
	"day" text NOT NULL,
	"baseline_bytes" bigint NOT NULL,
	"pr_bytes" bigint NOT NULL,
	"diff_bytes" bigint NOT NULL,
	"builds" integer NOT NULL,
	"snapshots" integer NOT NULL,
	"uploaded_images" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"created_at" double precision DEFAULT extract(epoch from clock_timestamp()) * 1000 NOT NULL,
	"identity_id" text,
	"name" text,
	"image" text,
	"email" text,
	"last_seen_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_members_user_id_index" ON "account_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_members_account_id_user_id_index" ON "account_members" USING btree ("account_id","user_id");--> statement-breakpoint
CREATE INDEX "accounts_provider_provider_account_id_index" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "accounts_login_index" ON "accounts" USING btree ("login");--> statement-breakpoint
CREATE INDEX "accounts_installation_id_index" ON "accounts" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "approved_images_project_id_build_name_pr_number_image_id_index" ON "approved_images" USING btree ("project_id","build_name","pr_number","image_id");--> statement-breakpoint
CREATE UNIQUE INDEX "builds_project_id_number_index" ON "builds" USING btree ("project_id","number");--> statement-breakpoint
CREATE INDEX "builds_project_id_build_name_nonce_index" ON "builds" USING btree ("project_id","build_name","nonce");--> statement-breakpoint
CREATE INDEX "builds_project_id_build_name_commit_sha_index" ON "builds" USING btree ("project_id","build_name","commit_sha");--> statement-breakpoint
CREATE INDEX "builds_project_id_build_name_pr_number_index" ON "builds" USING btree ("project_id","build_name","pr_number");--> statement-breakpoint
CREATE INDEX "builds_project_id_branch_index" ON "builds" USING btree ("project_id","branch");--> statement-breakpoint
CREATE INDEX "builds_project_id_pr_number_index" ON "builds" USING btree ("project_id","pr_number");--> statement-breakpoint
CREATE INDEX "builds_project_id_status_conclusion_index" ON "builds" USING btree ("project_id","status","conclusion");--> statement-breakpoint
CREATE INDEX "builds_check_out_of_sync_index" ON "builds" USING btree ("check_out_of_sync") WHERE "builds"."check_out_of_sync";--> statement-breakpoint
CREATE INDEX "builds_baseline_build_id_index" ON "builds" USING btree ("baseline_build_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_provider_provider_user_id_index" ON "connections" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_user_id_provider_index" ON "connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "deleted_builds_project_id_number_index" ON "deleted_builds" USING btree ("project_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "github_events_delivery_id_index" ON "github_events" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "images_account_id_hash_index" ON "images" USING btree ("account_id","hash");--> statement-breakpoint
CREATE INDEX "jobs_run_at_index" ON "jobs" USING btree ("run_at") WHERE "jobs"."failed_at" is null;--> statement-breakpoint
CREATE INDEX "project_tokens_project_id_index" ON "project_tokens" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_tokens_token_hash_index" ON "project_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "projects_account_id_name_index" ON "projects" USING btree ("account_id","name");--> statement-breakpoint
CREATE INDEX "projects_account_id_last_build_at_index" ON "projects" USING btree ("account_id","last_build_at");--> statement-breakpoint
CREATE INDEX "projects_provider_provider_repo_id_index" ON "projects" USING btree ("provider","provider_repo_id");--> statement-breakpoint
CREATE INDEX "projects_owner_name_index" ON "projects" USING btree ("owner","name");--> statement-breakpoint
CREATE UNIQUE INDEX "repo_permissions_user_id_project_id_index" ON "repo_permissions" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "reviews_snapshot_id_index" ON "reviews" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "reviews_build_id_index" ON "reviews" USING btree ("build_id");--> statement-breakpoint
CREATE INDEX "snapshots_build_id_name_index" ON "snapshots" USING btree ("build_id","name");--> statement-breakpoint
CREATE INDEX "snapshots_build_id_diff_status_name_index" ON "snapshots" USING btree ("build_id","diff_status","name");--> statement-breakpoint
CREATE INDEX "snapshots_image_id_index" ON "snapshots" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "snapshots_baseline_image_id_index" ON "snapshots" USING btree ("baseline_image_id");--> statement-breakpoint
CREATE INDEX "snapshots_diff_image_id_index" ON "snapshots" USING btree ("diff_image_id");--> statement-breakpoint
CREATE INDEX "usage_daily_project_id_day_index" ON "usage_daily" USING btree ("project_id","day");--> statement-breakpoint
CREATE INDEX "usage_daily_account_id_day_index" ON "usage_daily" USING btree ("account_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "users_identity_id_index" ON "users" USING btree ("identity_id");