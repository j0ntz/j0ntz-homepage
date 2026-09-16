// Scene constants and label geometry shared by the static snapshot (SVG,
// rendered on the server), the WebGL scene, and the data script, so the
// first WebGL frame is the same picture as the SVG it replaces. Erasable
// TypeScript only.

import type { GraphNode } from "./graph-types";

/** Camera sits on +z at this distance, looking at the origin. */
export const cameraDistance = 6;

/** Vertical field of view, in degrees, when the viewport is square or
 * landscape. Portrait viewports keep the horizontal extent instead (see
 * fovForAspect), which is what an SVG with xMidYMid meet does: the unit
 * square always fits inside the viewport, centred. */
export const baseFovDegrees = 40;

/** 1 / tan(fov / 2) for the base fov: the projection factor of the SVG. */
export const baseFocal = 1 / Math.tan((baseFovDegrees * Math.PI) / 360);

/** Root-mean-square radius the layout is scaled to, in scene units. */
export const targetRmsRadius = 1.25;

/** No node centre sits farther than this from the axis in x or y, so the
 * whole graph fits the square the camera shows at rest (half-extent 2.18 at
 * the origin) with room for the disc, the halo, and the orbit. */
export const maxSceneExtent = 1.7;

/** Disc radius range, in scene units, for the least and most active node. */
export const minNodeRadius = 0.045;
export const maxNodeRadius = 0.19;

/** The glow quad extends this many disc radii from the centre. */
export const haloScale = 2.4;

/** Nodes in --accent with the glow. The contract says eight. */
export const accentCount = 8;

/** Viewports narrower than this show the most active mobileCount nodes. */
export const desktopMinWidth = 768;
export const mobileCount = 25;
export const desktopMaxCount = 60;

/** One full orbit at rest, in seconds. */
export const orbitPeriodSeconds = 90;

/** The rest orbit as a rate, radians per second. */
export const autoSpinSpeed = (Math.PI * 2) / orbitPeriodSeconds;

/** Seconds after the cursor leaves, or the last touch lifts, before the
 * rest orbit eases back in. */
export const resumeDelaySeconds = 5;

/** Ease-in of the resumed orbit (a damp rate): about three seconds from
 * still to full speed. */
export const resumeEase = 0.8;

/** Decay rate of a flick's momentum, and of the rest orbit when the cursor
 * arrives: a flick eases out over one to two seconds. */
export const momentumDecay = 2.2;

/** Fastest a flick can spin the graph, radians per second. */
export const maxSpinSpeed = 4;

/** Radians a drag across the whole canvas width turns the graph. */
export const dragRadiansPerWidth = Math.PI;

/** A press that moves this far, in CSS pixels, is a drag, not a tap or click. */
export const dragThresholdPx = 6;

/** A release this soon after the last move keeps the drag's momentum;
 * a finger or cursor that stopped before lifting leaves the graph still. */
export const flickWindowMs = 80;

/** Nodes that carry their label at rest: the accent nodes. */
export const labelledCount = accentCount;

/** Radians of tilt at the edge of the viewport. */
export const parallaxYaw = 0.22;
export const parallaxPitch = 0.14;

/** Hover ramp, in seconds. */
export const hoverSeconds = 0.15;

/** Opacity of nodes outside the hovered neighbourhood. */
export const dimmedOpacity = 0.4;

/** Edge opacity at rest, as a fraction of --accent. */
export const edgeOpacity = 0.2;

/** Vertical fov, in degrees, that makes a WebGL viewport of this aspect
 * show the same region as the SVG snapshot with xMidYMid meet. */
export function fovForAspect(aspect: number): number {
  const focal = baseFocal * Math.min(aspect, 1);
  return (2 * Math.atan(1 / focal) * 180) / Math.PI;
}

/** Disc radius from activity: square root so the big node does not swamp
 * the rest, floor so an idle repo is still a target. */
export function nodeRadius(commits: number, maxCommits: number): number {
  const share = maxCommits > 0 ? Math.sqrt(commits / maxCommits) : 0;
  return minNodeRadius + (maxNodeRadius - minNodeRadius) * share;
}

/** The nodes a viewport shows, in the order graph.json stores them. */
export function selectNodes<T extends GraphNode>(nodes: T[], desktop: boolean): T[] {
  return nodes.slice(0, desktop ? desktopMaxCount : mobileCount);
}

export interface ProjectedNode {
  /** SVG units, x right and y down, in a -1 to 1 square. */
  x: number;
  y: number;
  /** Disc radius in the same units. */
  radius: number;
  /** Distance from the camera, for depth ordering. */
  depth: number;
}

/** Project a scene-space point with the camera at rest (no orbit, no
 * parallax), the state both the SVG and the first WebGL frame share. */
export function projectAtRest(
  x: number,
  y: number,
  z: number,
  radius: number,
): ProjectedNode {
  const depth = cameraDistance - z;
  const factor = baseFocal / depth;
  return { x: x * factor, y: -y * factor, radius: radius * factor, depth };
}

// ---------------------------------------------------------------------------
// Label placement, shared by the SVG snapshot (server, percent of a nominal
// square) and the live scene (per frame, pixels of the canvas).

/** Gap between a node's disc edge and its label, CSS pixels. */
export const labelGapPx = 8;

/** Margin a label keeps from the frame edge, CSS pixels: --space-base. The
 * snapshot's CSS uses the token itself. */
export const labelInsetPx = 8;

/** The label face as the server estimates it: --step-0 in pixels, JetBrains
 * Mono's advance width in em, and the label line height. */
export const labelFontPx = 16;
export const monoAdvanceEm = 0.6;
export const labelLineHeight = 1.3;

/** Square sizes the snapshot lays its labels out for: the hero at 900 tall
 * minus the three rhythm units below it, and a 390 wide phone. */
export const desktopNominalSquarePx = 828;
export const mobileNominalSquarePx = 390;

export interface LabelBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Something a label keeps off. A round obstacle is a disc: the collision
 * test uses the circle inscribed in the box, so a label may sit in the
 * corner of a big disc's bounding square. A soft obstacle (a neutral disc,
 * small and unlabelled) may be covered at a cost when the alternative is a
 * label far from its node; a hard one (an accent disc, a label, the hero's
 * text) never is. */
export interface Obstacle extends LabelBox {
  round?: boolean;
  soft?: boolean;
}

/** What covering one soft obstacle costs, in the same currency as the
 * pixels a label is pushed from its node: the disc's diameter, up to one
 * label height, so a label moves a line to clear a disc and no further and
 * moves less for a smaller one. Covering a hard one costs
 * more than any push inside a frame, so it happens only when every side
 * of the node is taken, and then as little as possible. */
export const softOverlapCostPx = labelFontPx * labelLineHeight;
export const hardOverlapCostPx = 4096;

/** A node that carries a label: its screen position and radius, and the
 * measured size of the label. */
export interface LabelSubject {
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
}

/** The farthest a label may be pushed from where it would sit beside its
 * node before another side of the node is tried: a label that has moved
 * further no longer reads as that node's name. About one and a half lines. */
export const maxLabelShiftPx = 32;

/** Where a label landed, and where it would have sat beside its node had
 * nothing been in the way. Callers that animate ease between the two. */
export interface LabelPlacement {
  anchor: LabelBox;
  box: LabelBox;
}

/** Puts a label box beside its node on the side facing away from the
 * graph's centre, so labels spread to the periphery: straight below a node
 * under the centre, to the right of a node right of it, and every direction
 * between. Continuous in the node position, so a label slides around its
 * node as the graph turns rather than flipping sides. */
export function anchorLabel(
  nodeX: number,
  nodeY: number,
  radius: number,
  centreX: number,
  centreY: number,
  width: number,
  height: number,
): LabelBox {
  const dx = nodeX - centreX;
  const dy = nodeY - centreY;
  const length = Math.hypot(dx, dy);
  const ux = length < 1e-6 ? 0 : dx / length;
  const uy = length < 1e-6 ? 1 : dy / length;
  return anchorToward(nodeX, nodeY, radius, ux, uy, width, height);
}

/** A label box beside a node in the direction (ux, uy), a unit vector: the
 * box is slid along that direction until no point of it is nearer the node's
 * centre than the disc radius plus the gap. A wide box on a diagonal would
 * otherwise reach back over the disc. */
function anchorToward(
  nodeX: number,
  nodeY: number,
  radius: number,
  ux: number,
  uy: number,
  width: number,
  height: number,
): LabelBox {
  const reach = radius + labelGapPx;
  let left = nodeX + ux * reach + ((ux - 1) * width) / 2;
  let top = nodeY + uy * reach + ((uy - 1) * height) / 2;
  for (let pass = 0; pass < anchorPasses; pass++) {
    const nearestX = Math.min(Math.max(left, nodeX), left + width);
    const nearestY = Math.min(Math.max(top, nodeY), top + height);
    const short = reach - Math.hypot(nearestX - nodeX, nearestY - nodeY);
    if (short <= anchorTolerancePx) break;
    left += ux * short;
    top += uy * short;
  }
  return { left, top, width, height };
}

const anchorPasses = 4;
const anchorTolerancePx = 0.5;

/** The four sides tried, in turn, when the preferred side is taken. */
const fallbackSides: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/** Whether a box meets an obstacle, the obstacle grown by `grow` pixels on
 * every side. */
function overlaps(box: LabelBox, obstacle: Obstacle, grow = 0): boolean {
  if (obstacle.round !== true) {
    return boxesOverlap(box, {
      left: obstacle.left - grow,
      top: obstacle.top - grow,
      width: obstacle.width + grow * 2,
      height: obstacle.height + grow * 2,
    });
  }
  const radius = obstacle.width / 2 + grow;
  const cx = obstacle.left + radius;
  const cy = obstacle.top + obstacle.height / 2;
  const nearestX = Math.min(Math.max(box.left, cx), box.left + box.width);
  const nearestY = Math.min(Math.max(box.top, cy), box.top + box.height);
  const dx = nearestX - cx;
  const dy = nearestY - cy;
  return dx * dx + dy * dy < radius * radius;
}

/** Slides a box inside a frame, labelInsetPx from its edges. The frame is
 * the part of the canvas a visitor can see, in canvas pixels: the whole
 * canvas for the snapshot and the mobile square, and on desktop the part
 * left inside the hero once the canvas is shifted right, since the hero
 * clips whatever crosses its edge. */
export function clampBox(box: LabelBox, frame: LabelBox): LabelBox {
  const minLeft = frame.left + labelInsetPx;
  const minTop = frame.top + labelInsetPx;
  return {
    ...box,
    left: Math.min(
      Math.max(minLeft, box.left),
      Math.max(minLeft, frame.left + frame.width - labelInsetPx - box.width),
    ),
    top: Math.min(
      Math.max(minTop, box.top),
      Math.max(minTop, frame.top + frame.height - labelInsetPx - box.height),
    ),
  };
}

function inFrame(box: LabelBox, frame: LabelBox): boolean {
  return (
    box.top >= frame.top + labelInsetPx &&
    box.top + box.height <= frame.top + frame.height - labelInsetPx
  );
}

/** The disc a node paints, as an obstacle labels keep off: hard for an
 * accent node, soft for a neutral one. */
export function discObstacle(x: number, y: number, radius: number, accent: boolean): Obstacle {
  return {
    left: x - radius,
    top: y - radius,
    width: radius * 2,
    height: radius * 2,
    round: true,
    soft: !accent,
  };
}

/** Final positions for the labels, one per subject, in order (the most
 * active node first, so it stays put). Each label is tried on the side of
 * its node facing away from the centre, and below, above, right, and left
 * of the node. On each side the box is slid inside the frame and tried as
 * is, pushed vertically past the hard obstacles (every accent disc, its
 * own included, the extra obstacles, and every label placed before it),
 * and pushed past every obstacle; each option costs the pixels it moved
 * from the anchor, plus up to softOverlapCostPx per neutral disc it covers
 * and softOverlapCostPx per other accent disc it comes within the label gap of (a name touching
 * another labelled disc reads as that disc's), plus hardOverlapCostPx per
 * hard obstacle it still meets. The outward side wins when its
 * best option costs no more than maxLabelShiftPx, since it moves smoothly
 * as the graph turns; otherwise the cheapest option of any side, so a
 * label always sits beside its node and never wanders across the graph. */
export function layOutLabels(
  subjects: LabelSubject[],
  centreX: number,
  centreY: number,
  discs: Obstacle[],
  obstacles: Obstacle[],
  frame: LabelBox,
): LabelPlacement[] {
  const placed: Obstacle[] = [...obstacles];
  return subjects.map((subject, index) => {
    const hardHit = (box: LabelBox): Obstacle | null =>
      discs.find((disc) => disc.soft !== true && overlaps(box, disc)) ??
      placed.find((other) => overlaps(box, other)) ??
      null;
    const anyHit = (box: LabelBox): Obstacle | null =>
      discs.find((disc, discIndex) =>
        overlaps(box, disc, disc.soft !== true && discIndex !== index ? labelGapPx : 0),
      ) ??
      placed.find((other) => overlaps(box, other)) ??
      null;
    const overlapCost = (box: LabelBox): number => {
      let cost = 0;
      discs.forEach((disc, discIndex) => {
        if (disc.soft === true) {
          if (overlaps(box, disc)) cost += Math.min(softOverlapCostPx, disc.height);
        } else if (overlaps(box, disc)) {
          cost += hardOverlapCostPx;
        } else if (discIndex !== index && overlaps(box, disc, labelGapPx)) {
          cost += softOverlapCostPx;
        }
      });
      for (const other of placed) if (overlaps(box, other)) cost += hardOverlapCostPx;
      return cost;
    };
    const maxPasses = discs.length + placed.length;
    const preferred = anchorLabel(
      subject.x,
      subject.y,
      subject.radius,
      centreX,
      centreY,
      subject.width,
      subject.height,
    );
    const sides: LabelBox[] = [preferred];
    for (const [ux, uy] of fallbackSides) {
      sides.push(
        anchorToward(subject.x, subject.y, subject.radius, ux, uy, subject.width, subject.height),
      );
    }
    let best: LabelBox | null = null;
    let bestCost = Infinity;
    for (const anchor of sides) {
      const box = clampBox(anchor, frame);
      const preferDown = box.top + box.height / 2 >= subject.y;
      const options = [
        box,
        sweep(box, hardHit, preferDown, maxPasses),
        sweep(box, hardHit, !preferDown, maxPasses),
        sweep(box, anyHit, preferDown, maxPasses),
        sweep(box, anyHit, !preferDown, maxPasses),
      ];
      for (const option of options) {
        if (option == null || !inFrame(option, frame)) continue;
        const cost =
          Math.hypot(option.left - anchor.left, option.top - anchor.top) + overlapCost(option);
        if (cost < bestCost) {
          best = option;
          bestCost = cost;
        }
      }
      if (anchor === preferred && bestCost <= maxLabelShiftPx) break;
    }
    const box = best ?? clampBox(preferred, frame);
    placed.push(box);
    return { anchor: preferred, box };
  });
}

/** Moves a box in one direction past every obstacle it meets, in turn, a
 * hair beyond each so a touching edge never reads as a hit again. Null
 * when the obstacle count's worth of passes still leaves it overlapping. */
function sweep(
  box: LabelBox,
  firstHit: (box: LabelBox) => Obstacle | null,
  down: boolean,
  maxPasses: number,
): LabelBox | null {
  let candidate = box;
  for (let pass = 0; pass <= maxPasses; pass++) {
    const hit = firstHit(candidate);
    if (hit == null) return candidate;
    candidate = {
      ...candidate,
      top: down
        ? hit.top + hit.height + sweepMarginPx
        : hit.top - candidate.height - sweepMarginPx,
    };
  }
  return null;
}

const sweepMarginPx = 1;
