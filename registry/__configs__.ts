import { type ComponentConfig, SHARED_CONTROLS } from "@/lib/customizer-config";
import { announceTitleConfig } from "@/registry/snap-cn/announce-title/config";
import { answerStreamConfig } from "@/registry/snap-cn/answer-stream/config";
import { blockWordmarkConfig } from "@/registry/snap-cn/block-wordmark/config";
import { followerRushConfig } from "@/registry/snap-cn/follower-rush/config";
import { heroLaunchConfig } from "@/registry/snap-cn/hero-launch/config";
import { karaokeCaptionsConfig } from "@/registry/snap-cn/karaoke-captions/config";
import { laptopFrameConfig } from "@/registry/snap-cn/laptop-frame/config";
import { logoAssembleConfig } from "@/registry/snap-cn/logo-assemble/config";
import { logoDriftConfig } from "@/registry/snap-cn/logo-drift/config";
import { logoFlickerConfig } from "@/registry/snap-cn/logo-flicker/config";
import { moodboardRevealConfig } from "@/registry/snap-cn/moodboard-reveal/config";
import { orbitGalleryConfig } from "@/registry/snap-cn/orbit-gallery/config";
import { phoneFrameConfig } from "@/registry/snap-cn/phone-frame/config";
import { promptSendConfig } from "@/registry/snap-cn/prompt-send/config";
import { promptZoomConfig } from "@/registry/snap-cn/prompt-zoom/config";
import { searchTypingConfig } from "@/registry/snap-cn/search-typing/config";
import { statusCycleConfig } from "@/registry/snap-cn/status-cycle/config";
import { terminalSimulatorConfig } from "@/registry/snap-cn/terminal-simulator/config";
import { textBuildConfig } from "@/registry/snap-cn/text-build/config";
import { textHighlightConfig } from "@/registry/snap-cn/text-highlight/config";
import { textRevealConfig } from "@/registry/snap-cn/text-reveal/config";
import { textRewriteConfig } from "@/registry/snap-cn/text-rewrite/config";
import { textSelectConfig } from "@/registry/snap-cn/text-select/config";
import { textSwapConfig } from "@/registry/snap-cn/text-swap/config";
import { textSwellConfig } from "@/registry/snap-cn/text-swell/config";
import { wordCaptionsConfig } from "@/registry/snap-cn/word-captions/config";
import { wordFlipConfig } from "@/registry/snap-cn/word-flip/config";
import { typeMorphConfig } from "./snap-cn/type-morph/config";

/**
 * Every component's customizer config, and nothing else.
 *
 * Split out of `__index__.tsx` because of what importing that file costs: it
 * pairs each config with its scene component, so a module that only needed to
 * know a component's *controls* pulled all 22 scenes and the whole of Remotion
 * into its bundle. The docs preview did exactly that, on every component page.
 *
 * The two passes below mutate these objects in place, and `__index__.tsx` holds
 * the same references — so a config is identical whichever side you reach it
 * from, and there is one place that decides what a control is.
 */
export const CONFIGS: Record<string, ComponentConfig> = {
  "announce-title": announceTitleConfig,
  "answer-stream": answerStreamConfig,
  "block-wordmark": blockWordmarkConfig,
  "follower-rush": followerRushConfig,
  "hero-launch": heroLaunchConfig,
  "type-morph": typeMorphConfig,
  "karaoke-captions": karaokeCaptionsConfig,
  "laptop-frame": laptopFrameConfig,
  "logo-assemble": logoAssembleConfig,
  "logo-drift": logoDriftConfig,
  "logo-flicker": logoFlickerConfig,
  "moodboard-reveal": moodboardRevealConfig,
  "orbit-gallery": orbitGalleryConfig,
  "phone-frame": phoneFrameConfig,
  "prompt-send": promptSendConfig,
  "prompt-zoom": promptZoomConfig,
  "search-typing": searchTypingConfig,
  "status-cycle": statusCycleConfig,
  "terminal-simulator": terminalSimulatorConfig,
  "text-build": textBuildConfig,
  "text-highlight": textHighlightConfig,
  "text-reveal": textRevealConfig,
  "text-rewrite": textRewriteConfig,
  "text-select": textSelectConfig,
  "text-swap": textSwapConfig,
  "text-swell": textSwellConfig,
  "word-captions": wordCaptionsConfig,
  "word-flip": wordFlipConfig,
};

// Append the shared controls (e.g. `speed`) to every component config so
// every animation in the customizer exposes the same baseline knobs.
for (const config of Object.values(CONFIGS)) {
  config.controls = { ...config.controls, ...SHARED_CONTROLS };
}

// These components schedule a payoff (a count-up landing on its target, a
// scripted flow reaching its end state, a reveal whose last elements enter at
// a fixed late frame) against the shared speed-scaled clock. A speed < 1 would
// stall the timeline short of that payoff, so the customizer caps their
// `speed` knob at a minimum of 1. Reassigning the existing key keeps its order.
const MIN_SPEED_ONE = [
  "follower-rush",
  // The tagline finishes draining to white at frame 147 of 170; under speed < 1
  // the line never reaches its resting colour inside the composition.
  "announce-title",
  "terminal-simulator",
  // The notch notification lands "connected" at frame 120 of 240; under
  // speed < 1 that beat never arrives inside the composition.
  "laptop-frame",
  // The hero landing is the last beat (frame 108–150); under speed < 1 the
  // montage never reaches it inside the composition.
  "moodboard-reveal",
  // The logo + brand name land in the last beat; under speed < 1 they never
  // arrive inside the composition.
  "logo-assemble",
  "logo-flicker",
  // The letters only resolve from frame 94, and the last swap lands at ~109 of
  // 150; under speed < 1 the wordmark never stops being blocks.
  "block-wordmark",
  "text-build",
  "text-swell",
  "karaoke-captions",
  "word-captions",
  // The payoff is the finished sentence and the beat that follows it. Under
  // speed < 1 the last characters never land inside durationInFrames.
  "search-typing",
  // The last chip arrives at frame 115 of 150 and its step settles by ~124;
  // under speed < 1 act 2 never finishes inside the composition.
  "status-cycle",
];
for (const name of MIN_SPEED_ONE) {
  const config = CONFIGS[name];
  if (config) {
    config.controls.speed = {
      type: "number",
      default: 1,
      min: 1,
      max: 4,
      step: 0.25,
      label: "Speed",
    };
  }
}
