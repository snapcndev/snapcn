"use client";

import type { ReactNode } from "react";
import { useScroll } from "@/hooks/use-scroll";
import { cn } from "@/lib/utils";

/**
 * The bar recedes rather than announcing itself: nothing at all at the top of
 * the page, and blurred background — no rule — once there is content behind it
 * to separate from. The blur alone does that job; a hairline across the full
 * width just draws a line under the logo. It used to collapse into a floating
 * rounded island with its own shadow, which put a second, competing surface on a
 * page whose loudest element is a full-bleed wall of video.
 *
 * Width comes from `.section`, the same container the page content uses, so the
 * logo sits on the same left edge as the copy below it instead of nearly on it.
 */
export function StickyHeaderShell({ children }: { children: ReactNode }) {
  const scrolled = useScroll();

  return (
    <header
      className={cn(
        "sticky inset-x-0 top-[var(--fd-banner-height,0px)] z-40 transition-colors duration-200 ease-out",
        scrolled && "bg-background/80 backdrop-blur-xl",
      )}
    >
      <div className="section flex h-14 items-center justify-between gap-6">
        {children}
      </div>
    </header>
  );
}
