import * as React from "react";

import {
  accentCount,
  edgeOpacity,
  haloScale,
  nodeRadius,
  projectAtRest,
} from "@/lib/graph-scene";
import type { GraphEdge, GraphLayout, GraphNode } from "@/lib/graph-types";

// The static picture of the graph: the same nodes, the same positions, and
// the same camera as the first WebGL frame, drawn as SVG on the server. It is
// what the first painted frame shows, what a crawler reads (every node is a
// link), and what a browser without WebGL keeps. Colors are the tokens by
// name; the file has no literal.

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: GraphLayout;
  /** Commits ceiling for sizing, shared with the WebGL scene so both
   * variants size a node identically. */
  maxCommits: number;
  ariaLabel: string;
  className?: string;
}

export const GraphSnapshot: React.FC<Props> = ({
  nodes,
  edges,
  layout,
  maxCommits,
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
  const gradientId = `graph-glow-${nodes.length}`;

  return (
    <svg
      className={className}
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
  );
};
