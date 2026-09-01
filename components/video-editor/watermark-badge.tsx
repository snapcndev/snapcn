"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SignInButtons } from "@/components/showcase/sign-in-buttons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useTrackEvent } from "@/lib/analytics";
import type { AuthProviderId } from "@/lib/auth-providers";
import { startCheckout } from "@/lib/upgrade";

/**
 * Written once. The signed-out pill and the signed-in one are the same offer,
 * and a price that changes as someone signs in reads as a bait price.
 */
const STARTER_PRICE = "$19";
const REMOVE_LABEL = `Watermark — remove for ${STARTER_PRICE}/mo`;

/**
 * Says what the export will contain, and offers the one thing that changes it.
 *
 * Deliberately states the *current* fact rather than nagging: the reader is
 * mid-task, and a status they can act on reads better than a demand. What the
 * status is worth saying alongside is the price, in every state where the mark
 * is still on — this badge is the only place in the editor the paid tier is
 * ever mentioned, so a reader who never opens the pricing page learns here or
 * nowhere. Signed out it used to offer sign-in and claim that removed the mark;
 * since Starter exists that was simply false, and the funnel ended in a free
 * account that still exported marked.
 *
 * The mark is not a nag either. A local `npx remotion render` of the same
 * component is unmarked forever, because the source is MIT and the reader owns
 * it; what this charges for is *our* CPU. The copy says so, because a limit
 * whose reason is stated reads as fair and one that is not reads as
 * crippleware.
 */
export function WatermarkBadge({
  signedIn,
  canRemoveWatermark,
  providers,
  emailEnabled = false,
  removeWatermark,
  onRemoveWatermarkChange,
}: {
  signedIn: boolean;
  canRemoveWatermark: boolean;
  providers: AuthProviderId[];
  emailEnabled?: boolean;
  removeWatermark: boolean;
  onRemoveWatermarkChange: (next: boolean) => void;
}) {
  const trackEvent = useTrackEvent();
  const [starting, setStarting] = useState(false);

  async function upgrade() {
    // Guarded because the checkout round trip is a network hop and this is a
    // button someone will click twice: two sessions is two chances to pay for
    // the same thing.
    if (starting) return;
    setStarting(true);
    trackEvent("upgrade_started", { from: "watermark_badge" });
    try {
      await startCheckout("starter");
      // No `setStarting(false)` on success — `startCheckout` navigates away,
      // and clearing the spinner first would flash the old label during the
      // page teardown.
    } catch (err) {
      setStarting(false);
      toast.error(
        err instanceof Error ? err.message : "Couldn't start checkout.",
      );
    }
  }

  // Signed in on a free plan: say so, and do not offer a switch. A toggle here
  // used to flip the preview clean and the server would still mark the file —
  // the export is decided by the plan in `app/api/render`, never by this
  // component — so the control was promising something it could not deliver.
  if (signedIn && !canRemoveWatermark) {
    return (
      <button
        type="button"
        onClick={upgrade}
        disabled={starting}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-muted py-1 pr-2.5 pl-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-wait sm:pr-3"
      >
        {starting ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Sparkles className="size-3" />
        )}
        <span className="hidden sm:inline">
          {starting ? "Opening checkout…" : REMOVE_LABEL}
        </span>
        <span className="sm:hidden">Mark</span>
      </button>
    );
  }

  // On a plan that allows it, the mark stays on until it is switched off. Paying
  // earns the *choice*, not the outcome: silently changing what someone's export
  // contains is a change they did not ask for and did not see.
  if (canRemoveWatermark) {
    return (
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-muted py-1 pr-2.5 pl-2 text-xs font-medium text-muted-foreground sm:pr-3 sm:pl-2.5">
        <Switch
          checked={!removeWatermark}
          onCheckedChange={(on) => onRemoveWatermarkChange(!on)}
          aria-label="snapcn watermark"
          className="scale-75"
        />
        <span className="hidden sm:inline">
          {removeWatermark ? "No watermark" : "Watermark"}
        </span>
        <span className="sm:hidden">Mark</span>
      </label>
    );
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) trackEvent("sign_in_opened", { surface: "editor_watermark" });
      }}
    >
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-2.5 pl-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:pr-3">
        <Sparkles className="size-3" />
        <span className="hidden sm:inline">{REMOVE_LABEL}</span>
        <span className="sm:hidden">Mark</span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-medium text-foreground">
          Remove the watermark — {STARTER_PRICE}/mo
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Rendering an MP4 runs Chromium on our machines, so the free export
          carries a small snapcn mark at 720p. Starter drops the mark and
          renders at 1080p.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Rendering the same components locally with{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            npx remotion render
          </code>{" "}
          is never watermarked — that code is yours.
        </p>

        <p className="mt-3 text-sm text-muted-foreground">
          Checkout attaches the plan to whoever paid, so it starts with an
          account. The price is on this badge again once you are back.
        </p>

        <div className="mt-4">
          <SignInButtons
            providers={providers}
            emailEnabled={emailEnabled}
            callbackUrl="/docs/video-editor"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
