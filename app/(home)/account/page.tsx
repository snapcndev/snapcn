import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CommandLine } from "@/components/command-line";
import { buttonVariants } from "@/components/ui/button";
import { SERVER } from "@/lib/mcp-clients";
import { PRO_SAMPLE } from "@/lib/plans";
import { listApiKeys } from "@/lib/server/api-key";
import { billingFor, planFor } from "@/lib/server/entitlements";
import { cn } from "@/lib/utils";
import { ApiKeys } from "./api-keys";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

const DATE = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * `/account` — a buyer's plan, their API keys, and the lines that put a key to
 * use. Checkout returns here, and the account menu links here.
 *
 * Before this, the key was shown once, on `/pro?checkout=done`, and nowhere
 * after: a customer who closed that tab, got a new laptop or leaked the key had
 * no way back to it and no way to replace it.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const session = await auth().catch(() => null);
  const user = session?.user;
  if (!user?.id) redirect("/signin?callbackUrl=/account");

  const [{ limits }, billing, keys] = await Promise.all([
    planFor(user.id),
    billingFor(user.id),
    listApiKeys(user.id).catch(() => []),
  ]);
  const pro = limits.components;
  const key = keys[0]?.key;

  return (
    <section className="relative py-16 sm:py-24">
      <div className="section">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-normal font-sans text-[clamp(2.25rem,4.6vw,3.5rem)] text-foreground leading-[1.06] tracking-[-0.03em]">
            Account
          </h1>

          <div className="mt-8 flex items-center gap-4 rounded-xl border border-border bg-card p-5">
            {user.image ? (
              // biome-ignore lint/performance/noImgElement: OAuth avatar from an arbitrary host.
              <img
                src={user.image}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              {user.name ? (
                <p className="truncate font-medium text-foreground">
                  {user.name}
                </p>
              ) : null}
              <p className="truncate text-muted-foreground text-sm">
                {user.email}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium text-foreground text-sm">
                {planLine(billing, pro)}
              </p>
              {!pro ? (
                <Link
                  href="/docs/pricing"
                  className="text-primary text-xs underline-offset-2 hover:underline"
                >
                  See plans
                </Link>
              ) : null}
            </div>
          </div>

          {checkout === "done" && !pro ? (
            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <h2 className="font-medium text-foreground">
                Payment received — setting up your access
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Your plan and first key appear here as soon as the payment is
                confirmed, usually within a minute. Refresh this page, and make
                sure you are signed in with the account you paid from.
              </p>
            </div>
          ) : null}

          {pro ? (
            <>
              <h2 className="mt-12 font-medium text-foreground text-lg">
                Install Pro components
              </h2>
              <ol className="mt-4 space-y-5 text-foreground text-sm">
                <li>
                  1. Put a key in <code>.env.local</code> — never in a committed
                  file.
                  <CommandLine
                    className="mt-2"
                    command={`SNAPCN_API_KEY=${key ?? "sk_…  (create a key below)"}`}
                  />
                </li>
                <li>
                  2. Tell the shadcn CLI to send it, in{" "}
                  <code>components.json</code>:
                  <CommandLine
                    className="mt-2"
                    command={`"registries": {
  "@snapcn": {
    "url": "https://snapcn.dev/r/{name}.json",
    "headers": { "Authorization": "Bearer \${SNAPCN_API_KEY}" }
  }
}`}
                  />
                </li>
                <li>
                  3. Install any Pro component, exactly like a free one:
                  <CommandLine
                    className="mt-2"
                    command={`npx shadcn@latest add @snapcn/${PRO_SAMPLE.name}`}
                  />
                </li>
              </ol>

              <h2 className="mt-12 font-medium text-foreground text-lg">
                Use the MCP server
              </h2>
              <p className="mt-2 text-muted-foreground text-sm">
                In Claude Code, one command. Every other client is on{" "}
                <Link
                  href="/docs/mcp"
                  className="text-foreground underline underline-offset-4"
                >
                  the MCP page
                </Link>{" "}
                — use a key from below in place of <code>YOUR_KEY</code>.
              </p>
              <CommandLine
                className="mt-3"
                command={`claude mcp add ${SERVER.name} -- ${SERVER.command} ${SERVER.args
                  .map((a) =>
                    a.startsWith("SNAPCN_API_KEY=")
                      ? `SNAPCN_API_KEY=${key ?? "YOUR_KEY"}`
                      : a,
                  )
                  .join(" ")}`}
              />
            </>
          ) : (
            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <h2 className="font-medium text-foreground">
                API keys come with Pro
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                A key installs every Pro component with the shadcn CLI and
                connects the MCP server to your agent.
              </p>
              <Link
                href="/docs/pricing"
                className={cn(buttonVariants({ size: "sm" }), "mt-4")}
              >
                See pricing
              </Link>
            </div>
          )}

          {pro || keys.length > 0 ? (
            <>
              <h2 className="mt-12 font-medium text-foreground text-lg">
                API keys
              </h2>
              <p className="mt-2 text-muted-foreground text-sm">
                One per person or machine, so you can delete one without
                breaking the others. A deleted key stops installs immediately,
                and a running MCP server within 15 minutes.
                {!pro
                  ? " Your plan is not active, so these keys install nothing until it is."
                  : ""}
              </p>
              <ApiKeys
                initial={keys.map((k) => ({
                  ...k,
                  createdAt: k.createdAt.toISOString(),
                }))}
                canCreate={pro}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** The plan, as its owner would describe it. */
function planLine(
  billing: Awaited<ReturnType<typeof billingFor>>,
  pro: boolean,
): string {
  if (!billing || billing.plan === "free") return "Free plan";
  const name = billing.plan === "pro" ? "Pro" : "Starter";
  const end = billing.currentPeriodEnd
    ? DATE.format(billing.currentPeriodEnd)
    : null;
  if (billing.status !== "active") {
    return pro && end ? `${name} · ends ${end}` : `${name} · ${billing.status}`;
  }
  // A one-time purchase has no subscription behind it and no end.
  if (!billing.subscriptionId) return `${name} · lifetime`;
  return end ? `${name} · renews ${end}` : name;
}
