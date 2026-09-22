import path from "node:path";
import ts from "typescript";

/**
 * One registry component as one self-contained `.element.tsx`.
 *
 * A Remotion Studio Element is a single file: Studio writes it into the project
 * and installs only the npm packages it declares. A snapcn component is not —
 * it imports its theme, fonts and colour maths from `@/lib/snap-cn-ui`. So the
 * lib files the component actually uses are inlined above it, in dependency
 * order, and everything else stays the exact bytes `shadcn add` installs.
 *
 * Only the file boundaries are rewritten:
 *
 * - imports from every part are merged into one set, per module;
 * - `export` comes off everything but the component and its types, because
 *   Studio requires exactly one exported component;
 * - a lib import whose name the component already uses is renamed — culori's
 *   `interpolate` against Remotion's, in 21 components. The lib source cannot
 *   be edited instead: `motion:measure` hashes it, and a rename that renders
 *   nothing would mark every measurement stale;
 * - what nothing in the file reads is dropped, with the imports only it used.
 *   A lib file arrives whole, and a component file exports helpers for its
 *   tests and config; once `export` is off, each of those is an error under
 *   the `noUnusedLocals` Remotion's templates type-check with.
 *
 * Returns null for a component that builds on another snapcn component: that
 * would mean flattening a component into a component, and the CLI stays the
 * honest path for those. Anything else it cannot do, it throws.
 */

const LIB = "@/lib/snap-cn-ui";

export interface RegistryFile {
  path: string;
  content: string;
}

interface Binding {
  module: string;
  kind: "default" | "namespace" | "named";
  imported: string;
  local: string;
  /** As written inside `{ }`: `a`, `a as b`, `type T`. */
  text: string;
  /** Where the local name is written, for the rename. */
  pos: number;
}

interface Part {
  bindings: Binding[];
  modules: string[];
  declared: string[];
  /** Comments that sat above a statement this dropped — the file stamps. */
  header: string[];
  body: string;
}

/** `@/…` and relative imports: files of this site, never npm packages. */
const isLocal = (module: string) =>
  module.startsWith("@/") || module.startsWith(".");

export function elementSource(
  component: string,
  componentName: string,
  lib: RegistryFile[],
): { sourceCode: string; modules: string[] } | null {
  const own = parse(
    component,
    (stmt, names) => names.includes(componentName) || isType(stmt),
  );
  if (own.modules.some((m) => isLocal(m) && m !== LIB)) return null;
  if (!own.declared.includes(componentName)) {
    throw new Error(`${componentName} is not declared in its own file`);
  }

  const fromLib = own.bindings.filter((b) => b.module === LIB);
  const aliased = fromLib.find((b) => b.local !== b.imported);
  if (aliased) throw new Error(`aliased import from ${LIB}: ${aliased.text}`);

  // The component claims its names first: it is the code people read and edit.
  const owner = new Map<string, string>();
  claim(own, owner);
  const libParts = libFiles(
    lib,
    fromLib.map((b) => b.imported),
  ).map((file) => {
    let text = file.content;
    for (;;) {
      const part = parse(text, () => false);
      const clash = part.bindings.find(
        (b) =>
          !isLocal(b.module) &&
          owner.has(b.local) &&
          owner.get(b.local) !== origin(b),
      );
      if (!clash) {
        claim(part, owner, file.path);
        return part;
      }
      const alias = camel(packageName(clash.module)) + capital(clash.imported);
      if (owner.has(alias)) throw new Error(`cannot rename ${clash.local}`);
      text = rename(text, clash.pos, alias);
    }
  });

  const parts = [own, ...libParts];
  const sourceCode = prune(
    [
      [...new Set(parts.flatMap((p) => p.header))].join("\n"),
      renderImports(
        parts.flatMap((p) => p.bindings).filter((b) => !isLocal(b.module)),
        [
          ...new Set(
            parts.flatMap((p) => p.modules).filter((m) => !isLocal(m)),
          ),
        ],
      ),
      ...libParts.map((p) => p.body),
      own.body,
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
  // Read back off the pruned file: a package only a dropped helper used is not
  // a dependency of this Element.
  const modules = [
    ...new Set(
      source(sourceCode)
        .statements.filter(ts.isImportDeclaration)
        .map((s) => (s.moduleSpecifier as ts.StringLiteral).text),
    ),
  ];

  return { sourceCode: `${sourceCode}\n`, modules };
}

/** TS6133 unused value, TS6196 unused type. */
const UNUSED = new Set([6133, 6196]);

/**
 * Top-level declarations nothing reads, removed with the comments above them
 * until none are left — a helper can be the only reader of another. Then the
 * imports only they used, the way an editor's "remove unused imports" does it.
 * An unused local inside a function is that function's own bug and stays.
 *
 * ponytail: assumes an unread top-level initializer is pure — `converter()`,
 * `Easing.bezier()`. A call made for its effect (a font load) has to be an
 * expression statement, which this never drops, or be read.
 */
function prune(text: string): string {
  const options = { noUnusedLocals: true, jsx: ts.JsxEmit.Preserve };
  for (;;) {
    const unused = new Set(
      service(text, options)
        .getSemanticDiagnostics(FILE)
        .filter((d) => UNUSED.has(d.code))
        .map((d) => d.start),
    );
    const dead = source(text).statements.filter((stmt) => {
      const names = nameStarts(stmt);
      return names.length > 0 && names.every((at) => unused.has(at));
    });
    if (!dead.length) break;
    for (const stmt of dead.reverse()) {
      text = text.slice(0, stmt.getFullStart()) + text.slice(stmt.end);
    }
  }
  const [imports] = service(text, options).organizeImports(
    { type: "file", fileName: FILE, mode: ts.OrganizeImportsMode.RemoveUnused },
    {},
    undefined,
  );
  for (const c of [...(imports?.textChanges ?? [])].reverse()) {
    const end = c.span.start + c.span.length;
    text = text.slice(0, c.span.start) + c.newText + text.slice(end);
  }
  return text.trim();
}

/** Where each name a non-import statement declares is written. */
function nameStarts(stmt: ts.Statement): number[] {
  if (ts.isVariableStatement(stmt)) {
    const names = stmt.declarationList.declarations.map((d) => d.name);
    // A destructured declaration is reported on the pattern; leave it be.
    return names.every(ts.isIdentifier) ? names.map((n) => n.getStart()) : [];
  }
  if (
    (ts.isFunctionDeclaration(stmt) ||
      ts.isClassDeclaration(stmt) ||
      ts.isEnumDeclaration(stmt) ||
      isType(stmt)) &&
    stmt.name
  ) {
    return [stmt.name.getStart()];
  }
  return [];
}

/** `@remotion/google-fonts/Inter` → `@remotion/google-fonts`. */
export const packageName = (module: string) =>
  module
    .split("/")
    .slice(0, module.startsWith("@") ? 2 : 1)
    .join("/");

const origin = (b: Binding) => `${b.module}:${b.imported}`;

/** Record a part's names, and refuse two declarations of one name. */
function claim(part: Part, owner: Map<string, string>, file = "component") {
  for (const b of part.bindings) {
    if (!isLocal(b.module)) owner.set(b.local, origin(b));
  }
  for (const name of part.declared) {
    if (owner.has(name)) throw new Error(`${file} redeclares ${name}`);
    owner.set(name, `${file}#${name}`);
  }
}

/**
 * The lib files that provide `names`, plus the files they import, ordered so
 * every file comes after what it imports — a module-scope `const` read from
 * another file must already exist when this one runs.
 */
function libFiles(lib: RegistryFile[], names: string[]): RegistryFile[] {
  const byBase = new Map(
    lib.map((f) => [path.basename(f.path, path.extname(f.path)), f]),
  );
  const home = new Map<string, string>();
  const index = byBase.get("index");
  if (!index) throw new Error(`${LIB} has no index`);
  for (const stmt of source(index.content).statements) {
    if (
      ts.isExportDeclaration(stmt) &&
      stmt.moduleSpecifier &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause)
    ) {
      const base = (stmt.moduleSpecifier as ts.StringLiteral).text.slice(2);
      for (const el of stmt.exportClause.elements) home.set(el.name.text, base);
    }
  }

  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (base: string) => {
    const file = byBase.get(base);
    if (!file) throw new Error(`${LIB} has no ${base}`);
    if (seen.has(base)) return;
    seen.add(base);
    for (const m of parse(file.content, () => false).modules) {
      if (m.startsWith("./")) visit(m.slice(2));
    }
    order.push(base);
  };
  for (const name of names) {
    const base = home.get(name);
    if (!base) throw new Error(`${LIB} does not export ${name}`);
    visit(base);
  }
  return order.flatMap((base) => byBase.get(base) ?? []);
}

const source = (text: string) =>
  ts.createSourceFile(
    "part.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

function parse(
  text: string,
  keepExport: (stmt: ts.Statement, names: string[]) => boolean,
): Part {
  const part: Part = {
    bindings: [],
    modules: [],
    declared: [],
    header: [],
    body: "",
  };
  const kept: string[] = [];
  for (const stmt of source(text).statements) {
    const full = text.slice(stmt.getFullStart(), stmt.end);
    const trivia = text.slice(stmt.getFullStart(), stmt.getStart()).trim();

    // Imports are re-emitted merged; a directive means nothing in a Remotion
    // project. Either way the comments above them — the stamps — are kept.
    if (ts.isImportDeclaration(stmt)) {
      readImport(stmt, part);
      if (trivia) part.header.push(trivia);
      continue;
    }
    if (ts.isExpressionStatement(stmt) && ts.isStringLiteral(stmt.expression)) {
      if (trivia) part.header.push(trivia);
      continue;
    }
    // Studio takes the one `export const|function`; `export default X` and
    // `export { X }` lists only widen what the file exports, so they go.
    if (ts.isExportAssignment(stmt)) continue;
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.moduleSpecifier)
        throw new Error(`cannot inline: ${stmt.getText()}`);
      continue;
    }

    const names = declaredNames(stmt);
    part.declared.push(...names);
    kept.push(stripExport(stmt, full, keepExport(stmt, names)));
  }
  part.body = kept.join("").trim();
  return part;
}

function readImport(stmt: ts.ImportDeclaration, part: Part) {
  const module = (stmt.moduleSpecifier as ts.StringLiteral).text;
  part.modules.push(module);
  const clause = stmt.importClause;
  if (!clause) return;
  const add = (b: Omit<Binding, "module">) =>
    part.bindings.push({ module, ...b });
  if (clause.name) {
    const local = clause.name.text;
    const pos = clause.name.getStart();
    add({ kind: "default", imported: "default", local, text: local, pos });
  }
  const named = clause.namedBindings;
  if (named && ts.isNamespaceImport(named)) {
    const local = named.name.text;
    const pos = named.name.getStart();
    add({ kind: "namespace", imported: "*", local, text: local, pos });
  }
  if (named && ts.isNamedImports(named)) {
    for (const el of named.elements) {
      const text = el.getText();
      add({
        kind: "named",
        imported: (el.propertyName ?? el.name).text,
        local: el.name.text,
        text: clause.isTypeOnly && !el.isTypeOnly ? `type ${text}` : text,
        pos: el.name.getStart(),
      });
    }
  }
}

function declaredNames(stmt: ts.Statement): string[] {
  const names = (n: ts.BindingName): string[] =>
    ts.isIdentifier(n)
      ? [n.text]
      : n.elements.flatMap((e) =>
          ts.isBindingElement(e) ? names(e.name) : [],
        );
  if (ts.isVariableStatement(stmt)) {
    return stmt.declarationList.declarations.flatMap((d) => names(d.name));
  }
  if (
    (ts.isFunctionDeclaration(stmt) ||
      ts.isClassDeclaration(stmt) ||
      ts.isEnumDeclaration(stmt) ||
      isType(stmt)) &&
    stmt.name
  ) {
    return [stmt.name.text];
  }
  return [];
}

const isType = (
  stmt: ts.Statement,
): stmt is ts.InterfaceDeclaration | ts.TypeAliasDeclaration =>
  ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt);

function stripExport(stmt: ts.Statement, full: string, keep: boolean) {
  const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : [];
  const exported = modifiers?.find(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  );
  if (!exported || keep) return full;
  if (modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
    throw new Error("cannot inline an `export default`");
  }
  const start = stmt.getFullStart();
  return (
    full.slice(0, exported.getStart() - start) +
    full.slice(exported.end - start).trimStart()
  );
}

/**
 * Every reference to one top-level binding, renamed the way an editor would —
 * the language service knows a shadowing parameter or `{ interpolate }`
 * shorthand from the import, which a text replace does not.
 */
function rename(text: string, at: number, to: string): string {
  const spots = service(text).findRenameLocations(FILE, at, false, false, {
    providePrefixAndSuffixTextForRename: true,
  });
  if (!spots?.length) throw new Error(`cannot rename at ${at}`);
  let out = text;
  for (const s of [...spots].sort(
    (a, b) => b.textSpan.start - a.textSpan.start,
  )) {
    const end = s.textSpan.start + s.textSpan.length;
    out = `${out.slice(0, s.textSpan.start)}${s.prefixText ?? ""}${to}${s.suffixText ?? ""}${out.slice(end)}`;
  }
  return out;
}

const FILE = "part.tsx";

/** A language service over one file alone: no lib, no import resolved. */
function service(text: string, options: ts.CompilerOptions = {}) {
  return ts.createLanguageService({
    getScriptFileNames: () => [FILE],
    getScriptVersion: () => "0",
    getScriptSnapshot: (f) =>
      f === FILE ? ts.ScriptSnapshot.fromString(text) : undefined,
    getCurrentDirectory: () => "/",
    getCompilationSettings: () => ({
      noLib: true,
      noResolve: true,
      ...options,
    }),
    getDefaultLibFileName: () => "lib.d.ts",
    fileExists: (f) => f === FILE,
    readFile: (f) => (f === FILE ? text : undefined),
  });
}

function renderImports(bindings: Binding[], modules: string[]): string {
  const lines: string[] = [];
  const sortKey = (text: string) => text.replace(/^type /, "");
  for (const module of modules) {
    const own = bindings.filter((b) => b.module === module);
    const named = new Map<string, string>();
    for (const b of own.filter((b) => b.kind === "named")) {
      // Imported as a value anywhere wins over a type-only import of it.
      const prev = named.get(b.local);
      if (!prev || prev.startsWith("type ")) named.set(b.local, b.text);
    }
    const specifiers = [...named.values()].sort((a, b) =>
      sortKey(a).localeCompare(sortKey(b), "en", { sensitivity: "base" }),
    );
    const def = own.find((b) => b.kind === "default")?.local;
    const namespace = own.find((b) => b.kind === "namespace")?.local;

    if (!own.length) lines.push(`import "${module}";`);
    if (namespace) lines.push(`import * as ${namespace} from "${module}";`);
    if (!def && !specifiers.length) continue;

    const clause = (list: string) =>
      [def, specifiers.length ? list : ""].filter(Boolean).join(", ");
    const line = `import ${clause(`{ ${specifiers.join(", ")} }`)} from "${module}";`;
    // Wrapped the way Biome wraps: past 80 columns, and never a lone specifier.
    lines.push(
      line.length <= 80 || specifiers.length < 2
        ? line
        : `import ${clause(`{\n${specifiers.map((s) => `  ${s},`).join("\n")}\n}`)} from "${module}";`,
    );
  }
  return lines.join("\n");
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const camel = (s: string) =>
  s
    .replace(/^@/, "")
    .split(/[^a-zA-Z0-9]+/)
    .map((w, i) => (i ? capital(w) : w))
    .join("");
