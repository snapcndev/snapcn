"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sun ⇄ moon as one disc with a bite taken out of it.
 *
 * A second circle rides inside a mask: parked off the canvas the disc is whole
 * (a sun), slid over the top-right corner it carves the disc into a crescent.
 * Nothing cross-fades, so there is never a frame with two icons half-visible in
 * it — the same mark just changes shape.
 *
 * Written here rather than pulled from a library: the mask is four numbers, and
 * the packaged versions of this effect ship attribution strings that would then
 * have to live in this file forever.
 *
 * Moved with transforms, not animated attributes: the bite slides by a
 * `translate` and the disc grows by a `scale` about its centre. This was
 * `motion/react` animating `cx`/`r`, and the toggle is in the header — so the
 * animation library loaded on every page of the site for two circles.
 *
 * Animated with the Web Animations API, not a CSS transition, and that is not a
 * preference: the theme switch runs with next-themes' `disableTransitionOnChange`,
 * which puts `transition: none !important` on every element for the duration of
 * the switch — the one moment this has to move. A transition snapped; an
 * animation is not a transition, so it plays.
 */
const MOVE = {
  duration: 350,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

const BITE = { dark: "translate(-21px, 19px)", light: "none" };
const DISC = { dark: "none", light: `scale(${9 / 11})` };

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Two toggles can be mounted at once (header and mobile sheet). A shared mask
  // id would have the second one clipping against the first one's mask.
  const mask = useId();

  // Avoid hydration mismatch — theme is only known on the client.
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  const bite = useRef<SVGCircleElement>(null);
  const disc = useRef<SVGCircleElement>(null);
  // The theme the mark last showed, once the real one is known. The first
  // answer after mount is not a switch — it is the page arriving in the theme
  // it was in — so it sets the mark without moving it.
  const shown = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (!mounted) return;
    const from = shown.current;
    shown.current = isDark;
    if (from === null || from === isDark) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const was = from ? "dark" : "light";
    const now = isDark ? "dark" : "light";
    bite.current?.animate(
      [{ transform: BITE[was] }, { transform: BITE[now] }],
      MOVE,
    );
    disc.current?.animate(
      [{ transform: DISC[was] }, { transform: DISC[now] }],
      MOVE,
    );
  }, [isDark, mounted]);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        !mounted
          ? "Toggle theme"
          : isDark
            ? "Switch to light theme"
            : "Switch to dark theme"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        // No plate on hover. The mark is the affordance — it swaps shape on
        // click — and a filled square appearing behind an 18px disc was heavier
        // than the thing it was highlighting. Feedback is the mark itself
        // lifting to full contrast.
        "size-11 text-foreground/70 hover:bg-transparent hover:text-foreground dark:hover:bg-transparent",
        className,
      )}
    >
      <svg
        viewBox="0 0 32 32"
        className="size-[2.25rem]"
        fill="currentColor"
        aria-hidden="true"
      >
        <mask id={mask}>
          <rect width="32" height="32" fill="#fff" />
          {/* Parked off the canvas at (44, -10); over the corner at (23, 9). */}
          <circle
            ref={bite}
            cx="44"
            cy="-10"
            r="11"
            fill="#000"
            style={{ transform: isDark ? BITE.dark : BITE.light }}
          />
        </mask>
        {/* r 9 → 11, as a scale about the disc's own centre. */}
        <circle
          cx="16"
          cy="16"
          r="11"
          ref={disc}
          mask={`url(#${mask})`}
          style={{
            transformOrigin: "16px 16px",
            transform: isDark ? DISC.dark : DISC.light,
          }}
        />
      </svg>
    </Button>
  );
}
