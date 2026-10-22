CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
CREATE INDEX "places_department_id_idx" ON "places" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "reports_status_created_at_idx" ON "reports" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_place_id_created_at_idx" ON "reports" USING btree ("place_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_created_at_idx" ON "reports" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_submission_id_unique" UNIQUE("submission_id");