import Link from "next/link";
import { installCommand } from "@/config/site";
import { convertNpmCommand } from "@/lib/convert-npm-command";
import { CodeBlockCommand } from "./code-block-command";

/**
 * The install command for a single component. Spelled once, in
 * `installCommand` — see there for why it is the `@snapcn/<name>` short form.
 *
 * Both `registry/*` items publish to the same flat `/r/<name>.json`, so the
 * `registry` prop no longer picks a path — it only names the component for the
 * agent prompt.
 *
 * ## Why the prerequisite line is here and not only on the install page
 *
 * A component page is a *landing* page. Every one of them is in the sitemap
 * aimed at a search like "remotion karaoke captions", so the first thing a
 * stranger ever sees of snapcn is this command — and running it in a bare
 * Remotion project fails with `We could not detect a supported framework`,
 * because `shadcn init` does not recognise Remotion and there is no
 * `components.json` for it to read.
 *
 * That is not a hypothesis. It is what happens, it is two steps to avoid, and
 * the page that explains it was reachable only by someone who already knew to
 * look for it. One muted line costs a returning reader nothing and saves a new
 * one the only failure this project reliably produces.
 */
export function InstallBlock({
  name,
  registry = "snapcn",
}: {
  name: string;
  registry?: "snapcn" | "snap-cn-ui";
}) {
  const npmCommand = installCommand(name);
  return (
    <div className="my-6">
      <CodeBlockCommand
        component={name}
        variant="outline"
        prompt={`Add the ${registry} ${name} component to my project by running: ${npmCommand}`}
        {...convertNpmCommand(npmCommand)}
      />
      <p className="mt-2 text-muted-foreground text-xs">
        Needs an existing Remotion project and a <code>components.json</code>.{" "}
        <Link
          href="/docs/getting-started/installation"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Two-minute setup
        </Link>{" "}
        if this is your first snapcn component.
      </p>
    </div>
  );
}
