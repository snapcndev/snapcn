import { cn } from "@/lib/utils";
import { FEATURED_POST as post } from "./wall-of-love-posts";

/**
 * One real quote, small, above a headline — the home hero and `/docs/pricing`.
 *
 * A link to the post rather than a styled claim: the reader can check it in one
 * click, which is the only thing that makes a quote on a sales page worth more
 * than the copy around it. No hooks, so the client hero and the server pricing
 * page can both render it.
 */
export function FeaturedQuote({ className }: { className?: string }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex max-w-full items-center gap-3 rounded-xl border border-border bg-card/70 py-2 pr-4 pl-2 text-left transition-colors duration-150 hover:bg-muted/60",
        className,
      )}
    >
      {/* biome-ignore lint/performance/noImgElement: local, fixed-size avatar. */}
      <img
        src={`/wall-of-love/${post.handle}.jpg`}
        alt=""
        width={32}
        height={32}
        decoding="async"
        className="size-8 shrink-0 rounded-full object-cover"
      />
      <span className="min-w-0">
        <span
          lang={post.lang}
          className="block text-pretty text-foreground text-sm"
        >
          “{post.quote}”
        </span>
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          {post.name}
          {post.verified ? <VerifiedIcon className="size-3.5" /> : null}
          {post.role ? <span>· {post.role}</span> : null}
        </span>
      </span>
    </a>
  );
}

/**
 * X's verified badge, for the authors who actually have one.
 *
 * Not `text-primary`, and not a token. This is X's mark reproduced on a card
 * that quotes an X post and links to it, so it is X's blue or it is a lie — the
 * badge means "this account is verified *on X*", and painting it in our accent
 * would turn a factual claim about someone else's platform into decoration.
 * `verified` comes off the post itself; see `wall-of-love-posts.ts`.
 *
 * Carries its own label, so a screen reader reads "Nett0, verified account".
 */
export const VerifiedIcon = ({
  className = "size-4",
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    className={cn("shrink-0", className)}
    fill="#1D9BF0"
    role="img"
  >
    <title>Verified account</title>
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
  </svg>
);
