import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import {
  DOCS_PAGE_META,
  INSTALL_ALL_NAMES,
  INSTALL_COMMAND,
  installCommand,
} from "@/config/site";
import { source } from "@/source";

export const revalidate = 3600;

/**
 * The card is the site's own light theme, to the token — `--background`
 * `#faf9f6`, `--foreground` `#141414`, `--muted-foreground` `#6e6a63`,
 * `--border` `#d9d9d9`. `var()` cannot reach a Satori render (there is no CSS
 * in an ImageResponse), so the values are spelled out here; they are the only
 * copy of them outside `app/globals.css` and DESIGN.md.
 *
 * It carries no accent. DESIGN.md: "colour is functional, never decorative" —
 * a static card has no primary action, no link and no active state, so the blue
 * has nothing to mark. The previous card's indigo-to-purple radials were the
 * one thing on it that did not come from the design system.
 */
const BG = "#faf9f6";
const CARD = "#ffffff";
const FG = "#141414";
const MUTED = "#6e6a63";
const BORDER = "#d9d9d9";

/**
 * Read once per server instance, not once per card. Both live outside
 * `public/`, so `next.config.ts` names them in `outputFileTracingIncludes` —
 * without that they are absent from the deployed bundle and every card 500s.
 *
 * Saans is the site's face, and the OG card is the site. Satori cannot parse
 * woff2 (it throws "Unsupported OpenType signature wOF2"), which is why these
 * are ttf copies of the two woff2 faces `app/layout.tsx` loads.
 */
const loadAssets = async () => {
  const font = (name: string) =>
    fs.readFile(path.join(process.cwd(), "app", "og", "fonts", name));
  const [regular, medium, mono, logo] = await Promise.all([
    font("Saans-Regular.ttf"),
    font("Saans-Medium.ttf"),
    font("GeistMono-Regular.ttf"),
    fs.readFile(path.join(process.cwd(), "public", "logo", "snapcn.png")),
  ]);
  return {
    logo: `data:image/png;base64,${logo.toString("base64")}`,
    fonts: [
      {
        name: "Saans",
        data: regular,
        weight: 400 as const,
        style: "normal" as const,
      },
      {
        name: "Saans",
        data: medium,
        weight: 500 as const,
        style: "normal" as const,
      },
      {
        name: "Geist Mono",
        data: mono,
        weight: 400 as const,
        style: "normal" as const,
      },
    ],
  };
};

let assets: ReturnType<typeof loadAssets> | undefined;
const getAssets = () => {
  assets ??= loadAssets();
  return assets;
};

/**
 * Three lines at 27px over 880px. Satori honours neither `-webkit-line-clamp`
 * nor `overflow: hidden` on a free-height box, so the cut is made on the string
 * — at a word boundary, or the ellipsis lands mid-word.
 */
const clamp = (text: string, max = 185) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;

/** Headlines set at one size wrap into a paragraph; three steps keep them a headline. */
const titleSize = (title: string) =>
  title.length <= 18 ? 88 : title.length <= 34 ? 74 : 60;

/**
 * Branded 1200x630 OpenGraph card. `/og` renders the site card; `/og/<docs
 * slug>` renders a per-page card with the page title, description, its
 * category and — when the page documents a registry item — that item's own
 * install command. Unknown slugs fall back to the site card so a stale share
 * link never 404s.
 */
export async function GET(
  _req: Request,
  props: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await props.params;
  const { logo, fonts } = await getAssets();

  const page = slug?.length ? source.getPage(slug) : undefined;
  const data = page?.data as { title?: string; description?: string };

  // The `(gallery)` routes — Video Editor, Showcase, Changelog, Roadmap — have
  // no MDX file, so `source.getPage` misses them and every one of them shared
  // the generic site card. They are the pages most likely to be shared.
  const bespoke =
    !page && slug?.length === 1 ? DOCS_PAGE_META[slug[0]] : undefined;

  const title =
    data?.title ?? bespoke?.title ?? "Product demo videos, in React.";
  const description =
    data?.description ??
    bespoke?.description ??
    "Copy-paste Remotion components for the shots a software demo is made of — streaming AI answers, terminals, device frames, captions.";

  // The category's own index page owns its label, so the card cannot drift from
  // the sidebar the way a hardcoded slug→label map here did.
  const category =
    slug && slug.length > 1
      ? (source.getPage([slug[0]])?.data as { title?: string } | undefined)
          ?.title
      : undefined;

  // A docs page named after a registry item shows *its* install command — a
  // shared component link then carries the line that installs it.
  const name = slug?.at(-1);
  const command =
    name && INSTALL_ALL_NAMES.includes(name)
      ? installCommand(name)
      : INSTALL_COMMAND;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        backgroundColor: BG,
        color: FG,
        fontFamily: "Saans",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* biome-ignore lint/performance/noImgElement: Satori renders <img>, not next/image. */}
          <img src={logo} alt="" width={41} height={36} />
          <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: -0.7 }}>
            snapcn
          </div>
        </div>
        {category ? (
          // DESIGN.md micro-label — uppercase, 600, 0.08em, muted — at 2x.
          <div
            style={{
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {category}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <div
          style={{
            fontSize: titleSize(title),
            fontWeight: 400,
            letterSpacing: -0.03 * titleSize(title),
            lineHeight: 1.06,
            maxWidth: 940,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 27,
            lineHeight: 1.45,
            color: MUTED,
            maxWidth: 880,
          }}
        >
          {clamp(description)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* The landing page's own install pill, doubled: h-11 / px-4 / gap-3 /
            text-sm / rounded-lg on a --card surface, muted `$`, foreground
            command. Same component, same proportions, no shadow. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            height: 88,
            padding: "0 32px",
            borderRadius: 9,
            border: `1px solid ${BORDER}`,
            backgroundColor: CARD,
            fontFamily: "Geist Mono",
            fontSize: 28,
          }}
        >
          <div style={{ color: "#a3a09a" }}>$</div>
          <div>{command}</div>
        </div>
        <div style={{ fontSize: 24, color: MUTED }}>snapcn.dev</div>
      </div>
    </div>,
    { width: 1200, height: 630, fonts },
  );
}
