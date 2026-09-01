"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTrackEvent } from "@/lib/analytics";
import { startCheckout, type UpgradeProduct } from "@/lib/upgrade";
import { cn } from "@/lib/utils";

/**
 * The prices, as one list, read from the plan table rather than retyped.
 *
 * `lib/plans.ts` is dependency-free precisely so a pricing page can import it:
 * the export count and the resolution on a card are the same values the render
 * route enforces, so the page cannot drift from what someone actually gets.
 * Only the copy lives here.
 */
type Tier = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  product?: UpgradeProduct;
  /**
   * The same tier on a yearly cadence, offered under the main button rather
   * than behind a monthly/annual toggle.
   *
   * A toggle makes the reader do arithmetic before they can compare anything;
   * one line of small print under the price does not, and annual is the whole
   * answer to a subscription whose churn shows up in month two.
   */
  annual?: { product: UpgradeProduct; label: string };
  cta: string;
  featured?: boolean;
};

export function PricingPlans({
  tiers,
  signedIn,
  currentPlan,
}: {
  tiers: Tier[];
  signedIn: boolean;
  currentPlan: string;
}) {
  const trackEvent = useTrackEvent();
  const [pending, setPending] = useState<UpgradeProduct | null>(null);

  async function buy(product: UpgradeProduct) {
    if (pending) return;
    if (!signedIn) {
      // Checkout needs an account so the webhook has a user to attach the plan
      // to. Sending them to sign-in with a return path is one redirect; letting
      // them press Buy and hit a 401 is a dead end.
      window.location.href = `/signin?callbackUrl=${encodeURIComponent("/docs/pricing")}`;
      return;
    }
    setPending(product);
    trackEvent("upgrade_started", { from: "pricing" });
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
    // Column count follows the list rather than being pinned to it, so removing
    // or restoring a tier cannot leave a hole in the row.
    <div
      className={cn(
        "grid gap-4",
        tiers.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {tiers.map((tier) => {
        const current = tier.name.toLowerCase() === currentPlan;
        return (
          <div
            key={tier.name}
            className={cn(
              "flex flex-col rounded-xl border bg-card p-5",
              tier.featured && "border-primary shadow-sm",
            )}
          >
            <h2 className="font-medium text-sm">{tier.name}</h2>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="font-semibold text-3xl tracking-tight">
                {tier.price}
              </span>
              <span className="text-muted-foreground text-sm">
                {tier.cadence}
              </span>
            </p>
            <p className="mt-2 text-muted-foreground text-sm">{tier.blurb}</p>

            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {tier.product ? (
              <Button
                className="mt-5 w-full"
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
              <p className="mt-5 text-center text-muted-foreground text-xs">
                {current ? "Your plan" : tier.cta}
              </p>
            )}

            {tier.annual && !current && (
              <button
                type="button"
                onClick={() => buy(tier.annual!.product)}
                disabled={pending !== null}
                className="mt-2 cursor-pointer text-center text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline disabled:cursor-wait"
              >
                {pending === tier.annual.product
                  ? "Opening checkout…"
                  : tier.annual.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
