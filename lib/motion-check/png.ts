import zlib from "node:zlib";

/**
 * PNG → pixels. Not a general codec: 8-bit, non-interlaced, colour-type 0/2/4/6
 * — measured against what Remotion's `imageFormat: "png"` actually emits, which
 * is colour-type 6 (RGBA): a composition is transparent wherever it does not
 * paint. Anything else throws rather than decodes wrong.
 *
 * Alpha is composited onto WHITE and dropped, so a `Raster` is always opaque.
 * That is the honest backdrop: every registry component is designed against the
 * light page it installs into, and compositing onto black would invent ink where
 * the component painted nothing.
 *
 * This is a second copy of the decoder in `snapcn-mcp/src/analyze.ts`.
 * Deliberate: the MCP is a sibling checkout, not a dependency, and the sync
 * flows the other way. `sharp`/`pngjs` is a 30MB native binary or a dependency
 * for 70 lines.
 */

export interface Raster {
  width: number;
  height: number;
  channels: 1 | 3;
  data: Uint8Array;
}

export interface Gray {
  width: number;
  height: number;
  /** One byte per pixel, row-major, top-left origin. Rec.601 luma. */
  data: Uint8Array;
}

const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Zero-copy view, so callers can hand us a plain Uint8Array from a stream. */
function buf(u: Uint8Array): Buffer {
  return Buffer.isBuffer(u)
    ? u
    : Buffer.from(u.buffer, u.byteOffset, u.byteLength);
}

export function decodePng(png: Uint8Array): Raster {
  const b = buf(png);
  if (b.length < 8 || !b.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error(`not a PNG (${b.length} bytes).`);
  }
  let off = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = -1;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (off + 8 <= b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString("latin1", off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (depth !== 8 || ![0, 2, 4, 6].includes(colour)) {
    throw new Error(
      `PNG is depth ${depth} colour-type ${colour}; this decoder reads 8-bit gray/RGB with or without alpha (0, 2, 4, 6) only.`,
    );
  }
  if (interlace !== 0) throw new Error("interlaced PNG — refusing to guess.");
  if (!width || !height) throw new Error("PNG has no IHDR dimensions.");
  // Samples per pixel on the wire; `channels` is what comes back out, after
  // alpha is composited away below.
  const samples = colour === 6 ? 4 : colour === 2 ? 3 : colour === 4 ? 2 : 1;
  const channels: 1 | 3 = samples >= 3 ? 3 : 1;
  const stride = width * samples;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * height) {
    throw new Error(
      `PNG inflated to ${raw.length} bytes, expected ${(stride + 1) * height}.`,
    );
  }
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;
    for (let i = 0; i < stride; i++) {
      // a = left, b = up, c = up-left, per the PNG spec's filter definitions.
      const a = i >= samples ? out[dst + i - samples] : 0;
      const bb = y > 0 ? out[up + i] : 0;
      const c = i >= samples && y > 0 ? out[up + i - samples] : 0;
      let p: number;
      switch (ft) {
        case 0:
          p = 0;
          break;
        case 1:
          p = a;
          break;
        case 2:
          p = bb;
          break;
        case 3:
          p = (a + bb) >> 1;
          break;
        case 4: {
          const pa = Math.abs(bb - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + bb - 2 * c);
          p = pa <= pb && pa <= pc ? a : pb <= pc ? bb : c;
          break;
        }
        default:
          throw new Error(`unknown PNG row filter ${ft} at row ${y}.`);
      }
      out[dst + i] = (raw[src + i] + p) & 0xff;
    }
  }
  if (samples === channels) return { width, height, channels, data: out };

  // Composite the alpha channel onto white and drop it.
  const n = width * height;
  const flat = Buffer.alloc(n * channels);
  for (let i = 0; i < n; i++) {
    const alpha = out[i * samples + channels] / 255;
    for (let c = 0; c < channels; c++) {
      flat[i * channels + c] = Math.round(
        out[i * samples + c] * alpha + 255 * (1 - alpha),
      );
    }
  }
  return { width, height, channels, data: flat };
}

/** Rec.601 luma; identity (no copy) when `r.channels === 1`. */
export function toGray(r: Raster): Gray {
  if (r.channels === 1) {
    return { width: r.width, height: r.height, data: r.data };
  }
  const n = r.width * r.height;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const s = i * 3;
    out[i] = Math.round(
      0.299 * r.data[s] + 0.587 * r.data[s + 1] + 0.114 * r.data[s + 2],
    );
  }
  return { width: r.width, height: r.height, data: out };
}
