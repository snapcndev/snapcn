import { createHash } from "node:crypto";
import type { Frame } from "./measure";
import type { Gray } from "./png";

/**
 * Synthetic rasters, so every check in `measure.ts` is tested with no video and
 * no browser.
 *
 * This is the half of the work that matters: the checks are the thing being
 * trusted, and if you can only exercise them by rendering a video, nobody
 * exercises them and a wrong threshold ships as fact. Building the rasters in
 * code also lets a reversal, a freeze and a hinting drift be *constructed* on
 * purpose, which is the only way to know a detector fires.
 */

export function grayOf(width: number, height: number, fill = 250): Gray {
  return {
    width,
    height,
    data: new Uint8Array(width * height).fill(fill),
  };
}

export function copyOf(g: Gray): Gray {
  return { width: g.width, height: g.height, data: new Uint8Array(g.data) };
}

/** Whole-pixel rect, half-open box. Mutates `g` and returns it. */
export function drawRect(
  g: Gray,
  box: { x0: number; y0: number; x1: number; y1: number },
  level: number,
): Gray {
  const x0 = Math.max(0, Math.round(box.x0));
  const y0 = Math.max(0, Math.round(box.y0));
  const x1 = Math.min(g.width, Math.round(box.x1));
  const y1 = Math.min(g.height, Math.round(box.y1));
  for (let y = y0; y < y1; y++) {
    g.data.fill(level, y * g.width + x0, y * g.width + x1);
  }
  return g;
}

/**
 * A rect with sub-pixel edges, antialiased by EXACT area coverage — so its
 * intensity-weighted centroid is known in closed form, which is the only way to
 * assert `inkCentroid` to 0.01px. Composites over whatever is already there.
 */
export function drawRectSubpixel(
  g: Gray,
  box: { x0: number; y0: number; x1: number; y1: number },
  level: number,
): Gray {
  const px0 = Math.max(0, Math.floor(box.x0));
  const py0 = Math.max(0, Math.floor(box.y0));
  const px1 = Math.min(g.width, Math.ceil(box.x1));
  const py1 = Math.min(g.height, Math.ceil(box.y1));
  for (let y = py0; y < py1; y++) {
    const cy = Math.max(0, Math.min(box.y1, y + 1) - Math.max(box.y0, y));
    if (cy <= 0) continue;
    for (let x = px0; x < px1; x++) {
      const cx = Math.max(0, Math.min(box.x1, x + 1) - Math.max(box.x0, x));
      if (cx <= 0) continue;
      const i = y * g.width + x;
      g.data[i] = Math.round(g.data[i] + cx * cy * (level - g.data[i]));
    }
  }
  return g;
}

/**
 * A clip of `count` frames, frame i produced by `at(i)`. Build a monotone scale,
 * a reversal, a five-frame freeze or a hinting wobble on purpose.
 *
 * `hash` stands in for capture's sha1-of-the-PNG-bytes: same guarantee (two
 * identical rasters hash equal, two different ones do not), no encoder needed.
 */
export function clipOf(count: number, at: (i: number) => Gray): Frame[] {
  return Array.from({ length: count }, (_, i) => {
    const gray = at(i);
    return {
      index: i,
      gray,
      hash: createHash("sha1").update(gray.data).digest("hex"),
    };
  });
}
