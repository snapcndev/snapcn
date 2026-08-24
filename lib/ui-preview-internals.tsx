"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { PlayIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Img } from "remotion";
import type { PreviewBackdropFill } from "@/lib/customizer-config";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * Shared internals for the docs preview widgets. Extracted verbatim from
 * `components/docs/component-preview.tsx` so both the original `ComponentPreview`
 * (animation tier) and the `UiComponentPreview` (ui tier) consume one
 * implementation — no copy-paste drift on the shared path.
 *
 * `getDefaults` already lives in `lib/customizer-config.ts`; reuse it from there.
 */

/**
 * `buildParsers` now lives in `lib/customizer-params.ts` — it needs no Remotion,
 * and importing it from here dragged the player into bundles that never mounted
 * one. Re-exported so existing callers are unchanged.
 */
export { buildParsers } from "@/lib/customizer-params";

/**
 * D2 — lazy-mount the Remotion player. Until the stage enters the viewport
 * (IntersectionObserver) or the user clicks the poster, render a labeled
 * poster button that exactly matches the Suspense fallback dimensions, so the
 * live Player swaps in with zero layout shift.
 *
 * Timing fields are passed flat (durationInFrames/fps/compositionWidth/
 * compositionHeight) so the caller can source them from either the registry
 * config (animation tier) or the example entry (ui tier — D2: example owns
 * timing).
 */
export function PreviewStage({
  name,
  Component,
  inputProps,
  durationInFrames,
  fps,
  compositionWidth,
  compositionHeight,
  previewBackdrop,
}: {
  /** Human label, for the poster's accessible name. */
  name: string;
  Component: React.ComponentType<any>;
  inputProps: Record<string, unknown>;
  durationInFrames: number;
  fps: number;
  compositionWidth: number;
  compositionHeight: number;
  previewBackdrop?: PreviewBackdropFill;
}) {
  const [mounted, setMounted] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (mounted) return;
    const el = frameRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  // Reliable autoplay. The `<Player autoPlay>` prop mounts a tick before its
  // imperative handle is ready (worse under Strict Mode's dev double-mount), so
  // it shows the "playing" UI but the frame loop never starts — the preview
  // looks frozen until a manual pause/play. Instead the Player mounts paused and
  // we drive play() via the ref on the next animation frame, retrying once if
  // the first call didn't take. Mirrors stars/hooks/use-player-controls.ts.
  useEffect(() => {
    if (!mounted) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      playerRef.current?.play();
      raf2 = requestAnimationFrame(() => {
        if (playerRef.current && !playerRef.current.isPlaying()) {
          playerRef.current.play();
        }
      });
    });
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [mounted]);

  const Composition = useMemo(() => {
    if (!previewBackdrop) return Component;
    const backdrop = previewBackdrop;
    const Wrapped = (p: Record<string, unknown>) => (
      <AbsoluteFill>
        {backdrop.type === "image" ? (
          <AbsoluteFill>
            <Img
              src={backdrop.src}
              style={{
                width: "100%",
                height: "100%",
                objectFit: backdrop.fit ?? "cover",
              }}
            />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill style={{ background: backdrop.value }} />
        )}
        <Component {...p} />
      </AbsoluteFill>
    );
    return Wrapped;
  }, [Component, previewBackdrop]);

  return (
    <div
      ref={frameRef}
      // Slightly shorter than 16:9 so the player takes a touch less vertical
      // space. Compositions are a strict 1280×720 (16:9), so the Player letterboxes
      // the small delta against the surface-card background while staying full-width
      // and aligned with the tabs/customize panel. The Suspense fallback above uses
      // the same ratio to keep zero layout shift.
      className="surface-card aspect-video w-full overflow-hidden rounded-2xl"
    >
      {mounted ? (
        <div
          className={cn(
            "size-full",
            !reducedMotion && "animate-in fade-in duration-300 ease-out",
          )}
        >
          <Player
            ref={playerRef}
            component={Composition}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={compositionWidth}
            compositionHeight={compositionHeight}
            style={{ width: "100%", height: "100%" }}
            controls
            loop
            acknowledgeRemotionLicense
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMounted(true)}
          aria-label={`Play preview of ${name}`}
          className={cn(
            "group flex size-full items-center justify-center bg-muted/40 transition-colors",
            "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-background/80 text-foreground transition-colors group-hover:bg-background">
            <PlayIcon className="size-5 translate-x-px fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
