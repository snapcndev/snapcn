"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

/**
 * Boots posthog-js.
 *
 * ## Why the ingest path is `/ingest` and not PostHog's own host
 *
 * This site's audience is frontend developers. Ad-blocker use in that group is
 * not the general population's — a direct `us.i.posthog.com` endpoint is on
 * every blocklist there is, and the traffic we would lose is exactly the
 * traffic we care most about measuring. `/ingest` is a same-origin rewrite (see
 * `next.config.ts`) so there is nothing third-party for a blocker to match.
 *
 * ## Why no manual pageview effect
 *
 * The usual App Router recipe pairs this provider with a `usePathname` +
 * `useSearchParams` effect that fires `$pageview` on every navigation. That
 * recipe predates `capture_pageview: "history_change"`, which makes the SDK
 * itself watch the History API and covers soft navigation without a component,
 * a Suspense boundary, or the double-fire that recipe is famous for.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // No key (a fork, a local checkout, a preview build) → no tracker, and every
    // `trackEvent` call downstream turns into a no-op rather than a crash.
    if (!key) return;

    posthog.init(key, {
      api_host: "/ingest",
      // Where the SDK sends people for the toolbar/debug links. The proxy above
      // only covers ingestion, so this has to be the real dashboard host.
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com",

      // App Router soft navigations, without a manual effect. See above.
      capture_pageview: "history_change",
      // Gives every pageview a duration, which is the only way to tell a docs
      // page that was read from one that was bounced off.
      capture_pageleave: true,

      // Anonymous visitors are counted as events but do not each mint a person
      // profile. On a marketing site that is the difference between a person
      // count that reflects our users and one that reflects our crawlers.
      // `identifyUser()` promotes someone the moment they sign in.
      person_profiles: "identified_only",

      // Unhandled errors and rejections, reported with the session that caused
      // them. Cheapest error monitoring that exists: one flag.
      capture_exceptions: true,

      // Session replay. For a product whose entire pitch is "look at how this
      // moves", watching one person fail to find the Customize panel is worth
      // more than a month of aggregate counts. Inputs are masked by default.
      //
      // Off in development, and not for tidiness: `before_send` drops every dev
      // event anyway, so the recorder has nothing to record — but it still
      // fetches its own 60KB bundle through the `/ingest` rewrite on every page
      // load. That is a server-side proxy hop to PostHog on a dev box, and when
      // it resets it surfaces as a bare `TypeError: fetch failed` with
      // ECONNRESET and no application frames, next to four "could not load
      // recorder" lines. Both disappear when nothing asks for the recorder.
      disable_session_recording: process.env.NODE_ENV === "development",

      // `pnpm dev` would otherwise post local clicking-around into the same
      // project the conversion numbers are read from. Events are still built and
      // logged (`debug()`), just not sent — so you can verify wiring from the
      // console. To verify end-to-end, run `pnpm build && pnpm start`: NODE_ENV
      // is "production" there and events go out for real.
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.debug();
      },
      before_send: (event) =>
        process.env.NODE_ENV === "development" ? null : event,
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
