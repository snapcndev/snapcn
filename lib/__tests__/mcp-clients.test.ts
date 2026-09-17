/**
 * The `/docs/mcp` snippets, decoded back to the server they claim to install.
 *
 * Run with:  pnpm vitest run lib/__tests__/mcp-clients.test.ts
 *
 * A one-click link that installs the wrong thing fails in someone else's editor,
 * where nothing reports back here.
 */
import { describe, expect, it } from "vitest";
import {
  CLIENTS,
  cursorInstallUrl,
  SERVER,
  vscodeInstallUrl,
} from "../mcp-clients";

const stdio = { command: SERVER.command, args: [...SERVER.args] };

describe("/docs/mcp install links", () => {
  it("Cursor's config param is the base64 stdio entry", () => {
    const url = new URL(cursorInstallUrl());
    expect(url.searchParams.get("name")).toBe(SERVER.name);
    expect(JSON.parse(atob(url.searchParams.get("config") ?? ""))).toEqual(
      stdio,
    );
  });

  it("VS Code's link is the URL-encoded entry, name included", () => {
    const query = vscodeInstallUrl().replace(/^vscode:mcp\/install\?/, "");
    expect(JSON.parse(decodeURIComponent(query))).toEqual({
      name: SERVER.name,
      ...stdio,
    });
  });
});

describe("/docs/mcp snippets", () => {
  it("every client installs the same package", () => {
    for (const client of CLIENTS) {
      for (const step of client.steps) {
        expect(step.code, client.id).toContain("@snapcn/mcp@latest");
      }
    }
  });

  it("every JSON snippet parses", () => {
    for (const client of CLIENTS) {
      for (const step of client.steps.filter((s) => s.code.startsWith("{"))) {
        expect(() => JSON.parse(step.code), client.id).not.toThrow();
      }
    }
  });
});
