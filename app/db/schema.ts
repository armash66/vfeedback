import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const places = pgTable("places", {
  id: text("id").primaryKey(), // slug like "lab-2"
  name: text("name").notNull(),
  groupName: text("group_name").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  active: boolean("active").notNull().default(true),
});

export const reports = pgTable(
  "reports",
  {
    code: text("code").primaryKey(),
    type: text("type").notNull(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id),
    rating: integer("rating"),
    message: text("message").notNull().default(""),
    highlights: text("highlights")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("reports_type_check", sql`${table.type} in ('rate', 'issue', 'suggest')`),
    check("reports_rating_check", sql`${table.rating} is null or (${table.rating} >= 1 and ${table.rating} <= 5)`),
    check("reports_message_length_check", sql`length(${table.message}) <= 1000`),
    check("reports_status_check", sql`${table.status} in ('new', 'in_progress', 'resolved', 'rejected')`),
  ],
);

export const reportEvents = pgTable(
  "report_events",
  {
    id: serial("id").primaryKey(),
    reportCode: text("report_code")
      .notNull()
      .references(() => reports.code, { onDelete: "cascade" }),
    actor: text("actor"),
    kind: text("kind").notNull(),
    note: text("note"),
    visibility: text("visibility").notNull().default("internal"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    check("report_events_kind_check", sql`${table.kind} in ('status_change', 'assignment', 'note', 'public_update')`),
    check("report_events_visibility_check", sql`${table.visibility} in ('internal', 'public')`),
  ],
);

export const staff = pgTable(
  "staff",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    role: text("role").notNull().default("department"),
    departmentId: integer("department_id").references(() => departments.id),
  },
  (table) => [check("staff_role_check", sql`${table.role} in ('super_admin', 'department')`)],
);
