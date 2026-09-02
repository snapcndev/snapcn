"use client";

import { Palette } from "lucide-react";
import { useRef } from "react";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type BrandKit, isLogoSrc } from "@/lib/video-editor/brand";
import { isHexColor } from "@/lib/video-editor/types";

/**
 * One accent and one logo for the whole video.
 *
 * Beside the FontPicker rather than inside it: the typeface is already a
 * first-class field on the video with a per-clip override, and folding it in
 * here would either duplicate that control or move it somewhere people have
 * already learned to look for it.
 *
 * Every value set here lands on every clip that declared a slot for it — see
 * `lib/video-editor/brand`, which is also where "which knobs" is decided.
 */
export function BrandKitPicker({
  value,
  onChange,
}: {
  value: BrandKit;
  onChange: (next: BrandKit) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const accent = value.accent ?? "#3072DB";

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      // A file the browser reads as something other than an image would reach
      // an `<img src>` in a server render; the same allowlist the renderer uses.
      if (isLogoSrc(src)) onChange({ ...value, logo: src });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Brand kit"
        className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
      >
        <Palette className="size-3.5 text-muted-foreground" />
        Brand
        {value.accent ? (
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full border border-border/60"
            style={{ background: value.accent }}
          />
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <div>
          <p className="font-medium text-sm text-foreground">Brand kit</p>
          <p className="text-xs text-muted-foreground">
            Applied to every clip, including ones you add later.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
          {/* Only the knobs each config marked `brand: "accent"` move. A
              headline's ink is deliberately not one of them. */}
          <span className="text-xs font-medium text-muted-foreground">
            Accent
          </span>
          <ColorPicker
            id="brand-accent"
            value={accent}
            onValueChange={(next) =>
              onChange({ ...value, accent: isHexColor(next) ? next : null })
            }
            className="flex items-center gap-2"
          >
            <span className="font-mono text-xs font-medium text-foreground uppercase">
              {accent}
            </span>
            <span
              aria-hidden="true"
              className="inline-flex size-5 shrink-0 rounded-lg border border-border/60"
              style={{ background: accent }}
            />
          </ColorPicker>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Logo
          </span>
          {value.logo ? (
            // biome-ignore lint/performance/noImgElement: tiny preview of a user data-URL/URL
            <img
              src={value.logo}
              alt=""
              className="size-6 shrink-0 rounded object-contain"
            />
          ) : null}
          <input
            type="text"
            value={
              value.logo?.startsWith("data:")
                ? "uploaded image"
                : (value.logo ?? "")
            }
            readOnly={value.logo?.startsWith("data:")}
            placeholder="https://…"
            onChange={(e) =>
              onChange({
                ...value,
                logo: isLogoSrc(e.target.value) ? e.target.value : null,
              })
            }
            className="min-w-0 flex-1 bg-transparent text-right font-mono text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="shrink-0 rounded-lg bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
          >
            Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        <button
          type="button"
          onClick={() => onChange({ accent: null, logo: null })}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      </PopoverContent>
    </Popover>
  );
}
