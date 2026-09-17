import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where the paid items live. Outside `public/`, deliberately.
 *
 * `split-pro` writes them to `registry/.private/` locally, which is the default
 * below and is what a dev checkout uses. **Production cannot use it.** The image
 * is built by Coolify from the public GitHub repo, and `registry/snap-cn-pro/`
 * is gitignored precisely because that repo is public — so the build context has
 * no pro source and this directory comes out empty. That is why every pro fetch
 * answered 404 in production and the 402 in `app/r/[file]` had never fired.
 *
 * So production points `PRO_PRIVATE_DIR` at the persistent volume the container
 * already mounts (`-v /data:/data`, alongside renders/audio/showcase). The files
 * are copied there once with scp and survive every deploy, because a volume is
 * not part of the image. Pro source therefore never enters the public repo, the
 * build context, or an image layer. See DEPLOYMENT.md.
 *
 * Shared by the paid install route and the free-sample route, so the two can
 * never read from different places.
 */
const PRIVATE_DIR = process.env.PRO_PRIVATE_DIR
  ? path.resolve(process.env.PRO_PRIVATE_DIR)
  : path.join(process.cwd(), "registry", ".private");

/**
 * The built registry item for a paid component, or null when this server does
 * not have it. `name` must already be validated as a bare component name — this
 * joins it onto a path.
 */
export async function readProItem(name: string): Promise<string | null> {
  try {
    return await readFile(path.join(PRIVATE_DIR, `${name}.json`), "utf8");
  } catch {
    return null;
  }
}
