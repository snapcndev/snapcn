import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Frame-by-frame comparison of a render against a reference recording.
 *
 * The point is to stop arguing about whether a motion looks right. Both files
 * are cut to 30fps, reduced to the same three signals per frame, and the errors
 * are printed side by side:
 *
 *   ink bounding box   — position and extent of the type
 *   chroma pixel count — how much accent is on screen
 *   mean luminance     — catches a flood or a fade the bbox cannot see
 *
 *   node scripts/dev/compare-frames.mts <reference.mov> <render.mp4> [refOffset]
 *
 * `refOffset` skips leading frames of the reference (the tail of a previous
 * scene), so frame 0 of the render lines up with the beat's real first frame.
 */
const [ref, mine, offsetArg] = process.argv.slice(2);
if (!ref || !mine) {
  throw new Error("usage: compare-frames.mts <reference> <render> [refOffset]");
}
const offset = Number(offsetArg ?? 0);

function frames(file: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "cmp-"));
  // Scale both to a common width so the numbers are directly comparable even
  // when the render and the recording were captured at different sizes.
  const r = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      file,
      "-vf",
      "fps=30,scale=1400:-1",
      `${dir}/f%04d.png`,
      "-y",
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${r.stderr}`);
  return dir;
}

const A = frames(ref);
const B = frames(mine);
const a = readdirSync(A).sort();
const b = readdirSync(B).sort();

const py = `
import sys
from PIL import Image
def sig(p):
    im = Image.open(p).convert("RGB").crop((0, 0, 1400, 720))
    d = list(im.getdata()); W = 1400
    dark = [i % W for i, v in enumerate(d) if sum(v) / 3 < 110]
    chroma = sum(1 for v in d if max(v) - min(v) > 34 and sum(v) / 3 < 235)
    lum = sum(sum(v) / 3 for v in d) / len(d)
    if not dark: return (None, None, chroma, lum)
    return (min(dark), max(dark), chroma, lum)
for line in sys.stdin:
    p = line.strip()
    if p: print(*sig(p), sep=",")
`;

function signals(dir: string, files: string[]) {
  const r = spawnSync("python3", ["-c", py], {
    input: files.map((f) => path.join(dir, f)).join("\n"),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout
    .trim()
    .split("\n")
    .map((l) => l.split(","));
}

const SA = signals(A, a);
const SB = signals(B, b);

console.log(
  "frame |  refL  refR  refW |   myL   myR    myW |    ΔL    ΔW | refChr myChr",
);
const dw: number[] = [];
const dl: number[] = [];
for (let i = 0; i + offset < SA.length && i < SB.length; i += 1) {
  const [rl, rr, rc] = SA[i + offset];
  const [ml, mr, mc] = SB[i];
  const has = rl !== "None" && ml !== "None";
  const rw = has ? Number(rr) - Number(rl) : null;
  const mw = has ? Number(mr) - Number(ml) : null;
  if (has && rw !== null && mw !== null) {
    dw.push(Math.abs(mw - rw));
    dl.push(Math.abs(Number(ml) - Number(rl)));
  }
  console.log(
    `${String(i).padStart(5)} | ${String(rl).padStart(5)} ${String(rr).padStart(5)} ${String(rw).padStart(5)} |` +
      ` ${String(ml).padStart(5)} ${String(mr).padStart(5)} ${String(mw).padStart(6)} |` +
      ` ${String(has ? Number(ml) - Number(rl) : "-").padStart(5)} ${String(has && rw !== null && mw !== null ? mw - rw : "-").padStart(5)} |` +
      ` ${String(rc).padStart(6)} ${String(mc).padStart(5)}`,
  );
}
const mean = (xs: number[]) =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
console.log(
  `\nmean |Δwidth| = ${mean(dw).toFixed(1)}px   mean |Δleft| = ${mean(dl).toFixed(1)}px   over ${dw.length} frames`,
);
