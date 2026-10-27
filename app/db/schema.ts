import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(), // slug like "lab-2"
    name: text("name").notNull(),
    groupName: text("group_name").notNull(),
    departmentId: integer("department_id").references(() => departments.id),
    active: boolean("active").notNull().default(true),
  },
  (table) => [index("places_department_id_idx").on(table.departmentId)],
);

export const reports = pgTable(
  "reports",
  {
    code: text("code").primaryKey(),
    submissionId: uuid("submission_id").unique(),
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
    index("reports_status_created_at_idx").on(table.status, table.createdAt.desc()),
    index("reports_place_id_created_at_idx").on(table.placeId, table.createdAt.desc()),
    index("reports_created_at_idx").on(table.createdAt.desc()),
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

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
