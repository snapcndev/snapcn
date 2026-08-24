import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono, Outfit } from "next/font/google";
import localFont from "next/font/local";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { cn } from "@/lib/utils";
import { PostHogProvider } from "./posthog-provider";
import { SnapCnThemeBridge } from "./snap-cn-theme-bridge";
import { ThemeShortcut } from "./theme-shortcut";

/**
 * Saans, the face simplifyingai.com is set in — copied from that project rather
 * than re-derived, so the two sites stay one voice. (Serrif came over with it and
 * was never set on anything; it is gone.)
 *
 * These are the *site's* faces only. `--font-geist-sans` below is a separate
 * thing and must stay: the registry's scenes render through it, and a Remotion
 * bundle has none of this CSS, so a locally-hosted face would silently fall
 * back to Times in the mp4 (see the design-system skill, rule 4).
 */
const saans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "./fonts/Saans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Saans-Medium.woff2", weight: "500", style: "normal" },
  ],
});

/**
 * `preload: false` on everything below is deliberate and measured.
 *
 * next/font emits a blocking `<link rel="preload">` per weight on *every* page
 * that mounts this layout — 430KB of woff2 on the landing page, more than all of
 * its JS. None of these four faces paint a single glyph there. Without preload
 * they still load, on the pages that actually use them, at the moment a rule
 * asks for one. Saans keeps its preload: it is the whole first screen.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // Scenes render through this; no site chrome is set in it.
  preload: false,
});

// Preloaded, unlike its siblings: the hero's install button is set in it.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// `--font-display`: docs headings, showcase and the video editor.
const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  preload: false,
});

// Handwritten face for the gallery sidebar's "new" scribble only.
const caveat = Caveat({
  variable: "--font-scribble",
  weight: "600",
  subsets: ["latin"],
  preload: false,
});

const SITE_URL = "https://snapcn.dev";
/**
 * The title is the one line that has to carry the query. "Cinematic video
 * components for React" was accurate and unsearchable — it omitted both terms
 * anyone actually types, *Remotion* and *shadcn*. This is 61 characters, so it
 * survives a SERP intact.
 */
const SITE_TITLE = "snapcn — Remotion components, installed with shadcn";
const SITE_DESCRIPTION =
  "A shadcn registry of Remotion components for React video: text animations, captions, device mockups and full scenes. Install with the CLI, own the code. MIT.";

export const metadata: Metadata = {
  // Resolves the relative `/bg.jpg` below into an absolute URL for crawlers.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · snapcn",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "snapcn",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    // `site` is the product's account, `creator` the author's — they are not
    // the same handle, and X shows the site one on the card.
    site: "@snapcndev",
    creator: "@SriNath693",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // Tells Next to suspend `scroll-behavior: smooth` during route
      // transitions, so a navigation jumps to the top instead of animating.
      data-scroll-behavior="smooth"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        outfit.variable,
        caveat.variable,
        "font-sans",
        saans.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <PostHogProvider>
            <NuqsAdapter>
              <RootProvider
                theme={{
                  defaultTheme: "system",
                  enableSystem: true,
                }}
              >
                <ThemeShortcut />
                <SnapCnThemeBridge>{children}</SnapCnThemeBridge>
              </RootProvider>
            </NuqsAdapter>
          </PostHogProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
