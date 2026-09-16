#!/usr/bin/env node
// Builds content/graph.json, the build input for the repo graph.
//
//   npm run graph:data
//
// Reads the GitHub REST API once, here, and never at build time: the committed
// JSON is what the site renders, so a stale file is a stale graph and never
// a failed build. Needs Node 22.18 or newer (it imports the shared layout
// code from lib/ as TypeScript) and a token with public scope in GITHUB_TOKEN
// or GH_TOKEN, falling back to `gh auth token`; the search endpoints refuse
// anonymous calls.
//
// Nodes:
//   - every public, non-fork repo owned by the user
//   - every other public repo where the user authored a commit or opened a
//     pull request (commit search plus pull request search), so the Edge
//     repos count even though they live under an org
//   - one node per entry in content/projects.json
// Private repos are dropped even when the token can see them.
//
// Per repo: commits in the last two years (every commit for a repo Jon owns,
// only the ones GitHub attributes to Jon elsewhere), first and last such
// commit, language, stars, topics. A project sums the commits of the repos it
// links.
//
// Edges, deduplicated with the strongest reason kept:
//   - link:     a project to each repo it lists, weight 1
//   - topic:    two repos sharing a GitHub topic, weight 0.6 per shared topic,
//               capped at 1
//   - language: a repo to the next two more active repos in its language,
//               weight 0.3. Not the full clique: with most repos in
//               TypeScript that would be a hairball.
//
// The layout is converged here with the same simulation the browser worker
// runs, so the static SVG and the first WebGL frame share one picture.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  convergenceTicks,
  createSimulation,
  rmsRadius,
  seedPositions,
} from "../lib/graph-force.ts";
import { maxSceneExtent, nodeRadius, targetRmsRadius } from "../lib/graph-scene.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectsPath = join(repoRoot, "content", "projects.json");
const outputPath = join(repoRoot, "content", "graph.json");

const user = "j0ntz";
const apiBase = "https://api.github.com";
const windowYears = 2;
const layoutSeed = 7;

const topicWeight = 0.6;
const languageWeight = 0.3;
const languageNeighbours = 2;

main().catch((error) => {
  process.stderr.write(`fetch-graph-data: ${errorMessage(error)}\n`);
  process.exit(1);
});

async function main() {
  const token = resolveToken();
  const api = createApi(token);
  const now = new Date();
  const since = new Date(now);
  since.setUTCFullYear(since.getUTCFullYear() - windowYears);

  const projects = loadProjects();
  const repoNames = await discoverRepos(api, projects);
  process.stderr.write(`fetch-graph-data: ${repoNames.size} candidate repos\n`);

  const repoNodes = [];
  const topicsById = new Map();
  for (const fullName of [...repoNames].sort((a, b) => a.localeCompare(b))) {
    const node = await buildRepoNode(api, fullName, since);
    if (node == null) continue;
    repoNodes.push(node.node);
    topicsById.set(node.node.id, node.topics);
  }

  const projectNodes = projects.map((project) => buildProjectNode(project, repoNodes));
  const nodes = [...repoNodes, ...projectNodes].sort(compareActivity);
  const edges = buildEdges(nodes, projects, topicsById);
  const layout = computeLayout(nodes, edges);

  const data = {
    generatedAt: now.toISOString(),
    since: since.toISOString(),
    nodes,
    edges,
    layout,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  process.stderr.write(
    `fetch-graph-data: wrote ${nodes.length} nodes and ${edges.length} edges to content/graph.json\n`,
  );
}

// ---------------------------------------------------------------------------
// Discovery

async function discoverRepos(api, projects) {
  const names = new Set();
  const owned = await api.paginate(`/users/${user}/repos?type=owner&per_page=100`);
  for (const repo of owned) {
    if (repo.private === true || repo.fork === true) continue;
    names.add(repo.full_name);
  }
  const commitHits = await api.paginate(
    `/search/commits?q=${encodeURIComponent(`author:${user}`)}&per_page=100`,
    { items: true },
  );
  for (const hit of commitHits) {
    if (hit.repository?.private === true) continue;
    names.add(hit.repository.full_name);
  }
  const pullHits = await api.paginate(
    `/search/issues?q=${encodeURIComponent(`author:${user} type:pr is:public`)}&per_page=100`,
    { items: true },
  );
  for (const hit of pullHits) {
    names.add(hit.repository_url.replace(`${apiBase}/repos/`, ""));
  }
  for (const project of projects) {
    for (const link of project.links) names.add(link);
  }
  return names;
}

async function buildRepoNode(api, fullName, since) {
  const repo = await api.get(`/repos/${fullName}`);
  if (repo == null) {
    process.stderr.write(`fetch-graph-data: skip ${fullName} (not found)\n`);
    return null;
  }
  if (repo.private === true) {
    process.stderr.write(`fetch-graph-data: skip ${fullName} (private)\n`);
    return null;
  }
  // An owned repo counts every commit (its history is Jon's work whatever
  // email a commit carries); a repo under someone else's account counts only
  // the commits GitHub attributes to Jon.
  const owned = repo.owner?.login === user;
  const commits = await api.paginate(
    `/repos/${fullName}/commits?per_page=100${owned ? "" : `&author=${user}`}`,
  );
  const dates = commits
    .map((commit) => commit.commit?.author?.date)
    .filter((date) => typeof date === "string")
    .sort((a, b) => a.localeCompare(b));
  const recent = dates.filter((date) => date >= since.toISOString()).length;
  if (dates.length === 0 && !owned) {
    // A pull request with no authored commit on the default branch (closed
    // unmerged, or squashed under another author) is not activity.
    process.stderr.write(`fetch-graph-data: skip ${fullName} (no authored commits)\n`);
    return null;
  }
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  return {
    node: {
      id: fullName.toLowerCase(),
      kind: "repo",
      label: repo.name,
      url: repo.html_url,
      owner: repo.owner.login,
      language: repo.language ?? null,
      commits: recent,
      stars: repo.stargazers_count ?? 0,
      firstActivity: dates[0] ?? null,
      lastActivity: dates[dates.length - 1] ?? null,
      topics,
      description: repo.description ?? "",
    },
    topics,
  };
}

function buildProjectNode(project, repoNodes) {
  const linked = repoNodes.filter((node) => project.links.some((link) => link.toLowerCase() === node.id));
  const commits = linked.reduce((total, node) => total + node.commits, 0);
  const stars = linked.reduce((total, node) => total + node.stars, 0);
  const firsts = linked.map((node) => node.firstActivity).filter((date) => date != null).sort();
  const lasts = linked.map((node) => node.lastActivity).filter((date) => date != null).sort();
  return {
    id: project.id,
    kind: "project",
    label: project.label,
    url: project.url,
    owner: "project",
    language: project.language ?? null,
    commits,
    stars,
    firstActivity: firsts[0] ?? null,
    lastActivity: lasts[lasts.length - 1] ?? null,
    topics: [],
    description: project.description ?? "",
  };
}

function compareActivity(a, b) {
  return b.commits - a.commits || b.stars - a.stars || a.label.localeCompare(b.label);
}

// ---------------------------------------------------------------------------
// Edges

function buildEdges(nodes, projects, topicsById) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = new Map();
  const add = (source, target, weight, reason) => {
    if (source === target || !byId.has(source) || !byId.has(target)) return;
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    const existing = edges.get(key);
    if (existing == null || existing.weight < weight) {
      edges.set(key, { source, target, weight, reason });
    }
  };

  for (const project of projects) {
    for (const link of project.links) add(project.id, link.toLowerCase(), 1, "link");
  }

  const repos = nodes.filter((node) => node.kind === "repo");
  for (let a = 0; a < repos.length; a++) {
    const topicsA = new Set(topicsById.get(repos[a].id) ?? []);
    if (topicsA.size === 0) continue;
    for (let b = a + 1; b < repos.length; b++) {
      const shared = (topicsById.get(repos[b].id) ?? []).filter((topic) => topicsA.has(topic)).length;
      if (shared > 0) add(repos[a].id, repos[b].id, Math.min(1, shared * topicWeight), "topic");
    }
  }

  // nodes is sorted by activity, so "the next two more active" is a lookback.
  const seenByLanguage = new Map();
  for (const node of repos) {
    if (node.language == null) continue;
    const seen = seenByLanguage.get(node.language) ?? [];
    for (const earlier of seen.slice(-languageNeighbours)) {
      add(node.id, earlier.id, languageWeight, "language");
    }
    seen.push(node);
    seenByLanguage.set(node.language, seen);
  }

  return [...edges.values()];
}

// ---------------------------------------------------------------------------
// Layout

function computeLayout(nodes, edges) {
  const index = new Map(nodes.map((node, position) => [node.id, position]));
  const maxCommits = Math.max(1, ...nodes.map((node) => node.commits));
  const radii = new Float32Array(nodes.map((node) => nodeRadius(node.commits, maxCommits)));
  const links = edges.map((edge) => ({
    source: index.get(edge.source),
    target: index.get(edge.target),
    weight: edge.weight,
  }));
  const positions = seedPositions(nodes.length, layoutSeed);
  const simulation = createSimulation(positions, radii, links, undefined, layoutSeed);
  for (let tick = 0; tick < convergenceTicks; tick++) {
    // Alpha cools from 1 to a little above the idle level the worker keeps.
    const alpha = 1 - (tick / convergenceTicks) * 0.95;
    simulation.tick(alpha, 0);
  }
  // Scale to the target spread, but never so far that a node leaves the
  // square the camera shows at rest (half-extent maxSceneExtent).
  let farthest = 0;
  for (let index = 0; index < positions.length; index++) {
    if (index % 3 !== 2) farthest = Math.max(farthest, Math.abs(positions[index]));
  }
  const scale = Math.min(
    targetRmsRadius / Math.max(rmsRadius(positions), 1e-6),
    maxSceneExtent / Math.max(farthest, 1e-6),
  );
  return {
    positions: Array.from(positions, (value) => Number(value.toFixed(4))),
    scale: Number(scale.toFixed(5)),
    seed: layoutSeed,
  };
}

// ---------------------------------------------------------------------------
// Inputs and the API client

function loadProjects() {
  const parsed = JSON.parse(readFileSync(projectsPath, "utf8"));
  if (!Array.isArray(parsed.projects)) throw new Error("content/projects.json: `projects` must be an array");
  for (const project of parsed.projects) {
    for (const field of ["id", "label", "url"]) {
      if (typeof project[field] !== "string" || project[field] === "") {
        throw new Error(`content/projects.json: every project needs a string ${field}`);
      }
    }
    if (!Array.isArray(project.links)) project.links = [];
  }
  return parsed.projects;
}

function resolveToken() {
  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnv != null && fromEnv !== "") return fromEnv;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    throw new Error("no GitHub token: set GITHUB_TOKEN or log in with `gh auth login`");
  }
}

function createApi(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "j0ntz-homepage graph data",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const request = async (url) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await fetch(url, { headers });
      if (response.status === 404) return { response, body: null };
      if (response.status === 403 || response.status === 429) {
        const reset = Number(response.headers.get("x-ratelimit-reset") ?? 0) * 1000;
        const retryAfter = Number(response.headers.get("retry-after") ?? 0) * 1000;
        const wait = Math.max(retryAfter, reset - Date.now(), 2000) + 500;
        process.stderr.write(`fetch-graph-data: rate limited, waiting ${Math.ceil(wait / 1000)}s\n`);
        await new Promise((resolveWait) => setTimeout(resolveWait, wait));
        continue;
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
      return { response, body: await response.json() };
    }
    throw new Error(`gave up after repeated rate limits for ${url}`);
  };

  return {
    get: async (path) => (await request(`${apiBase}${path}`)).body,
    paginate: async (path, options = {}) => {
      const results = [];
      let url = `${apiBase}${path}`;
      while (url != null) {
        const { response, body } = await request(url);
        if (body == null) break;
        results.push(...(options.items === true ? body.items : body));
        url = nextLink(response.headers.get("link"));
      }
      return results;
    },
  };
}

function nextLink(header) {
  if (header == null) return null;
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match != null) return match[1];
  }
  return null;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
