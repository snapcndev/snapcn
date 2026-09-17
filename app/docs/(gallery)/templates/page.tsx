import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FeaturedQuote } from "@/app/(home)/components/sections/featured-quote";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { EarlyBirdStrip } from "@/components/early-bird";
import { buttonVariants } from "@/components/ui/button";
import { DOCS_PAGE_META, PRO_ITEMS } from "@/config/site";
import { renderedDemoPoster, renderedDemoSrc } from "@/lib/demo-urls";
import { ITEM_BY_SLUG } from "@/lib/gallery-data";
import { CATALOGUE_PRICE, CATALOGUE_PROMISE, EARLY_BIRD } from "@/lib/plans";
import { RenderedDemo } from "@/lib/rendered-demos";
import { cn } from "@/lib/utils";

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META.templates;
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/templates";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs/templates" },
  openGraph: {
    type: "website",
    url: "/docs/templates",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "snapcn",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/** Hourly, so the days-left count is right to the hour on a static page. */
export const revalidate = 3600;

const BUY = "/docs/pricing?ref=templates#plans";
const dollars = (cents: number) => `$${cents / 100}`;

/**
 * The first templates, as the plan names them (PLAN_SEP09_NOV20, item 15).
 *
 * Each plays a component that exists today — the kind of shot the template is
 * made of — and says so under the video. A template that is not built yet does
 * not get a fake preview.
 */
const COMING = [
  {
    title: "Product launch",
    body: "The headline, the one claim that matters, your app on a phone, the numbers, your wordmark.",
    demo: "hero-launch",
  },
  {
    title: "Feature announcement",
    body: "The prompt, the answer streaming in, the moment the new feature does its job.",
    demo: "prompt-send",
  },
  {
    title: "Changelog",
    body: "What shipped this week, one beat per change, and the version it landed in.",
    demo: "status-cycle",
  },
  {
    title: "Demo Day pitch",
    body: "The problem, the traction as numbers that count up, and the ask.",
    demo: "count-grid",
  },
  {
    title: "Pricing explainer",
    body: "Your plans side by side, what separates them, and the price landing last.",
    demo: "text-highlight",
  },
] as const;

const FAQ = [
  {
    q: "Are templates included in Pro?",
    a: `Yes. Pro and Lifetime include every template at no extra cost — the ${CATALOGUE_PROMISE.templates} on ${EARLY_BIRD.endsOn} and every one after.`,
  },
  {
    q: `What changes on ${EARLY_BIRD.endsOn}?`,
    a: `The templates land and the early-bird prices end: Pro goes from ${CATALOGUE_PRICE.annual} to ${dollars(EARLY_BIRD.risesTo.everything_annual)} a year, Lifetime from ${CATALOGUE_PRICE.lifetime} to ${dollars(EARLY_BIRD.risesTo.lifetime)}.`,
  },
  {
    q: "If I subscribe now, does my price go up later?",
    a: "No. A subscription renews at the price it started at, for as long as you keep it.",
  },
  {
    q: "Can I use them for client work?",
    a: `Yes — that is the Commercial licence: ${CATALOGUE_PRICE.commercial} once, for up to five people.`,
  },
];

/**
 * `/docs/templates` — what lands on 20 October, and why today is the day to buy.
 *
 * It was a coming-soon card with one button, on the second-busiest docs page
 * (719 people a month, for templates that did not exist yet). Every one of
 * them is already telling us what they want; this page shows them what is
 * coming, prices it, and says plainly what waiting costs — a real date, a real
 * count, and the renewal promise Dodo actually keeps.
 */
export default function TemplatesPage() {
  return (
    <GalleryFrame>
      <DocsTopBar />

      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <EarlyBirdStrip />
          <p className="mt-8 font-medium font-mono text-[0.6875rem] text-muted-foreground uppercase tracking-[0.14em]">
            Templates · landing {EARLY_BIRD.endsOn}
          </p>
          <h1 className="mt-3 max-w-[18ch] text-balance font-normal font-sans text-[clamp(2.25rem,5vw,3.75rem)] text-foreground leading-[1.05] tracking-[-0.03em]">
            Finished videos. Your product in them.
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-body-lg text-current/70">
            Around ten complete videos, each composed from snapcn components,
            cut to time and ready to render. Swap in your headline, your
            screenshots and your logo — the motion is already done.
          </p>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={BUY}
              className={cn(
                buttonVariants({ size: "lg" }),
                "group/cta h-12 w-full gap-2 rounded-xl px-6 text-base transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] sm:w-auto",
              )}
            >
              Lock in Pro at {CATALOGUE_PRICE.annual}/yr
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-150 ease-out group-hover/cta:translate-x-0.5"
              />
            </Link>
            <Link
              href={BUY}
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-12 w-full rounded-xl px-6 text-base transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] sm:w-auto",
              )}
            >
              Or own it for {CATALOGUE_PRICE.lifetime}
            </Link>
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            Templates are included in Pro and Lifetime — no separate purchase.
          </p>
        </section>

        {/* What is coming */}
        <section className="mt-24">
          <h2 className="text-center font-normal font-sans text-[clamp(1.75rem,3.4vw,2.5rem)] text-foreground leading-[1.1] tracking-[-0.03em]">
            The first templates
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-center text-current/70">
            Each is a whole video with a job to do. The previews play the
            components they are made from.
          </p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {COMING.map((t) => {
              const src = renderedDemoSrc(t.demo);
              const item = ITEM_BY_SLUG.get(t.demo);
              return (
                <li
                  key={t.title}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-gallery-card">
                    {src ? (
                      <RenderedDemo
                        src={src}
                        poster={renderedDemoPoster(t.demo) ?? undefined}
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-medium text-foreground">{t.title}</h3>
                    <p className="mt-1.5 flex-1 text-muted-foreground text-sm leading-relaxed">
                      {t.body}
                    </p>
                    {item ? (
                      <Link
                        href={item.href}
                        className="mt-4 text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Preview: the {item.name} component
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
            <li className="flex flex-col justify-center rounded-2xl border border-border border-dashed p-6">
              <p className="font-medium text-foreground">
                …and more on {EARLY_BIRD.endsOn}
              </p>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                Around ten at launch, then more with every release. Each one is
                code in your repo, so every beat is yours to change.
              </p>
            </li>
          </ul>
        </section>

        {/* Why today */}
        <section className="mt-24">
          <h2 className="text-center font-normal font-sans text-[clamp(1.75rem,3.4vw,2.5rem)] text-foreground leading-[1.1] tracking-[-0.03em]">
            Buy before {EARLY_BIRD.endsOn}, pay less for good
          </h2>
          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
            {[
              {
                name: "Pro",
                today: `${CATALOGUE_PRICE.annual}/yr`,
                later: `${dollars(EARLY_BIRD.risesTo.everything_annual)}/yr`,
                line: `Renews at ${CATALOGUE_PRICE.annual} for as long as you stay.`,
              },
              {
                name: "Lifetime",
                today: CATALOGUE_PRICE.lifetime,
                later: dollars(EARLY_BIRD.risesTo.lifetime),
                line: "One payment. Every template and component that ships.",
              },
            ].map((p) => (
              <div
                key={p.name}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <p className="text-muted-foreground">{p.name}</p>
                <p className="mt-3 flex items-baseline gap-3">
                  <span className="font-semibold text-4xl text-foreground tracking-tight">
                    {p.today}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    goes to {p.later} on {EARLY_BIRD.endsOnShort}
                  </span>
                </p>
                <p className="mt-3 text-muted-foreground text-sm">{p.line}</p>
              </div>
            ))}
          </div>
          <ul className="mx-auto mt-8 grid max-w-3xl gap-3 text-sm sm:grid-cols-2">
            {[
              `All ${PRO_ITEMS.length} Pro components today, growing to ${CATALOGUE_PROMISE.components}`,
              `${CATALOGUE_PROMISE.templates} video templates from ${EARLY_BIRD.endsOn}`,
              "The snapcn MCP server for your coding agent",
              "No watermark, 1080p exports in the editor",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Check className="size-3.5" strokeWidth={2.5} />
                </span>
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-muted-foreground text-xs">
            Lower regional prices in six countries — shown on the pricing page.
          </p>
        </section>

        <section className="mt-20 flex justify-center">
          <FeaturedQuote />
        </section>

        {/* Questions */}
        <section className="mx-auto mt-20 max-w-2xl">
          <h2 className="text-center font-normal font-sans text-[clamp(1.5rem,2.8vw,2rem)] text-foreground leading-[1.1] tracking-[-0.03em]">
            Questions
          </h2>
          <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground text-sm">
                  {f.q}
                  <span
                    aria-hidden
                    className="text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Last call */}
        <section className="mt-20 flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <h2 className="max-w-[22ch] text-balance font-normal font-sans text-[clamp(1.5rem,3vw,2.25rem)] text-foreground leading-[1.1] tracking-[-0.03em]">
            Get every template the day it lands, at today&apos;s price.
          </h2>
          <EarlyBirdStrip className="mt-5" />
          <Link
            href={BUY}
            className={cn(
              buttonVariants({ size: "lg" }),
              "group/cta mt-7 h-12 gap-2 rounded-xl px-6 text-base transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]",
            )}
          >
            See the early-bird prices
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform duration-150 ease-out group-hover/cta:translate-x-0.5"
            />
          </Link>
        </section>
      </div>
    </GalleryFrame>
  );
}
