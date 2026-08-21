"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTrackEvent } from "@/lib/analytics";
import { FadeUp } from "../fade-up";

type Status = "idle" | "sending" | "done" | "error";

/**
 * The launch list.
 *
 * A list is the only channel that can be reached twice without paying for the
 * reach again, and it is worthless if it starts on launch day — an address
 * collected in August is warm in October; one collected in October is a cold
 * blast. So this asks now, months before there is anything to sell.
 *
 * A re-submitted address is treated as success by the route, so nobody is told
 * off for signing up twice.
 */
export function Newsletter() {
  const trackEvent = useTrackEvent();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "home" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      trackEvent("email_subscribed", { source: "home" });
      setStatus("done");
      setEmail("");
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setStatus("error");
    }
  }

  return (
    <section id="newsletter" className="relative pb-20 sm:pb-28">
      <div className="section">
        <FadeUp>
          <h2 className="mx-auto max-w-[16ch] text-pretty text-center font-sans text-[clamp(2.25rem,4.6vw,3.5rem)] font-normal leading-[1.06] tracking-[-0.03em] text-foreground">
            Get the new components
          </h2>
        </FadeUp>

        <FadeUp delay={0.08}>
          <p className="mx-auto mt-4 max-w-[46ch] text-pretty text-center text-muted-foreground">
            New scenes, transitions and backgrounds as they ship. No more than
            one email a week, and never a sponsored one.
          </p>
        </FadeUp>

        <FadeUp delay={0.14}>
          <form
            onSubmit={onSubmit}
            className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <Input
              id="newsletter-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "sending"}
              className="flex-1"
            />
            <Button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Joining…" : "Join the list"}
            </Button>
          </form>
        </FadeUp>

        {/* Announced, not just painted — the form is the only thing on the page
            whose result a screen reader cannot infer from what moved. */}
        <p
          aria-live="polite"
          className="mt-3 min-h-5 text-center text-sm text-muted-foreground"
        >
          {status === "done" && "You're on the list."}
          {status === "error" && error}
        </p>
      </div>
    </section>
  );
}
