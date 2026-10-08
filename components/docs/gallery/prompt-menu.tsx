"use client";

import {
  CheckIcon,
  ChevronDown,
  ClipboardCopy,
  FileCode,
  ImageIcon,
  Plug,
  TerminalIcon,
} from "lucide-react";
import { compressToEncodedURIComponent } from "lz-string";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MCP_CLIENT_ICONS } from "@/components/icons/mcp-client-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { installCommand } from "@/config/site";
import { type AnalyticsEvents, useTrackEvent } from "@/lib/analytics";
import type { GalleryItem } from "@/lib/gallery-data";

const SITE_URL = "https://snapcn.dev";

type Action = AnalyticsEvents["component_prompt_used"]["action"];

/**
 * Where a prompt can go. A CLI agent has no web deep link, so it copies; the
 * rest open with the prompt filled in, never sent — except Bolt, whose
 * `?prompt=` submits on load, and v0, which opens the registry item itself
 * (shadcn's documented "Open in v0") rather than a prompt about it.
 *
 * None of this goes through the snapcn MCP. The MCP needs a paid key; this
 * menu is the free path, and a free install must never hit a paywall.
 */
const AGENTS: {
  id: Action;
  label: string;
  /** Free components only: a builder cannot hold a Pro key. */
  builder?: boolean;
  href?: (prompt: string, slug: string) => string;
}[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  {
    id: "cursor",
    label: "Cursor",
    // cursor.com/docs/reference/deeplinks — 8,000-character cap; ours is ~800.
    href: (p) => `https://cursor.com/link/prompt?text=${encodeURIComponent(p)}`,
  },
  {
    id: "replit",
    label: "Replit",
    builder: true,
    // docs.replit.com/references/integrations/open-in-replit — LZ-compressed.
    href: (p) =>
      `https://replit.com/?stack=Build&prompt=${compressToEncodedURIComponent(p)}&referrer=snapcn`,
  },
  {
    id: "lovable",
    label: "Lovable",
    builder: true,
    // docs.lovable.dev/integrations/build-with-url — a hash, not a query.
    href: (p) => `https://lovable.dev/#prompt=${encodeURIComponent(p)}`,
  },
  {
    id: "bolt",
    label: "Bolt.new",
    builder: true,
    href: (p) => `https://bolt.new/?prompt=${encodeURIComponent(p)}`,
  },
  {
    id: "v0",
    label: "v0 by Vercel",
    builder: true,
    // ui.shadcn.com/docs/registry/open-in-v0
    href: (_, slug) =>
      `https://v0.dev/chat/api/open?url=${encodeURIComponent(`${SITE_URL}/r/${slug}.json`)}`,
  },
];

function buildPrompt(item: GalleryItem, slug: string) {
  return [
    `Add the snapcn "${item.name}" Remotion component to this project.`,
    "",
    item.description,
    "",
    `1. Install it: ${installCommand(slug)}`,
    "   The source lands in components/snap-cn/ as plain Remotion code (useCurrentFrame, interpolate, spring) that this project owns and can edit.",
    item.pro
      ? "   It is a snapcn Pro component: the install reads the API key from components.json (see snapcn.dev/account)."
      : null,
    `2. Read its docs and props: ${SITE_URL}${item.href}.md`,
    "3. Use it inside a Remotion <Composition>. If this project has no Remotion setup, install remotion and @remotion/player and show it in a <Player>.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** The poster as a PNG — the clipboard takes nothing else everywhere. */
function pngFrom(src: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // media.snapcn.dev answers `Access-Control-Allow-Origin: *`; without this
    // the canvas is tainted and `toBlob` throws.
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob"))),
        "image/png",
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function sourceOf(slug: string) {
  const res = await fetch(`/r/${slug}.json`);
  const { files } = (await res.json()) as { files: { content: string }[] };
  return files.map((f) => f.content).join("\n\n");
}

const ITEM_ICON = "size-4 text-muted-foreground";

/**
 * "Copy prompt" and its menu, on a component's panel: the prompt, the source,
 * the poster, the CLI line, and the same prompt carried into a named agent or
 * app builder.
 */
export function PromptMenu({
  item,
  slug,
  poster,
}: {
  item: GalleryItem;
  slug: string;
  poster: string | null;
}) {
  const trackEvent = useTrackEvent();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const prompt = buildPrompt(item, slug);

  const done = (action: Action) => {
    trackEvent("component_prompt_used", { component: slug, action });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const copy = (action: Action, text: string | Promise<string>) =>
    // A promise in a ClipboardItem, not an await before writeText: Safari only
    // allows the clipboard inside the click, and a fetch ends the click.
    navigator.clipboard
      .write([new ClipboardItem({ "text/plain": text })])
      .then(() => done(action));

  return (
    <div className="flex h-11 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/20 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
      <button
        type="button"
        onClick={() => copy("prompt", prompt)}
        className="inline-flex items-center justify-center gap-1.5 px-3 font-medium text-foreground text-sm transition-[background-color] duration-150 ease-out hover:bg-muted/60 active:bg-muted motion-reduce:transition-none"
      >
        <span
          key={copied ? "copied" : "copy"}
          className="inline-flex items-center gap-2 animate-in fade-in-0 duration-150 motion-reduce:animate-none"
        >
          {copied ? (
            <CheckIcon
              className="size-4 text-primary xl:hidden"
              aria-hidden="true"
            />
          ) : (
            // Hidden in the 296px desktop column, where it is the ~20px that
            // would push "Make a video" past its button.
            <ClipboardCopy className="size-4 xl:hidden" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy prompt"}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More ways to use this component"
          className="flex w-9 shrink-0 items-center justify-center border-border border-l text-foreground transition-colors hover:bg-muted/60 data-popup-open:bg-muted/60"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={() => copy("prompt", prompt)}>
            <ClipboardCopy className={ITEM_ICON} />
            Copy prompt
          </DropdownMenuItem>
          {item.pro ? null : (
            <DropdownMenuItem onClick={() => copy("source", sourceOf(slug))}>
              <FileCode className={ITEM_ICON} />
              <span className="truncate font-mono text-[13px]">{slug}.tsx</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {poster ? (
            <DropdownMenuItem
              onClick={() =>
                navigator.clipboard
                  .write([new ClipboardItem({ "image/png": pngFrom(poster) })])
                  .then(() => done("image"))
              }
            >
              <ImageIcon className={ITEM_ICON} />
              Copy image
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => copy("cli", installCommand(slug))}>
            <TerminalIcon className={ITEM_ICON} />
            Copy CLI command
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Optimized for</DropdownMenuLabel>
            {AGENTS.filter((a) => !(a.builder && item.pro)).map((a) => {
              const Icon = MCP_CLIENT_ICONS[a.id];
              return (
                <DropdownMenuItem
                  key={a.id}
                  onClick={() => {
                    if (!a.href) return copy(a.id, prompt);
                    window.open(a.href(prompt, slug), "_blank", "noopener");
                    trackEvent("component_prompt_used", {
                      component: slug,
                      action: a.id,
                    });
                  }}
                >
                  {Icon ? <Icon className="size-4" /> : null}
                  {a.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {/* The one row that is an upsell, and it says so: the MCP needs a
              paid key, so it is a link to what it is, not a step in the path. */}
          <DropdownMenuItem
            onClick={() => {
              trackEvent("component_prompt_used", {
                component: slug,
                action: "mcp",
              });
              router.push("/docs/mcp");
            }}
          >
            <Plug className={ITEM_ICON} />
            snapcn MCP
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              Pro
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
