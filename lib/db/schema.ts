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
  /**
   * The only secret in the row. It addresses both the confirm link and the
   * unsubscribe link, and it is a second column rather than `id` so the row's
   * primary key never travels in a URL a mail client will log, scan and cache.
   *
   * One token for both jobs on purpose: the worst a confirm link can do in the
   * wrong hands is unsubscribe an address that had not confirmed yet.
   */
  token: uuid("token").notNull().unique().defaultRandom(),
  /**
   * Null until the address itself opened the confirm link — the whole point of
   * double opt-in. Nothing but the confirm mail is ever sent to a null row, so
   * typing a stranger's address into the form costs them one message and
   * nothing after it.
   */
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  /**
   * Set by the footer link, by Gmail's one-click header, or by a spam
   * complaint arriving on the Resend webhook. Rows are kept rather than deleted
   * so a later signup cannot silently re-add somebody who asked to leave — they
   * have to confirm again.
   */
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  /**
   * When the confirm mail last went out. The re-send throttle reads it: the
   * signup form is public, so without this an attacker with a list of proxies
   * can point it at one address and mail-bomb a stranger in our name.
   */
  confirmSentAt: timestamp("confirm_sent_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Addresses no mail may be sent to, ever again.
 *
 * Written only by the Resend webhook, from a hard bounce or a spam complaint,
 * and read by `sendEmail` before every single send — transactional included.
 * That last part looks aggressive and is the point: a mailbox that answered
 * "no such user" will answer it again, and a sender that keeps asking is a
 * sender Gmail stops trusting for *every* stream. A dead address is not worth
 * the sign-in links of the people who share the domain reputation with it.
 *
 * Separate from `subscriber.unsubscribedAt`, which means something else
 * entirely: unsubscribed is a preference about one list, suppressed is a fact
 * about the address. Somebody can be on the list and suppressed, or neither.
 *
 * Keyed by the address, not by a row id: the question this table exists to
 * answer is "may I mail this string", and every other shape makes that a join.
 */
export const emailSuppressions = pgTable("email_suppression", {
  email: text("email").primaryKey(),
  /** `bounced` or `complained`. Ours, not the provider's — see `suppressionFor`. */
  reason: text("reason").notNull(),
  /** The provider's own words, kept only so a surprise can be read back. */
  detail: text("detail"),
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
   *
   * SUPERSEDED by the `api_key` table (migration 0007 copies these across) and
   * no longer read or written. Kept only so the deploy before that migration
   * does not select a column that is gone; drop it in a later migration.
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
 * A customer's API keys — several, so a team can give each person their own and
 * revoke one without breaking everyone else's install.
 *
 * The key is what turns `shadcn add @snapcn/<pro>` from a 402 into a file, and
 * what the MCP server checks. Whether it works is not stored here: a key is
 * worth whatever its owner's `billing_subscription` row is worth at the moment
 * it is used, so a lapsed plan disables every key at once and a renewal brings
 * them all back, with nothing to update.
 *
 * Plain text, for the reason on the old `billing_subscription.api_key`: it goes
 * into a config file on every new machine, so the owner has to be able to read
 * it back. The worst a leaked key buys is component source — and now the owner
 * can delete that one key.
 */
export const apiKeys = pgTable(
  "api_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(),
    /** The owner's label — "laptop", "CI", a teammate's name. */
    name: text("name").notNull().default("Default"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("api_key_user_idx").on(t.userId, t.createdAt)],
);

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

/**
 * A finished export, kept, with a public page at `/v/<id>`.
 *
 * ## Why this is not a `showcase_submission`
 *
 * The two look identical — a claimed MP4 plus a row — and they are not the same
 * thing. A submission is authored, moderated, and listed in a public gallery. A
 * shared video is created automatically the moment someone asks for a link, is
 * never listed anywhere, and is only reachable by knowing its id.
 *
 * Overloading `showcase_submission` with an extra status would work today and
 * leak later: every showcase query would have to remember to exclude the new
 * state, and one that forgot would publish a stranger's private video into the
 * gallery. `app/r/[file]/route.ts` already states the rule this follows — "a
 * gate that has to remember to say no is one refactor away from saying yes".
 *
 * `jobId` is both the storage key and the render it came from: the file lives at
 * `SHOWCASE_WORK_DIR/<jobId>.mp4` and is streamed by the same range-capable
 * route the showcase uses, so hosting a share link added no new storage path
 * and no second player.
 */
export const sharedVideos = pgTable(
  "shared_video",
  {
    /** What appears in the URL. Unguessable, and not the render's id. */
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Basename of the claimed MP4, which is the render job's own uuid.
     *
     * Unique: claiming moves the file, so a second row for the same job would
     * be a second page pointing at one file — and deleting either would break
     * the other.
     */
    jobId: text("job_id").notNull().unique(),
    title: text("title").notNull().default("Untitled video"),
    /** For "built with", and so a page can link the components it used. */
    componentsUsed: text("components_used").array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // "My links", newest first, is the only list this table is ever queried for.
  (t) => [index("shared_video_user_created_idx").on(t.userId, t.createdAt)],
);
