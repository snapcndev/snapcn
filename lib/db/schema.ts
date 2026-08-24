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
