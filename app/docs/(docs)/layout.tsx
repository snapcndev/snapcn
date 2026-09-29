import type { ReactNode } from "react";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";

/**
 * Every prose docs route (Getting Started, UI, …) renders inside the exact same
 * bespoke chrome as the Components page: the fixed, collapsible gallery rail
 * (logo + section nav + GitHub promo) on the left with the content in the right
 * column — no fumadocs top header, no per-page TOC. The sibling `(gallery)`
 * group renders the masonry Components page inside this same `GalleryFrame`, so
 * navigating between Getting Started, Components, and UI keeps one unchanging
 * layout.
 *
 * No top bar here: a component URL renders the Components gallery, whose header
 * row is its own `DocsTopBar`, so each page brings the one it needs.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return <GalleryFrame>{children}</GalleryFrame>;
}
