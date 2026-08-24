import { ThemeToggle } from "@/app/(home)/components/theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";

/**
 * Theme + account, as one unit.
 *
 * There are two chromes under `/docs` — the top bar prose and gallery routes
 * render, and the editor's own application bar — and these controls belong at
 * the top right of both. Defining them once and mounting that component twice
 * is not the duplication worth avoiding; rendering two different versions of
 * the same controls would be.
 *
 * The rail was the wrong home for them. It is the one element every route
 * shares, which made it the tempting answer, but it put the account menu at the
 * *bottom left* of the window — nowhere anyone looks for it.
 */
export function ChromeControls({ className }: { className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <ThemeToggle />
      <UserMenu />
    </div>
  );
}
