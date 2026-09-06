// Scene constants shared by the static snapshot (SVG, rendered on the
// server), the WebGL scene, and the data script, so the first WebGL frame is
// the same picture as the SVG it replaces. Erasable TypeScript only.

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

/** One full orbit, in seconds. */
export const orbitPeriodSeconds = 90;

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
