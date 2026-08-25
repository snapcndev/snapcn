import type React from "react";
import type { ComponentConfig } from "@/lib/customizer-config";
import { CONFIGS } from "@/registry/__configs__";
import { AnnounceTitle } from "@/registry/snap-cn/announce-title";
import { AnswerStream } from "@/registry/snap-cn/answer-stream";
import { BlockWordmark } from "@/registry/snap-cn/block-wordmark";
import { FollowerRush } from "@/registry/snap-cn/follower-rush";
import { HeroLaunch } from "@/registry/snap-cn/hero-launch";
import { KaraokeCaptions } from "@/registry/snap-cn/karaoke-captions";
import { LaptopFrame } from "@/registry/snap-cn/laptop-frame";
import { LogoAssemble } from "@/registry/snap-cn/logo-assemble";
import { LogoFlicker } from "@/registry/snap-cn/logo-flicker";
import { MoodboardReveal } from "@/registry/snap-cn/moodboard-reveal";
import { OrbitGallery } from "@/registry/snap-cn/orbit-gallery";
import { PhoneFrame } from "@/registry/snap-cn/phone-frame";
import { PromptZoom } from "@/registry/snap-cn/prompt-zoom";
import { SearchTyping } from "@/registry/snap-cn/search-typing";
import { StatusCycle } from "@/registry/snap-cn/status-cycle";
import { TerminalSimulator } from "@/registry/snap-cn/terminal-simulator";
import { TextBuild } from "@/registry/snap-cn/text-build";
import { TextHighlight } from "@/registry/snap-cn/text-highlight";
import { TextReveal } from "@/registry/snap-cn/text-reveal";
import { TextSwap } from "@/registry/snap-cn/text-swap";
import { TextSwell } from "@/registry/snap-cn/text-swell";
import { WordCaptions } from "@/registry/snap-cn/word-captions";
import { WordFlip } from "@/registry/snap-cn/word-flip";
import { TypeMorph } from "./snap-cn/type-morph";

/**
 * Scene component + customizer config, per slug.
 *
 * Importing this module means importing every scene, and therefore Remotion —
 * which is right for anything that renders one and wrong for anything that only
 * reads a config. Those callers import `CONFIGS` from `__configs__` instead;
 * the config objects here are the same references, so nothing can drift.
 */
export interface RegistryEntry {
  Component: React.ComponentType<any>;
  config: ComponentConfig;
}

const registry: Record<string, RegistryEntry> = {
  "announce-title": {
    Component: AnnounceTitle,
    config: CONFIGS["announce-title"],
  },
  "answer-stream": {
    Component: AnswerStream,
    config: CONFIGS["answer-stream"],
  },
  "block-wordmark": {
    Component: BlockWordmark,
    config: CONFIGS["block-wordmark"],
  },
  "follower-rush": {
    Component: FollowerRush,
    config: CONFIGS["follower-rush"],
  },
  "hero-launch": { Component: HeroLaunch, config: CONFIGS["hero-launch"] },
  "type-morph": { Component: TypeMorph, config: CONFIGS["type-morph"] },
  "karaoke-captions": {
    Component: KaraokeCaptions,
    config: CONFIGS["karaoke-captions"],
  },
  "laptop-frame": { Component: LaptopFrame, config: CONFIGS["laptop-frame"] },
  "logo-assemble": {
    Component: LogoAssemble,
    config: CONFIGS["logo-assemble"],
  },
  "logo-flicker": { Component: LogoFlicker, config: CONFIGS["logo-flicker"] },
  "moodboard-reveal": {
    Component: MoodboardReveal,
    config: CONFIGS["moodboard-reveal"],
  },
  "orbit-gallery": {
    Component: OrbitGallery,
    config: CONFIGS["orbit-gallery"],
  },
  "phone-frame": { Component: PhoneFrame, config: CONFIGS["phone-frame"] },
  "prompt-zoom": { Component: PromptZoom, config: CONFIGS["prompt-zoom"] },
  "search-typing": {
    Component: SearchTyping,
    config: CONFIGS["search-typing"],
  },
  "status-cycle": { Component: StatusCycle, config: CONFIGS["status-cycle"] },
  "terminal-simulator": {
    Component: TerminalSimulator,
    config: CONFIGS["terminal-simulator"],
  },
  "text-build": { Component: TextBuild, config: CONFIGS["text-build"] },
  "text-highlight": {
    Component: TextHighlight,
    config: CONFIGS["text-highlight"],
  },
  "text-reveal": { Component: TextReveal, config: CONFIGS["text-reveal"] },
  "text-swap": { Component: TextSwap, config: CONFIGS["text-swap"] },
  "text-swell": { Component: TextSwell, config: CONFIGS["text-swell"] },
  "word-captions": {
    Component: WordCaptions,
    config: CONFIGS["word-captions"],
  },
  "word-flip": { Component: WordFlip, config: CONFIGS["word-flip"] },
};

export default registry;
