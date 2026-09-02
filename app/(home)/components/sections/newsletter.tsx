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
          <h2 className="mx-auto max-w-[16ch] text-pretty text-center font-sans text-[clamp(2.25rem,4.6vw,3.5rem)] font-normal leading-[1.06] tracking-[-0.03em] text-foreground">
            Get the pro components first
          </h2>
        </FadeUp>

        <FadeUp delay={0.08}>
          <p className="mx-auto mt-4 max-w-[46ch] text-pretty text-center text-muted-foreground">
            Pro components and an agent that assembles a whole video for you are
            what comes next — this is the list that gets them first. New free
            components as they ship, one email a week at most, and never a
            sponsored one.
          </p>
        </FadeUp>

        <FadeUp delay={0.14}>
          <NewsletterForm
            defaultSource="home"
            className="mx-auto mt-8 max-w-md [&_p]:text-center"
          />
        </FadeUp>
      </div>
    </section>
  );
}
