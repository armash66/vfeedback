CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group_name" text NOT NULL,
	"department_id" integer,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_code" text NOT NULL,
	"actor" text,
	"kind" text NOT NULL,
	"note" text,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "report_events_kind_check" CHECK ("report_events"."kind" in ('status_change', 'assignment', 'note', 'public_update')),
	CONSTRAINT "report_events_visibility_check" CHECK ("report_events"."visibility" in ('internal', 'public'))
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"code" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"place_id" text NOT NULL,
	"rating" integer,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_type_check" CHECK ("reports"."type" in ('rate', 'issue', 'suggest')),
	CONSTRAINT "reports_rating_check" CHECK ("reports"."rating" is null or ("reports"."rating" >= 1 and "reports"."rating" <= 5)),
	CONSTRAINT "reports_message_length_check" CHECK (length("reports"."message") <= 1000),
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" in ('new', 'in_progress', 'resolved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'department' NOT NULL,
	"department_id" integer,
	CONSTRAINT "staff_email_unique" UNIQUE("email"),
	CONSTRAINT "staff_role_check" CHECK ("staff"."role" in ('super_admin', 'department'))
);
--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_report_code_reports_code_fk" FOREIGN KEY ("report_code") REFERENCES "public"."reports"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;