/**
 * The geometry of the showcase wall (see `showcase-carousel.tsx`).
 *
 * The curve is not a rotation, and getting that wrong is what makes a wall look
 * like a carousel with a bent card in it.
 *
 * Measured off the reference: its six cards are 138, 138, 138, 138, 139px wide
 * with 6px gaps — uniform to the pixel — across a frame in which those same
 * cards grow from 171px tall to over 300px. Nothing is foreshortened
 * horizontally. What bends is the vertical axis alone, about a centre line that
 * does not move (y=173 at every single column of that frame).
 *
 * So there is no per-card angle. There is one scale field over the width of the
 * stage, and a card is simply the trapezoid between the field at its left edge
 * and the field at its right. Neighbours therefore agree on the height where
 * they meet, and the row's silhouette is a single continuous ribbon — that is
 * the thing the eye reads as a curve. Give each card its own axis to turn on and
 * you get rectangles at unrelated angles with a crease between them.
 *
 * A trapezoid that keeps its width is not affine, and it is not `rotateY`
 * either — `rotateY` foreshortens. It is a homography.
 *
 * ## Why the cards are drawn and not transformed
 *
 * A homography is still the wrong shape, and by a measurable amount. Every CSS
 * transform maps straight lines to straight lines, so a card's top edge comes
 * out as the *chord* of the arc it should be sitting on. Measured against the
 * field below, that chord runs 4.7px proud of the surface across the last card
 * and 1.6px across the one before it — the reference's own cards bow by 1.5–4px
 * over the same span, so this is the whole difference between a curve and a
 * crease, and it does not survive being looked at closely.
 *
 * There is no CSS for a bent plane. So `drawWallCard` paints the card art onto
 * a canvas instead: the silhouette is a path sampled along the real curve, and
 * the video is laid into it in vertical strips, each scaled to the surface at
 * its own x. The DOM keeps the `<video>` — it is the decode source, and it sits
 * underneath, always covered — and the link that wraps it.
 *
 * Only the cards that are actually on the curve get drawn. One in the flat zone
 * is already a DOM element, pixel for pixel; drawing it again would buy nothing
 * and cost a fill, a clip and a resample.
 */
export const WALL = {
  /** Stage widths travelled per second. */
  speed: 0.075,
  /** Gap between cards, as a fraction of *card* width — 6px on 138 in the
      reference. Cards belong to one surface; they are not tiles on a shelf. */
  gap: 0.043,
  /**
   * How many cards the flat reading zone holds, which is what sets where the
   * wall starts to turn. The reference folds at 35.5% of frame width and pitches
   * its cards every 17.8%, so: 1.95. Expressed this way it survives a resize —
   * the flat zone always holds two cards, and a stage with no room left over for
   * the bend (a phone) gets `foldStart = 1` and stays flat, which is the honest
   * answer there.
   */
  flatCards: 1.95,
  /**
   * The scale field: `1 / (1 - depth * t ** foldEase)`, `t` the fraction of the
   * way from `foldStart` to the right edge. Fitted to 28 samples taken off the
   * reference, 1.1% RMS. `depth` 0.5 puts the far edge at exactly 2×, which is
   * where the reference lands (171px → 342px).
   */
  depth: 0.5,
  foldEase: 1.8,
  /** Headroom above and below, as a fraction of card height. The wall doubles a
      card's height about its centre line, so this is what it takes to hold the
      tallest one — and it is what the reference frame gives them. */
  headroom: 0.95,
  /** …but a stage too narrow to fold never grows a card, so a curve's worth of
      room is just a hole: a phone was holding 61px open above the row and
      another 61 below. Enough air that it is not cramped, and no more. This is
      the only thing that spaces the row from the section above it — the section
      itself has no top padding — so it is one number, not three fighting. */
  flatHeadroom: 0.4,
  /**
   * Card width: a share of the stage, floored so a phone still gets a big card.
   *
   * The reference's own density is 0.175, ~5.5 cards across; this is far looser
   * at ~3.4. Its cards are screenshots, which survive being small; ours are the
   * product. The trade is curve resolution, which is why `flatCards` came down
   * with it — the bend has to keep about two cards on it, or the wall reads as a
   * flat row with one bent card, which is the thing this component exists to
   * avoid.
   */
  cardFraction: 0.2,
  minCardPx: 230,
  /** Ceiling, so a narrow stage still shows more than one card. */
  maxCardFraction: 0.68,
};

export type WallGeometry = {
  width: number;
  pitch: number;
  /** Rail length of the whole row: one full cycle of the travel. */
  span: number;
  /** Fraction of stage width at which the wall leaves flat. `>= 1` means never. */
  foldStart: number;
  /** Vertical slack the stage reserves, as a fraction of card height. */
  headroom: number;
};

export function wallGeometry(stageWidth: number, cards: number): WallGeometry {
  // Sized for the right-hand edge, which is the one you watch cards arrive at.
  // On a row that never stops, the card at that edge shows an average of 52% of
  // itself however it is sized — the phase sweeps uniformly, so the only lever
  // on how much of it you see is how big the card is. Capping width to keep a
  // whole card on screen therefore made the right-hand card *smaller*, which is
  // backwards.
  const width = Math.min(
    Math.max(stageWidth * WALL.cardFraction, WALL.minCardPx),
    stageWidth * WALL.maxCardFraction,
  );
  const pitch = width * (1 + WALL.gap);
  const turns = (WALL.flatCards * pitch) / stageWidth;
  // The bend needs a card's worth of room to happen in, or it is a card
  // doubling its height inside the last few pixels of screen. A stage that
  // narrow (a phone) stays honestly flat.
  const folds = (1 - turns) * stageWidth >= pitch;
  return {
    width,
    pitch,
    span: pitch * cards,
    foldStart: folds ? turns : 1,
    headroom: folds ? WALL.headroom : WALL.flatHeadroom,
  };
}

export const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Where card `i` sits, in pitches from the stage's left edge, before the wall
 * has moved: `wallOffset(i, pitch, span, 0) / pitch`. The row runs backwards —
 * the last card is the one at the left edge, then the one before it — which is
 * why the cards on the first screen are the *end* of the list.
 */
export const startSlot = (i: number, count: number) =>
  ((count - i) % count) - 1;

/**
 * Card `i`'s offset inside the track, when the track has travelled `travel`
 * (`mod(travelled, span)`) to the left. `offset - travel` is the card's stage x,
 * `mod(-travelled - i·pitch, span) - pitch`: one pitch of slack on the left, so a
 * card wraps to the far right while still fully off screen.
 *
 * Split this way because the track moves every frame and the offset only
 * changes when the card wraps — see `paint` in `showcase-carousel.tsx` for what
 * a per-card write every frame cost.
 */
export function wallOffset(
  i: number,
  pitch: number,
  span: number,
  travel: number,
): number {
  const c = mod(-i * pitch, span);
  return c - pitch + (c < travel ? span : 0);
}

/** Vertical scale of the surface, `u` fractions of the way across the stage. */
export function wallScale(u: number, foldStart: number): number {
  if (foldStart >= 1) return 1;
  const t = (u - foldStart) / (1 - foldStart);
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 / (1 - WALL.depth * clamped ** WALL.foldEase);
}

/**
 * Spacing of the samples along a curved edge. The field's second derivative
 * tops out near 1e-5/px², so 12px between samples leaves the polyline within
 * 0.01px of the curve — two orders under the 4.7px it is there to recover.
 */
const EDGE_STEP = 12;

/**
 * The picture a curved card is cut from: the video's current frame when it has
 * one, its poster until then.
 *
 * Never the `<video>` element itself. A card is laid in as up to 96 strips, and
 * every `drawImage(video, …)` converts the whole decoded frame again — YUV to
 * RGB, off the GPU and back — before cropping a strip out of it. Measured with
 * the GPU off (the machines people were getting stuck on), that was 1.9s of every
 * 6s of main thread, the page frozen under a wall. The carousel copies each new
 * frame into a canvas once and the strips come out of that.
 */
export type WallArt = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

export type WallPaint = {
  /** Left edge of the card, stage space. */
  x: number;
  /** The wall's unmoving centre line, stage space. */
  cy: number;
  /** Half the card's flat height. */
  half: number;
  radius: number;
  fill: string;
  stroke: string;
  /** Device pixels per CSS pixel, so strip seams can land on whole ones. */
  dpr: number;
};

/**
 * Paint one card onto the wall's canvas, curved.
 *
 * The path is the card's real silhouette, sampled along the scale field; it is
 * what draws the curve, and being a clip it is antialiased by the rasteriser.
 * The video then goes in as vertical strips, each scaled to the field at its own
 * x — so the *content* follows the surface too, not just the outline.
 *
 * Assumes the source video matches the card's 16:9 box, which every rendered
 * demo does (960×540 — see `retimeTo60`; the strips are taken off
 * the art's own width and height, so the size itself does not matter, only the
 * ratio). A demo of another shape would stretch rather than letterbox.
 */
export function drawWallCard(
  ctx: CanvasRenderingContext2D,
  art: WallArt | null,
  geo: WallGeometry,
  stageWidth: number,
  { x, cy, half, radius, fill, stroke, dpr }: WallPaint,
) {
  const { width, foldStart } = geo;
  const x1 = x + width;
  const edge = (px: number) => half * wallScale(px / stageWidth, foldStart);
  const r = Math.min(radius, width / 2, half);

  const path = new Path2D();
  path.moveTo(x + r, cy - edge(x + r));
  for (let px = x + r + EDGE_STEP; px < x1 - r; px += EDGE_STEP) {
    path.lineTo(px, cy - edge(px));
  }
  path.lineTo(x1 - r, cy - edge(x1 - r));
  path.arcTo(x1, cy - edge(x1), x1, cy - edge(x1) + r, r);
  path.lineTo(x1, cy + edge(x1) - r);
  path.arcTo(x1, cy + edge(x1), x1 - r, cy + edge(x1 - r), r);
  for (let px = x1 - r - EDGE_STEP; px > x + r; px -= EDGE_STEP) {
    path.lineTo(px, cy + edge(px));
  }
  path.lineTo(x + r, cy + edge(x + r));
  path.arcTo(x, cy + edge(x), x, cy + edge(x) - r, r);
  path.lineTo(x, cy - edge(x) + r);
  path.arcTo(x, cy - edge(x), x + r, cy - edge(x + r), r);
  path.closePath();

  ctx.fillStyle = fill;
  ctx.fill(path);

  if (art && art.width > 0 && art.height > 0) {
    // Enough strips that the step between two neighbours stays well under a
    // pixel at the card's own top edge, where it is worst. Scaled to the sweep
    // rather than fixed: the cap used to be 48, which was fine when a card's
    // edge climbed 42px and became a 2.5px staircase once cards got big enough
    // to climb 120px.
    const sweep = Math.abs(edge(x1) - edge(x));
    const strips = Math.min(96, Math.max(1, Math.ceil(sweep)));
    // Whole device pixels: two strips meeting on a fractional boundary are each
    // antialiased against it and leave a hairline down the card.
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    ctx.save();
    ctx.clip(path);
    for (let k = 0; k < strips; k++) {
      const a = snap(x + (k * width) / strips);
      const b = snap(x + ((k + 1) * width) / strips);
      if (b <= a) continue;
      // The TALLEST edge across the strip, not the middle of it. A strip sized
      // to its midpoint falls short of the curve over half its width, and the
      // fill painted underneath shows through the gap as a pale staircase along
      // the top edge — which is what "poor quality" looked like. Overshooting
      // instead costs nothing: the clip trims it back to the real curve, so the
      // silhouette is exact no matter how coarse the strips are.
      const e = Math.max(edge(a), edge(b));
      ctx.drawImage(
        art.source,
        ((a - x) / width) * art.width,
        0,
        ((b - a) / width) * art.width,
        art.height,
        a,
        cy - e,
        b - a,
        2 * e,
      );
    }
    ctx.restore();
  }

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke(path);
}
