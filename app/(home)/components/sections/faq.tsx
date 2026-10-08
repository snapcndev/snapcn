import { ChevronDown } from "lucide-react";
import { GITHUB_URL, INSTALL_COMMAND } from "@/config/site";
import { GALLERY_COUNT } from "@/lib/gallery-data";
import { FadeUp } from "../fade-up";

/**
 * ## Why `<details>` and not the Accordion in `components/ui`
 *
 * A Radix-style accordion unmounts its panel when it is closed. Everything
 * written below would then be absent from the HTML a crawler receives, and the
 * one section on this page written specifically to be quoted would be the one
 * section nothing can read. `<details>` keeps its content in the DOM, opens
 * without a byte of JavaScript, and is what a browser's own find-in-page
 * expands. Rung 4: the platform already does this.
 *
 * ## Why the answers are plain strings
 *
 * They are rendered here *and* serialised into the FAQPage JSON-LD on the home
 * page. One array, both consumers — an answer cannot say one thing to a reader
 * and another to a crawler, because there is only one of it.
 *
 * Questions are phrased the way somebody types them ("Do I need Remotion
 * first?"), not the way a marketing page words them ("Prerequisites"). The
 * question *is* the query.
 */
export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What is snapcn?",
    a: `snapcn is a shadcn-style registry of ${GALLERY_COUNT} Remotion components for React video — text animations, captions, logo stings, device mockups and full scenes. You install one with the shadcn CLI and the source file is copied into your project, exactly the way shadcn/ui works for interface components.`,
  },
  {
    q: "Do I need Remotion installed first?",
    a: "Yes. snapcn does not bootstrap a video project — npx create-video@latest does that. Once you have a Remotion project with a components.json, snapcn installs into it like any other shadcn registry.",
  },
  {
    q: "How do I install a snapcn component?",
    a: `Run ${INSTALL_COMMAND}. The component is written to components/snap-cn/ (or wherever your components.json points), along with anything it depends on, and every prop but the words you are animating is defaulted, so it renders the moment you mount it in a composition.`,
  },
  {
    q: "Is snapcn free?",
    a: "Yes. Every component is MIT licensed, the whole registry is on GitHub, and there is no account, no key and no paid tier to install any of it.",
  },
  {
    q: "Can I edit a component after installing it?",
    a: "That is the point. The file is yours — not a dependency you configure through props somebody else chose. It is ordinary Remotion built on useCurrentFrame, interpolate and spring, so changing a duration means changing a number in a file you can read.",
  },
  {
    q: "How is this different from an npm animation package?",
    a: "A package puts the animation behind a version number: you get what its author shipped, you upgrade on their schedule, and a patch release can change your video after you signed it off. A registry copies the code in once. There is no snapcn in your package.json at all.",
  },
  {
    q: "Does it work in a project without Tailwind?",
    a: "Yes. The components carry their own styles inline through a theme prop rather than through utility classes, because CSS custom properties do not survive a Remotion render. They look the same in a Tailwind project and in one that has never seen it.",
  },
  {
    q: "Does it render to MP4?",
    a: "Yes — the component that plays in the browser preview is the one that goes into the file. Because the output is ordinary Remotion, anything that renders a Remotion project renders these: npx remotion render, the SSR APIs, or Remotion Lambda.",
  },
  {
    q: "Does it work with Claude Code and other AI agents?",
    a: "snapcn ships an agent skill — the component catalog with props and durations, the motion-design rules, and the anti-patterns — installable with npx skills add snapcndev/snapcn. Your agent then picks the right component and budgets the timeline without you pasting context every time.",
  },
];

/**
 * Two columns, after ruixen.com's FAQ: the heading, a line of context and the
 * way out (an issue) on the left; the questions on the right. A single centred
 * column of nine closed rows read as a wall of lines with nothing to anchor it.
 */
export function Faq() {
  return (
    <section id="faq" className="relative pb-20 sm:pb-28">
      <div className="section">
        <FadeUp>
          <div className="grid gap-10 md:grid-cols-5 md:gap-16">
            <div className="md:sticky md:top-24 md:col-span-2 md:self-start">
              <h2 className="text-pretty font-sans text-[clamp(2.25rem,4.6vw,3.5rem)] font-normal leading-[1.06] tracking-[-0.03em] text-foreground">
                Before you install
              </h2>
              <p className="mt-5 max-w-sm text-pretty leading-relaxed text-current/70">
                The questions people ask before they run the CLI — what it
                needs, what it costs, and what you own afterwards.
              </p>
              <p className="mt-4 max-w-sm text-pretty text-sm text-current/60">
                Something not here?{" "}
                <a
                  href={`${GITHUB_URL}/issues`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Open an issue on GitHub
                </a>
                .
              </p>
            </div>

            <div className="border-t border-border md:col-span-3">
              {FAQ_ITEMS.map(({ q, a }) => (
                <details key={q} className="group border-b border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                    <h3 className="font-medium">{q}</h3>
                    <ChevronDown
                      className="size-4 shrink-0 text-current/40 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="pb-5 pr-8 text-pretty leading-relaxed text-current/70">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
