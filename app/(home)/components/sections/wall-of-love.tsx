import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FadeUp } from "../fade-up";
import { VerifiedIcon } from "./featured-quote";
import { WALL_POSTS } from "./wall-of-love-posts";

/**
 * The wall of love — real posts about snapcn, and the ask to add one.
 *
 * ## Why there is no embed
 *
 * Not one line of X's widget script. The posts are data in
 * `wall-of-love-posts.ts` and this whole section is server-rendered with zero
 * JavaScript of its own: no third-party frame per card, no layout shift as
 * nine iframes settle, no tracker on the landing page, and it still renders
 * when X is down or the reader blocks it. The cost is that a card does not
 * update if someone edits their post — which is the trade we want, since a
 * quote we shipped should not silently become a different quote.
 *
 * `x.com/intent/tweet` is likewise a URL, not an SDK. The composer opens
 * pre-filled and fully editable — nothing is posted by clicking these, X still
 * needs its own send. That is why the button can say what it does without a
 * confirmation step behind it.
 *
 * ## Layout
 *
 * CSS multi-column, not a JS masonry library. The quotes are wildly uneven —
 * four words from one account, a paragraph from another — and columns pack
 * that without measuring anything. The one rule it needs is
 * `break-inside-avoid`, so a card never splits across a column boundary.
 * Source order is preserved down each column rather than across, which is
 * fine here: these are peers, and no card is "first".
 */
const SITE_URL = "https://snapcn.dev";

const intent = (text: string) =>
  `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;

const POSTS = [
  {
    label: "Post about snapcn",
    // Written in the reader's voice, not ours — they are the one posting it, and
    // a line of marketing copy in the first person is the thing people delete.
    text: `@snapcn: ready-made Remotion components for video, installed with the shadcn CLI. Copy the code, own it forever.`,
    primary: true,
  },
  {
    label: "Show what you built",
    text: `Made this with snapcn 🎬

Remotion video components you install with the shadcn CLI:
${SITE_URL}`,
    primary: false,
  },
] as const;

const DATE_FMT = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function WallOfLove() {
  return (
    // Bottom padding only, like every other section here: the showcase wall
    // above already carries its own `pb`, and adding a `pt` to meet it stacked
    // two gaps into one 176px hole.
    <section id="wall-of-love" className="relative pb-20 sm:pb-28">
      <div className="section">
        <FadeUp>
          {/* At the same size the changelog and the hero use — the size is what
              keeps this section on the same page as the two above it, and now
              the alignment matches them too. */}
          <h2 className="mx-auto max-w-[14ch] text-pretty text-center font-sans text-[clamp(2.25rem,4.6vw,3.5rem)] font-normal leading-[1.06] tracking-[-0.03em] text-foreground">
            What people are saying
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-center text-body-lg text-current/70">
            Real posts from X. Every card links to the original.
          </p>
        </FadeUp>

        <FadeUp delay={0.08}>
          <ul className="mt-12 gap-4 sm:columns-2 lg:columns-3">
            {WALL_POSTS.map((post) => (
              <li key={post.handle} className="mb-4 break-inside-avoid">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-full flex-col gap-3 rounded-xl border border-border p-5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-center gap-3">
                    {/* Plain <img>: these are nine 400px avatars copied into
                        /public, already the right size and shape. next/image
                        would add a resize round-trip for no gain. */}
                    {/* biome-ignore lint/performance/noImgElement: local, fixed-size avatar. */}
                    <img
                      src={`/wall-of-love/${post.handle}.jpg`}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
                      className="size-10 shrink-0 rounded-full object-cover"
                    />
                    <span className="min-w-0">
                      {/* A row, not a block, so the badge sits on the name's
                          baseline and the *name* is what truncates — put the
                          badge inside the truncating span and a long name eats
                          it before it eats itself. */}
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate text-sm font-medium text-foreground">
                          {post.name}
                        </span>
                        {post.verified ? <VerifiedIcon /> : null}
                      </span>
                      <span className="block truncate text-sm text-current/50">
                        @{post.handle}
                      </span>
                    </span>
                    <XIcon className="ml-auto size-4 shrink-0 text-current/30" />
                  </div>

                  {/* `whitespace-pre-line` keeps the author's own line breaks —
                      the posts use them as structure (bullets, a beat between
                      thoughts) and reflowing them into a block loses that.
                      `lang` so the right CJK/Latin faces are picked. */}
                  <p
                    lang={post.lang}
                    className="whitespace-pre-line text-pretty text-sm leading-relaxed text-current/80"
                  >
                    {post.quote}
                  </p>

                  <time
                    dateTime={post.date}
                    className="mt-auto text-xs text-current/40"
                  >
                    {DATE_FMT.format(new Date(post.date))}
                  </time>
                </a>
              </li>
            ))}
          </ul>
        </FadeUp>

        <FadeUp delay={0.14}>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {POSTS.map(({ label, text, primary }) => (
              <a
                key={label}
                href={intent(text)}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({
                    size: "lg",
                    variant: primary ? "default" : "outline",
                  }),
                  "h-11 w-full gap-2 px-6 text-sm sm:w-auto",
                )}
              >
                <XIcon className="size-4" />
                {label}
              </a>
            ))}
          </div>
        </FadeUp>

        <FadeUp delay={0.2}>
          <p className="mt-5 text-center text-sm text-current/50">
            Opens X with the post already written. Edit anything before you send
            it.
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="img">
    <title>X</title>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
