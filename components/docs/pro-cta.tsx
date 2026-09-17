"use client";

import Link from "next/link";
import { useOwnsCatalogue } from "@/hooks/use-owns-catalogue";
import { cn } from "@/lib/utils";

/**
 * The call to action under a Pro component's demo on its docs page.
 *
 * The page is static (built once, revalidated daily), so it cannot know who is
 * reading; this does, from the session. Someone whose plan already includes
 * Pro is sent to the install below and their key, not asked to buy it again.
 * Hidden, not swapped, while the session loads, so neither version flashes.
 */
export function ProCta({
  name,
  sampleTitle,
  meta,
}: {
  name: string;
  sampleTitle: string;
  /** The small line under the buttons — count, price, installs. */
  meta: string;
}) {
  const owns = useOwnsCatalogue();
  const button =
    "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90";
  const link =
    "text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground";

  return (
    <div
      className={cn(
        "not-prose mt-5 flex flex-wrap items-center gap-x-4 gap-y-2",
        owns === null && "invisible",
      )}
    >
      {owns ? (
        <>
          <Link href="#installation" className={button}>
            Install {name}
          </Link>
          <Link href="/account" className={link}>
            Your API key and setup
          </Link>
          <span className="w-full text-muted-foreground text-xs">
            Included in your plan.
          </span>
        </>
      ) : (
        <>
          <Link href="/docs/pricing#plans" className={button}>
            Get {name} with Pro
          </Link>
          <Link href="/docs/pricing#free" className={link}>
            or get {sampleTitle} free
          </Link>
          <span className="w-full text-muted-foreground text-xs">{meta}</span>
        </>
      )}
    </div>
  );
}
