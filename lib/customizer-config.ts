/** Full-bleed fill painted behind a component in its preview stage. */
export type PreviewBackdropFill =
  | { type: "color"; value: string }
  | { type: "gradient"; value: string }
  | { type: "image"; src: string; fit?: "cover" | "contain" };

/**
 * What a control means to a *brand*, as opposed to what it means to a component.
 *
 * The editor's brand kit sets one accent colour and one logo across a whole
 * timeline, and it cannot work that out from prop names. The colour knobs in
 * this registry are called `accentColor`, `fieldColor`, `titleColor`,
 * `paperColor`, `voidColor`, `glowColorA` and `color`, and a heuristic over
 * that set puts `announce-title`'s title ink and title paper on the same hex
 * and renders the component unreadable. So it is declared, once, by the person
 * who knows what the knob does.
 *
 * Only two roles, deliberately. `accent` is a colour that is *supposed* to be
 * loud — a highlight, a glow, a colour field — so replacing it can never hide
 * text behind its own background. Bare `color` and `textColor` controls are
 * left unmarked for exactly that reason: they are ink, and ink that follows a
 * brand colour is one light palette away from an invisible headline.
 */
export type BrandRole = "accent" | "logo";

export type ControlType =
  | { type: "text"; default: string; label: string }
  // Image URL or data URL. Rendered by components as a plain string `src`; the
  // customizer's `image` control adds file upload (→ data URL) + URL paste.
  | { type: "image"; default: string; label: string; brand?: BrandRole }
  | {
      type: "number";
      default: number;
      min: number;
      max: number;
      step: number;
      label: string;
    }
  | {
      type: "number-input";
      default: number;
      min: number;
      max: number;
      step: number;
      label: string;
    }
  | { type: "color"; default: string; label: string; brand?: BrandRole }
  | { type: "select"; default: string; options: string[]; label: string }
  | { type: "boolean"; default: boolean; label: string };

export type ControlConfig = Record<string, ControlType>;

export interface ComponentConfig {
  controls: ControlConfig;
  durationInFrames: number;
  fps: number;
  compositionWidth: number;
  compositionHeight: number;
  /**
   * Import statement shown in the generated code snippet.
   * Example: `import { TextReveal } from "@/components/snap-cn/text-reveal";`
   */
  importPath: string;
  /**
   * Pascal-case component name used in the generated JSX snippet.
   */
  componentName: string;
  /**
   * Optional custom code-snippet generator. When present, the preview's
   * `generateCode` delegates to it instead of the default prop serializer
   * (used by the ui-tier primitives to emit a `steps={[…]}` literal and omit
   * preview-only props). Components without it keep the default path.
   */
  snippet?: (values: Record<string, unknown>) => string;
  previewBackdrop?: PreviewBackdropFill;
}

export const FPS = 30;
export const W = 1280;
export const H = 720;
export const FONT_WEIGHT_OPTIONS = ["400", "500", "600", "700"];

/**
 * Controls present on every animation. Merged into each component's controls
 * inside the registry index so every animation in the customizer exposes the
 * same baseline knobs.
 */
export const SHARED_CONTROLS: ControlConfig = {
  speed: {
    type: "number",
    default: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    label: "Speed",
  },
};

export function getDefaults(controls: ControlConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, ctrl] of Object.entries(controls)) {
    out[key] = ctrl.default;
  }
  return out;
}
