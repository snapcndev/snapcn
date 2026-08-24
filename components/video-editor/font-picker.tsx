"use client";

import { Check, Search, Type } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  BUILT_IN_FONTS,
  GOOGLE_FAMILIES,
  googleFontHref,
  resolveFont,
} from "@/lib/video-editor/fonts";

/**
 * Families shown before anyone types.
 *
 * 1821 alphabetical entries opens on `ABeeZee`, which tells a reader nothing
 * about what is here. A short curated head means the list is useful closed and
 * the search is there when it is not.
 */
const SUGGESTED = [
  "Geist",
  "Inter",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Bebas Neue",
  "Space Grotesk",
  "DM Sans",
  "Lora",
  "Oswald",
  "Anton",
  "Raleway",
  "Merriweather",
  "JetBrains Mono",
];

/** Rendering 1821 rows is what makes a picker feel broken. */
const MAX_ROWS = 60;

export function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUGGESTED;
    // Prefix matches first: typing "rob" should offer Roboto before
    // "Baloo Bhaijaan 2" just because that also contains the letters.
    const starts: string[] = [];
    const contains: string[] = [];
    for (const family of GOOGLE_FAMILIES) {
      const lower = family.toLowerCase();
      if (lower.startsWith(q)) starts.push(family);
      else if (lower.includes(q)) contains.push(family);
      if (starts.length >= MAX_ROWS) break;
    }
    return [...starts, ...contains].slice(0, MAX_ROWS);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Typeface"
        className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
      >
        <Type className="size-3.5 text-muted-foreground" />
        <span className="max-w-28 truncate">{resolveFont(value).label}</span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-0">
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          {/* biome-ignore lint/a11y/noAutofocus: the popover exists to be typed
              into — landing anywhere else costs a second interaction. */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 1,800+ fonts"
            className="w-full bg-transparent py-2.5 pr-3 pl-8 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {!query && (
            <Section label="On this machine">
              {Object.entries(BUILT_IN_FONTS).map(([id, f]) => (
                <Row
                  key={id}
                  family={id}
                  label={f.label}
                  preview={f.stack}
                  selected={value === id}
                  onPick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                />
              ))}
            </Section>
          )}

          <Section label={query ? "Results" : "Google Fonts"}>
            {results.map((family) => (
              <Row
                key={family}
                family={family}
                label={family}
                preview={`'${family}', sans-serif`}
                selected={value === family}
                onPick={() => {
                  onChange(family);
                  setOpen(false);
                }}
              />
            ))}
            {results.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No family matches “{query}”.
              </p>
            )}
          </Section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="px-2 py-1.5 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * One family, set in itself.
 *
 * The stylesheet is attached on hover rather than for every visible row: sixty
 * `<link>` elements on open is sixty requests to fetch faces most people scroll
 * straight past. Pointing at a row is the cheapest honest signal of interest.
 */
function Row({
  family,
  label,
  preview,
  selected,
  onPick,
}: {
  family: string;
  label: string;
  preview: string;
  selected: boolean;
  onPick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  function attach() {
    if (loaded || family in BUILT_IN_FONTS) return;
    setLoaded(true);
    if (document.querySelector(`link[data-google-font="${family}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = googleFontHref(family);
    link.dataset.googleFont = family;
    document.head.appendChild(link);
  }

  return (
    <button
      type="button"
      onClick={onPick}
      onPointerEnter={attach}
      onFocus={attach}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
        selected && "bg-muted",
      )}
    >
      <span
        className="truncate text-sm text-foreground"
        style={{ fontFamily: loaded ? preview : undefined }}
      >
        {label}
      </span>
      {selected && <Check className="size-3.5 shrink-0 text-primary" />}
    </button>
  );
}
