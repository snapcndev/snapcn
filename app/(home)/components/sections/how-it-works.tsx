"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CodeSnippet } from "../code-snippet";
import { FadeUp } from "../fade-up";

/**
 * Two panels on the left, a sticky index on the right that lights up whichever
 * one you are reading.
 *
 * ## Why the panels are code and not screenshots
 *
 * The reference this is modelled on screenshots its own editor, because its
 * product *is* an editor. snapcn has no app to photograph — what a reader
 * actually receives is a file in their repo. So the panel shows the file. It is
 * also the only "screenshot" here that can never go stale against the product,
 * because it is not a picture of the product, it is the product.
 *
 * Both snippets are real API — `Series`/`Series.Sequence` from Remotion, and
 * `useCurrentFrame`/`interpolate`/`spring`, which is what every component in the
 * registry is built on (see CLAUDE.md). Nothing here is pseudo-code, so nobody
 * can paste it and find out it was decoration.
 */
const COMPOSE_CODE = `import { Series } from "remotion";
import { LogoAssemble } from "@/components/snap-cn/logo-assemble";
import { TextReveal } from "@/components/snap-cn/text-reveal";

export function LaunchScene() {
  return (
    <Series>
      <Series.Sequence durationInFrames={90}>
        <LogoAssemble brand="Acme" logoSrc="/logo.png" />
      </Series.Sequence>

      <Series.Sequence durationInFrames={120}>
        <TextReveal text="Ship it this afternoon" fontSize={72} />
      </Series.Sequence>
    </Series>
  )
}`;

const ANIMATE_CODE = `import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export function FadeIn({ children }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const blur = interpolate(enter, [0, 1], [12, 0]);

  return (
    <div style={{ opacity: enter, filter: \`blur(\${blur}px)\` }}>
      {children}
    </div>
  )
}`;

const ENTRIES = [
  {
    id: "compose",
    title: "Compose",
    file: "launch-scene.tsx",
    blurb:
      "Scenes drop into a Remotion timeline like any other React component. Sequence them, set their durations, nest them inside each other — it is all just JSX, in your repo, under your name.",
    code: COMPOSE_CODE,
  },
  {
    id: "animate",
    title: "Animate",
    file: "fade-in.tsx",
    blurb:
      "No keyframe graphs and no timeline UI to learn. Every component is written straight onto the Remotion API — useCurrentFrame, interpolate, spring — so you can open one and change any number in it.",
    code: ANIMATE_CODE,
  },
] as const;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const panels = useRef<(HTMLElement | null)[]>([]);

  // Which panel the reader is actually on. The margins leave a band about a
  // tenth of the viewport tall across the middle — a reading line — and whatever
  // crosses it wins.
  //
  // Only ever *set* on intersect, never cleared: the gap between panels is
  // taller than the band, so clearing would blank the column between them and
  // light it again, which reads as a flicker rather than a hand-off.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isNaN(i)) setActive(i);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const el of panels.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // `overflow-x-clip`, because the panels below are pulled past the container's
    // left padding and would otherwise open a horizontal scrollbar on the page.
    <section
      id="how-it-works"
      className="relative overflow-x-clip pb-24 sm:pb-32"
    >
      <div className="section">
        <FadeUp>
          <h2 className="mx-auto max-w-[12ch] text-pretty text-center font-sans text-[clamp(2.25rem,4.6vw,3.5rem)] font-normal leading-[1.06] tracking-[-0.03em] text-foreground">
            Compose it, then animate it
          </h2>
        </FadeUp>

        <div className="mt-12 grid grid-cols-1 gap-12 sm:mt-16 lg:mt-24 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16 xl:gap-20">
          {/* `gap-36` on desktop is load-bearing: the sticky column only reads as
              tracking the page if one panel has clearly handed over to the next,
              and a tight stack puts both on the reading line at once. */}
          <div className="flex flex-col gap-16 lg:gap-36">
            {ENTRIES.map((entry, i) => (
              <article
                key={entry.id}
                data-index={i}
                ref={(el) => {
                  panels.current[i] = el;
                }}
              >
                {/* Flush to the left edge of the window from `lg` up: the
                    negative margin cancels `.section`'s padding at exactly the
                    breakpoint that sets it, and the left corners square off to
                    meet the edge. Below `lg` it keeps the gutter — code pinned to
                    a phone's left edge is unreadable, and that is the one thing
                    the panel exists to be. */}
                <CodeSnippet
                  label={entry.file}
                  code={entry.code}
                  className="lg:-ml-6 lg:rounded-l-none xl:-ml-[min(7vw,8rem)]"
                  bodyClassName="lg:pl-10 xl:pl-[max(1.5rem,min(7vw,8rem))]"
                />

                {/* Under each panel on mobile, where there is no room for a
                    column beside it — so the text is never orphaned. */}
                <div className="mt-6 lg:hidden">
                  <h3 className="font-sans text-[1.375rem] font-medium tracking-[-0.02em] text-foreground">
                    {entry.title}
                  </h3>
                  <p className="mt-2 text-pretty text-body-lg text-current/70">
                    {entry.blurb}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="relative hidden lg:block">
            <div className="sticky top-[26vh] flex flex-col">
              {ENTRIES.map((entry, i) => {
                const isActive = i === active;
                return (
                  <div
                    key={entry.id}
                    className="border-t border-border py-6 first:border-t-0 first:pt-0"
                  >
                    <h3
                      className={cn(
                        "font-sans text-[1.625rem] font-medium tracking-[-0.02em] transition-colors duration-300 ease-out",
                        isActive ? "text-foreground" : "text-current/40",
                      )}
                    >
                      {entry.title}
                    </h3>
                    {/* `0fr → 1fr` on a grid row, not a measured pixel height:
                        the paragraph collapses to nothing and expands to exactly
                        its own height, at any width, with no JS and no
                        ResizeObserver watching for a reflow. */}
                    <div
                      className="grid transition-all duration-300 ease-out"
                      style={{
                        gridTemplateRows: isActive ? "1fr" : "0fr",
                        opacity: isActive ? 1 : 0,
                      }}
                    >
                      <div className="overflow-hidden">
                        <p className="pt-3 text-pretty text-body-lg text-current/70">
                          {entry.blurb}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
