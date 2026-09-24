"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Rise into place the first time a fifth of it is on screen: 24px, from an 8px
 * blur, over 200ms ease-out.
 *
 * A CSS transition and one IntersectionObserver. This was `motion/react`, which
 * put the whole animation library on the home page for a fade — and imported
 * its easing from `config/site`, which carried the registry JSON with it.
 * Reduced motion shows the content where it lands, with nothing to wait for.
 */
export function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Seconds. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,translate,filter] duration-200 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-none motion-reduce:transition-none",
        shown
          ? "translate-y-0 opacity-100 blur-none"
          : "translate-y-6 opacity-0 blur-[8px]",
        className,
      )}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
