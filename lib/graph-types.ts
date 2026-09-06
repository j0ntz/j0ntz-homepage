// Shape of content/graph.json, written by scripts/fetch-graph-data.mjs and
// read by the snapshot, the scene, and the worker. Erasable TypeScript only:
// the data script imports the guard into Node.

export type GraphNodeKind = "repo" | "project";

export interface GraphNode {
  /** Stable id: `owner/repo` lowercased, or `project:<slug>`. */
  id: string;
  kind: GraphNodeKind;
  label: string;
  url: string;
  /** Repos: the GitHub owner. Projects: the string "project". */
  owner: string;
  language: string | null;
  /** Jon's authored commits in the two years before the fetch. Projects sum
   * their linked repos. */
  commits: number;
  stars: number;
  /** ISO dates of Jon's first and last authored commit, or null when none. */
  firstActivity: string | null;
  lastActivity: string | null;
  topics: string[];
  description: string;
}

export type GraphEdgeReason = "link" | "topic" | "language";

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  reason: GraphEdgeReason;
}

export interface GraphLayout {
  /** Node positions in force units, three per node, in node order. */
  positions: number[];
  /** Multiplier that maps force units to scene units. */
  scale: number;
  seed: number;
}

export interface GraphData {
  /** ISO timestamp of the fetch. */
  generatedAt: string;
  /** Start of the commit window the counts cover. */
  since: string;
  /** Sorted by commits descending, then stars, then label. */
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: GraphLayout;
}

export function isGraphData(value: unknown): value is GraphData {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const layout = record.layout as Record<string, unknown> | undefined;
  return (
    typeof record.generatedAt === "string" &&
    Array.isArray(record.nodes) &&
    Array.isArray(record.edges) &&
    layout != null &&
    Array.isArray(layout.positions) &&
    typeof layout.scale === "number" &&
    layout.positions.length === record.nodes.length * 3
  );
}
