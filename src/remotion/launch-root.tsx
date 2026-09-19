import { springTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { AppReveal } from "@/registry/snap-cn-pro/app-reveal";
import { LibraryFlight } from "@/registry/snap-cn-pro/library-flight";
import { Manifesto } from "@/registry/snap-cn-pro/manifesto";
import { PickerCommit } from "@/registry/snap-cn-pro/picker-commit";
import { TextHighlight } from "@/registry/snap-cn/text-highlight";

/**
 * The 15s snapcn Pro launch cut — Pro scenes, because that is what is being sold.
 *
 * 110 + 141 + 130 + 78 + 63 − 4×18 overlap = 450f = 15.0s @30fps.
 *
 * Three earlier cuts are behind this one and every rule here came off a rendered
 * frame of them:
 *   · the free `card-rail` flicked our own demo posters and a fake "npm install
 *     One Tool" terminal past the camera — someone else's product, in this video.
 *     Every beat below is a scene whose own content IS snapcn's.
 *   · `laptop-frame` held a still screenshot for two seconds and read as dead air.
 *     No device frame survives; the product shows itself in `app-reveal`.
 *   · text beats were billed at the frame their last word landed. The MCP now
 *     bills copy at 3 words a second (snapcn_plan_video's SETTLE block), and
 *     every line below clears that: 7 words in 110f, 5 in 130f, 4 in 63f.
 *   · the beats were CROSSFADED, and at 0:13 "Add component" and "Get it at
 *     snapcn.dev/pro" were one illegible word. `fade()` leaves the outgoing
 *     scene at full opacity (`shouldFadeOutExitingScene` defaults false) and
 *     draws the next one over it, and every scene here owns the middle of the
 *     frame. Both had long since settled — settling is not the fix, moving is.
 */
const ACCENT = "#F2D200";
const PAGE = "#09090B";
/**
 * Slides, because a slide translates the two beats apart: for all 18 shared
 * frames every pixel belongs to exactly one shot, whatever either scene paints
 * or leaves transparent. `damping: 200` kills the default spring's overshoot —
 * an overshooting slide throws the whole scene past centre and drags it back.
 */
const beat = {
  // from-right: the next beat arrives from the right and pushes this one off to
  // the left. Remotion's default is the other way round, which reads as a rewind.
  presentation: slide({ direction: "from-right" }),
  timing: springTiming({ durationInFrames: 18, config: { damping: 200 } }),
};

export const SnapcnProLaunch = () => (
  <AbsoluteFill style={{ background: PAGE }}>
    <TransitionSeries>
      {/* The claim, in the scene built for claims */}
      <TransitionSeries.Sequence durationInFrames={110}>
        <Manifesto
          lineOne="You shipped it."
          lineTwo="The demo takes"
          lineThree="minutes."
          edgeColor={ACCENT}
          edgeMidColor="#FFF07A"
          mode="dark"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...beat} />
      {/* The product: the wordmark folding into the editor it opens */}
      <TransitionSeries.Sequence durationInFrames={141}>
        <AppReveal
          wordmark="snapcn"
          greeting="Product demo videos,"
          subGreeting="in React."
          placeholder="Describe your video"
          footnote="Scenes shortened and simulated."
          speed={0.75}
          mode="dark"
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...beat} />
      {/* The catalogue, flown through — its own screens, which are the product */}
      <TransitionSeries.Sequence durationInFrames={130}>
        <LibraryFlight
          title="snapcn Pro"
          first="One subscription."
          second="Endless videos."
          background={PAGE}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...beat} />
      {/* The install, which is the whole verb of this product */}
      <TransitionSeries.Sequence durationInFrames={78}>
        {/* mode, not theme: `theme` is a token object, and the string it was
            handed left the scene on the LIGHT palette — a white frame in a dark
            cut. It paints no accent, so there is nothing to pass ACCENT to. */}
        <PickerCommit cta="Add component" mode="dark" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...beat} />
      {/* CTA — 4 words, 63f: over the 40f the read budget asks for */}
      <TransitionSeries.Sequence durationInFrames={63}>
        <TextHighlight
          before="Get it at "
          highlight="snapcn.dev/pro"
          preset="marker"
          accentColor={ACCENT}
          mode="dark"
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

export function LaunchRoot() {
  return (
    <Composition
      id="SnapcnProLaunch"
      component={SnapcnProLaunch}
      durationInFrames={450}
      fps={30}
      width={1280}
      height={720}
    />
  );
}

registerRoot(LaunchRoot);
