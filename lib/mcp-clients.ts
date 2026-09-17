/**
 * Every snippet on `/docs/mcp` (and its llms.txt entry), built from one server definition.
 *
 * Each client spells the same three facts — a name, `npx`, and its arguments —
 * in its own file format, and a one-click link encodes them a third way. Written
 * out by hand, those copies drift: the JSON says one package and the deeplink
 * installs another, and nothing on the page looks wrong. So nothing below
 * spells the package twice. `lib/__tests__/mcp-clients.test.ts` decodes the links back.
 */

/**
 * The key rides in `args`, not an env block: every client spells `args` the same
 * way, and each spells env differently. `YOUR_KEY` is not `sk_`-shaped, so a
 * snippet pasted unedited gets the server's "set your key" answer, not "refused".
 */
export const KEY_PLACEHOLDER = "YOUR_KEY";

export const SERVER = {
  name: "snapcn",
  command: "npx",
  args: ["-y", "@snapcn/mcp@latest", `SNAPCN_API_KEY=${KEY_PLACEHOLDER}`],
} as const;

const RUN = `${SERVER.command} ${SERVER.args.join(" ")}`;
const stdio = { command: SERVER.command, args: [...SERVER.args] };
const json = (value: unknown) => JSON.stringify(value, null, 2);

/** `mcpServers` is the shape Cursor, Windsurf, Gemini CLI and most others share. */
const MCP_SERVERS_JSON = json({ mcpServers: { [SERVER.name]: stdio } });

/**
 * Cursor's install link: the server entry, base64'd JSON, name alongside.
 *
 * Checked against Cursor's own handler (`handleMCPInstall`): it reads `name` and
 * `config`, turns `+` into a space BEFORE percent-decoding, then `atob`s. So the
 * base64 is percent-encoded — a raw `+` in it would arrive as a space and the
 * install would silently do nothing.
 */
export const cursorInstallUrl = () =>
  `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER.name}&config=${encodeURIComponent(
    btoa(JSON.stringify(stdio)),
  )}`;

/** VS Code's install link: the whole entry, name included, URL-encoded JSON. */
export const vscodeInstallUrl = () =>
  `vscode:mcp/install?${encodeURIComponent(
    JSON.stringify({ name: SERVER.name, ...stdio }),
  )}`;

export interface McpClient {
  /** Tab value and the analytics `target`. */
  id: string;
  label: string;
  /** One line: where the server ends up. */
  where: string;
  oneClick?: { label: string; href: string };
  steps: { label?: string; code: string }[];
  note?: string;
}

export const CLIENTS: McpClient[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    where: "One command in your project. Restart the session to pick it up.",
    steps: [{ code: `claude mcp add ${SERVER.name} -- ${RUN}` }],
    note: "Add --scope user before the name to have it in every project.",
  },
  {
    id: "cursor",
    label: "Cursor",
    where:
      "One click, or paste it into ~/.cursor/mcp.json (.cursor/mcp.json for one project).",
    oneClick: { label: "Add to Cursor", href: cursorInstallUrl() },
    steps: [{ code: MCP_SERVERS_JSON }],
  },
  {
    id: "vscode",
    label: "VS Code",
    where:
      "One click, one command, or .vscode/mcp.json. Tools show up in Copilot's agent mode.",
    oneClick: { label: "Install in VS Code", href: vscodeInstallUrl() },
    steps: [
      {
        label: "Terminal",
        code: `code --add-mcp '${JSON.stringify({ name: SERVER.name, ...stdio })}'`,
      },
      {
        label: ".vscode/mcp.json",
        code: json({ servers: { [SERVER.name]: { type: "stdio", ...stdio } } }),
      },
    ],
  },
  {
    id: "codex",
    label: "Codex",
    where:
      "One command, or ~/.codex/config.toml. The CLI and the IDE extension share it.",
    steps: [
      { label: "Terminal", code: `codex mcp add ${SERVER.name} -- ${RUN}` },
      {
        label: "~/.codex/config.toml",
        code: `[mcp_servers.${SERVER.name}]\ncommand = "${SERVER.command}"\nargs = [${SERVER.args
          .map((a) => `"${a}"`)
          .join(", ")}]`,
      },
    ],
  },
  {
    id: "windsurf",
    label: "Windsurf",
    // Windsurf is Devin Desktop now. Its default agent (Devin Local) reads the
    // Devin CLI's config; ~/.codeium/windsurf is the legacy Cascade agent only.
    where:
      "Windsurf is Devin Desktop now: one command for the Devin Local agent, or the same JSON in ~/.codeium/windsurf/mcp_config.json for legacy Cascade.",
    steps: [
      {
        label: "Terminal",
        code: `devin mcp add -s user ${SERVER.name} -- ${RUN}`,
      },
      {
        label:
          "~/.config/devin/mcp_config.json or ~/.codeium/windsurf/mcp_config.json",
        code: MCP_SERVERS_JSON,
      },
    ],
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    where:
      "One command in your project, or .gemini/settings.json by hand (~/.gemini/settings.json for every project).",
    steps: [
      { label: "Terminal", code: `gemini mcp add ${SERVER.name} ${RUN}` },
      { label: ".gemini/settings.json", code: MCP_SERVERS_JSON },
    ],
    // Tested: in an untrusted folder `gemini mcp list` shows the server
    // "Disabled", which reads like a broken snippet. It is the trust gate.
    note: "Add --scope user before the name to have it in every project. Gemini only starts MCP servers in a folder you have trusted.",
  },
  {
    id: "other",
    label: "Other",
    where:
      "Claude Desktop, Cline, Kiro, Warp and JetBrains Junie take the mcpServers entry. Zed and opencode spell it their own way.",
    steps: [
      { label: "mcpServers (most clients)", code: MCP_SERVERS_JSON },
      {
        label: "Zed — settings.json",
        code: json({ context_servers: { [SERVER.name]: stdio } }),
      },
      {
        label: "opencode — opencode.json",
        code: json({
          mcp: {
            [SERVER.name]: {
              type: "local",
              command: [SERVER.command, ...SERVER.args],
            },
          },
        }),
      },
    ],
    note: `Transport stdio, command ${SERVER.command}, arguments ${SERVER.args.join(" ")}. Replace ${KEY_PLACEHOLDER} with your Pro key. No env block needed.`,
  },
];

/** What "Copy as prompt" hands an agent: install it for me, then prove it worked. */
export function installPrompt(client: McpClient): string {
  return [
    `Add the snapcn MCP server to ${client.label === "Other" ? "this MCP client" : client.label}.`,
    `It is a stdio server, run with \`${RUN}\`. It is part of snapcn Pro: replace ${KEY_PLACEHOLDER} with my key (ask me for it — it is on https://snapcn.dev/account). No env block.`,
    client.where,
    ...client.steps.map((s) => `${s.label ? `${s.label}:\n` : ""}${s.code}`),
    "Then confirm six tools are listed: snapcn_search_components, snapcn_component, snapcn_plan_video, snapcn_preview, snapcn_analyze_recording, snapcn_rules.",
    "Setup reference: https://snapcn.dev/docs/mcp",
  ].join("\n\n");
}

export type JobId =
  | "search"
  | "component"
  | "plan"
  | "analyze"
  | "preview"
  | "rules";

export const JOBS: {
  id: JobId;
  tool: string;
  title: string;
  description: string;
  prompt: string;
}[] = [
  {
    id: "plan",
    tool: "snapcn_plan_video",
    title: "Plan a whole video",
    description:
      "A one-line brief becomes beats, one component each, one install command and a TransitionSeries skeleton — once it has your real copy.",
    prompt:
      "Plan a 20-second launch video for this repo with snapcn. Dark mode.",
  },
  {
    id: "search",
    tool: "snapcn_search_components",
    title: "Find the component for a shot",
    description:
      "Describe what the shot has to do. Get ranked components with their length, install command and, where written, when not to use them.",
    prompt:
      "Find a snapcn component that shows our CLI install command running in a terminal.",
  },
  {
    id: "component",
    tool: "snapcn_component",
    title: "Get a component's real props",
    // Not "every prop": the table is the customizer's controls, and it leaves
    // out list/object props (terminal-simulator's `command` and `lines`).
    description:
      "The install command, its tunable props with defaults and ranges, and its frame budget — read off the registry, not guessed.",
    prompt:
      "Get text-reveal's props from snapcn, then add a headline scene that says “Ship faster”.",
  },
  {
    id: "analyze",
    tool: "snapcn_analyze_recording",
    title: "Cut a screen recording into beats",
    description:
      "Measures the chrome to crop, the frame each beat opens on and where to point the camera — off the file itself.",
    prompt:
      "Measure public/demo.mp4 with snapcn and plan a product demo around it.",
  },
  {
    id: "preview",
    tool: "snapcn_preview",
    title: "Look at a frame before you ship",
    description:
      "Renders frames of your composition with your own Remotion CLI and hands the image back, so the agent sees what it wrote.",
    prompt:
      "Render frames 30 and 120 of the Video composition with snapcn and fix anything that looks wrong.",
  },
  {
    id: "rules",
    tool: "snapcn_rules",
    title: "Write chrome that matches",
    description:
      "snapcn's motion, design and anti-slop rules, for the backdrops, cards and easing the agent writes itself.",
    prompt:
      "Read snapcn's design rules, then build a lower-third that matches the components.",
  },
];
