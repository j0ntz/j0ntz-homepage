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
  const reach = radius + labelGapPx;
  return {
    left: nodeX + ux * reach + ((ux - 1) * width) / 2,
    top: nodeY + uy * reach + ((uy - 1) * height) / 2,
    width,
    height,
  };
}

function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/** Slides a box inside a width by height frame, labelInsetPx from its edges. */
export function clampBox(box: LabelBox, frameWidth: number, frameHeight: number): LabelBox {
  return {
    ...box,
    left: Math.min(
      Math.max(labelInsetPx, box.left),
      Math.max(labelInsetPx, frameWidth - labelInsetPx - box.width),
    ),
    top: Math.min(
      Math.max(labelInsetPx, box.top),
      Math.max(labelInsetPx, frameHeight - labelInsetPx - box.height),
    ),
  };
}

function inFrame(box: LabelBox, frameHeight: number): boolean {
  return box.top >= labelInsetPx && box.top + box.height <= frameHeight - labelInsetPx;
}

/** The square a disc occupies, as an obstacle labels keep off. */
export function discBox(x: number, y: number, radius: number): LabelBox {
  return { left: x - radius, top: y - radius, width: radius * 2, height: radius * 2 };
}

/** Final positions for the labels: each is slid inside the frame, then, in
 * order (the most active node first, so it stays put), pushed vertically
 * until it clears the obstacles and every label before it. A label at or
 * below its node moves down, one above moves up; when that direction runs
 * out of frame the label is pushed the other way from where it started. */
export function layOutLabels(
  boxes: LabelBox[],
  nodeYs: number[],
  obstacles: LabelBox[],
  frameWidth: number,
  frameHeight: number,
): LabelBox[] {
  const placed: LabelBox[] = [...obstacles];
  return boxes.map((rawBox, index) => {
    const box = clampBox(rawBox, frameWidth, frameHeight);
    const preferDown = box.top + box.height / 2 >= nodeYs[index];
    const preferred = sweep(box, placed, preferDown);
    const chosen = inFrame(preferred, frameHeight) ? preferred : sweep(box, placed, !preferDown);
    const final = inFrame(chosen, frameHeight) ? chosen : clampBox(preferred, frameWidth, frameHeight);
    placed.push(final);
    return final;
  });
}

/** Moves a box in one direction past every box it overlaps, in turn. */
function sweep(box: LabelBox, placed: LabelBox[], down: boolean): LabelBox {
  let candidate = box;
  for (let pass = 0; pass <= placed.length; pass++) {
    const hit = placed.find((other) => boxesOverlap(candidate, other));
    if (hit == null) break;
    candidate = { ...candidate, top: down ? hit.top + hit.height : hit.top - candidate.height };
  }
  return candidate;
}
