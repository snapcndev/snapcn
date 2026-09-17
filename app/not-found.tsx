import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SnapCnLogo } from "@/components/snapcn-logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found — snapcn",
  // A 404 has nothing to index and no canonical of its own.
  robots: { index: false, follow: true },
};

/**
 * Root 404. Catches every unmatched path in the app, including `/docs/*`.
 *
 * Deliberately a full page rather than a line of text inside the docs chrome:
 * whoever lands here followed a broken link and needs somewhere to go, so the
 * three routes that actually matter are offered instead of a back button.
 */
const WAYS_OUT = [
  { href: "/docs/components", label: "Browse all components" },
  { href: "/docs/getting-started/introduction", label: "Read the docs" },
  { href: "/docs/pricing", label: "See pricing" },
];

export default function NotFound() {
  return (
    <main className="section flex min-h-[70vh] flex-col items-start justify-center py-24">
      <Link href="/" aria-label="snapcn home" className="mb-10 inline-flex">
        <SnapCnLogo />
      </Link>

      <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        404
      </p>
      <h1 className="mt-3 max-w-[20ch] text-pretty font-sans text-[clamp(2rem,5vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.03em] text-foreground">
        This page doesn’t exist
      </h1>
      <p className="mt-4 max-w-md text-pretty text-body-lg text-current/70">
        The link may be out of date, or the page may have moved. Everything the
        registry ships is one of these.
      </p>

      <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
        <Button
          size="lg"
          className="h-11 gap-2 px-6 text-sm"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Back home
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <ul className="mt-10 flex flex-col gap-2.5">
        {WAYS_OUT.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className="text-sm text-foreground/75 underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
