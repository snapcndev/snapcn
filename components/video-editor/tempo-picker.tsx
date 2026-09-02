"use client";

import { Gauge } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DEFAULT_TEMPO } from "@/lib/video-editor/tempo";

/**
 * How fast the whole video runs.
 *
 * Fixed steps rather than a slider: `speed` is a multiplier on a component's
 * own clock, and the difference between 1.15 and 1.2 is not something anybody
 * can see or wants to hunt for. Five named paces is the whole useful range.
 *
 * Every step is a *request*. A clip whose `speed` control starts at `min: 1` —
 * 18 of the 38 that have one — cannot slow down, so "Slower" leaves it exactly
 * where it was rather than writing a value its own control rejects. That is
 * `applyTempo`'s job, not this control's.
 */
const STEPS: [label: string, value: number][] = [
  ["Slowest", 0.5],
  ["Slower", 0.75],
  ["Normal", DEFAULT_TEMPO],
  ["Faster", 1.5],
  ["Fastest", 2],
];

export function TempoPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const label =
    STEPS.find(([, v]) => v === value)?.[0] ?? `${value.toFixed(2)}×`;

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Pace"
        className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
      >
        <Gauge className="size-3.5 text-muted-foreground" />
        {label}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-52 p-1">
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          Re-times every clip that can be re-timed, and shortens it to match.
        </p>
        {STEPS.map(([name, v]) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(v)}
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
              v === value
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {name}
            <span className="font-mono text-xs">{v}×</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
