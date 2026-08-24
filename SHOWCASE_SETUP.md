# Showcase setup

The Showcase (`/docs/showcase`) lets people sign in and submit a link to the
social post of a video they made with snap-cn. Approved submissions appear in a
public gallery. It is the app's first **auth + database** layer, meant to also
back future features (Marketplace, accounts).

The code ships working but **inert** until you connect a database and at least
one OAuth provider — until then the page shows a "Showcase is being set up"
empty state and the build stays green. Follow the steps below to switch it on.

**Stack:** Auth.js (NextAuth v5) · Supabase Postgres · Drizzle ORM.

---

## 1. Create the database (Supabase)

1. Create a project at <https://supabase.com>.
2. In the dashboard: **Connect** (top bar) → copy two connection strings into
   `.env.local` (copy `.env.example` first):
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Direct connection** (port `5432`) → `DIRECT_URL`
   Replace `<password>` with your database password in both.

## 2. Create the tables

The migration SQL is already generated in `drizzle/`. Apply it:

```bash
pnpm drizzle-kit migrate
```

(That creates the Auth.js tables + `showcase_submission`. To re-generate after
schema changes: `pnpm drizzle-kit generate` then `migrate` again.)

## 3. Auth secret + admin

```bash
npx auth secret          # writes AUTH_SECRET to .env.local
```

Set `ADMIN_EMAILS` to the email(s) that may moderate (comma-separated). Only
these can open `/docs/showcase/admin` and approve/reject.

## 4. OAuth providers (set up the ones you want)

For each provider, create an app, then paste its client id/secret into
`.env.local`. A provider only appears in the sign-in menu once both are set.

Callback URL is always `<site>/api/auth/callback/<provider>` — add **both** the
localhost and production variants in each provider's console:

| Provider | Console | Env vars | `<provider>` |
|---|---|---|---|
| Google | console.cloud.google.com → Credentials → OAuth client | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | `google` |
| GitHub | github.com → Settings → Developer settings → OAuth Apps | `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | `github` |
| X / Twitter | developer.x.com → Project → OAuth 2.0 | `AUTH_TWITTER_ID` / `AUTH_TWITTER_SECRET` | `twitter` |
| Facebook | developers.facebook.com → App → Facebook Login | `AUTH_FACEBOOK_ID` / `AUTH_FACEBOOK_SECRET` | `facebook` |

Example callbacks for Google:
`http://localhost:3000/api/auth/callback/google` and
`https://snapcn.dev/api/auth/callback/google`.

## 5. Deploy

Add every `.env.local` value to your host (Vercel → Project → Settings →
Environment Variables), then redeploy. Add the production callback URLs to each
OAuth app.

**On a container host (Coolify, Fly, Railway), do this too** — an approved
showcase video is a file on disk, and without it the whole library is deleted
on the next redeploy:

1. Mount a persistent volume at `/data`.
2. Set `RENDER_WORK_DIR=/data/renders`, `AUDIO_WORK_DIR=/data/audio`,
   `SHOWCASE_WORK_DIR=/data/showcase`.
3. Keep the app at **one replica**. The render job registry is in-process and
   the MP4s are on local disk, so a second container 404s the polls and
   downloads that land on the wrong one.

---

## Verify the flow

1. `pnpm dev`, open `/docs/showcase`.
2. **Submit your video** → sign in → paste a post link + title → submit. You'll
   see a "Submitted! We'll review it shortly." toast; it lands as `pending`.
3. As an admin, open `/docs/showcase/admin` → **Approve**.
4. Back on `/docs/showcase`, the entry now appears in the gallery.

## Notes

- **Moderation is on by default** — submissions are hidden until an admin
  approves them (`showcase_submission.status`).
- **Thumbnails** are a best-effort scrape of the post's `og:image`. Many social
  sites block scraping, so cards fall back to a platform-branded tile — that's
  expected. (A direct upload path via Supabase Storage can be added later;
  `thumbnail_url` already exists for it.)
- **Adding a provider** (e.g. LinkedIn): add `LinkedIn` to `auth.ts`, extend
  `PROVIDER_ENV` there and `lib/auth-providers.ts`, and set its env pair.
