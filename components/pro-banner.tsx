"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PRO_ITEMS } from "@/config/site";
import { useOwnsCatalogue } from "@/hooks/use-owns-catalogue";
import { useTrackEvent } from "@/lib/analytics";
import {
  CATALOGUE_PRICE,
  CATALOGUE_PROMISE,
  EARLY_BIRD,
  earlyBirdDaysLeft,
  SEPTEMBER_BONUS,
  septemberBonusActive,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

const HREF = "/docs/pricing?ref=banner#plans";

/**
 * One line naming Pro, on the three pages most people see: the home hero, the
 * gallery and the editor. In the first half of September 74 of 2,175 visitors
 * reached pricing, and none of those three pages said Pro existed.
 *
 * Hidden from anyone who already owns it, and invisible (space kept) until the
 * session answers, so an owner never sees it flash. The dated parts are decided
 * only after that, on the client: the gallery is prerendered, and a deadline
 * baked into its HTML would outlive the deadline.
 */
export function ProBanner({ className }: { className?: string }) {
  const owns = useOwnsCatalogue();
  const trackEvent = useTrackEvent();
  if (owns) return null;

  const ready = owns === false;
  const early = ready && earlyBirdDaysLeft() > 0;
  const bonus = ready && septemberBonusActive();

  return (
    <Link
      href={HREF}
      onClick={() =>
        trackEvent("cta_clicked", { cta: "pro_banner", destination: HREF })
      }
      className={cn(
        "group flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border border-border bg-card px-4 py-2 text-center text-sm transition-colors duration-150 ease-out hover:bg-muted/60",
        !ready && "invisible",
        className,
      )}
    >
      <span className="rounded-full bg-primary px-2 py-0.5 font-semibold text-[0.6875rem] text-primary-foreground uppercase leading-[1.35] tracking-wide">
        Pro
      </span>
      <span className="text-foreground">
        {PRO_ITEMS.length} components, the MCP server and{" "}
        {CATALOGUE_PROMISE.templates} templates — {CATALOGUE_PRICE.annual}/yr
        {early ? ` until ${EARLY_BIRD.endsOnShort}` : ""}
      </span>
      {bonus ? (
        <span className="text-muted-foreground">
          · Free Commercial licence by {SEPTEMBER_BONUS.endsOnShort}
        </span>
      ) : null}
      <ArrowRight
        aria-hidden
        className="size-3.5 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5"
      />
    </Link>
  );
}
