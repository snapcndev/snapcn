import type { ReactNode } from "react";
import { ChromeControls } from "./chrome-controls";
import { GallerySidebarMobile } from "./gallery-sidebar";
import { DocsSectionNav } from "./section-nav";

/**
 * The row every `/docs/*` page opens with: the small-screen section links, then
 * whatever the page wants on the left, then the theme toggle at the right edge
 * of the content column.
 *
 * It exists because five pages had each written this row out for themselves, and
 * the four with nothing to put on the left wrote `justify-between` around a
 * single *visible* child — `DocsSectionNav` is `lg:hidden`, so on a desktop the
 * toggle was the only item and `justify-between` parked it at flex-start. The
 * control sat top-right on the Components page and top-left on every prose docs
 * page. `ml-auto` here, in the one place, so it lands at the same point on every
 * route, and the mobile nav sits on its own line everywhere rather than beside
 * the toggle on some pages and above it on others.
 */
export function DocsTopBar({ children }: { children?: ReactNode }) {
  return (
    <div className="pt-6">
      <DocsSectionNav className="mb-4" />
      <div className="flex items-center gap-2">
        <GallerySidebarMobile />
        {children}
        <ChromeControls className="ml-auto" />
      </div>
    </div>
  );
}
