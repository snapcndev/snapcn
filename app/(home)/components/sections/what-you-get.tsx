import Link from "next/link";
import { INSTALL_COMMAND } from "@/config/site";
import type { CategoryId } from "@/lib/gallery-data";
import {
  CATEGORY_ICONS,
  FREE_CATEGORIES,
  GALLERY_COUNT,
  GALLERY_ITEMS,
} from "@/lib/gallery-data";
import { FadeUp } from "../fade-up";

/**
 * The page's answer to "what is this", in prose a machine can quote.
 *
 * Everything above this section is a picture or a button. A crawler — and, more
 * to the point, an assistant summarising snapcn for somebody who asked it what
 * to use for a Remotion demo — had one sentence of the hero to go on. This is
 * the paragraph that gets quoted, so it says the whole thing plainly: registry,
 * CLI, the file lands in your repo, no package.
 *
 * The category list is also the only place on the landing page that links into
 * the seven docs categories. Those pages are where the long-tail traffic lands
 * ("remotion text animation", "remotion captions"); a home page that links to
 * none of them hands them no authority at all.
 *
 * Counts come from `GALLERY_ITEMS`, never from a number typed here — same rule
 * the gallery's own top bar follows.
 */
const COUNTS = GALLERY_ITEMS.reduce<Record<string, number>>((acc, item) => {
  acc[item.category] = (acc[item.category] ?? 0) + 1;
  return acc;
}, {});

/**
 * One line per category, written as the sentence somebody would type into a
 * search box — "text reveals", "karaoke captions", "phone and laptop mockups" —
 * rather than as a category blurb. The label above it is already the abstract
 * noun; this is the concrete one.
 */
const BLURBS: Record<CategoryId, string> = {
  text: "Text reveals, word flips, kinetic titles and highlight sweeps — the type animations a product video opens on.",
  captions:
    "Word-by-word and karaoke captions, timed against your audio, for the vertical cuts that get watched on mute.",
  logos:
    "Logo stings: an assemble that snaps your mark together, and a flicker for the sign-on shot.",
  screens:
    "Phone, laptop and terminal mockups to put your actual product on screen without opening a design tool.",
  charts:
    "Scatter plots, unit charts and figures that count up to the number, for the metrics beat.",
  social:
    "Follower and metric counters that rush up to a number, for the social proof beat.",
  scenes:
    "Whole compositions — hero launch, orbit gallery, moodboard reveal — assembled from the primitives above.",
  "ai-input":
    "Prompt typing, answer streaming and prompt zooms, for demoing an AI product's actual interaction.",
};

export function WhatYouGet() {
  return (
    <section id="what-you-get" className="relative pb-20 sm:pb-28">
      <div className="section">
        <FadeUp>
          <h2 className="mx-auto max-w-[18ch] text-pretty text-center font-sans text-[clamp(2.25rem,4.6vw,3.5rem)] font-normal leading-[1.06] tracking-[-0.03em] text-foreground">
            A shadcn registry, for video
          </h2>
          <div className="mx-auto mt-5 max-w-2xl space-y-4 text-pretty text-center text-body-lg text-current/70">
            <p>
              snapcn is a registry of {GALLERY_COUNT} Remotion components for
              React video. You run{" "}
              <code className="font-mono text-[0.9em] text-foreground">
                {INSTALL_COMMAND}
              </code>
              , the source file lands in{" "}
              <code className="font-mono text-[0.9em] text-foreground">
                components/snap-cn/
              </code>
              , and you edit it like code you wrote yourself.
            </p>
            <p>
              Nothing is added to your{" "}
              <code className="font-mono text-[0.9em] text-foreground">
                package.json
              </code>
              . There is no snapcn runtime, no version to pin and no upgrade
              that can change your video the week before you ship it. Every
              component is written against the plain Remotion API —{" "}
              <code className="font-mono text-[0.9em] text-foreground">
                useCurrentFrame()
              </code>
              ,{" "}
              <code className="font-mono text-[0.9em] text-foreground">
                interpolate()
              </code>{" "}
              and{" "}
              <code className="font-mono text-[0.9em] text-foreground">
                spring()
              </code>{" "}
              — so the file you own is a file you can read.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.08}>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FREE_CATEGORIES.map(({ id, label }) => {
              const Icon = CATEGORY_ICONS[id];
              return (
                <li key={id} className="bg-background">
                  <Link
                    href={`/docs/${id}`}
                    className="flex h-full flex-col gap-2 p-6 transition-colors hover:bg-muted/60"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 text-current/50" aria-hidden />
                      <h3 className="text-base font-medium text-foreground">
                        {label}
                      </h3>
                      <span className="text-sm text-current/40">
                        {COUNTS[id] ?? 0}
                      </span>
                    </span>
                    <p className="text-sm leading-relaxed text-pretty text-current/70">
                      {BLURBS[id]}
                    </p>
                  </Link>
                </li>
              );
            })}
            <li className="bg-background">
              <Link
                href="/docs/components"
                className="flex h-full flex-col gap-2 p-6 transition-colors hover:bg-muted/60"
              >
                <h3 className="text-base font-medium text-foreground">
                  All {GALLERY_COUNT} components →
                </h3>
                <p className="text-sm leading-relaxed text-pretty text-current/70">
                  The whole registry in one filterable grid, every card playing
                  its own scene in a real Remotion player.
                </p>
              </Link>
            </li>
          </ul>
        </FadeUp>
      </div>
    </section>
  );
}
