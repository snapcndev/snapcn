"use server";

import type { ReactNode } from "react";
import { docBodyFor } from "./doc-bodies";

/**
 * Fetch one component's rendered documentation for the gallery overlay.
 *
 * A Server Action rather than a route handler because what the overlay needs is
 * a *rendered React tree*, not markup: the MDX body is a server component and
 * carries the same fumadocs styling, code blocks and mdx-components mapping the
 * standalone `/docs/<category>/<slug>` page gets. Returning it as JSX keeps one
 * renderer for both surfaces; returning HTML from a route would have been a
 * second one to keep in step.
 *
 * The caller caches the result per slug for the life of the page, so stepping
 * back to a component with the arrow keys costs nothing.
 */
export async function loadDocBody(slug: string): Promise<ReactNode | null> {
  return docBodyFor(slug);
}
