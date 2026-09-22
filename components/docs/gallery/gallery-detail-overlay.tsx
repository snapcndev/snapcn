"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowLeft,
  ArrowRight,
  CheckIcon,
  ChevronDown,
  Clapperboard,
  CopyIcon,
  KeyRound,
  Lock,
  XIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { StudioInstall } from "@/components/docs/studio-install";
import { installCommand as buildInstallCommand } from "@/config/site";
import { useOwnsCatalogue } from "@/hooks/use-owns-catalogue";
import { useTrackEvent } from "@/lib/analytics";
import {
  GALLERY_CATEGORIES,
  type GalleryItem,
  slugFromHref,
} from "@/lib/gallery-data";
import { CATALOGUE_PRICE } from "@/lib/plans";
import { previewMeta } from "@/lib/preview-meta";
import { proDemoSrc } from "@/lib/pro-demos";
import {
  RenderedDemo,
  renderedDemoPoster,
  renderedDemoSrc,
} from "@/lib/rendered-demos";
import STUDIO_ELEMENTS from "@/lib/studio-elements.json";
import { cn } from "@/lib/utils";
import { loadDocBody } from "./doc-body-action";
import { morphToCard, SHARED_MEDIA } from "./shared-media-transition";

/** Remotion, only for a component with no rendered demo — see `live-preview.tsx`. */
const LivePreview = dynamic(() => import("./live-preview"), { ssr: false });

const CATEGORY_LABEL = new Map(GALLERY_CATEGORIES.map((c) => [c.id, c.label]));

/**
 * The panel's primary action. A lit top edge and a short shadow give it a
 * surface to press, and it presses: a touch smaller, 150ms, out.
 */
const PRIMARY_BTN =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.25)] transition-[filter,transform] duration-150 ease-out hover:brightness-110 active:scale-[0.97] motion-reduce:transition-none";

/** A card on the panel: a hairline, a whisper of fill. */
const CARD = "rounded-xl border border-border bg-muted/30 px-3.5 py-3";
/** The small caps a card and a spec open with. */
const CARD_LABEL =
  "font-medium text-[11px] text-muted-foreground uppercase tracking-[0.12em]";

const ROUND_BTN =
  "flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted";

// Both tiers publish to the same flat `/r/<name>.json`, so the tier no longer
// picks a path. See `installCommand` in config/site.ts for why this is a URL and
// not `@snapcn/<slug>`.

function typeLabel(href: string) {
  if (href.startsWith("/docs/ui/blocks/")) return "Block";
  if (href.startsWith("/docs/ui/")) return "UI primitive";
  return "Animation";
}

/**
 * In-place component detail overlay. Opening a card sets `?item=<slug>`
 * (owned by `GalleryExplorer`), which renders this Base UI Dialog over the
 * gallery — the grid behind is dimmed + blurred, the left panel slides in and
 * the large live preview scales up. Base UI gives focus-trap, scroll-lock,
 * Escape, and ARIA for free. Prev/next walk the on-screen list. Every
 * component's full docs render inline here, fetched for the open component
 * rather than shipped for all of them (see `doc-bodies.tsx`).
 */
export function GalleryDetailOverlay({
  item,
  docSlugs,
  onClose,
  onPrev,
  onNext,
}: {
  item: GalleryItem | null;
  /** Slugs that have documentation — the layout choice, without the documents. */
  docSlugs?: string[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Retain the last item through the close animation (Base UI keeps the popup
  // mounted while it animates out; without this the content would vanish
  // instantly and only an empty panel would fade).
  const [shown, setShown] = useState<GalleryItem | null>(item);
  useEffect(() => {
    if (item) setShown(item);
  }, [item]);

  // Never open during SSR. A modal Base UI dialog marks the other top-level
  // nodes inert (`data-base-ui-inert` + `aria-hidden`), including the docs
  // search dialog that fumadocs portals to <body>. That server-only inert state
  // has no client equivalent and triggers a hydration mismatch when the page is
  // deep-linked with `?item=<slug>`. Gating `open` on mount keeps the server and
  // first client render closed (matching), then opens a frame later — the deep
  // link still lands on the overlay.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * Documentation for the components opened so far, by slug.
   *
   * Kept in a ref *and* mirrored into state: the ref is what a second open of
   * the same component reads (so arrowing back and forth re-renders instead of
   * re-fetching), the state is what makes React paint the body when the first
   * fetch lands. A ref alone would never re-render; state alone would refetch a
   * document already on the client.
   */
  const cache = useRef<Map<string, ReactNode>>(new Map());
  const [, setLoaded] = useState(0);
  const shownSlug = shown ? slugFromHref(shown.href) : null;
  const hasDoc = shownSlug ? (docSlugs?.includes(shownSlug) ?? false) : false;

  useEffect(() => {
    if (!shownSlug || !hasDoc || cache.current.has(shownSlug)) return;
    let cancelled = false;
    loadDocBody(shownSlug).then((body) => {
      // The overlay may have moved on (arrow keys step fast); dropping a late
      // response is right, and the next open of that slug refetches it.
      if (cancelled || !body) return;
      cache.current.set(shownSlug, body);
      setLoaded((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [shownSlug, hasDoc]);

  // Fly back into the card instead of fading out over it. Wrapped here rather
  // than at each call site so every close path — ×, Escape, backdrop — goes
  // through it.
  const closeWithMorph = useCallback(() => {
    if (!item) {
      onClose();
      return;
    }
    morphToCard(slugFromHref(item.href), onClose);
  }, [item, onClose]);

  return (
    <Dialog.Root
      open={mounted && item !== null}
      onOpenChange={(open) => {
        if (!open) closeWithMorph();
      }}
    >
      <Dialog.Portal>
        {/* Offset by the sidebar width on lg so the overlay opens BESIDE the
            fixed sidebar, never over it (the detail panel sits at the sidebar's
            right edge). On mobile the sidebar is hidden, so it's full-width.

            Below `xl` the popup is one opaque, scrolling sheet — see
            `OverlayBody` for why. From `xl` it is transparent and click-through
            around its two columns, so the backdrop still closes it. */}
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md duration-200 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 lg:left-[var(--gallery-sidebar-w)]" />
        <Dialog.Popup className="group/ov fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain bg-background outline-none duration-200 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 lg:left-[var(--gallery-sidebar-w)] xl:pointer-events-none xl:flex-row xl:overflow-hidden xl:bg-transparent">
          {shown ? (
            <OverlayBody
              item={shown}
              // Only while genuinely open. Base UI keeps this popup mounted
              // through its close animation, so if the preview kept the name it
              // would still be holding it when the card reclaims it on the way
              // back — two holders, and the browser skips the morph entirely.
              holdsSharedName={item !== null}
              hasDoc={hasDoc}
              docBody={shownSlug ? cache.current.get(shownSlug) : undefined}
              onClose={closeWithMorph}
              onPrev={onPrev}
              onNext={onNext}
            />
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function OverlayBody({
  item,
  holdsSharedName,
  hasDoc,
  docBody,
  onClose,
  onPrev,
  onNext,
}: {
  item: GalleryItem;
  /** Whether this preview currently owns the shared view-transition name. */
  holdsSharedName: boolean;
  /**
   * Whether this component has documentation — known from the slug list, so the
   * two-column docs layout is chosen on the first frame. Deriving it from
   * `docBody` instead would open every component in the centred preview layout
   * and then reflow it into two columns when the fetch landed.
   */
  hasDoc: boolean;
  /** The documentation itself, once fetched. */
  docBody?: ReactNode;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const slug = slugFromHref(item.href);
  // Shape and length only, never the component — see `lib/preview-meta.ts`. A
  // paid component has neither: the pro barrel is gitignored and never reaches
  // the client bundle, so there is no source here to mount. The overlay shows
  // the video, and the price — or, to someone whose plan includes Pro, the
  // install command, which their API key turns from a 402 into files.
  const meta = item.pro ? null : previewMeta(slug);
  /**
   * The overlay shows the default scene, exactly like the card does — the
   * customizer is the only surface that varies the props — so a slug with a
   * rendered demo has to play the mp4 here too.
   *
   * The card already did this and the overlay did not, which put a live Player
   * on precisely the components that are in RENDERED_DEMOS *because* a live
   * Player misrepresents them. Opening logo-flicker — listed there because its
   * images swap nearly every frame and the Player flashes through them before
   * the pool is cached — showed the one thing the rendered file exists to
   * avoid, at full overlay size.
   *
   * Not fixed inside PreviewStage: the docs page hands that customized values,
   * and a fixed mp4 cannot show those. This is a default-props surface; that
   * one is not.
   */
  const demoSrc = item.pro ? proDemoSrc(slug) : renderedDemoSrc(slug);
  // No poster for a paid card: it autoplays the moment it is on screen and a
  // still in front of it is a frame of the video shown as a photograph.
  const demoPoster = item.pro ? null : renderedDemoPoster(slug);
  const category = CATEGORY_LABEL.get(item.category) ?? item.category;
  // One string for both the label and the clipboard. They used to be written out
  // separately, so the row showed a bare `@snapcn/text-reveal` — which is not a
  // command and does nothing if you type it — while the copy button quietly
  // handed over the real thing. What it says is now what you get.
  const installCommand = buildInstallCommand(slug);
  const hasDocs = hasDoc;
  const trackEvent = useTrackEvent();
  // A paid card sells Pro only to someone without it. An owner gets the install
  // row and a way to their key instead. `null` while the session loads.
  const owns = useOwnsCatalogue();
  const locked = item.pro && !owns;

  // Arrow keys step between components without leaving the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  const preview = demoSrc ? (
    // A frame the size of the video before a byte of it arrives: a paid demo
    // has no poster, and a bare <video> is 300x150 until its metadata loads,
    // so the page used to jump when it did. Every demo is rendered 16:9, and
    // `object-contain` letterboxes anything that is not.
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-gallery-card">
      <RenderedDemo src={demoSrc} poster={demoPoster ?? undefined} priority />
    </div>
  ) : item.pro ? (
    <div className="aspect-video w-full rounded-xl bg-gallery-card" />
  ) : (
    <LivePreview slug={slug} name={item.name} stage />
  );

  /**
   * One tree, two layouts.
   *
   * Below `xl` it is a single scrolling sheet in reading order — controls, the
   * video, the details, the docs. It used to be the desktop layout squeezed:
   * the details column stacked on top at full width, so on a phone the video
   * started 700px down, under a screen of prose, cut off by the bottom edge;
   * and between 1024 and 1280 it was a 380px thumbnail beside a 360px column.
   * The video is what somebody opened this for, so it comes first and full
   * width.
   *
   * From `xl` the details are a column beside the video, each scrolling on its
   * own, as before. The two column wrappers are `display: contents` below `xl`,
   * so their children order as one list without rendering anything twice.
   */
  return (
    <>
      <div className="contents xl:pointer-events-auto xl:relative xl:z-10 xl:flex xl:h-full xl:w-[360px] xl:shrink-0 xl:flex-col xl:gap-6 xl:overflow-y-auto xl:border-border xl:border-r xl:bg-background xl:px-8 xl:py-6 xl:duration-300 xl:ease-out xl:group-data-[open]/ov:animate-in xl:group-data-[open]/ov:fade-in-0 xl:group-data-[open]/ov:slide-in-from-left-8">
        <div className="sticky top-0 z-20 order-1 flex items-center gap-2 border-border border-b bg-background px-4 py-3 sm:px-6 xl:static xl:order-none xl:border-0 xl:p-0">
          <button
            type="button"
            onClick={onClose}
            className={ROUND_BTN}
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              className={ROUND_BTN}
              aria-label="Previous component"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              className={ROUND_BTN}
              aria-label="Next component"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        <div
          key={slug}
          className="order-3 mx-auto flex w-full max-w-3xl animate-in flex-col gap-6 px-4 pt-2 pb-8 fade-in duration-150 sm:px-6 xl:order-none xl:mx-0 xl:max-w-none xl:p-0"
        >
          <header>
            <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
              {category}
            </p>
            <Dialog.Title className="mt-2 font-semibold text-[1.75rem] text-foreground leading-[1.1] tracking-[-0.025em]">
              {item.name}
            </Dialog.Title>
          </header>

          <Description text={item.description} />

          {/* The facts, as a spec sheet rather than a ledger: label over value,
              two to a row, between hairlines. */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-border border-y py-5">
            <Spec label="Type">{typeLabel(item.href)}</Spec>
            {meta ? (
              <Spec label="Duration">
                {(meta.durationInFrames / meta.fps).toFixed(1)}s
              </Spec>
            ) : null}
            <Spec label="Category">{category}</Spec>
            <Spec label="Source">snapcn</Spec>
          </dl>

          {locked ? (
            // The price, spelled both ways, because the two products are the
            // decision: a year of everything, or the same catalogue outright.
            <div className={CARD}>
              <p className={CARD_LABEL}>Price</p>
              <p className="mt-1.5 text-foreground text-sm tabular-nums">
                {CATALOGUE_PRICE.annual} a year · {CATALOGUE_PRICE.lifetime}{" "}
                outright
              </p>
            </div>
          ) : (
            <InstallCard command={installCommand} slug={slug} />
          )}

          {/* The actions, as one group: the editor first — the gallery's
              measurable exit, where 64% of visitors put a clip on the timeline,
              and `?clip=` carries this one straight onto it — then Studio for
              someone already in a Remotion project. */}
          <div className="flex flex-col gap-2.5">
            {item.pro && owns ? (
              <Link href="/account" className={PRIMARY_BTN}>
                <KeyRound className="size-4" aria-hidden="true" />
                Your API key and setup
              </Link>
            ) : (
              <Link
                href={
                  item.pro
                    ? "/docs/pricing#plans"
                    : `/docs/video-editor?clip=${slug}`
                }
                onClick={() =>
                  trackEvent("cta_clicked", {
                    cta: item.pro ? "gallery_pro" : "gallery_make_video",
                    destination: item.pro
                      ? "/docs/pricing#plans"
                      : `/docs/video-editor?clip=${slug}`,
                  })
                }
                className={cn(
                  PRIMARY_BTN,
                  item.pro && owns === null && "invisible",
                )}
              >
                {item.pro ? (
                  <>
                    <Lock className="size-4" aria-hidden="true" />
                    Get the pro catalogue
                  </>
                ) : (
                  <>
                    <Clapperboard className="size-4" aria-hidden="true" />
                    Make a video with this
                  </>
                )}
              </Link>
            )}
            {/* Free ones only — a Pro component installs with a key, through
                the CLI. */}
            {!item.pro && STUDIO_ELEMENTS.includes(slug) && (
              <StudioInstall name={slug} surface="gallery" block />
            )}
          </div>
        </div>
      </div>

      {/* From `xl`: with docs, a column that scrolls — the video pinned on top,
          the documentation under it; without, the video centred, with the space
          around it click-through to the backdrop so a click there closes. */}
      <div
        className={cn(
          "contents",
          hasDocs
            ? "xl:pointer-events-auto xl:relative xl:block xl:h-full xl:flex-1 xl:overflow-y-auto"
            : "xl:relative xl:flex xl:flex-1 xl:items-center xl:justify-center xl:p-12",
        )}
      >
        <div
          className={cn(
            "order-2 mx-auto w-full max-w-3xl px-4 pt-4 pb-2 sm:px-6",
            hasDocs
              ? "xl:px-10 xl:pt-12 xl:pb-0"
              : "xl:pointer-events-auto xl:p-0",
          )}
        >
          {/* Claims the name the clicked card just released, so the browser
              treats the two as one element and flies it here. No zoom-in: the
              morph *is* the entrance, and running both fights itself. */}
          <div
            key={slug}
            style={{
              viewTransitionName: holdsSharedName ? SHARED_MEDIA : undefined,
            }}
          >
            {preview}
          </div>
        </div>

        {hasDocs ? (
          <div className="order-4 mx-auto w-full max-w-3xl px-4 pt-2 pb-12 sm:px-6 xl:px-10 xl:pt-10">
            {docBody ?? (
              // One in-flight fetch's worth of placeholder. Sized off the
              // shortest real doc, so the column does not collapse and then
              // jump when the body lands.
              <div className="space-y-3" aria-busy="true">
                <span className="sr-only">Loading documentation</span>
                {[80, 100, 92, 64].map((w) => (
                  <span
                    key={w}
                    style={{ width: `${w}%` }}
                    className="block h-4 animate-pulse rounded bg-gallery-card"
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** One fact: a small-caps label, the value under it. */
function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={CARD_LABEL}>{label}</dt>
      <dd className="mt-1 truncate text-foreground text-sm">{children}</dd>
    </div>
  );
}

/**
 * The whole description, always — it is the page's text, and search reads it
 * whether or not it is open. Past four lines it rests under a fade, and "Show
 * more" lets it run; a short one never grows a button it does not need.
 */
function Description({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  useEffect(() => {
    const el = ref.current?.firstElementChild;
    if (el) setLong(el.scrollHeight > el.clientHeight + 1);
  }, []);

  return (
    <div ref={ref}>
      <Dialog.Description
        className={cn(
          "text-pretty text-[0.9375rem] text-muted-foreground leading-6",
          !open && "line-clamp-4",
          !open &&
            long &&
            "[mask-image:linear-gradient(to_bottom,#000_55%,transparent)]",
        )}
      >
        {text}
      </Dialog.Description>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-2 inline-flex items-center gap-1 font-medium text-foreground/80 text-xs transition-colors hover:text-foreground"
        >
          {open ? "Show less" : "Show more"}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}

/**
 * The install command as a card: a label and the copy action on top, the
 * command on one line below — never wrapped, so the package name is never cut
 * in two; it scrolls and fades at the edge instead. The package is the part
 * worth reading, so it is the bright part.
 */
function InstallCard({ command, slug }: { command: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const at = command.lastIndexOf(" ") + 1;

  const copy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn(CARD, "px-0 py-0")}>
      <div className="flex h-9 items-center justify-between border-border border-b px-3.5">
        <p className={CARD_LABEL}>Install</p>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy install command for ${slug}`}
          className="-mr-1.5 inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground text-xs transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96] motion-reduce:transition-none"
        >
          <span
            key={copied ? "copied" : "copy"}
            className="inline-flex items-center gap-1.5 animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
          >
            {copied ? (
              <>
                <CheckIcon className="size-3.5 text-primary" />
                Copied
              </>
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </span>
        </button>
      </div>
      <div className="relative">
        <p className="overflow-x-auto whitespace-nowrap px-3.5 py-3 font-mono text-[0.8125rem] leading-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="select-none text-muted-foreground/60">$ </span>
          <span className="text-muted-foreground">{command.slice(0, at)}</span>
          <span className="text-foreground">{command.slice(at)}</span>
        </p>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-br-xl bg-gradient-to-l from-background/80 to-transparent"
        />
      </div>
    </div>
  );
}
