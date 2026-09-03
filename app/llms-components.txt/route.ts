import { componentIndex } from "@/lib/llms";

export const dynamic = "force-static";

/**
 * llms-components.txt: every installable component in one table — name, what it
 * is for, how long it runs, what it pulls in, and where its full page is.
 *
 * `llms.txt` indexes pages and `/llms-full.txt` is the whole corpus; this sits
 * between them and is the one an agent building a video actually wants, because
 * choosing a component is the only decision it has to make before installing.
 */
export function GET() {
  return new Response(componentIndex(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
