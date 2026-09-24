import type { Metadata } from "next";
import Link from "next/link";
import { CommandLine } from "@/components/command-line";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { DOCS_PAGE_META } from "@/config/site";
import { ITEM_BY_SLUG } from "@/lib/gallery-data";
import { docsBreadcrumb, JsonLd } from "@/lib/structured-data";
import STUDIO_ELEMENTS from "@/lib/studio-elements.json";

/**
 * `/docs/remotion-studio` — what "Add to Remotion Studio" does and what it
 * needs. The button sits on every free component's page and in the gallery
 * panel; this is where it points when it cannot find a Studio, so the steps
 * here are the ones that fix that. The component list is `studio-elements.json`,
 * the same file that decides where the button shows, so the two cannot drift.
 */

const { title: TITLE, description: DESCRIPTION } =
  DOCS_PAGE_META["remotion-studio"];
const PATH = "/docs/remotion-studio";
const OG_IMAGE = "/og/remotion-studio";

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

const STEPS = [
  {
    title: "Start Studio in your Remotion project",
    body: "Remotion 4.0.524 or newer. Any project works — the one from npx create-video included.",
    command: "npx remotion studio",
  },
  {
    title: "Open a composition",
    body: "The component goes into the composition you have open, on its own timeline layer.",
  },
  {
    title: "Click “Add to Remotion Studio”",
    body: "On a component's page, under the install command, or in the gallery panel under “Make a video with this”.",
  },
  {
    title: "Confirm in Studio",
    body: "Studio shows you the source first. Confirm, and it writes the file, installs what it imports and places it.",
  },
] as const;

const TROUBLE = [
  {
    says: "No Remotion Studio found on this computer",
    fix: "Studio is not running, no composition is open in it, or it is older than 4.0.524 — an older Studio does not answer at all. Start it with npx remotion studio, open a composition and click again; if it was already open, run npx remotion upgrade first.",
  },
  {
    says: "This needs Remotion 4.0.524 or newer",
    fix: "Your Studio predates the Studio Protocol. Run npx remotion upgrade in the project.",
  },
  {
    says: "Your browser blocked access to localhost",
    fix: "The site asks your browser to talk to the Studio on this computer. Allow local network access for snapcn.dev in the site settings.",
  },
] as const;

const components = STUDIO_ELEMENTS.flatMap((slug) => {
  const item = ITEM_BY_SLUG.get(slug);
  return item ? [{ slug, name: item.name, href: item.href }] : [];
}).sort((a, b) => a.name.localeCompare(b.name));

const jsonLd = [docsBreadcrumb(TITLE, PATH)];

export default function RemotionStudioPage() {
  return (
    <GalleryFrame>
      <JsonLd graph={jsonLd} />
      <DocsTopBar />

      <div className="mx-auto w-full max-w-3xl py-12 sm:py-16">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Remotion Studio
        </p>
        <h1 className="mt-3 max-w-[20ch] text-pretty font-sans text-[clamp(1.75rem,3.6vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.03em] text-foreground">
          Add components straight to Studio
        </h1>
        <p className="mt-4 max-w-lg text-pretty text-body-lg text-current/70">
          One click sends a component from this site to the Remotion Studio
          running on your computer. Studio installs it and puts it on your
          timeline — no CLI, no{" "}
          <code className="font-mono text-foreground text-sm">
            components.json
          </code>
          . It arrives as one layer you can move and trim, with its text,
          colours and font in the Inspector, and a transparent background so it
          sits on your own footage.
        </p>

        <ol className="mt-10 space-y-4">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <p className="font-medium text-foreground">
                <span className="mr-2 font-mono text-muted-foreground text-sm">
                  {i + 1}
                </span>
                {step.title}
              </p>
              <p className="mt-1.5 text-muted-foreground text-sm">
                {step.body}
              </p>
              {"command" in step && (
                <CommandLine command={step.command} className="mt-3" />
              )}
            </li>
          ))}
        </ol>

        <h2 className="mt-20 font-sans text-[clamp(1.5rem,2.8vw,2rem)] font-normal leading-[1.1] tracking-[-0.03em] text-foreground">
          What lands in your project
        </h2>
        <ul className="mt-4 max-w-lg list-disc space-y-2 pl-5 text-current/70">
          <li>
            One file,{" "}
            <code className="font-mono text-foreground text-sm">
              src/&lt;name&gt;.element.tsx
            </code>{" "}
            — the whole component, yours to edit.
          </li>
          <li>
            The packages it imports, at exact versions. Nothing else is added.
          </li>
          <li>
            A layer in the open composition, sized to the component rather than
            the frame.
          </li>
        </ul>

        <h2 className="mt-20 font-sans text-[clamp(1.5rem,2.8vw,2rem)] font-normal leading-[1.1] tracking-[-0.03em] text-foreground">
          {components.length} components work this way
        </h2>
        <p className="mt-3 max-w-lg text-pretty text-current/70">
          Every free component, and the Pro ones marked Studio-ready in the
          gallery, signed in with the account that owns them. Other Pro
          components install with your key through the{" "}
          <Link
            href="/docs/getting-started/installation"
            className="text-foreground underline underline-offset-4"
          >
            shadcn CLI
          </Link>{" "}
          or the{" "}
          <Link
            href="/docs/mcp"
            className="text-foreground underline underline-offset-4"
          >
            MCP server
          </Link>
          .
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {components.map((c) => (
            <li key={c.slug}>
              <Link
                href={c.href}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-20 font-sans text-[clamp(1.5rem,2.8vw,2rem)] font-normal leading-[1.1] tracking-[-0.03em] text-foreground">
          If the button says
        </h2>
        <dl className="mt-6 space-y-4">
          {TROUBLE.map((t) => (
            <div
              key={t.says}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <dt className="font-medium text-foreground">“{t.says}”</dt>
              <dd className="mt-1.5 text-muted-foreground text-sm">{t.fix}</dd>
            </div>
          ))}
        </dl>
      </div>
    </GalleryFrame>
  );
}
