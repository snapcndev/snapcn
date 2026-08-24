"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowLeft,
  ArrowRight,
  CheckIcon,
  CopyIcon,
  XIcon,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { installCommand as buildInstallCommand } from "@/config/site";
import {
  GALLERY_CATEGORIES,
  type GalleryItem,
  slugFromHref,
} from "@/lib/gallery-data";
import { resolvePreview } from "@/lib/gallery-preview";
import {
  RenderedDemo,
  renderedDemoPoster,
  renderedDemoSrc,
} from "@/lib/rendered-demos";
import { PreviewStage } from "@/lib/ui-preview-internals";
import { morphToCard, SHARED_MEDIA } from "./shared-media-transition";

const CATEGORY_LABEL = new Map(GALLERY_CATEGORIES.map((c) => [c.id, c.label]));

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
 * component's full docs render inline here — there are no standalone docs pages.
 */
export function GalleryDetailOverlay({
  item,
  docBodies,
  onClose,
  onPrev,
  onNext,
}: {
  item: GalleryItem | null;
  /** Server-rendered docs for every component, keyed by slug. */
  docBodies?: Record<string, ReactNode>;
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
            right edge). On mobile the sidebar is hidden, so it's full-width. */}
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md duration-200 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 lg:left-[var(--gallery-sidebar-w)]" />
        <Dialog.Popup className="group/ov pointer-events-none fixed inset-0 z-50 flex flex-col outline-none duration-200 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 md:flex-row lg:left-[var(--gallery-sidebar-w)]">
          {shown ? (
            <OverlayBody
              item={shown}
              // Only while genuinely open. Base UI keeps this popup mounted
              // through its close animation, so if the preview kept the name it
              // would still be holding it when the card reclaims it on the way
              // back — two holders, and the browser skips the morph entirely.
              holdsSharedName={item !== null}
              docBody={docBodies?.[slugFromHref(shown.href)]}
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
  docBody,
  onClose,
  onPrev,
  onNext,
}: {
  item: GalleryItem;
  /** Whether this preview currently owns the shared view-transition name. */
  holdsSharedName: boolean;
  /** The component's full documentation, rendered inline (the overlay is the
   *  docs — there is no standalone page). */
  docBody?: ReactNode;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const slug = slugFromHref(item.href);
  const preview = useMemo(() => resolvePreview(slug), [slug]);
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
  const demoSrc = renderedDemoSrc(slug);
  const demoPoster = renderedDemoPoster(slug);
  const category = CATEGORY_LABEL.get(item.category) ?? item.category;
  // One string for both the label and the clipboard. They used to be written out
  // separately, so the row showed a bare `@snapcn/text-reveal` — which is not a
  // command and does nothing if you type it — while the copy button quietly
  // handed over the real thing. What it says is now what you get.
  const installCommand = buildInstallCommand(slug);
  const [copied, setCopied] = useState(false);
  const hasDocs = Boolean(docBody);

  const copyInstall = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Arrow keys step between components without leaving the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  return (
    <>
      <aside className="pointer-events-auto relative z-10 flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-border bg-background px-8 py-6 duration-300 ease-out group-data-[open]/ov:animate-in group-data-[open]/ov:fade-in-0 md:h-full md:w-[360px] md:border-r md:group-data-[open]/ov:slide-in-from-left-8">
        <div className="flex items-center gap-2">
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
          className="flex animate-in flex-col gap-5 fade-in duration-150"
        >
          <div>
            <p className="text-sm text-muted-foreground">{category}</p>
            <Dialog.Title className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {item.name}
            </Dialog.Title>
          </div>

          <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
            {item.description}
          </Dialog.Description>

          <dl className="text-sm">
            <MetaRow label="Source">snapcn</MetaRow>
            <MetaRow label="Category">{category}</MetaRow>
            <MetaRow label="Type">{typeLabel(item.href)}</MetaRow>
            {preview ? (
              <MetaRow label="Duration">
                {(preview.durationInFrames / preview.fps).toFixed(1)}s
              </MetaRow>
            ) : null}
            <MetaRow label="Install">
              <button
                type="button"
                onClick={copyInstall}
                className="inline-flex items-start gap-1.5 text-left font-mono text-xs break-all text-foreground transition-colors hover:text-muted-foreground"
                title="Copy install command"
              >
                {installCommand}
                {copied ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
              </button>
            </MetaRow>
          </dl>
        </div>
      </aside>

      {hasDocs ? (
        // Docs mode: the right column scrolls — live preview pinned on top, the
        // component's full documentation below. `pointer-events-auto` so it's
        // readable/selectable (backdrop-to-close still works from the aside).
        <div className="pointer-events-auto relative flex-1 overflow-y-auto md:h-full">
          <div className="mx-auto w-full max-w-3xl px-6 py-8 md:px-10 md:py-12">
            {/* Claims the name the clicked card just released, so the browser
                treats the two as one element and flies it here. No zoom-in: the
                morph *is* the entrance, and running both fights itself. */}
            <div
              key={slug}
              style={{
                viewTransitionName: holdsSharedName ? SHARED_MEDIA : undefined,
              }}
            >
              {demoSrc ? (
                <RenderedDemo src={demoSrc} poster={demoPoster ?? undefined} />
              ) : preview ? (
                <PreviewStage
                  name={item.name}
                  Component={preview.Component}
                  inputProps={preview.inputProps}
                  durationInFrames={preview.durationInFrames}
                  fps={preview.fps}
                  compositionWidth={preview.width}
                  compositionHeight={preview.height}
                  previewBackdrop={preview.previewBackdrop}
                />
              ) : (
                <div className="aspect-video w-full bg-gallery-card" />
              )}
            </div>
            <div className="mt-10">{docBody}</div>
          </div>
        </div>
      ) : (
        // The padding around the preview is pointer-events-none, so clicks there
        // fall through to Base UI's backdrop and close the overlay natively;
        // only the preview wrapper is interactive. Escape and × also close.
        <div className="relative flex flex-1 items-center justify-center p-6 md:p-12">
          {/* Same shared element as the docs-mode wrapper above — only one of
              the two branches is ever mounted, so the name stays unique. */}
          <div
            key={slug}
            className="pointer-events-auto w-full max-w-3xl"
            style={{
              viewTransitionName: holdsSharedName ? SHARED_MEDIA : undefined,
            }}
          >
            {demoSrc ? (
              <RenderedDemo src={demoSrc} poster={demoPoster ?? undefined} />
            ) : preview ? (
              <PreviewStage
                name={item.name}
                Component={preview.Component}
                inputProps={preview.inputProps}
                durationInFrames={preview.durationInFrames}
                fps={preview.fps}
                compositionWidth={preview.width}
                compositionHeight={preview.height}
                previewBackdrop={preview.previewBackdrop}
              />
            ) : (
              <div className="aspect-video w-full bg-gallery-card" />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}
