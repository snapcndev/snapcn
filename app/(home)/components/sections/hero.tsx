"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ProBanner } from "@/components/pro-banner";
import { Button } from "@/components/ui/button";
import { useTrackEvent } from "@/lib/analytics";
import { FeaturedQuote } from "./featured-quote";

/**
 * `FadeUp`'s entrance (24px rise, 8px blur, 200ms ease-out), in CSS. `FadeUp`
 * server-renders at opacity 0 and waits for hydration to reveal, so the hero
 * text — the page's LCP element — stayed invisible until every chunk had loaded
 * and run: LCP 8.7s on Lighthouse mobile. A keyframe starts at first paint.
 * `backwards`, not `both`: nothing is held on the text once it lands.
 */
const RISE =
  "animate-in fade-in slide-in-from-bottom-6 blur-in-8 duration-200 ease-[cubic-bezier(0,0,0.58,1)] fill-mode-backwards motion-reduce:animate-none";

export function Hero({ proCount }: { proCount: number }) {
  const trackEvent = useTrackEvent();

  return (
    <section className="relative overflow-hidden pt-14 pb-4 sm:pt-20 sm:pb-6">
      {/* Theme-aware backdrop: dotted grid that fades out + a soft top glow. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fade" />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-muted),transparent_70%)] opacity-70" />
      </div>

      <div className="section">
        <div className="flex flex-col items-center text-center">
          <div className={RISE}>
            <FeaturedQuote className="mb-8" />
          </div>
          {/* simplifyingai.com's page-heading treatment, to the number: Saans at
              regular weight, `clamp(2.75rem, 6.5vw, 5.5rem)`, leading 1.05,
              tracking -0.03em. The size is fluid rather than stepped at a
              breakpoint, which is how that site scales all of its headings. */}
          <div className={`${RISE} delay-[60ms]`}>
            {/* This line used to read "Copy-paste Remotion components", chosen
                to compete head-on for the phrase our nearest competitor ranks
                for. That was the wrong fight, for a reason that only shows up
                when you look the competitor up: remocn predates us by ~4 months
                and has >1k stars. You do not out-rank an older, better-linked
                registry on its own phrase with a new domain — and to the part of
                the audience that has already seen it, an identical headline
                reads as a clone rather than an alternative. We lost the ranking
                and the credibility in one line.

                So the keywords move down rather than out. That is the same trade
                this file already made when "installed with the shadcn CLI" came
                off the h1: an h1 is a weak ranking signal next to the title tag
                and the body copy, and the sentence below carries "copy-paste",
                "Remotion" and "shadcn CLI" intact — every term the old headline
                held. What the h1 buys instead is the thing remocn cannot say:
                they are a general motion library, and we are the shots a
                *software* demo is made of.

                Keep this under ~32 characters. Past that it wraps to three rows
                of 5.5rem type, which is a headline you read rather than take in. */}
            <h1 className="mx-auto max-w-[16ch] text-pretty font-sans text-[clamp(2.75rem,6.5vw,5.5rem)] font-normal leading-[1.05] tracking-[-0.03em] text-foreground">
              Product demo videos, in React.
            </h1>
          </div>

          {/* `text-body-lg` at 70% of the foreground rather than a separate
              grey. The face is Saans, inherited from `html` like everything. */}
          <div className={`${RISE} delay-[120ms]`}>
            {/* Carries the search terms the h1 gave up — "copy-paste",
                "Remotion", "shadcn CLI" — and spends the rest of the sentence on
                the shot list, which is the part no other Remotion registry can
                claim. Naming the shots also does the demo's job for it: a reader
                who needs a terminal in a video recognises themselves here. */}
            <p className="mx-auto mt-6 max-w-xl text-pretty text-body-lg text-current/70">
              Copy-paste Remotion components for the shots a software demo is
              made of — streaming AI answers, terminals, device frames,
              captions. Install with the shadcn CLI; the code is yours.
            </p>
          </div>

          <div className={`${RISE} delay-[180ms]`}>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
              {/* The editor leads, and the ranking is measured rather than
                  chosen: of everyone who lands on the site, 24% open the editor
                  and 3.8% export a video from it, while the gallery's job ends
                  at a copied install command. Someone who has made a video has
                  understood the product in a way no component grid explains.
                  Browsing is still one click away for the reader who wants to
                  read code first. */}
              <Button
                size="lg"
                className="h-11 gap-2 px-6 text-sm"
                nativeButton={false}
                render={
                  <Link
                    href="/docs/video-editor"
                    onClick={() =>
                      trackEvent("cta_clicked", {
                        cta: "hero_editor",
                        destination: "/docs/video-editor",
                      })
                    }
                  />
                }
              >
                Make a video
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 gap-2 px-6 text-sm"
                nativeButton={false}
                render={
                  <Link
                    href="/docs/components"
                    onClick={() =>
                      trackEvent("cta_clicked", {
                        cta: "hero_browse",
                        destination: "/docs/components",
                      })
                    }
                  />
                }
              >
                Browse components
              </Button>
            </div>
          </div>

          <div className={`${RISE} delay-[240ms]`}>
            <ProBanner
              count={proCount}
              className="mt-6 rounded-2xl sm:rounded-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
