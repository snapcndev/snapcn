"use client";

import { ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type CodeTheme = "light" | "dark";

export type SyntaxPalette = {
  keyword: string;
  type: string;
  fn: string;
  prop: string;
  string: string;
  number: string;
  boolean: string;
  punctuation: string;
  plain: string;
};

// Fixed dark editor palette (mirrors the reference mock).
export const SYNTAX_DARK: SyntaxPalette = {
  keyword: "#c792ea",
  type: "#c9b3ff",
  fn: "#82aaff",
  prop: "#a6accd",
  string: "#c3e88d",
  number: "#89ddff",
  boolean: "#f78c6c",
  // Comments and punctuation, lightened from Material's #676e95. That value is
  // lit for Material's own #292d3e surface; on this panel's #0a0a0a it measures
  // 3.87:1 and fails AA. Same hue and chroma, walked up in OKLCH to 4.66:1 —
  // and a code comment nobody can read is a code comment that may as well not
  // be in the snippet.
  punctuation: "#747ba3",
  plain: "#bcc2e0",
};

// Light editor palette (GitHub-light flavoured) for the same token kinds.
export const SYNTAX_LIGHT: SyntaxPalette = {
  keyword: "#cf222e",
  type: "#116329",
  fn: "#8250df",
  prop: "#953800",
  string: "#0a3069",
  number: "#0550ae",
  boolean: "#0550ae",
  // GitHub's own comment grey is #6e7781, which clears AA on GitHub's white but
  // only reaches 4.27:1 on this panel's #f6f8fa. Darkened in OKLCH to 4.66:1.
  punctuation: "#68717b",
  plain: "#1f2328",
};

export const SYNTAX: Record<CodeTheme, SyntaxPalette> = {
  dark: SYNTAX_DARK,
  light: SYNTAX_LIGHT,
};

// Chrome (surface, title bar, traffic lights, chip) per theme.
const CHROME: Record<
  CodeTheme,
  {
    container: string;
    /** Same colour as `container`, as a value — the sticky line-number gutter
     *  has to paint it itself or the code scrolls visibly underneath it. */
    surface: string;
    titleBar: string;
    dot: string;
    chip: string;
  }
> = {
  dark: {
    container: "bg-[#0a0a0a] ring-white/10",
    surface: "#0a0a0a",
    titleBar: "border-white/[0.06]",
    dot: "bg-white/15",
    chip: "bg-white/5 text-white/55 ring-white/10",
  },
  light: {
    container: "bg-[#f6f8fa] ring-black/[0.08]",
    surface: "#f6f8fa",
    titleBar: "border-black/[0.06]",
    dot: "bg-black/15",
    chip: "bg-black/[0.04] text-black/55 ring-black/[0.08]",
  },
};

function Token({ color, children }: { color: string; children: ReactNode }) {
  return <span style={{ color }}>{children}</span>;
}

/**
 * Just enough TSX tokeniser to colour a marketing snippet.
 *
 * Order in the alternation is the whole trick: comments and strings come first,
 * so a keyword inside either is already swallowed by the time the keyword branch
 * is tried. Capitalised identifiers are typed wholesale, which is why `<` and
 * `/>` fall through to punctuation and come out right without a JSX branch.
 *
 * ponytail: one regex, no parser. It cannot tell a JSX prop from an object key
 * and does not try. If these ever need to be real editors, delete it and hand
 * the string to shiki — the `code` prop is already the right shape for that.
 */
const TOKENS =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|from|export|default|function|return|const|let|new|await|async)\b|\b(true|false|null|undefined)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Z][A-Za-z0-9]*)\b|\b([a-z][A-Za-z0-9]*)(?=\s*[=:])/g;

/** Which capture group maps to which palette entry, in regex order. */
const KINDS = [
  "punctuation", // // line comment
  "string",
  "keyword",
  "boolean",
  "number",
  "type",
  "prop",
] as const satisfies readonly (keyof SyntaxPalette)[];

function highlight(code: string, palette: SyntaxPalette) {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  TOKENS.lastIndex = 0;
  let m = TOKENS.exec(code);
  while (m !== null) {
    if (m.index > last) {
      out.push(
        <Token color={palette.punctuation} key={key++}>
          {code.slice(last, m.index)}
        </Token>,
      );
    }
    const g = KINDS.findIndex((_, i) => m?.[i + 1] !== undefined);
    out.push(
      <Token color={palette[KINDS[g] ?? "plain"]} key={key++}>
        {m[0]}
      </Token>,
    );
    last = m.index + m[0].length;
    m = TOKENS.exec(code);
  }
  if (last < code.length) {
    out.push(
      <Token color={palette.punctuation} key={key++}>
        {code.slice(last)}
      </Token>,
    );
  }
  return out;
}

/** The original hard-coded body, now just a string. */
const DEFAULT_CODE = `import { TextReveal } from "@/components/snap-cn/text-reveal";

export function Hero() {
  return (
    <TextReveal
      text="Hello, world"
      fontSize={72}
      color="#171717"
      fontWeight={700}
    />
  )
}`;

/**
 * A syntax-highlighted editor card. Defaults to the `TextReveal` usage snippet —
 * the component the get-started card tells you to install — and takes any other
 * TSX through `code`.
 *
 * Theme resolution: an explicit `theme` prop always wins; otherwise the block
 * follows the site's next-theme (`resolvedTheme`), falling back to dark before
 * mount to avoid hydration mismatch.
 */
export function CodeSnippet({
  label = "TextReveal",
  code = DEFAULT_CODE,
  theme,
  header = true,
  className,
  bodyClassName,
}: {
  label?: string;
  code?: string;
  theme?: CodeTheme;
  header?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Theme is only known on the client; before mount fall back to dark so SSR
  // and the first client render agree.
  useEffect(() => setMounted(true), []);

  const active: CodeTheme =
    theme ?? (mounted && resolvedTheme === "light" ? "light" : "dark");
  const chrome = CHROME[active];
  const palette = SYNTAX[active];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl ring-1 sm:rounded-3xl",
        chrome.container,
        className,
      )}
    >
      {/* Title bar */}
      {header && (
        <div
          className={cn(
            "relative flex items-center justify-between border-b px-5 py-4",
            chrome.titleBar,
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn("size-3 rounded-full", chrome.dot)} />
            <span className={cn("size-3 rounded-full", chrome.dot)} />
            <span className={cn("size-3 rounded-full", chrome.dot)} />
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1",
              chrome.chip,
            )}
          >
            {label}
            <ChevronDown className="size-3.5" />
          </span>
        </div>
      )}

      {/* Code */}
      <pre
        className={cn(
          "relative flex overflow-x-auto py-6 pr-6 font-mono text-[13px] leading-[1.95] whitespace-pre [scrollbar-width:none] sm:text-sm [&::-webkit-scrollbar]:hidden",
          bodyClassName,
        )}
      >
        {/* Sticky so the numbers survive a horizontal scroll, and select-none
            so copying the snippet does not drag the gutter along with it. */}
        <span
          aria-hidden
          className="sticky left-0 shrink-0 select-none pl-6 pr-5 text-right tabular-nums"
          style={{
            color: palette.punctuation,
            backgroundColor: chrome.surface,
          }}
        >
          {code
            .split("\n")
            .map((_, i) => i + 1)
            .join("\n")}
        </span>
        <code>{highlight(code, palette)}</code>
      </pre>
    </div>
  );
}
