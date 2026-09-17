import type { Metadata } from "next";
import Link from "next/link";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { DOCS_PAGE_META } from "@/config/site";
import { JOBS, SERVER } from "@/lib/mcp-clients";
import {
  docsBreadcrumb,
  JsonLd,
  PUBLISHER,
  SITE_URL,
} from "@/lib/structured-data";
import { McpClients, McpJobs } from "./mcp-install";

/**
 * `/docs/mcp` — how to put snapcn inside a coding agent.
 *
 * Modelled on 21st.dev/mcp: one tab per client with the exact line to paste,
 * then the jobs the server does, each as a prompt to hand the agent. The server
 * is `@snapcn/mcp` (the sibling `snapcn-mcp` package). Every snippet comes from
 * `lib/mcp-clients.ts`, which `llms.txt` reads too, so the page and the corpus
 * an agent reads cannot disagree about how to install it.
 *
 * `/mcp` redirects here (next.config.ts): it is the URL people guess.
 */

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META.mcp;
const PATH = "/docs/mcp";
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/mcp";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: PATH,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "snapcn",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const jsonLd = [
  {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}${PATH}#app`,
    name: "snapcn MCP server",
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Linux, Windows",
    featureList: JOBS.map((job) => job.title),
    installUrl: `https://www.npmjs.com/package/${SERVER.args[1].replace(/@latest$/, "")}`,
    publisher: PUBLISHER,
  },
  docsBreadcrumb(TITLE, PATH),
];

export default function McpPage() {
  return (
    <GalleryFrame>
      <JsonLd graph={jsonLd} />
      <DocsTopBar />

      <div className="mx-auto w-full max-w-3xl py-12 sm:py-16">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          MCP server
        </p>
        <h1 className="mt-3 max-w-[20ch] text-pretty font-sans text-[clamp(1.75rem,3.6vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.03em] text-foreground">
          Use snapcn in your agent
        </h1>
        <p className="mt-4 max-w-lg text-pretty text-body-lg text-current/70">
          Your agent searches the registry, reads a component&apos;s real props
          and plans the whole video from a one-line brief — then installs the
          components with the shadcn CLI. Included with{" "}
          <Link
            href="/docs/pricing?ref=mcp"
            className="text-foreground underline underline-offset-4"
          >
            snapcn Pro
          </Link>
          : replace{" "}
          <code className="font-mono text-foreground text-sm">YOUR_KEY</code>{" "}
          with a key from{" "}
          <Link
            href="/account"
            className="text-foreground underline underline-offset-4"
          >
            your account
          </Link>
          .
        </p>

        <div className="mt-10">
          <McpClients />
        </div>

        <h2 className="mt-20 font-sans text-[clamp(1.5rem,2.8vw,2rem)] font-normal leading-[1.1] tracking-[-0.03em] text-foreground">
          What do you want to do?
        </h2>
        <p className="mt-3 max-w-lg text-pretty text-current/70">
          Each card is one of the server&apos;s six tools. Copy the prompt into
          your agent and it picks the tool itself.
        </p>
        <div className="mt-8">
          <McpJobs />
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-muted-foreground text-sm">
          <p>
            Needs Node 18 or newer. The server checks your key with snapcn.dev
            on the first call and every 15 minutes after — delete a key on your
            account and it stops within that — then reads the live registry and
            falls back to a copy bundled in the package. Previews and recording
            analysis run on the Remotion CLI already in your project.
          </p>
          <p className="mt-3">
            {/* Two places need the key: the server's arguments (above), which
                unlock the tools, and the project's components.json, which the
                shadcn CLI reads to install Pro source. /account shows both. */}
            Pro components show up in search with their props, marked Pro.
            Installing one takes your key in{" "}
            <code className="font-mono text-foreground text-xs">
              components.json
            </code>{" "}
            —{" "}
            <Link
              href="/account"
              className="text-foreground underline underline-offset-4"
            >
              see your account
            </Link>
            . Rather teach the agent than run a server?{" "}
            <Link
              href="/docs/getting-started/agent-skill"
              className="text-foreground underline underline-offset-4"
            >
              Install the agent skill
            </Link>
            .
          </p>
        </div>
      </div>
    </GalleryFrame>
  );
}
