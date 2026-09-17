/**
 * Push the pro demos to R2.
 *
 *     CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… \
 *       node scripts/pro-upload.mts <dir-from-pro-demos> [bucket]
 *
 * The free demos ride in `public/demos` and are served by the app. The pro ones
 * cannot: `registry/snap-cn-pro` is gitignored, so a public checkout has neither
 * the components nor any way to build their previews, and a build on CI would
 * emit nothing. So the files live in a bucket and the gallery plays them from
 * there — set `NEXT_PUBLIC_PRO_DEMO_BASE` to the bucket's public origin.
 *
 * Cloudflare's object API rather than the S3 one: it takes the same API token
 * everything else here uses, so there is no second credential to mint, store and
 * rotate for what is fourteen public mp4s.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const bucket = process.argv[3] ?? "snapcn-pro-demos";
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!dir || !account || !token) {
  console.error(
    "usage: CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… node scripts/pro-upload.mts <dir> [bucket]",
  );
  process.exit(1);
}

const api = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}`;

/** Every file to send, as `<key>` → `<path on disk>`, mirroring the demo layout. */
function files(): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of readdirSync(dir).sort()) {
    if (name.endsWith(".mp4")) out.set(name, path.join(dir, name));
  }
  const posters = path.join(dir, "posters");
  if (statSync(posters, { throwIfNoEntry: false })?.isDirectory()) {
    for (const name of readdirSync(posters).sort()) {
      if (name.endsWith(".webp")) {
        out.set(`posters/${name}`, path.join(posters, name));
      }
    }
  }
  return out;
}

async function put(key: string, file: string) {
  const body = readFileSync(file);
  const res = await fetch(`${api}/objects/${key}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": key.endsWith(".mp4") ? "video/mp4" : "image/webp",
      // A year, immutable: every URL the site builds carries the file's own byte
      // hash as `?v=`, so a changed demo is a changed address and nothing here
      // ever has to be revalidated or purged.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `${key}: ${res.status} ${(await res.text()).slice(0, 200)}`,
    );
  }
  return body.length;
}

const list = files();
if (list.size === 0) {
  console.error(
    `No .mp4 or posters/*.webp under ${dir} — run pro-demos first.`,
  );
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
  `\nUploaded ${(sent / 1024 / 1024).toFixed(1)}MB to r2://${bucket}.\n` +
    `The bucket has to be publicly readable for the gallery to play any of it — ` +
    `attach a custom domain (or enable the r2.dev URL) in the Cloudflare ` +
    `dashboard, then set NEXT_PUBLIC_PRO_DEMO_BASE to that origin.`,
);
