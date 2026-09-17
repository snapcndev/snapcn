"use client";

import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTrackEvent } from "@/lib/analytics";
import { startCheckout, type UpgradeProduct } from "@/lib/upgrade";
import { cn } from "@/lib/utils";

/**
 * The pricing cards — the Staged Pricing layout from Ruixen UI
 * (registry/ruixenui/staged-pricing.tsx): cards set in a hairline frame with
 * corner crosshairs, a large price, one bold line naming who the tier is for,
 * then the features.
 *
 * Ported class for class and resolved through snapcn's own tokens, so the
 * card radius lands on DESIGN.md's 10px rather than Ruixen's 22px and the
 * highlight is snapcn's accent rather than Ruixen's black. No billing toggle:
 * nothing here is sold monthly.
 */
type Tier = {
  name: string;
  price: string;
  /** Under the price: what the number buys, in time. */
  caption: string;
  /** The one bold line — who the tier is for. */
  audience: string;
  features: string[];
  /** A short chip beside the price. A fact about the price, never a boast. */
  badge?: string;
  product?: UpgradeProduct;
  /** Where a tier with nothing to buy sends people instead. */
  href?: string;
  /**
   * One line under the button, for a fact about the price rather than about the
   * plan — seats left, a dated rise. Not a feature: a feature is what you get,
   * and this is a reason to decide now.
   */
  note?: string;
  cta: string;
  featured?: boolean;
};

/**
 * Columns, and the breakpoint the frame appears at — the same one, because the
 * frame's vertical lines are placed on grid columns and mean nothing on a
 * single-column stack. Four tiers wait for `xl`: `/docs/pricing` sits beside a
 * 260px sidebar, and at `lg` four cards would be 160px wide.
 */
const LAYOUT: Record<number, { grid: string; frame: string }> = {
  2: { grid: "md:grid-cols-2", frame: "md:block" },
  3: { grid: "lg:grid-cols-3", frame: "lg:block" },
  4: { grid: "md:grid-cols-2 xl:grid-cols-4", frame: "xl:block" },
};

export function PricingPlans({
  tiers,
  signedIn,
  currentPlan,
  returnTo = "/docs/pricing",
  from = "pricing",
  footnote,
}: {
  tiers: Tier[];
  signedIn: boolean;
  currentPlan: string;
  /** Where sign-in sends them back to, so the buy button is still under them. */
  returnTo?: string;
  /** Which page the `upgrade_started` came from — `/pro` sells too. */
  from?: "pricing" | "pro_page";
  /** One line under the whole row — the regional prices. */
  footnote?: string;
}) {
  const trackEvent = useTrackEvent();
  const [pending, setPending] = useState<UpgradeProduct | null>(null);
  const layout = LAYOUT[tiers.length] ?? LAYOUT[4];

  async function buy(product: UpgradeProduct) {
    if (pending) return;
    if (!signedIn) {
      // Checkout needs an account so the webhook has a user to attach the plan
      // to. Sending them to sign-in with a return path is one redirect; letting
      // them press Buy and hit a 401 is a dead end.
      window.location.href = `/signin?callbackUrl=${encodeURIComponent(returnTo)}`;
      return;
    }
    setPending(product);
    trackEvent("upgrade_started", { from });
    try {
      await startCheckout(product);
    } catch (err) {
      setPending(null);
      toast.error(
        err instanceof Error ? err.message : "Couldn't start checkout.",
      );
    }
  }

  return (
    <div>
      <div className={cn("relative grid grid-cols-1 gap-6", layout.grid)}>
        <FrameLines columns={tiers.length} visible={layout.frame} />
        {tiers.map((tier) => {
          const current = tier.name.toLowerCase() === currentPlan;
          const ctaClass = "h-11 w-full rounded-xl text-base lg:h-9 lg:text-sm";
          return (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col justify-between rounded-3xl border bg-card px-[23px] pt-[21px] pb-[23px] shadow-[var(--shadow-card)]",
                tier.featured
                  ? "border-primary/40 ring-4 ring-primary/10"
                  : "border-border",
              )}
            >
              <div className="flex flex-col">
                <h2 className="text-muted-foreground text-xl">{tier.name}</h2>

                <div className="mt-4 lg:mt-8">
                  <div className="flex items-start gap-2">
                    {/* Stepped down for long regional prices — "₫1,249,000"
                        at 48px is wider than the card. */}
                    <span
                      className={cn(
                        "whitespace-nowrap font-semibold text-foreground tracking-tight",
                        tier.price.length <= 5
                          ? "text-5xl"
                          : tier.price.length <= 7
                            ? "text-4xl"
                            : "text-3xl",
                      )}
                    >
                      {tier.price}
                    </span>
                    {tier.badge && (
                      <span className="mt-[6px] inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border border-primary/20 bg-primary/10 px-[7px] py-[3px] font-medium text-primary text-xs">
                        {tier.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {tier.caption}
                  </p>
                </div>

                <p className="mt-5 text-pretty font-semibold text-foreground text-sm lg:mt-8">
                  {tier.audience}
                </p>

                <ul className="mt-2.5 flex flex-col gap-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Check className="size-3.5" strokeWidth={2.5} />
                      </span>
                      <span className="text-pretty text-muted-foreground text-sm">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex flex-col items-stretch lg:mt-8">
                {tier.product ? (
                  <Button
                    className={ctaClass}
                    variant={tier.featured ? "default" : "outline"}
                    disabled={current || pending !== null}
                    onClick={() => buy(tier.product as UpgradeProduct)}
                  >
                    {pending === tier.product && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {current ? "Your plan" : tier.cta}
                  </Button>
                ) : (
                  <Link
                    href={tier.href ?? "/docs/components"}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      ctaClass,
                    )}
                  >
                    {current ? "Your plan" : tier.cta}
                  </Link>
                )}
                {/* Always rendered, so a card without a note keeps its button
                    level with the cards that have one. */}
                <p className="mt-2 min-h-4 text-center text-muted-foreground text-xs">
                  {tier.note}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {footnote && (
        <p className="mt-10 text-center text-muted-foreground text-xs">
          {footnote}
        </p>
      )}
    </div>
  );
}

/** A 7px plus at a corner of the frame. */
function Crosshair({ className }: { className: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute", className)}>
      <div className="relative size-[7px]">
        <div className="absolute top-[3px] left-0 h-px w-full rounded-full bg-foreground/40" />
        <div className="absolute top-0 left-[3px] h-full w-px rounded-full bg-foreground/40" />
      </div>
    </div>
  );
}

/**
 * The frame: a hairline 12px above and below the row, one down every column
 * boundary running 48px past it, each fading out at its ends, and a crosshair
 * where the outer lines meet. Decoration only — hidden from assistive tech and
 * below the breakpoint where the grid has its full column count.
 */
function FrameLines({
  columns,
  visible,
}: {
  columns: number;
  visible: string;
}) {
  const across =
    "pointer-events-none absolute left-0 col-span-full hidden h-px w-full bg-[linear-gradient(to_right,transparent_0%,var(--color-border)_6.5%,var(--color-border)_93.5%,transparent_100%)]";
  return (
    <>
      <div
        aria-hidden
        className={cn(across, "-top-3 -translate-y-1/2", visible)}
      />
      <div
        aria-hidden
        className={cn(across, "-bottom-3 translate-y-1/2", visible)}
      />
      {Array.from({ length: columns + 1 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed, positional lines
          key={i}
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-12 -bottom-12 hidden w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--color-border)_11%,var(--color-border)_89%,transparent_100%)]",
            i === columns
              ? "-right-3 translate-x-1/2"
              : "-left-3 -translate-x-1/2",
            visible,
          )}
          style={{ gridColumnStart: i + 1 }}
        />
      ))}
      {[
        "-top-3 -left-3 -translate-x-1/2 -translate-y-1/2",
        "-top-3 -right-3 translate-x-1/2 -translate-y-1/2",
        "-right-3 -bottom-3 translate-x-1/2 translate-y-1/2",
        "-bottom-3 -left-3 -translate-x-1/2 translate-y-1/2",
      ].map((corner) => (
        <Crosshair key={corner} className={cn("hidden", corner, visible)} />
      ))}
    </>
  );
}
