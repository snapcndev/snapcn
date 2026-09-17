"use client";

import { Plug } from "lucide-react";
import { type ComponentType, type SVGProps, useId } from "react";

/**
 * Each MCP client's own mark, beside its tab on `/docs/mcp`.
 *
 * Paths from @lobehub/icons (MIT) — the product marks, not the parent company's:
 * Codex's terminal bloom rather than the OpenAI knot, Claude Code's pixel crab
 * rather than the Claude spark — and VS Code from simple-icons (CC0). Colour
 * only where the brand has one; Cursor, Codex and Windsurf are one-colour marks
 * and take the text colour, so they hold up in both themes.
 */
type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const svg = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
  ...props,
});

const ClaudeCode: Icon = (props) => (
  <svg {...svg(props)}>
    <path
      fill="#D97757"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
    />
  </svg>
);

const Cursor: Icon = (props) => (
  <svg {...svg(props)} fill="currentColor" fillRule="evenodd">
    <path d="M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z" />
  </svg>
);

const VsCode: Icon = (props) => (
  <svg {...svg(props)}>
    <path
      fill="#007ACC"
      d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"
    />
  </svg>
);

const Codex: Icon = (props) => (
  <svg {...svg(props)} fill="currentColor" fillRule="evenodd">
    <path
      clipRule="evenodd"
      d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z"
    />
  </svg>
);

const Windsurf: Icon = (props) => (
  <svg {...svg(props)} fill="currentColor" fillRule="evenodd">
    <path
      clipRule="evenodd"
      d="M23.78 5.004h-.228a2.187 2.187 0 00-2.18 2.196v4.912c0 .98-.804 1.775-1.76 1.775a1.818 1.818 0 01-1.472-.773L13.168 5.95a2.197 2.197 0 00-1.81-.95c-1.134 0-2.154.972-2.154 2.173v4.94c0 .98-.797 1.775-1.76 1.775-.57 0-1.136-.289-1.472-.773L.408 5.098C.282 4.918 0 5.007 0 5.228v4.284c0 .216.066.426.188.604l5.475 7.889c.324.466.8.812 1.351.938 1.377.316 2.645-.754 2.645-2.117V11.89c0-.98.787-1.775 1.76-1.775h.002c.586 0 1.135.288 1.472.773l4.972 7.163a2.15 2.15 0 001.81.95c1.158 0 2.151-.973 2.151-2.173v-4.939c0-.98.787-1.775 1.76-1.775h.194c.122 0 .22-.1.22-.222V5.225a.221.221 0 00-.22-.222z"
    />
  </svg>
);

const GeminiCli: Icon = (props) => {
  // A gradient is referenced by id, and an id must be unique in the document.
  const gradient = useId();
  return (
    <svg {...svg(props)}>
      <path
        fill={`url(#${gradient})`}
        d="M0 4.391A4.391 4.391 0 014.391 0h15.217A4.391 4.391 0 0124 4.391v15.217A4.391 4.391 0 0119.608 24H4.391A4.391 4.391 0 010 19.608V4.391z"
      />
      <path
        fill="#1E1E2E"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.74 1.444a2.816 2.816 0 012.816 2.816v15.48a2.816 2.816 0 01-2.816 2.816H4.26a2.816 2.816 0 01-2.816-2.816V4.26A2.816 2.816 0 014.26 1.444h15.48zM7.236 8.564l7.752 3.728-7.752 3.727v2.802l9.557-4.596v-3.866L7.236 5.763v2.801z"
      />
      <defs>
        <linearGradient
          id={gradient}
          gradientUnits="userSpaceOnUse"
          x1="24"
          x2="0"
          y1="6.587"
          y2="16.494"
        >
          <stop stopColor="#EE4D5D" />
          <stop offset=".328" stopColor="#B381DD" />
          <stop offset=".476" stopColor="#207CFE" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const Other: Icon = (props) => <Plug aria-hidden {...props} />;

/** Keyed by `McpClient.id`. */
export const MCP_CLIENT_ICONS: Record<string, Icon> = {
  "claude-code": ClaudeCode,
  cursor: Cursor,
  vscode: VsCode,
  codex: Codex,
  windsurf: Windsurf,
  gemini: GeminiCli,
  other: Other,
};
