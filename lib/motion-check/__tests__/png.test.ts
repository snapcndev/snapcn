import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodePng, toGray } from "../png";

/**
 * The decoder is the one place in `motion-check` where a bug is silent and
 * catastrophic: a mis-applied row filter still produces a plausible raster, and
 * every number downstream is then confidently wrong. So this round-trips real
 * PNG bytes through a local encoder that rotates through ALL FIVE row filters —
 * Remotion's PNGs use whatever libpng's heuristic picks, which is all of them.
 */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const o = Buffer.alloc(12 + data.length);
  o.writeUInt32BE(data.length, 0);
  o.write(type, 4, "latin1");
  data.copy(o, 8);
  o.writeUInt32BE(crc32(o.subarray(4, 8 + data.length)), 8 + data.length);
  return o;
}

/** Forward row filter — the exact inverse of the decoder's unfilter. */
function filterRow(
  raw: Buffer,
  prev: Buffer | null,
  bpp: number,
  ft: number,
): Buffer {
  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const a = i >= bpp ? raw[i - bpp] : 0;
    const b = prev ? prev[i] : 0;
    const c = i >= bpp && prev ? prev[i - bpp] : 0;
    let p = 0;
    if (ft === 1) p = a;
    else if (ft === 2) p = b;
    else if (ft === 3) p = (a + b) >> 1;
    else if (ft === 4) {
      const pa = Math.abs(b - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + b - 2 * c);
      p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    out[i] = (raw[i] - p) & 0xff;
  }
  return out;
}

const COLOUR_OF: Record<number, number> = { 1: 0, 2: 4, 3: 2, 4: 6 };

function encodePng(
  width: number,
  height: number,
  samples: 1 | 2 | 3 | 4,
  data: Uint8Array,
  opts: { depth?: number; colour?: number; interlace?: number } = {},
): Buffer {
  const stride = width * samples;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const raw = Buffer.from(data.subarray(y * stride, (y + 1) * stride));
    const prev =
      y > 0 ? Buffer.from(data.subarray((y - 1) * stride, y * stride)) : null;
    const ft = y % 5; // rotate 0..4 so every unfilter branch is exercised
    rows.push(
      Buffer.concat([Buffer.from([ft]), filterRow(raw, prev, samples, ft)]),
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = opts.depth ?? 8;
  ihdr[9] = opts.colour ?? COLOUR_OF[samples];
  ihdr[12] = opts.interlace ?? 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("decodePng", () => {
  it("round-trips 8-bit gray through all five row filters", () => {
    const w = 23;
    const h = 17; // not a multiple of 5, so the filter rotation wraps
    const src = new Uint8Array(w * h);
    for (let i = 0; i < src.length; i++) src[i] = (i * 37 + (i >> 3)) & 0xff;
    const r = decodePng(encodePng(w, h, 1, src));
    expect([r.width, r.height, r.channels]).toEqual([23, 17, 1]);
    expect(Buffer.from(r.data).equals(Buffer.from(src))).toBe(true);
  });

  it("round-trips 8-bit RGB and reduces it with Rec.601", () => {
    const src = new Uint8Array([
      200, 100, 50, 0, 0, 0, 255, 255, 255, 10, 20, 30,
    ]);
    const g = toGray(decodePng(encodePng(4, 1, 3, src)));
    // 0.299*200 + 0.587*100 + 0.114*50 = 124.2
    expect(Array.from(g.data)).toEqual([124, 0, 255, 18]);
  });

  it("composites RGBA onto white — Remotion paints nothing where a scene is transparent", () => {
    // opaque black, half-transparent black, fully transparent red, opaque white.
    const src = new Uint8Array([
      0, 0, 0, 255, 0, 0, 0, 128, 255, 0, 0, 0, 255, 255, 255, 255,
    ]);
    const g = toGray(decodePng(encodePng(4, 1, 4, src)));
    // A transparent pixel MUST read as background, never as ink.
    expect(Array.from(g.data)).toEqual([0, 127, 255, 255]); // 128/255 alpha
  });

  it("round-trips 8-bit gray+alpha", () => {
    const g = toGray(
      decodePng(encodePng(2, 1, 2, new Uint8Array([0, 255, 0, 0]))),
    );
    expect(Array.from(g.data)).toEqual([0, 255]);
  });

  it("refuses what it cannot decode instead of guessing", () => {
    const px = new Uint8Array(4);
    expect(() => decodePng(new Uint8Array([1, 2, 3]))).toThrow(/not a PNG/);
    // colour-type 3 is a palette — decodable-looking bytes, meaningless numbers.
    expect(() => decodePng(encodePng(2, 2, 1, px, { colour: 3 }))).toThrow(
      /colour-type 3/,
    );
    expect(() => decodePng(encodePng(2, 2, 1, px, { depth: 16 }))).toThrow(
      /depth 16/,
    );
    expect(() => decodePng(encodePng(2, 2, 1, px, { interlace: 1 }))).toThrow(
      /interlaced/,
    );
  });

  it("hands back the same buffer for gray — no copy per frame", () => {
    const r = decodePng(encodePng(8, 8, 1, new Uint8Array(64).fill(9)));
    expect(toGray(r).data).toBe(r.data);
  });
});
