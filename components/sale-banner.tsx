"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTrackEvent } from "@/lib/analytics";
import { CATALOGUE_PRICE, EARLY_BIRD, earlyBirdDaysLeft } from "@/lib/plans";

const HREF = "/docs/pricing?ref=sale_banner#plans";

/**
 * The site-wide early-bird bar, above every page until `EARLY_BIRD.endsAt`.
 *
 * Decided on the client only: most pages are prerendered, and a deadline baked
 * into their HTML would outlive the deadline. Shown to everyone, owners
 * included, and not dismissible.
 */
export function SaleBanner() {
  const trackEvent = useTrackEvent();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || earlyBirdDaysLeft() === 0) return null;

  return (
    <div
      className="sticky top-0 z-40 flex h-(--fd-banner-height) items-center justify-center overflow-hidden px-4 text-center text-sm whitespace-nowrap text-white"
      style={{
        background:
          // The site's --primary (#3072db), lifted toward a lighter blue at the centre.
          "radial-gradient(45% 160% at 50% 50%, #5a92ea 0%, transparent 75%), radial-gradient(30% 140% at 85% 40%, #4a86e4 0%, transparent 70%), linear-gradient(90deg, #2458b0, #3072db 35%, #3072db 65%, #2458b0)",
      }}
    >
      {/* Sticky at a fixed height, published as `--fd-banner-height` — the
          variable fumadocs' own Banner sets. Everything fixed or sticky to
          the top (the gallery rail and its reopen button, the filter bars,
          the site header, the editor's viewport height) offsets by it, so
          nothing slides under the banner. */}
      <style>{":root { --fd-banner-height: 2.5rem; }"}</style>
      {/* Dot-matrix texture over the gradient, denser at the edges so the copy stays clean. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.35) 0.75px, transparent 1.25px)",
          backgroundSize: "6px 6px",
          maskImage:
            "linear-gradient(90deg, #000 0%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.25) 70%, #000 100%)",
        }}
      />
      <p className="relative">
        Early-bird pricing ends {EARLY_BIRD.endsOn}
        <span className="hidden sm:inline">
          {" "}
          — Pro is {CATALOGUE_PRICE.annual}/yr or {CATALOGUE_PRICE.lifetime}{" "}
          once until then
        </span>
        .{" "}
        <Link
          href={HREF}
          onClick={() =>
            trackEvent("cta_clicked", { cta: "sale_banner", destination: HREF })
          }
          className="ml-1 font-medium underline underline-offset-4"
        >
          Lock it in
        </Link>
      </p>
    </div>
  );
}
