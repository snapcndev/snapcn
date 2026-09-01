import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/**
 * The app's database schema. The first four tables are the standard Auth.js
 * (NextAuth) Postgres tables, wired to the Drizzle adapter in `auth.ts`. The
 * `showcase_submission` table is the first app-owned table; future features
 * (Marketplace, etc.) add their tables here alongside it.
 */

// --- Auth.js core tables (shape required by @auth/drizzle-adapter) ---

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// --- Showcase ---

export const submissionStatus = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
]);

export const showcasePlatform = pgEnum("showcase_platform", [
  "x",
  "facebook",
  "linkedin",
  "youtube",
  "instagram",
  "tiktok",
  "other",
]);

export const showcaseSubmissions = pgTable("showcase_submission", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  postUrl: text("post_url").notNull(),
  platform: showcasePlatform("platform").notNull().default("other"),
  description: text("description"),
  // Reserved for a future direct-upload path (Supabase Storage); today it holds
  // a best-effort scraped og:image, or null.
  thumbnailUrl: text("thumbnail_url"),
  componentsUsed: text("components_used").array(),
  status: submissionStatus("status").notNull().default("pending"),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Video editor projects ---

/**
 * A saved timeline. The editor's work, for a signed-in user, kept server-side
 * instead of in that one browser's `localStorage`.
 *
 * The whole row is the *project*, not the export: the MP4 is scratch (deleted
 * as it downloads, swept after ten minutes), and a few KB of JSON that can be
 * re-rendered on demand is a far cheaper thing to keep than a video file we
 * would need a blob store to hold. "My videos" is this list.
 *
 * `data` is the same `{clips, audio, font}` shape as the local draft — the
 * client revives both through `reviveDraft`, so a row written by an older build
 * (or hand-edited) degrades to a valid timeline instead of a broken render.
 */
export const videoProjects = pgTable(
  "video_project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled video"),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // The only query there is: this user's projects, most recently touched first.
  (t) => [index("video_project_user_idx").on(t.userId, t.updatedAt)],
);

// --- Email list ---

/**
 * The launch list. Section 3 of GTM_PLAN.md prices this as the largest single
 * revenue channel at launch and the plan assumed it existed — it did not, and
 * a list can only be warm if it started collecting months before the ask.
 *
 * `source` records which surface the address came from (home page, docs, a
 * post-install page) so a cold blast can be split by intent instead of sent to
 * everyone at once.
 */
export const subscribers = pgTable("subscriber", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("home"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Billing ---

/** Mirrors `PlanName` in `lib/plans.ts`. Changing one without the other breaks. */
export const planEnum = pgEnum("plan", ["free", "starter", "pro"]);

/**
 * One row per user — the entitlement, not the billing history. Dodo keeps the
 * history; duplicating it here only creates a second thing to reconcile.
 *
 * Named `billing_subscription` rather than the obvious `subscription` because
 * `subscriber` next door is the marketing email list. Two tables one letter
 * apart, one holding "who gets Pro" and the other "who gets the newsletter", is
 * a mis-JOIN waiting for a tired evening.
 *
 * `status` is plain text on purpose: it is Dodo's vocabulary, not ours
 * (`pending`, `active`, `on_hold`, `paused`, `cancelled`, `failed`, `expired`).
 * A pgEnum here means the day Dodo adds a status the webhook handler starts
 * throwing on insert, which is a billing outage caused entirely by our own type.
 *
 * A user with no row is free — see `limitsFor(null)`. Only the webhook writes
 * here, so the whole paid tier can be switched off by simply never writing.
 */
export const billingSubscriptions = pgTable("billing_subscription", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: planEnum("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  dodoSubscriptionId: text("dodo_subscription_id"),
  dodoCustomerId: text("dodo_customer_id"),
  /**
   * The key a paid customer pastes into their MCP config, and the only thing
   * standing between `/r/<pro>.json` and the world.
   *
   * Stored in plain text, deliberately. A hash would be the reflex, but the
   * threat here is not a credential: the worst a leaked key buys is component
   * source, never money, never someone else's data. What a hash *does* cost is
   * the dashboard — this key lives in a config file the customer re-pastes on
   * every new machine, so it has to be readable back to them, and "regenerate,
   * you cannot see the old one" is a support ticket per laptop.
   *
   * Null until the first paid webhook mints one. A row with a null key is a
   * free or lapsed customer, which is the same answer the gate wants anyway.
   */
  apiKey: text("api_key").unique(),
  /**
   * Dodo calls this `next_billing_date` — there is no `current_period_end` in
   * its payloads. Stored under the neutral name so a second processor could
   * fill it without a migration. The meter resets on the calendar month, not on
   * this: it is for showing a renewal date and for deciding when a cancelled
   * subscription stops being honoured.
   */
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * The meter. One row per meter key per calendar month, `period_month` as
 * "YYYY-MM" text — a date would invite timezone-dependent bucketing, and the
 * bucket is a billing boundary, not an instant.
 *
 * `meter_key` is text and deliberately NOT a foreign key to `user`: it holds a
 * user id for a signed-in caller and an anonymous hash (IP-derived) otherwise.
 * An FK would make the anonymous case unstorable, and the alternatives — a
 * nullable user_id plus a nullable hash, or a second table — both cost a branch
 * at every call site to save a constraint nothing here needs.
 *
 * The composite primary key is the ON CONFLICT target. Callers MUST increment
 * atomically in one statement, never read-then-write:
 *
 *   INSERT INTO render_usage (meter_key, period_month, renders_used)
 *   VALUES ($1, $2, 1)
 *   ON CONFLICT (meter_key, period_month)
 *   DO UPDATE SET renders_used = render_usage.renders_used + 1
 *   RETURNING renders_used
 *
 * Two renders started in the same second are the normal case, not the edge one:
 * a SELECT-then-UPDATE loses one of them, and a lost increment is a free render
 * on a paid plan.
 */
export const renderUsage = pgTable(
  "render_usage",
  {
    meterKey: text("meter_key").notNull(),
    periodMonth: text("period_month").notNull(),
    rendersUsed: integer("renders_used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "render_usage_pk",
      columns: [t.meterKey, t.periodMonth],
    }),
  ],
);
