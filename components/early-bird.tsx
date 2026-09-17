import { EARLY_BIRD, earlyBirdDaysLeft } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * The early-bird deadline, as a count — on the pricing and templates pages.
 *
 * A real date and a real count, both from `EARLY_BIRD`; nothing here resets per
 * visitor. Rendered on the server: the pricing page is dynamic, and the
 * templates page revalidates hourly, so the count is right to the hour without
 * a client clock that would disagree with the server's first paint. Gone the
 * day the window closes.
 */
export function EarlyBirdStrip({
  className,
  withLockIn = false,
}: {
  className?: string;
  /** Add the line that makes buying early worth it for a subscription. */
  withLockIn?: boolean;
}) {
  const days = earlyBirdDaysLeft();
  if (days === 0) return null;
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-center font-medium text-primary text-xs">
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-primary"
        />
        <span>Early-bird prices end {EARLY_BIRD.endsOn}</span>
        <span aria-hidden>·</span>
        <span>
          {days} {days === 1 ? "day" : "days"} left
        </span>
      </p>
      {withLockIn ? (
        <p className="text-balance text-center text-muted-foreground text-xs">
          Subscribe before then and every renewal stays at today&apos;s price.
        </p>
      ) : null}
    </div>
  );
}
