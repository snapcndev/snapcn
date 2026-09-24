"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Absolutely-positioned highlight that glides to a target rect. Driven by transform
 * (left:0 + translateX) rather than animating layout, so it slides between
 * targets instead of popping. `rect={null}` retracts it (opacity 0). The parent
 * owns positioning context and measurement; this only renders the moving span.
 *
 * A CSS transition, not `motion/react`: this sits in the site header, so the
 * animation library was loading on every page of the site for one hover.
 * Retracted, it holds the last rect it had — it fades out where it was, and the
 * next hover slides from there rather than in from the left edge.
 */
export function SlidingHighlight({
  rect,
  className,
}: {
  rect: { left: number; width: number } | null;
  className?: string;
}) {
  const last = useRef(rect);
  if (rect) last.current = rect;
  const at = rect ?? last.current;

  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-0 top-0 -z-10 h-full rounded-md bg-muted transition-[translate,width,opacity] duration-150 ease-out motion-reduce:transition-none",
        className,
      )}
      style={{
        translate: `${at?.left ?? 0}px 0`,
        width: at?.width ?? 0,
        opacity: rect ? 1 : 0,
      }}
    />
  );
}
