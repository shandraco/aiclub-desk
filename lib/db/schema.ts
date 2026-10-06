import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Captions, Slide } from "@/lib/posts/types";

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ---------------- people and access ---------------- */

/** admin: everything, including invites and roles. officer: plan, write, approve. member: write drafts only. */
export const roleEnum = pgEnum("role", ["admin", "officer", "member"]);

export const users = pgTable(
  "users",
  {
    id: id(),
    /** Stored lowercase; the unique index is on this column. */
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("member"),
    createdAt: created(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_username_key").on(t.username),
    check("users_username_shape", sql`${t.username} ~ '^([a-z0-9][a-z0-9_.-]{2,31}|[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,24})$'`),
  ],
);

/** The cookie carries a random token; only its SHA-256 is stored, so a database leak is not a login. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token), hex
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: created(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const invites = pgTable(
  "invites",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    role: roleEnum("role").notNull().default("officer"),
    /** Who it is for, so the admin can tell invites apart. Not shown to anyone else. */
    label: text("label").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: created(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: uuid("used_by").references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("invites_token_key").on(t.tokenHash)],
);

/** Sign-in attempts, for rate limiting by username and by client address. Pruned after a day. */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: id(),
    key: text("key").notNull(),
    ok: boolean("ok").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_attempts_key_at_idx").on(t.key, t.at)],
);

/* ---------------- library ---------------- */

export const assetKindEnum = pgEnum("asset_kind", ["photo", "logo"]);

export const assets = pgTable("assets", {
  id: id(),
  kind: assetKindEnum("kind").notNull(),
  url: text("url").notNull(),
  pathname: text("pathname").notNull(),
  contentType: text("content_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes"),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
});

export const rooms = pgTable("rooms", {
  id: id(),
  name: text("name").notNull(),
  /** How it reads on a graphic's data strip: "RSC 233". */
  short: text("short").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: created(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const speakers = pgTable("speakers", {
  id: id(),
  name: text("name").notNull(),
  /** "Data lead · Textron Aviation" as it should appear under the photo. */
  role: text("role").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  linkedin: text("linkedin").notNull().default(""),
  photoId: uuid("photo_id").references(() => assets.id, { onDelete: "set null" }),
  /** Focus point and zoom for the photo: {x, y, zoom}. */
  photoCrop: jsonb("photo_crop").$type<{ x: number; y: number; zoom: number }>(),
  notes: text("notes").notNull().default(""),
  createdAt: created(),
  updatedAt: updated(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const logoToneEnum = pgEnum("logo_tone", ["original", "white", "black"]);

export const partners = pgTable("partners", {
  id: id(),
  name: text("name").notNull(),
  instagram: text("instagram").notNull().default(""),
  linkedin: text("linkedin").notNull().default(""),
  logoId: uuid("logo_id").references(() => assets.id, { onDelete: "set null" }),
  logoTone: logoToneEnum("logo_tone").notNull().default("original"),
  notes: text("notes").notNull().default(""),
  createdAt: created(),
  updatedAt: updated(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

/* ---------------- events ---------------- */

export const eventStatusEnum = pgEnum("event_status", ["planned", "cancelled"]);

export const events = pgTable(
  "events",
  {
    id: id(),
    title: text("title").notNull(),
    /** Series preset key from lib/brand/presets.ts: "workshop", "speaker-series", ... */
    preset: text("preset").notNull(),
    /** "Workshop · 03" as it appears in the graphic's header. */
    seriesLabel: text("series_label").notNull().default(""),
    /** One sentence for the dek and the caption drafts. */
    summary: text("summary").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    /** Free text when the room is not in the library, or an online link label. */
    place: text("place").notNull().default(""),
    rsvpUrl: text("rsvp_url").notNull().default(""),
    status: eventStatusEnum("status").notNull().default("planned"),
    /** Turnout and RSVPs, recorded after the event. */
    rsvps: integer("rsvps"),
    attendance: integer("attendance"),
    resultsNote: text("results_note").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("events_starts_idx").on(t.startsAt)],
);

export const eventSpeakers = pgTable(
  "event_speakers",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    speakerId: uuid("speaker_id")
      .notNull()
      .references(() => speakers.id, { onDelete: "cascade" }),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.speakerId] })],
);

export const eventPartners = pgTable(
  "event_partners",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.partnerId] })],
);

/* ---------------- posts ---------------- */

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "posted",
]);

/** Where in an event's run the post sits. "custom" is anything else. */
export const postKindEnum = pgEnum("post_kind", [
  "announce",
  "linkedin",
  "reminder",
  "day_of",
  "recap",
  "photos",
  "custom",
]);

export const posts = pgTable(
  "posts",
  {
    id: id(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    kind: postKindEnum("kind").notNull().default("custom"),
    /** Preset key the post started from; sets template, ground and data strip defaults. */
    preset: text("preset").notNull(),
    /** Slide 1 is the cover. A single graphic is a carousel of one. */
    slides: jsonb("slides").$type<Slide[]>().notNull(),
    captions: jsonb("captions").$type<Captions>().notNull(),
    /** Formats to export: feed, story, wide. */
    formats: text("formats").array().notNull().default(sql`ARRAY['feed']::text[]`),
    /** Where it will go: instagram, linkedin, story. */
    channels: text("channels").array().notNull().default(sql`ARRAY['instagram']::text[]`),
    status: postStatusEnum("status").notNull().default("draft"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** Review checklist at approval time. */
    checklist: jsonb("checklist")
      .$type<{ facts: boolean; tagged: boolean; consent: boolean }>()
      .notNull()
      .default({ facts: false, tagged: false, consent: false }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    /** Links to the live posts, by channel. */
    postedUrls: jsonb("posted_urls").$type<Record<string, string>>().notNull().default({}),
    /** Optimistic concurrency: every save sends the version it started from. */
    version: integer("version").notNull().default(1),
    createdAt: created(),
    updatedAt: updated(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("posts_event_idx").on(t.eventId),
    index("posts_scheduled_idx").on(t.scheduledFor),
    index("posts_status_idx").on(t.status),
  ],
);

/** Comments and every state change on a post, newest last. Doubles as the audit trail. */
export const activityActionEnum = pgEnum("activity_action", [
  "created",
  "comment",
  "review_requested",
  "changes_requested",
  "approved",
  "reopened",
  "posted",
  "results",
]);

export const postActivity = pgTable(
  "post_activity",
  {
    id: id(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: activityActionEnum("action").notNull(),
    body: text("body").notNull().default(""),
    createdAt: created(),
  },
  (t) => [index("post_activity_post_idx").on(t.postId, t.createdAt)],
);

/** Numbers per channel, typed in from Instagram and LinkedIn insights after posting. */
export const postResults = pgTable(
  "post_results",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    reach: integer("reach"),
    impressions: integer("impressions"),
    likes: integer("likes"),
    comments: integer("comments"),
    shares: integer("shares"),
    saves: integer("saves"),
    clicks: integer("clicks"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.channel] })],
);

/** Who has a post open right now. A heartbeat row, upserted every 20 s while the editor is open. */
export const presence = pgTable(
  "presence",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);
