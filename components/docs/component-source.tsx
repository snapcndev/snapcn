"use client";

import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RegistryFile {
  path: string;
  target?: string;
  content?: string;
}

/**
 * The component's actual source, read from the published registry item.
 *
 * ## Why it fetches instead of being server-rendered
 *
 * `getDocBodies()` renders *every* component's MDX into the components page so
 * the overlay can show any of them without a round-trip — that payload is
 * already ~800KB. These files run 20–30KB each, so inlining twenty of them to
 * display one would add roughly half a megabyte to a page where nineteen of
 * them are never looked at. `public/r/<name>.json` is already built by
 * `registry:build`, already committed, and already served statically, so the
 * open component fetches its own source and the other nineteen cost nothing.
 *
 * That also means this shows *exactly* what `shadcn add` installs — same file,
 * same bytes. A hand-maintained copy in MDX would drift the first time anyone
 * edited the component.
 *
 * Collapsed by default: these are 600–800 line files, and an un-collapsed one
 * buries the Props table under a mile of scroll.
 */
export function ComponentSource({
  name,
  /** Collapsed height in px. Enough to show the imports and the first export. */
  collapsedHeight = 320,
}: {
  name: string;
  collapsedHeight?: number;
}) {
  const [files, setFiles] = useState<RegistryFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  /**
   * Nothing happens until this is nearly on screen.
   *
   * Fetching the JSON is the cheap half. The expensive half is what renders it:
   * `DynamicCodeBlock` highlights in the browser, which pulls Shiki's TSX
   * TextMate grammar — 175KB that costs about 1.5s of script evaluation on a
   * mid-range phone, spent on a 700-line file sitting below the fold behind a
   * collapsed box. It was the single largest task on every component page.
   *
   * 400px of margin so it is ready by the time anyone scrolls to it.
   */
  useEffect(() => {
    if (near) return;
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    fetch(`/r/${name}.json`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((d) => {
        if (cancelled) return;
        const withSource = (d.files ?? []).filter(
          (f: RegistryFile) => f.content,
        );
        if (withSource.length === 0) setFailed(true);
        else setFiles(withSource);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [name, near]);

  if (failed) {
    return (
      <div className="not-prose my-6 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">
        Source unavailable. Run <code>pnpm run registry:build</code> to generate{" "}
        <code>public/r/{name}.json</code>.
      </div>
    );
  }

  if (!files) {
    return (
      <div
        ref={rootRef}
        className="not-prose my-6 animate-pulse rounded-2xl bg-muted"
        style={{ height: collapsedHeight }}
      />
    );
  }

  return (
    <div ref={rootRef} className="not-prose my-6 flex flex-col gap-4">
      {files.map((file) => (
        <figure key={file.path} className="flex flex-col gap-1.5">
          {files.length > 1 ? (
            <figcaption className="font-mono text-[12px] text-muted-foreground">
              {file.target ?? file.path}
            </figcaption>
          ) : null}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl",
              !expanded && "[&_figure]:!mb-0",
            )}
            style={expanded ? undefined : { maxHeight: collapsedHeight }}
          >
            <DynamicCodeBlock
              lang={file.path.endsWith(".ts") ? "ts" : "tsx"}
              code={file.content ?? ""}
            />
            {!expanded ? (
              // Fades the cut edge so it reads as "there is more" rather than a
              // line of code sliced in half.
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-background to-transparent" />
            ) : null}
          </div>
        </figure>
      ))}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="self-start rounded-4xl border border-border px-4 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
      >
        {expanded ? "Collapse code" : "Expand full code"}
      </button>
    </div>
  );
}
