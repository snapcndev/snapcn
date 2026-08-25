"use client";

import posthog from "posthog-js";
import { useCallback } from "react";

/**
 * The site's typed event vocabulary.
 *
 * Every event below exists to answer a question we would otherwise guess at.
 * If you cannot name the question, do not add the event — a taxonomy nobody
 * reads is worse than no taxonomy, because it looks like coverage.
 *
 *   ┌ Are we converting? ──────────────────────────────────────────────────┐
 *   │ install_command_copied → registry_component_fetched (server-side, in │
 *   │ middleware.ts). That ratio is the funnel. Copying a string is        │
 *   │ intent; the registry fetch is the install. Everything else on this   │
 *   │ list is a leading indicator of that one line.                        │
 *   └──────────────────────────────────────────────────────────────────────┘
 *   • What do people want?      docs_component_viewed, component_code_viewed,
 *                               gallery_filtered, docs_searched (server) —
 *                               zero-result searches are a component request
 *                               in disguise.
 *   • Is the customizer worth   component_customized, customizer_reset,
 *     its complexity?           customized_link_shared. If nobody touches a
 *                               control, its config line can go.
 *   • Does the editor work?     editor_* — export failures are a bug report we
 *                               would otherwise never receive, because the user
 *                               just closes the tab.
 *   • Who will be there on      email_subscribed. The launch list is the largest
 *     launch day?               revenue channel in GTM_PLAN.md §3, and a list is
 *                               only warm if it started collecting months before
 *                               the ask. `source` says which surface earned it.
 *   • Community loop            showcase_submitted, signed_in.
 *
 * Deliberately NOT here: scroll depth, rage clicks, generic clicks, time on
 * page, and web vitals — PostHog's autocapture, `$pageleave` and web-vitals
 * config already record all of it. Hand-rolling them would be duplicate data
 * under a second name.
 *
 * Also not here: preview play/pause. Previews autoplay when they scroll into
 * view (`use-lazy-player.ts`), so a "played" event would measure scrolling
 * under a name that reads like intent — worse than not measuring it.
 */
export type CtaId =
  | "hero_browse"
  | "hero_ui_badge"
  | "showcase_card"
  | "github_header";

type AnalyticsEvents = {
  install_command_copied: {
    component: string;
    package_manager: "pnpm" | "npm" | "yarn" | "bun" | "prompt";
    surface: "docs" | "landing";
  };
  component_customized: {
    component: string;
    prop: string;
  };
  customized_link_shared: {
    component: string;
  };
  customizer_reset: {
    component: string;
  };
  cta_clicked: {
    cta: CtaId;
    destination: string;
  };
  docs_component_viewed: {
    component: string;
  };

  /**
   * Switched a component page to the Code tab. Reading the source before
   * installing is the shadcn-user behaviour that separates "browsing" from
   * "evaluating", and it is the strongest on-site predictor we have of a real
   * install short of the fetch itself.
   */
  component_code_viewed: {
    component: string;
  };
  /** Category pill on /docs/components. Tells us which shelf people shop. */
  gallery_filtered: {
    category: string | null;
  };

  /** Video editor. Opened, built, exported — the whole funnel of the one part
   * of this site that is an app rather than a document. */
  editor_opened: Record<string, never>;
  editor_clip_added: {
    component: string;
    clip_count: number;
  };
  editor_export_started: {
    clip_count: number;
  };
  editor_export_succeeded: {
    clip_count: number;
    /** Wall-clock from click to downloaded file — the number a user feels. */
    duration_ms: number;
  };
  editor_export_failed: {
    clip_count: number;
    reason: string;
  };

  /**
   * An address joined the launch list. Not a proxy for intent to buy — it is
   * the one channel we can reach again without paying for the reach twice.
   */
  email_subscribed: {
    /** Which surface earned it, so a launch mail can be split by intent. */
    source: string;
  };

  /**
   * Answers whether the editor produces submissions the paste-a-link form
   * never would — the two surfaces ask for very different amounts of work.
   */
  showcase_submitted: { source: "gallery" | "editor" };
  /**
   * Fired once per browser per account, at the moment `identifyUser` promotes
   * an anonymous visitor. No `provider` property: which OAuth button they used
   * is already a row in the `accounts` table, and a copy here would be a second
   * source of truth for a question the database answers exactly.
   */
  signed_in: Record<string, never>;
  /**
   * A sign-in prompt was opened. Paired with `signed_in` this is the conversion
   * of the whole auth gate, and `surface` says which ask does the work — the
   * header button, or the watermark badge in the editor where the reader has a
   * concrete reason to care. If one converts and the other does not, the ask
   * moves.
   */
  sign_in_opened: {
    surface: "header" | "editor_watermark";
  };
};

/**
 * Fire a typed event. Safe to call before PostHog has initialised and safe to
 * call when it is unconfigured — posthog-js queues, and an unconfigured build
 * simply drops. No call site needs a guard.
 */
export function useTrackEvent() {
  return useCallback(
    <E extends keyof AnalyticsEvents>(
      event: E,
      ...args: AnalyticsEvents[E] extends Record<string, never>
        ? []
        : [AnalyticsEvents[E]]
    ) => {
      posthog.capture(event, args[0] as Record<string, unknown> | undefined);
    },
    [],
  );
}

/**
 * Attach the signed-in identity to the person PostHog has been recording
 * anonymously, so their pre-signup browsing joins up with everything after.
 *
 * Self-guarding, because the only place that knows someone is signed in is a
 * server-rendered page that re-renders on every visit — there is no "on sign-in"
 * moment on the client to hook. `identify` merges the anonymous history the
 * first time and is wasted requests every time after, so compare against the id
 * PostHog is already using and return whether this call was the transition.
 * That boolean is the `signed_in` trigger.
 *
 * `get_distinct_id()` is safe before `init` (persistence is optional-chained),
 * so an unconfigured build takes this path without throwing.
 */
export function identifyUser(
  userId: string,
  properties?: { email?: string; name?: string },
): boolean {
  if (posthog.get_distinct_id() === userId) return false;
  posthog.identify(userId, properties);
  return true;
}

/** Clear the identity on sign-out so a shared machine doesn't merge two people. */
export function resetUser() {
  posthog.reset();
}
