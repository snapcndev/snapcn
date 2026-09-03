import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

/**
 * PostHog ingestion, proxied through this origin (see app/posthog-provider.tsx
 * for why: our audience is frontend developers, and a third-party analytics
 * hostname is blocked for a large share of them).
 *
 * `NEXT_PUBLIC_POSTHOG_HOST` is the dashboard host and decides the region —
 * `https://us.posthog.com` or `https://eu.posthog.com`. The ingestion and static
 * hosts are derived from it, so switching region is one env var, not three.
 */
const POSTHOG_REGION = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "").includes(
  "eu.",
)
  ? "eu"
  : "us";
const POSTHOG_INGEST = `https://${POSTHOG_REGION}.i.posthog.com`;
const POSTHOG_ASSETS = `https://${POSTHOG_REGION}-assets.i.posthog.com`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The OG card reads its faces and the mark off disk at request time. Neither
  // is imported, so nothing traces them into the deployed function — without
  // this the route builds fine and 500s on every crawler.
  outputFileTracingIncludes: {
    "/og/[[...slug]]": ["./app/og/fonts/*.ttf", "./public/logo/snapcn.png"],
  },
  // PostHog's endpoints are sensitive to a trailing-slash redirect in front of
  // them; Next would otherwise rewrite `/ingest/e/` and then 308 it.
  skipTrailingSlashRedirect: true,
  // Remotion's server packages are Node-only and ship native binaries (esbuild +
  // the platform-specific @remotion/compositor-*). They must NOT be bundled by
  // Turbopack/webpack — keep them external so they're require()'d at runtime in
  // the /api/render route. Without this the build fails resolving the compositor
  // binaries + reading the esbuild binary as source.
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "esbuild",
  ],
  turbopack: {
    root: __dirname,
  },
  // One canonical host. `www.` and the apex both served a 200, so Google saw two
  // copies of every page and split the ranking signal between them — while the
  // sitemap, the `<link rel=canonical>` and `SITE_URL` in lib/llms.ts +
  // lib/structured-data.tsx all name the apex. This makes the server agree with
  // what those three already claim, rather than the other way round.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.snapcn.dev" }],
        destination: "https://snapcn.dev/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // The SDK bundle + recorder script. Separate host from ingestion.
      {
        source: "/ingest/static/:path*",
        destination: `${POSTHOG_ASSETS}/static/:path*`,
      },
      { source: "/ingest/:path*", destination: `${POSTHOG_INGEST}/:path*` },
      // `<docs url>.md` serves that page as markdown. A rewrite rather than a
      // route because `app/docs/[[...slug]]/page.tsx` already owns this path
      // and a second handler on it will not build; the public URL is still the
      // docs URL, which is the whole point — an agent appends `.md` to the link
      // it already has and does not need to learn a second URL shape.
      { source: "/docs/:path*.md", destination: "/docs-md/:path*" },
    ];
  },
  // Rendered demos always ship to the SAME path (`/demos/<slug>.mp4`), so a
  // browser that has one will happily keep replaying it after the file underneath
  // has been re-rendered — <video> caches especially hard. That cost two rounds of
  // "why am I still seeing the old one". In dev, never cache them; in production,
  // always revalidate (a 304 is cheap and these change on every deploy).
  async headers() {
    return [
      {
        source: "/demos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              process.env.NODE_ENV === "development"
                ? "no-store"
                : "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
  typescript: {
    // Gate the production build on app code only; vitest owns test typing and
    // the render scripts run under node with their own import rules.
    tsconfigPath: "tsconfig.build.json",
  },
};

export default withMDX(nextConfig);
