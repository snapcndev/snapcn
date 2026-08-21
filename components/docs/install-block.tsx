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
    </div>
  );
}
