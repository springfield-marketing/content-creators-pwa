// Drizzle translation of the §B4 schema. Postgres features Drizzle can't
// express (extensions, the no-overlap exclusion constraint, trigram index)
// live in the custom migration — see drizzle/*_postgres_extras.sql.
//
// Deviation from §B4: users.slug added — the public booking page is
// /book/[creator] and needs a URL-safe identifier that isn't a UUID.

import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["creator", "manager", "executive"]);
export const bookingStatus = pgEnum("booking_status", [
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);
export const shootType = pgEnum("shoot_type", ["photo", "video", "photo_video"]);
export const shootLocation = pgEnum("shoot_location", ["on_site", "office"]);
export const bookingSource = pgEnum("booking_source", ["agent", "company", "manual"]);
export const deliverableType = pgEnum("deliverable_type", [
  "reel",
  "photo_set",
  "video",
  "other",
]);
export const platform = pgEnum("platform", [
  "instagram",
  "tiktok",
  "drive",
  "dropbox",
  "other",
]);
export const reviewStatus = pgEnum("review_status", [
  "submitted",
  "under_review",
  "approved",
  "needs_revision",
]);

// Working hours: arrays of [start, end] ranges per day — allows lunch splits.
export type WorkingHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string][]>
>;
export type ShootDurations = { photo: number; video: number; photo_video: number };

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique().notNull(),
  fullName: text("full_name").notNull(),
  role: userRole("role").notNull(),
  slug: text("slug").unique(), // creators only; used in /book/[creator]
  // Deviation from §B4: shown on the booking page cards; not in the spec schema.
  specialty: shootType("specialty").default("photo_video"),
  googleCalendarId: text("google_calendar_id"),
  googleRefreshToken: text("google_refresh_token"), // Option B only; unused under Workspace delegation
  webhookChannelId: text("webhook_channel_id"),
  webhookResourceId: text("webhook_resource_id"),
  webhookExpiresAt: timestamp("webhook_expires_at", { withTimezone: true }),
  calendarSyncToken: text("calendar_sync_token"),
  workingHours: jsonb("working_hours")
    .$type<WorkingHours>()
    .default(
      sql`'{"mon":[["09:00","18:00"]],"tue":[["09:00","18:00"]],"wed":[["09:00","18:00"]],"thu":[["09:00","18:00"]],"fri":[["09:00","18:00"]]}'::jsonb`
    ),
  shootDurations: jsonb("shoot_durations")
    .$type<ShootDurations>()
    .default(sql`'{"photo":90,"video":150,"photo_video":180}'::jsonb`),
  bufferMinutes: integer("buffer_minutes").default(30),
  minNoticeHours: integer("min_notice_hours").default(24),
  maxHorizonDays: integer("max_horizon_days").default(28),
  maxShootsPerDay: integer("max_shoots_per_day").default(3),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const creatorTimeOff = pgTable(
  "creator_time_off",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("time_off_creator").on(t.creatorId, t.startsOn, t.endsOn)]
);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  office: text("office"),
  isApproved: boolean("is_approved").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
// agents_name_trgm gin index lives in the custom migration (needs pg_trgm).

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    agentId: uuid("agent_id").references(() => agents.id), // NULL for company shoots
    source: bookingSource("source").notNull().default("agent"),
    shootType: shootType("shoot_type").notNull(),
    locationType: shootLocation("location_type").notNull(),
    propertyAddress: text("property_address"),
    notes: text("notes"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("confirmed"),
    cancellationReason: text("cancellation_reason"),
    cancelledBy: text("cancelled_by"), // 'agent' | 'creator' | 'manager' | 'system'
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    manageTokenHash: text("manage_token_hash"),
    googleEventId: text("google_event_id").unique(),
    googleCalendarId: text("google_calendar_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("bookings_creator_time").on(t.creatorId, t.startsAt),
    index("bookings_status").on(t.status),
    // no_overlapping_confirmed exclusion constraint: custom migration.
  ]
);

export const deliverables = pgTable(
  "deliverables",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    bookingId: uuid("booking_id").references(() => bookings.id),
    agentId: uuid("agent_id").references(() => agents.id),
    type: deliverableType("type").notNull(),
    platform: platform("platform"),
    url: text("url").notNull(),
    isPosted: boolean("is_posted").default(false),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    workDate: date("work_date").notNull(),
    reviewStatus: reviewStatus("review_status").notNull().default("submitted"),
    reviewComment: text("review_comment"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("deliverables_review").on(t.reviewStatus, t.createdAt),
    index("deliverables_creator_month").on(t.creatorId, t.workDate),
  ]
);

export const kpiTargets = pgTable(
  "kpi_targets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    month: date("month").notNull(), // first of month
    targetShoots: integer("target_shoots").default(0),
    targetDeliverables: integer("target_deliverables").default(0),
    targetPosted: integer("target_posted").default(0),
  },
  (t) => [uniqueIndex("kpi_targets_creator_month").on(t.creatorId, t.month)]
);

export const kpiSnapshots = pgTable(
  "kpi_snapshots",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    snapshotDate: date("snapshot_date").notNull(),
    month: date("month").notNull(),
    shootsCompleted: integer("shoots_completed"),
    shootsCancelled: integer("shoots_cancelled"),
    deliverablesTotal: integer("deliverables_total"),
    deliverablesApproved: integer("deliverables_approved"),
    postedTotal: integer("posted_total"),
    avgTurnaroundHours: numeric("avg_turnaround_hours"),
  },
  (t) => [uniqueIndex("kpi_snapshots_creator_date").on(t.creatorId, t.snapshotDate)]
);

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorId: uuid("actor_id"),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
