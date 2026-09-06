import * as React from "react";

import {
  accentCount,
  discObstacle,
  edgeOpacity,
  haloScale,
  labelFontPx,
  labelLineHeight,
  labelledCount,
  layOutLabels,
  monoAdvanceEm,
  nodeRadius,
  projectAtRest,
  type LabelSubject,
  type ProjectedNode,
} from "@/lib/graph-scene";
import type { GraphEdge, GraphLayout, GraphNode } from "@/lib/graph-types";

// The static picture of the graph: the same nodes, the same positions, and
// the same camera as the first WebGL frame, drawn as SVG on the server. It is
// what the first painted frame shows, what a crawler reads (every node is a
// link), and what a browser without WebGL keeps. The eight accent nodes carry
// their label at rest as HTML over the SVG, in the mono face at a real pixel
// size (SVG text would scale with the viewport), placed by the rule the live
// scene applies per frame: beside the node on the side away from the centre,
// pushed clear of every disc and of the other labels, kept inside the
// square. Colors are the tokens by name; the file has no literal.

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: GraphLayout;
  /** Commits ceiling for sizing, shared with the WebGL scene so both
   * variants size a node identically. */
  maxCommits: number;
  /** Distinguishes the instances one page renders (desktop and mobile), so
   * each SVG owns its gradient and a fill never resolves into a hidden
   * sibling. */
  id: string;
  /** Side of the square, in CSS pixels, the labels are laid out for. Their
   * positions are emitted in percent, so any other size scales the picture
   * and keeps the text its real size. */
  squarePx: number;
  ariaLabel: string;
  className?: string;
}

export const GraphSnapshot: React.FC<Props> = ({
  nodes,
  edges,
  layout,
  maxCommits,
  id,
  squarePx,
  ariaLabel,
  className,
}) => {
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const projected = nodes.map((node, index) => {
    const base = index * 3;
    return projectAtRest(
      layout.positions[base] * layout.scale,
      layout.positions[base + 1] * layout.scale,
      layout.positions[base + 2] * layout.scale,
      nodeRadius(node.commits, maxCommits),
    );
  });
  // Far nodes first so near discs cover them, as the depth buffer does in WebGL.
  const order = projected
    .map((point, index) => ({ index, depth: point.depth }))
    .sort((a, b) => b.depth - a.depth)
    .map((entry) => entry.index);
  const gradientId = `graph-glow-${id}`;
  const labelled = nodes.slice(0, labelledCount);
  const tagStyles = layOutTags(nodes, projected, squarePx);

  return (
    <div className={className == null ? "graph-frame" : `graph-frame ${className}`}>
      <div className="graph-square">
        <svg
          className="block h-full w-full"
          viewBox="-1 -1 2 2"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <radialGradient id={gradientId}>
              <stop offset={`${(100 / haloScale).toFixed(2)}%`} className="graph-glow-stop" />
              <stop offset="100%" className="graph-glow-stop-end" />
            </radialGradient>
          </defs>
          <g className="stroke-accent" strokeOpacity={edgeOpacity} strokeWidth={1} vectorEffect="non-scaling-stroke">
            {edges.map((edge) => {
              const source = indexById.get(edge.source);
              const target = indexById.get(edge.target);
              if (source == null || target == null) return null;
              const a = projected[source];
              const b = projected[target];
              return (
                <line
                  key={`${edge.source}|${edge.target}`}
                  x1={a.x.toFixed(4)}
                  y1={a.y.toFixed(4)}
                  x2={b.x.toFixed(4)}
                  y2={b.y.toFixed(4)}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
          {order.map((index) => {
            const node = nodes[index];
            const point = projected[index];
            const accent = index < accentCount;
            return (
              <a key={node.id} href={node.url} target="_blank" rel="noopener noreferrer">
                <title>{node.label}</title>
                {accent ? (
                  <circle
                    cx={point.x.toFixed(4)}
                    cy={point.y.toFixed(4)}
                    r={(point.radius * haloScale).toFixed(4)}
                    fill={`url(#${gradientId})`}
                  />
                ) : null}
                <circle
                  cx={point.x.toFixed(4)}
                  cy={point.y.toFixed(4)}
                  r={point.radius.toFixed(4)}
                  className={accent ? "fill-accent" : "fill-foreground-muted"}
                />
              </a>
            );
          })}
        </svg>
        <div className="graph-tags" aria-hidden>
          {labelled.map((node, index) => (
            <span key={node.id} className="graph-tag" style={tagStyles[index]}>
              {node.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Where the labels at rest sit, as CSS the server can emit: the shared
 * placement run at the nominal square size with the label boxes estimated
 * from the mono face (a monospace label is its character count wide) and
 * every disc as an obstacle, then expressed in percent of the square. The
 * clamp keeps a label inside the square at every real size; the live
 * scene's frame loop runs the same placement in pixels, so the swap keeps
 * every label in place. */
function layOutTags(
  nodes: GraphNode[],
  projected: ProjectedNode[],
  squarePx: number,
): React.CSSProperties[] {
  const toPx = (unit: number): number => ((unit + 1) / 2) * squarePx;
  const height = labelFontPx * labelLineHeight;
  const centre = squarePx / 2;
  const radiusPx = (point: ProjectedNode): number => (point.radius / 2) * squarePx;
  const labelled = nodes.slice(0, labelledCount);
  const subjects: LabelSubject[] = labelled.map((node, index) => ({
    x: toPx(projected[index].x),
    y: toPx(projected[index].y),
    radius: radiusPx(projected[index]),
    width: node.label.length * monoAdvanceEm * labelFontPx,
    height,
  }));
  const discs = projected.map((point, index) =>
    discObstacle(toPx(point.x), toPx(point.y), radiusPx(point), index < accentCount),
  );
  const frame = { left: 0, top: 0, width: squarePx, height: squarePx };
  const placed = layOutLabels(subjects, centre, centre, discs, [], frame);
  return placed.map(({ box }, index) => {
    const chars = labelled[index].label.length;
    const left = ((box.left / squarePx) * 100).toFixed(2);
    const top = ((box.top / squarePx) * 100).toFixed(2);
    return {
      left: `clamp(var(--space-base), ${left}%, 100% - ${chars}ch - var(--space-base))`,
      top: `clamp(var(--space-base), ${top}%, 100% - var(--graph-tag-height) - var(--space-base))`,
    };
  });
}
