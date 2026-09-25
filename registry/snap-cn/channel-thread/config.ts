import {
  type ComponentConfig,
  FONT_FAMILY_CONTROL,
  FPS,
  H,
  W,
} from "@/lib/customizer-config";

/**
 * The default conversation, in the string form the component takes for this
 * one-line control: `avatar > name time > text`, `|` between messages, and a
 * message that is only text continues the one above. The repo ships 24 square
 * photos in `public/avatars` (`follower-rush` draws from the same folder):
 * faces are the difference between a chat and a wireframe.
 */
const MESSAGES =
  "/avatars/07.jpg > rhea 9:41 AM > Launch video by Thursday? | We have nothing shot. | /avatars/13.jpg > sam 9:42 AM > Already done. | Built it out of snapcn.";

export const channelThreadConfig: ComponentConfig = {
  componentName: "ChannelThread",
  importPath: "@/components/snap-cn/channel-thread",
  controls: {
    messages: {
      type: "text",
      default: MESSAGES,
      label: "Messages (avatar > name time > text | …)",
    },
    mode: {
      type: "select",
      // The only scene in the registry that ships dark, and deliberately: a
      // transcript is read against the room it is in, and the reference this was
      // measured from is white type on black. On the warm off-white page the
      // scroll fade — which is the whole depth of the scene — turns the oldest
      // line into a pale smudge that reads as a rendering fault rather than as
      // distance. Light is one prop away and still resolves from the tokens.
      default: "dark",
      options: ["light", "dark"],
      label: "Theme",
    },
    fontFamily: FONT_FAMILY_CONTROL,
  },
  // The last message lands on 84 and the scroll under it is still arriving; 110
  // leaves the finished thread up for most of a second.
  durationInFrames: 110,
  fps: FPS,
  compositionWidth: W,
  compositionHeight: H,
};
