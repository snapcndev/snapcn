"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTrackEvent } from "@/lib/analytics";

type Status = "idle" | "sending" | "done" | "error";

/**
 * The list signup, as one form used by every surface that asks for an address.
 *
 * It lived inside the home page's `<Newsletter>` section, which meant the whole
 * capture — the fetch, the four states, the analytics call, the aria-live
 * announcement — existed on exactly one page. The docs are where the traffic
 * actually lands (thirty-seven component pages, each aimed at its own search),
 * and none of them asked for anything. Splitting the form out of the section is
 * what lets a second surface ask without a second copy of the request logic
 * drifting from this one.
 *
 * The section chrome — heading, sub-copy, animation — stays with each caller,
 * because a hero band and a docs footer want to look nothing alike.
 */
export function NewsletterForm({
  defaultSource,
  id = "newsletter-email",
  className,
  buttonLabel = "Join the list",
}: {
  /**
   * Where the address came from when the URL does not say. `?ref=` still wins:
   * the string every component prints after `shadcn add` links here with
   * `?ref=cli`, and that attribution is the only way to tell an address the CLI
   * won from one somebody scrolled to.
   */
  defaultSource: string;
  /** Unique per rendered instance — two forms on one page must not share a label. */
  id?: string;
  className?: string;
  buttonLabel?: string;
}) {
  const trackEvent = useTrackEvent();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  function source() {
    const ref = new URLSearchParams(window.location.search).get("ref");
    return ref && /^[a-z0-9-]{1,32}$/.test(ref) ? ref : defaultSource;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: source() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      trackEvent("email_subscribed", { source: source() });
      setStatus("done");
      setEmail("");
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className={className}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <Input
          id={id}
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
          {status === "sending" ? "Joining…" : buttonLabel}
        </Button>
      </form>

      {/* Announced, not just painted — the form is the only thing on the page
          whose result a screen reader cannot infer from what moved. */}
      <p
        aria-live="polite"
        className="mt-3 min-h-5 text-sm text-muted-foreground"
      >
        {status === "done" && "You're on the list."}
        {status === "error" && error}
      </p>
    </div>
  );
}
