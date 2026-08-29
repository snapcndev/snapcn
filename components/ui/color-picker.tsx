"use client";

import { useCallback, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  clamp01,
  type Hsv,
  hexToHsv,
  hsvToHex,
  normalizeHex,
} from "@/lib/color-hex";
import { cn } from "@/lib/utils";

/**
 * A colour picker: saturation field, hue rail, typed hex, swatches.
 *
 * ## Why this is written rather than installed
 *
 * The obvious move is the 21st.dev picker, and it brings nine packages —
 * `@radix-ui/react-popover`, `-dropdown-menu`, `-separator`, `-slot`,
 * `class-variance-authority`, `@uiw/color-convert`, and two `@uiw/react-color-*`
 * surfaces. This app has every one of those already, in a different form:
 * `components/ui/*` is built on **@base-ui/react**, and `culori` has shipped in
 * `package.json` since the registry needed oklch. Installing that set would put
 * a second primitives library beside the first and a second colour library
 * beside `culori` — and the Radix `popover.tsx` would shadow the base-ui one the
 * rest of the app imports.
 *
 * What is genuinely missing is about seventy lines of pointer maths, below.
 *
 * ## What it replaces
 *
 * `<input type="color">`. Native is fine for a swatch and useless for the thing
 * people actually do here, which is paste a hex out of a brand doc. The native
 * control has no text field on any platform, so a brand colour had to be
 * eyeballed off a gradient.
 */
export interface ColorPickerProps {
  /** Hex, with the hash. Anything unparseable falls back to black. */
  value: string;
  onValueChange: (hex: string) => void;
  /** Shown under the rail. The brand kit passes the colours already in play. */
  swatches?: string[];
  children: React.ReactNode;
  className?: string;
  /** Put on the trigger, so a sibling `<label htmlFor>` targets a real control. */
  id?: string;
}

const DEFAULT_SWATCHES = [
  "#0A0A0B",
  "#FFFFFF",
  "#F8371A",
  "#F97C1B",
  "#FAC81C",
  "#3FD0B6",
  "#2CADF6",
  "#6462FC",
];

export function ColorPicker({
  value,
  onValueChange,
  swatches = DEFAULT_SWATCHES,
  children,
  className,
  id,
}: ColorPickerProps) {
  const hsv = hexToHsv(value);
  /**
   * The hex field is uncontrolled while it has focus.
   *
   * Typing "#1a2b3c" passes through "#1", "#1a", "#1a2" — none of which are
   * colours. Parsing each keystroke and writing the result back makes the field
   * fight the typist, which is precisely the failure the native input already
   * had. So the draft is held here and only committed when it parses.
   */
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: { h?: number; s?: number; v?: number }) =>
    onValueChange(hsvToHex({ ...hsv, ...next }));

  return (
    <Popover>
      {/* A real <button>. Base UI's trigger defaults `nativeButton` to true and
          logs — correctly — when handed anything else: a span loses the
          keyboard semantics this needs, and the trigger genuinely is a button. */}
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            className={cn("cursor-pointer text-left", className)}
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <SaturationField hsv={hsv} onChange={(s, v) => commit({ s, v })} />
        <HueRail hue={hsv.h} onChange={(h) => commit({ h })} />

        <div className="mt-3 flex items-center gap-2">
          <span
            className="size-8 shrink-0 rounded-lg border border-border/60"
            style={{ background: value }}
            aria-hidden="true"
          />
          <input
            aria-label="Hex colour"
            value={draft ?? value.toUpperCase()}
            onChange={(e) => {
              const next = e.target.value;
              setDraft(next);
              // Only the six-digit form commits while typing. `#1a2` is valid
              // hex and means `#11AA22`, but on the way to `#1a2b3c` it is a
              // keystroke — committing it flashes a colour nobody asked for.
              // The short form is honoured on blur, below, where it is a
              // finished answer rather than a waypoint.
              if (/^#?[0-9a-f]{6}$/i.test(next.trim())) {
                const parsed = normalizeHex(next);
                if (parsed) onValueChange(parsed);
              }
            }}
            onBlur={() => {
              if (draft !== null) {
                const parsed = normalizeHex(draft);
                if (parsed) onValueChange(parsed);
              }
              setDraft(null);
            }}
            spellCheck={false}
            className="h-8 w-full min-w-0 rounded-lg border border-border/60 bg-background px-2 font-medium font-mono text-foreground text-sm uppercase outline-none focus:border-foreground/30"
          />
        </div>

        {swatches.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {swatches.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => onValueChange(swatch.toUpperCase())}
                aria-label={`Use ${swatch}`}
                className="size-5 cursor-pointer rounded border border-border/60 transition-transform hover:scale-110"
                style={{ background: swatch }}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── The two drag surfaces ──────────────────────────────────────────────── */

/**
 * Pointer capture, not mousemove-on-window.
 *
 * `setPointerCapture` keeps events coming to this element once the drag starts,
 * so dragging off the edge of the square — which is exactly how someone reaches
 * pure white or pure black — keeps tracking instead of dropping the gesture. It
 * also covers touch and pen without a second code path.
 */
function useDrag(onMove: (xRatio: number, yRatio: number) => void) {
  const ref = useRef<HTMLDivElement | null>(null);

  const emit = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      onMove(
        clamp01((e.clientX - box.left) / box.width),
        clamp01((e.clientY - box.top) / box.height),
      );
    },
    [onMove],
  );

  return {
    ref,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      emit(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) emit(e);
    },
  };
}

function SaturationField({
  hsv,
  onChange,
}: {
  hsv: Hsv;
  onChange: (s: number, v: number) => void;
}) {
  const drag = useDrag((x, y) => onChange(x, 1 - y));
  return (
    <div
      {...drag}
      ref={drag.ref}
      className="relative h-32 w-full cursor-crosshair touch-none overflow-hidden rounded-lg border border-border/60"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
      }}
    >
      <Knob left={hsv.s} top={1 - hsv.v} />
    </div>
  );
}

function HueRail({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (hue: number) => void;
}) {
  const drag = useDrag((x) => onChange(Math.round(x * 360)));
  return (
    <div
      {...drag}
      ref={drag.ref}
      className="relative mt-3 h-3 w-full cursor-pointer touch-none rounded-full border border-border/60"
      style={{
        background:
          "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
      }}
    >
      <Knob left={hue / 360} top={0.5} />
    </div>
  );
}

function Knob({ left, top }: { left: number; top: number }) {
  return (
    <span
      aria-hidden="true"
      className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute size-3 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
      style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
    />
  );
}
