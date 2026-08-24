"use client";

import { type ReactNode, useEffect, useState } from "react";
import { PanelToggleIcon } from "@/components/icons/panel-toggle";
import { cn } from "@/lib/utils";
import { GallerySidebar } from "./gallery-sidebar";

/**
 * Client layout frame for the gallery: a fixed, full-height sidebar beside a
 * scrollable content column. The « button collapses the sidebar (slides it
 * off-screen and reclaims its width so the grid reflows); a floating » button
 * reopens it. The sidebar width lives in the `--gallery-sidebar-w` CSS variable
 * so the content padding AND the detail overlay's left offset both follow one
 * value — the overlay always sits beside the sidebar, never over it.
 */
export function GalleryFrame({
  children,
  fill = false,
}: {
  children: ReactNode;
  /**
   * Hand the content column the exact viewport instead of a scrolling page.
   *
   * The video editor needs the same rail as every other `/docs/*` route — one
   * definition of the nav, one collapse control, one active-link rule — but it
   * is an application, not a document: it wants `h-dvh`, no prose gutters, and
   * its own internal scrolling. That is the only thing that differs, so it is a
   * flag here rather than a second frame that would drift from this one.
   */
  fill?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const root = document.documentElement.style;
    if (collapsed) {
      // Zero, so a closed sidebar leaves the content column with the same 32px
      // (`lg:px-8`) down both edges. Reserving a rail here instead put 80px on
      // the left against 32px on the right, which reads as the page having
      // slipped sideways.
      root.setProperty("--gallery-sidebar-w", "0px");
    } else {
      // Clear the override rather than re-stating the open width, so the
      // stylesheet's `--gallery-sidebar-w-open` stays the only place it lives.
      root.removeProperty("--gallery-sidebar-w");
    }
  }, [collapsed]);

  return (
    <>
      <GallerySidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Open sidebar"
          // Sized and placed to sit *inside* the content column's own 32px
          // gutter — 4px inset, 24px wide, 4px to spare — so it never reaches
          // the text. It used to be `left-4 size-8`, which spans 16–48px and put
          // it 16px over content that starts at 32px: the first glyph of every
          // heading rendered behind it ("Components" read as "omponents").
          //
          // Keep `4 + width + 4 = 32` if either number changes, or it either
          // collides again or stops looking centred in the gutter.
          className="fixed top-5 left-1 z-40 hidden size-6 items-center justify-center bg-background text-muted-foreground transition-colors hover:text-foreground lg:flex"
        >
          <PanelToggleIcon className="size-[18px]" />
        </button>
      ) : null}

      <div
        className={cn(
          "transition-[padding] duration-300 ease-out lg:pl-[var(--gallery-sidebar-w)]",
          fill ? "h-dvh overflow-hidden" : "min-h-screen",
        )}
      >
        {/* The 32px left gutter exists to house the reopen button above, and
            that button only exists when the rail is closed. With the rail open
            it was 32px of nothing between the rail's text and the first card —
            on top of the rail's own 20px of right padding. So: 16px while open,
            back to the button's 32px while collapsed. The right stays at 32px;
            that edge is the window, not a neighbour. */}
        {/* `main`, not a div: it is the content column of every docs and
            gallery route, and it was the one landmark the chrome never had.
            Lighthouse flags the absence (`landmark-one-main`), a screen reader
            has no "skip to content" target without it, and the extractors
            answer engines run on a page look for exactly this element to
            decide which half of the HTML is the article and which is the rail. */}
        <main
          className={cn(
            "transition-[padding] duration-300 ease-out",
            fill
              ? "h-full"
              : cn("px-6 lg:pr-8", collapsed ? "lg:pl-8" : "lg:pl-4"),
          )}
        >
          {children}
        </main>
      </div>
    </>
  );
}
