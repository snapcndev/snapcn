import {
  parseAsBoolean,
  parseAsFloat,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";
import type { ControlConfig } from "@/lib/customizer-config";

/**
 * The URL half of the customizer, on its own.
 *
 * It lived in `lib/ui-preview-internals.tsx` next to `PreviewStage` — and that
 * module imports `@remotion/player`, so every docs page that only wanted to
 * build a few query-param parsers pulled the entire Remotion runtime into its
 * bundle. Nothing here needs Remotion; nothing here should cost it.
 */
/**
 * Build nuqs parsers + URL keys from a control config. Each control becomes a
 * URL-synced query param prefixed with the component name (dashes → underscores)
 * so multiple previews on one page never collide.
 */
export function buildParsers(name: string, controls: ControlConfig) {
  const parsers: Record<string, any> = {};
  const urlKeys: Record<string, string> = {};
  const prefix = name.replace(/-/g, "_");

  for (const [key, ctrl] of Object.entries(controls)) {
    urlKeys[key] = `${prefix}_${key}`;
    if (ctrl.type === "text" || ctrl.type === "image") {
      parsers[key] = parseAsString.withDefault(ctrl.default);
    } else if (ctrl.type === "number" || ctrl.type === "number-input") {
      parsers[key] = parseAsFloat.withDefault(ctrl.default);
    } else if (ctrl.type === "color") {
      parsers[key] = parseAsString.withDefault(ctrl.default);
    } else if (ctrl.type === "select") {
      parsers[key] = parseAsStringLiteral(
        ctrl.options as readonly string[],
      ).withDefault(ctrl.default);
    } else if (ctrl.type === "boolean") {
      parsers[key] = parseAsBoolean.withDefault(ctrl.default);
    }
  }
  return { parsers, urlKeys };
}
