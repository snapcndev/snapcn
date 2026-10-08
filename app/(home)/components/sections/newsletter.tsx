import { NewsletterForm } from "@/components/newsletter-form";
import { FadeUp } from "../fade-up";

/**
 * The launch list.
 *
 * A list is the only channel that can be reached twice without paying for the
 * reach again, and it is worthless if it starts on launch day — an address
 * collected in August is warm in October; one collected in October is a cold
 * blast. So this asks now, months before there is anything to sell.
 *
 * The form itself is `<NewsletterForm>`, shared with the docs footer. This file
 * is now only the band: the heading, the promise, and the animation. A
 * re-submitted address is treated as success by the route, so nobody is told
 * off for signing up twice.
 *
 * No longer a client component — nothing here holds state, so the interactive
 * half is the only thing that ships as JS.
 */
export function Newsletter() {
  return (
    <section id="newsletter" className="relative pb-20 sm:pb-28">
      <div className="section">
        <FadeUp>
          {/* A closed panel, not loose text: the copy on the left, the one
              thing to do on the right, so it reads as the page's last ask. */}
          <div className="relative overflow-hidden rounded-[1.25rem] border border-border/60 bg-card px-6 py-10 sm:px-12 sm:py-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary/15 blur-3xl"
            />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
              <div>
                <h2 className="max-w-[16ch] text-pretty font-sans text-[clamp(2rem,3.6vw,3rem)] font-normal leading-[1.06] tracking-[-0.03em] text-foreground">
                  Get the pro components first
                </h2>
                <p className="mt-4 max-w-[46ch] text-pretty text-muted-foreground">
                  Pro components and an agent that assembles a whole video for
                  you are what comes next — this is the list that gets them
                  first. New free components as they ship, one email a week at
                  most, and never a sponsored one.
                </p>
              </div>
              <NewsletterForm
                defaultSource="home"
                className="w-full [&_button]:h-11 [&_button]:px-5 [&_input]:h-11 [&_input]:bg-background"
              />
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
