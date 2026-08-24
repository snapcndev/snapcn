import { Menu } from "lucide-react";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { SearchButton } from "@/components/search-button";
import { SnapCnLogo } from "@/components/snapcn-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_LINKS } from "@/config/site";
import { cn } from "@/lib/utils";
import { GithubButton } from "./github-button";
import { NavMobile } from "./header-nav";
import { ThemeToggle } from "./theme-toggle";

export function HeaderLogo() {
  return (
    <Link
      href="/"
      aria-label="snapcn home"
      className="flex items-center focus-visible:outline-none"
    >
      <SnapCnLogo />
    </Link>
  );
}

export function HeaderActions() {
  return (
    <div className="flex items-center gap-1.5">
      <SearchButton className="lg:w-52" />
      <div className="hidden sm:block">
        <GithubButton />
      </div>
      <ThemeToggle />
      <div className="hidden sm:block">
        <UserMenu />
      </div>

      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="sm:hidden"
              aria-label="Open menu"
            />
          }
        >
          <Menu className="size-4" aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="right" className="bg-background">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <NavMobile links={NAV_LINKS} />
          <div className="mt-4 flex flex-col gap-4 px-6 pb-6">
            <UserMenu className="w-full" />
            <GithubButton />
            <SheetClose
              render={
                <Link
                  href="/docs/getting-started/introduction"
                  className={cn(buttonVariants({ size: "lg" }), "h-11 w-full")}
                />
              }
            >
              Get started
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
