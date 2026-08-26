"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { NavBadge } from "@/components/nav-badge";
import { SlidingHighlight } from "@/components/sliding-highlight";
import { SheetClose } from "@/components/ui/sheet";
import type { NavLink } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Desktop nav whose items behave like ghost buttons: a single rounded
 * background tracks the hovered (or keyboard-focused) item and glides from one
 * to the next instead of popping. Rendered once and animated via transform, so
 * moving between items reads as the same highlight sliding across the row.
 * Hidden below `sm`, where the header falls back to the mobile sheet.
 */
export function NavDesktop({
  links,
  className,
}: {
  links: NavLink[];
  className?: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const [highlight, setHighlight] = useState<{
    left: number;
    width: number;
  } | null>(null);

  // Measure the item relative to the nav so the pill can be positioned with a
  // transform (left:0 + translateX) rather than animating layout.
  const moveTo = (el: HTMLElement | null) => {
    const nav = navRef.current;
    if (!nav || !el) return;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setHighlight({ left: elRect.left - navRect.left, width: elRect.width });
  };

  return (
    <nav
      ref={navRef}
      onMouseLeave={() => setHighlight(null)}
      // Retract the pill once focus leaves the nav entirely (not while tabbing
      // between items), mirroring the mouse-leave behaviour for keyboard users.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHighlight(null);
        }
      }}
      className={cn("relative hidden items-center gap-0.5 sm:flex", className)}
    >
      <SlidingHighlight rect={highlight} />
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onMouseEnter={(event) => moveTo(event.currentTarget)}
          onFocus={(event) => moveTo(event.currentTarget)}
          className="relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          {link.label}
          {link.badge ? <NavBadge>{link.badge}</NavBadge> : null}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Mobile nav: just the stacked list of links rendered inside the header's
 * Sheet. The Sheet shell, GitHub stars, and the Get-started CTA stay with the
 * header; each link is a `SheetClose` so a tap closes the sheet before routing.
 */
export function NavMobile({ links }: { links: NavLink[] }) {
  return (
    <nav className="flex flex-col px-6 text-base">
      {links.map((link) => (
        <SheetClose
          key={link.href}
          render={
            <Link
              href={link.href}
              className="flex items-center gap-1.5 py-3 text-foreground/90 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
            />
          }
        >
          {link.label}
          {link.badge ? <NavBadge>{link.badge}</NavBadge> : null}
        </SheetClose>
      ))}
    </nav>
  );
}
