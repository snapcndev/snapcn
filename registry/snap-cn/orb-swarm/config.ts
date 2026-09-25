import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

export const orbSwarmConfig: ComponentConfig = {
  componentName: "OrbSwarm",
  importPath: "@/components/snap-cn/orb-swarm",
  controls: {
    script: {
      type: "text",
      default:
        "one command | what if | every launch | you shipped | got a video | in seconds",
      label: "Script (| card)",
    },
    background: { type: "color", default: "#fcf9ff", label: "Background" },
    ink: { type: "color", default: "#000000", label: "Ink" },
    orbColor: { type: "color", default: "#3577e0", label: "Orb colour" },
    softness: {
      type: "number",
      default: 0.7,
      min: 0,
      max: 2,
      step: 0.05,
      label: "Type softness",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // The recording's 128 beats at 24 a second, on a 30fps clock.
  durationInFrames: 160,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
