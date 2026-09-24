import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Push rendered demos and their posters to R2, where `media.snapcn.dev` serves
 * them (see `MEDIA_BASE` in lib/demo-urls.ts).
 *
 *     CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… \
 *       node scripts/media-upload.mts <dir> <prefix> [bucket]
 *
 *   node scripts/media-upload.mts out/demos demos          # the free demos
 *   node scripts/media-upload.mts <pro-demos-dir> pro-demos # the paid ones
 *
 * Every file under `<dir>` goes to `<prefix>/<its path under dir>`, so
 * `out/demos/posters/x.webp` lands at `demos/posters/x.webp`.
 *
 * The site does not serve these itself. It did, from `public/demos`, off one
 * server with no CDN in front and a must-revalidate on every file: every visitor
 * paid a round trip per demo, far from the box paid it slowly, and 16MB of video
 * rode in the repository. From R2 behind Cloudflare they are cached at the edge.
 *
 * A year, immutable: every URL the site builds carries the file's own byte hash
 * as `?v=` (lib/demo-manifest.json, lib/pro-demo-manifest.json), so a changed
 * demo is a changed address and nothing here is ever revalidated or purged.
 *
 * Cloudflare's object API rather than the S3 one: it takes the same API token
 * everything else here uses, so there is no second credential to mint.
 */

const [dir, prefix, bucket = "snapcn"] = process.argv.slice(2);
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!dir || !prefix || !account || !token) {
  console.error(
    "usage: CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… node scripts/media-upload.mts <dir> <prefix> [bucket]",
  );
  process.exit(1);
}

const api = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}`;

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};

/** Every media file under `root`, as `<key>` → `<path on disk>`. */
function files(root: string, rel = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of readdirSync(path.join(root, rel)).sort()) {
    const sub = path.join(rel, name);
    const full = path.join(root, sub);
    if (statSync(full).isDirectory()) {
      for (const [k, v] of files(root, sub)) out.set(k, v);
    } else if (TYPES[path.extname(name)]) {
      out.set(`${prefix}/${sub.split(path.sep).join("/")}`, full);
    }
  }
  return out;
}

async function put(key: string, file: string) {
  const body = readFileSync(file);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${api}/objects/${key}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body,
    });
    if (res.ok) return body.length;
    if (attempt === 3) {
      throw new Error(
        `${key}: ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
    }
  }
}

const list = files(dir);
if (list.size === 0) {
  console.error(`Nothing to upload under ${dir}.`);
  process.exit(1);
}

let sent = 0;
let n = 0;
for (const [key, file] of list) {
  n += 1;
  sent += await put(key, file);
  console.log(`[${n}/${list.size}] ${key}`);
}
console.log(
  `\nUploaded ${(sent / 1024 / 1024).toFixed(1)}MB to r2://${bucket}/${prefix}.`,
);
