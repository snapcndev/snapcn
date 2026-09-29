"use client";

import type { PostHog } from "posthog-js";

/**
 * posthog-js, loaded after the page instead of with it.
 *
 * The SDK is ~75KB gzipped and was a static import of the root layout, so it
 * was in the first batch of scripts on every page — requested at the first
 * byte, alongside the fonts and the content, on a phone's shared bandwidth.
 * Lighthouse's mobile LCP counts every such request, and this was the largest
 * one that was not React itself. `app/posthog-provider.tsx` now imports it once
 * the page has loaded.
 *
 * Everything that talks to PostHog goes through `withPostHog`, which runs now
 * if the SDK is up and otherwise queues until it is — so an event fired during
 * hydration is sent, just a moment later. Only a visit that ends before `load`
 * goes unrecorded.
 */

let client: PostHog | null = null;
let disabled = false;
const pending: ((ph: PostHog) => void)[] = [];

export function withPostHog(fn: (ph: PostHog) => void): void {
  if (client) fn(client);
  else if (!disabled) pending.push(fn);
}

/** No key (a fork, a local checkout): every call becomes a no-op, not a queue. */
export function disablePostHog(): void {
  disabled = true;
  pending.length = 0;
}

/** Import the SDK, let `init` configure it, then drain the queue. Once. */
let started = false;
export function startPostHog(init: (ph: PostHog) => void): void {
  if (started) return;
  started = true;
  void import("posthog-js").then(({ default: ph }) => {
    init(ph);
    client = ph;
    for (const fn of pending.splice(0)) fn(ph);
  });
}
