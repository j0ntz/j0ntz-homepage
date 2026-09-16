"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import type { ForceLink } from "@/lib/graph-force";
import { desktopMinWidth, nodeRadius, selectNodes } from "@/lib/graph-scene";
import type { GraphData, GraphEdge, GraphNode } from "@/lib/graph-types";

// The hero graph. On the server and in the first paint it is the SVG
// snapshot passed as children. Once mounted it decides the viewport variant
// (desktop shows every node, mobile the most active few), checks for WebGL,
// and swaps the snapshot for the live scene the moment the scene has drawn
// its first frame at the same positions. No WebGL: the snapshot stays.

/** A unit with its singular, so a count of one reads "1 star". */
export interface CountUnit {
  one: string;
  other: string;
}

export interface GraphCopy {
  commitsUnit: CountUnit;
  starsUnit: CountUnit;
  sincePrefix: string;
}

export interface GraphSelection {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Force units, three per node, node order. */
  positions: Float32Array;
  /** Scene units per node. */
  radii: Float32Array;
  links: ForceLink[];
  /** Node indices adjacent to each node. */
  neighbours: number[][];
  scale: number;
  seed: number;
}

interface Props {
  data: GraphData;
  copy: GraphCopy;
  /** Ceiling for disc sizing, the same on both variants. */
  maxCommits: number;
  children: React.ReactNode;
}

const RepoGraphCanvas = dynamic(
  () => import("./RepoGraphCanvas").then((module) => module.RepoGraphCanvas),
  { ssr: false },
);

export const RepoGraph: React.FC<Props> = ({ data, copy, maxCommits, children }) => {
  const desktop = useMediaQuery(`(min-width: ${desktopMinWidth}px)`);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)") === true;
  const webgl = React.useSyncExternalStore(subscribeNever, hasWebgl, serverFalse);
  const [ready, setReady] = React.useState(false);

  const selection = React.useMemo(
    () => (desktop == null ? null : buildSelection(data, desktop, maxCommits)),
    [data, desktop, maxCommits],
  );

  const handleReady = React.useCallback((): void => {
    setReady(true);
  }, []);

  const handleActivate = React.useCallback((node: GraphNode): void => {
    window.open(node.url, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <div className="absolute inset-0">
      <div className={ready ? "hidden" : "contents"} aria-hidden={ready}>
        {children}
      </div>
      {webgl && selection != null ? (
        <div className={ready ? "absolute inset-0" : "absolute inset-0 opacity-0"}>
          <RepoGraphCanvas
            key={desktop === true ? "desktop" : "mobile"}
            selection={selection}
            copy={copy}
            maxCommits={maxCommits}
            reducedMotion={reducedMotion}
            onReady={handleReady}
            onActivate={handleActivate}
          />
        </div>
      ) : null}
    </div>
  );
};

function buildSelection(data: GraphData, desktop: boolean, maxCommits: number): GraphSelection {
  const nodes = selectNodes(data.nodes, desktop);
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const positions = new Float32Array(nodes.length * 3);
  const radii = new Float32Array(nodes.length);
  nodes.forEach((node, index) => {
    const sourceIndex = data.nodes.indexOf(node);
    positions[index * 3] = data.layout.positions[sourceIndex * 3];
    positions[index * 3 + 1] = data.layout.positions[sourceIndex * 3 + 1];
    positions[index * 3 + 2] = data.layout.positions[sourceIndex * 3 + 2];
    radii[index] = nodeRadius(node.commits, maxCommits);
  });
  const edges = data.edges.filter(
    (edge) => indexById.has(edge.source) && indexById.has(edge.target),
  );
  const neighbours: number[][] = nodes.map(() => []);
  const links: ForceLink[] = edges.map((edge) => {
    const source = indexById.get(edge.source) as number;
    const target = indexById.get(edge.target) as number;
    neighbours[source].push(target);
    neighbours[target].push(source);
    return { source, target, weight: edge.weight };
  });
  return {
    nodes,
    edges,
    positions,
    radii,
    links,
    neighbours,
    scale: data.layout.scale,
    seed: data.layout.seed,
  };
}

/** null on the server and during hydration, then the live answer. */
function useMediaQuery(query: string): boolean | null {
  const subscribe = React.useCallback(
    (onChange: () => void): (() => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );
  const getSnapshot = React.useCallback((): boolean => window.matchMedia(query).matches, [query]);
  return React.useSyncExternalStore(subscribe, getSnapshot, serverNull);
}

function serverNull(): null {
  return null;
}

function serverFalse(): boolean {
  return false;
}

function subscribeNever(): () => void {
  return () => {};
}

let webglSupport: boolean | null = null;

function hasWebgl(): boolean {
  if (webglSupport != null) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    webglSupport = canvas.getContext("webgl2") != null || canvas.getContext("webgl") != null;
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}
