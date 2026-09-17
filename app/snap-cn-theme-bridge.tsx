"use client";

import { useTheme } from "next-themes";
import type { ReactNode } from "react";
// The module, not the `@/lib/snap-cn-ui` barrel: the barrel re-exports `fonts`,
// which calls `loadFont` for six Google families at import time — and this file
// is in the root layout, so every page on the site fetched all six.
import { SnapCnUIProvider } from "@/lib/snap-cn-ui/theme";

/**
 * Hand the site's resolved light/dark down to every component we preview.
 *
 * The components read their palette from `useSnapCnTheme()`, which resolves
 * `prop > provider > default`. Nothing was mounting the provider, so every
 * `<Player>` on the site painted `defaultLightTheme` — a white-surfaced scene
 * sitting on a near-black page the moment you hit the theme toggle.
 *
 * Only `mode` is passed, deliberately. The token *values* already mirror
 * `globals.css` (enforced by `pnpm run check:tokens`), so re-sending them here
 * would be a second copy of the palette to keep in sync — the exact failure this
 * is cleaning up. All this needs to say is which of the two the page is in.
 *
 * Must render inside `RootProvider` so `useTheme()` has context.
 */
export function SnapCnThemeBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  // Undefined until next-themes has read the DOM. `useSnapCnTheme` already
  // treats that as light, which is what the server rendered, so the first paint
  // agrees and dark arrives on mount.
  return (
    <SnapCnUIProvider mode={resolvedTheme === "dark" ? "dark" : "light"}>
      {children}
    </SnapCnUIProvider>
  );
}
