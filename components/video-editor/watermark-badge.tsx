"use client";

import { Sparkles } from "lucide-react";
import { SignInButtons } from "@/components/showcase/sign-in-buttons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useTrackEvent } from "@/lib/analytics";
import type { AuthProviderId } from "@/lib/auth-providers";

/**
 * Says what the export will contain, and offers the one thing that changes it.
 *
 * Deliberately states the *current* fact ("Watermarked") rather than nagging
 * ("Remove the watermark!"): the reader is mid-task, and a status they can act
 * on reads better than a demand. Signed in, it stops being a control at all
 * and becomes a quiet confirmation — nobody needs a button for a thing that is
 * already true.
 *
 * The mark is not a nag either. A local `npx remotion render` of the same
 * component is unmarked forever, because the source is MIT and the reader owns
 * it; what this asks payment-in-signup for is *our* CPU. The copy says so,
 * because a limit whose reason is stated reads as fair and one that is not
 * reads as crippleware.
 */
export function WatermarkBadge({
  signedIn,
  providers,
  emailEnabled = false,
  removeWatermark,
  onRemoveWatermarkChange,
}: {
  signedIn: boolean;
  providers: AuthProviderId[];
  emailEnabled?: boolean;
  removeWatermark: boolean;
  onRemoveWatermarkChange: (next: boolean) => void;
}) {
  const trackEvent = useTrackEvent();

  // Signed in, the mark stays on until it is switched off. Signing in earns the
  // *choice*, not the outcome: silently changing what someone's export contains
  // because they logged in is a change they did not ask for and did not see.
  if (signedIn) {
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
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <Sparkles className="size-3.5" />
        Watermarked
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-medium text-foreground">
          Sign in for a clean export
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Rendering an MP4 runs Chromium on our machines, so the free export
          carries a small snapcn mark. Signing in removes it.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Rendering the same components locally with{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            npx remotion render
          </code>{" "}
          is never watermarked — that code is yours.
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
