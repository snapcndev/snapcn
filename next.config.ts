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
  experimental: {
    // Turbopack's on-disk dev cache is never pruned on 16.2 (vercel/next.js#94915).
    // Ours reached 27 GB, and from that state an idle `next dev` spun at ~600% CPU
    // until React's dev async hook overflowed ("RangeError: Map maximum size
    // exceeded") and killed the server ~3 min after the first page load. With no
    // cache the same pages sat at 0% CPU, and cold compiles were no slower
    // (/docs/components 5.3s without it, 8.4s with). Re-enable once Next prunes it.
    turbopackFileSystemCacheForDev: false,
    inlineCss: true,
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
      // The URL people guess from 21st.dev/mcp. The page lives in the docs
      // chrome, so this is the short link, not a second copy to index.
      { source: "/mcp", destination: "/docs/mcp", permanent: true },
      // The blog moved 2026-09-24: the index to `/blogs`, each post to the root.
      { source: "/blog", destination: "/blogs", permanent: true },
      {
        source: "/blog/rss.xml",
        destination: "/blogs/rss.xml",
        permanent: true,
      },
      { source: "/blog/:slug", destination: "/:slug", permanent: true },
      // Pages removed 2026-09-17. They were indexed and linked from outside, so
      // they forward rather than 404: the showcase to the work itself, the
      // marketplace (a "coming soon" for paid scenes) to where paid scenes are
      // sold now.
      {
        source: "/docs/showcase/:path*",
        destination: "/docs/components",
        permanent: true,
      },
      {
        source: "/docs/marketplace",
        destination: "/docs/pricing",
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
  typescript: {
    // Gate the production build on app code only; vitest owns test typing and
    // the render scripts run under node with their own import rules.
    tsconfigPath: "tsconfig.build.json",
  },
};

export default withMDX(nextConfig);
