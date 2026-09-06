<!-- orch -->
# Agent run report: Living repo graph hero

**Live preview: https://j0ntz-homepage-qd8mz4mir-jontz.vercel.app**  |  **PR: https://github.com/j0ntz/j0ntz-homepage/pull/4**

| field | value |
|---|---|
| Task | #2 · https://github.com/j0ntz/j0ntz-homepage/issues/2 |
| PR | https://github.com/j0ntz/j0ntz-homepage/pull/4 |
| Preview | https://j0ntz-homepage-qd8mz4mir-jontz.vercel.app |
| Branch | jon/task-2 |
| Verified | pass |
| Date | 2026-09-05 |

## Summary
The hero renders the repo graph as server-side SVG in the first frame and the WebGL scene takes over at the same positions about 0.2 s later on the live preview. The eight accent nodes carry their names at rest on desktop and on mobile, no two labels overlap, and none leaves the viewport. Rotation is the one control: the orbit stops under the cursor, a drag turns the graph, a flick coasts out and settles within three seconds, and the orbit is back about eight seconds after the cursor leaves. On touch a horizontal drag spins with the same momentum and a vertical swipe scrolls the page without moving the graph. Lighthouse mobile scores 94 against the preview. The cold review of head `a396e44` found nothing that needs a code change; this is the rerun after Jon's feedback comment, which the builder consumed in address round 2 and rounds 3 and 4 refined.

## What changed
- `scripts/fetch-graph-data.mjs` and the `graph:data` script build `content/graph.json` from the GitHub API: 23 nodes (20 public repos with commits attributed to Jon plus the three projects in `content/projects.json`), 45 edges, and a converged 3D layout. A build never calls the API.
- `lib/graph-force.ts`, `lib/graph-scene.ts`, `lib/graph-types.ts`: the force simulation, the camera constants, and the label placement shared by the data script, the SVG snapshot, the worker, and the scene.
- `components/GraphSnapshot.tsx`: the SVG the server renders, one per viewport variant, every node a link, the eight labels as HTML over it.
- `components/RepoGraph.tsx`, `components/RepoGraphCanvas.tsx`, `workers/graph-layout.worker.ts`: react-three-fiber scene with three draw calls, colors read from the CSS tokens at mount, layout ticking in a worker, the spin state (rest orbit, drag, flick momentum, resume after idle), hover, tap-tap on touch, and the DOM label layer placed per frame clear of the discs and of the hero's text blocks. drei is not a dependency.
- `app/page.tsx`, `app/globals.css`, `content/site.json`: the desktop hero (name at 61px, line at 20px, links top-right, call to action bottom-left, the graph shifted right and starting below the nav band) and the mobile layout (name, line, stacked links, call to action in flow, then the graph as a full-width square), plus the stubs for zones 2 and 3.

## Test evidence
- `verify-preview.sh` result: pass against https://j0ntz-homepage-qd8mz4mir-jontz.vercel.app (HTTP 200, mobile `overflowBy: 0`, "See the work" in the HTML).
- Live scene in headless Chrome 152 on a hardware GPU (puppeteer-core over the DevTools protocol), label positions as the proxy for rotation:
  - 1440x900: the scene takes over 232 ms after load. At rest the labels move 33 px over 2 s; with the cursor over the graph they move 4 px over 1.5 s. A 300 px drag moves them 527 px; after release they coast 342 px in the first second, 223 px in the next two, then 6 px. Three to four seconds after the cursor leaves the graph is still (4.5 px); eight to nine seconds after it is turning again (105 px). A wheel over the graph scrolls the page and does not turn the graph.
  - Hover on the largest node shows `Edge wallet / TypeScript · 366 commits · 691 stars · since 2026` with a pointer cursor, the click calls `window.open` with the repo URL, `_blank`, `noopener,noreferrer`, and leaving the node clears the label.
  - 390x844 with touch: the first screen is the name, the one line, the three links, and the call to action; the graph square starts 562 px down. Eight labels, no overlaps, widest right edge 381.5 of 390. A horizontal swipe turns the graph 695 px and coasts, with the scroll position unchanged. A vertical swipe over the canvas scrolls the page 135 px and moves the graph 1.9 px net of the scroll. A first tap on a node shows the label without opening anything; a second tap opens the repo.
  - Reduced motion at 1440: zero label movement over 3 s.
  - 768x1024, 820x1180, 1024x768, 1280x720: every label inside the hero, nothing under the links.
  - No console errors in any run.
- Lighthouse 13, mobile preset, against the live preview: performance 94, first contentful paint 2.0 s, largest contentful paint 2.0 s, total blocking time 200 ms, cumulative layout shift 0.023.
- `tsc --noEmit` exits 0, `eslint` exits 0, `scripts/design-check.mjs` exits 0 on the tree (28 files). The judgment tier of `/design-check` found no violation: every size on the scale, tokens only, no scroll-triggered motion, the one line names what he builds.
- The PR body carries the Chrome performance trace summaries at 1440 and 390 wide.
- Screenshots committed under `docs/screenshots/`, one desktop and one mobile (~390px) capture from `verify-preview.sh`, plus the live scene:
  - Desktop: [issue-2-desktop.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-desktop.png)
  - Mobile: [issue-2-mobile.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-mobile.png)
  - 1440x900 at rest with the eight labels: [issue-2-desktop-1440.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-desktop-1440.png)
  - 1440x900 on hover: [issue-2-desktop-1440-hover.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-desktop-1440-hover.png)
  - 390 graph section at rest: [issue-2-mobile-graph.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-mobile-graph.png)
  - 390 after the first tap: [issue-2-mobile-tap.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-mobile-tap.png)

## Decisions (defaults taken)
- The graph has 23 nodes, under the contract's 40 to 60 on desktop, because that is every public repo GitHub attributes commits by `j0ntz` to plus the three named projects. The issue forbids inventing projects; the builder's issue comment lists what was excluded and why. Reversible by making a private repo public or adding an entry to `content/projects.json`, then `npm run graph:data`.
- `project:agent-evals` links one repo (`edge-dev-agents`) and so sits beside it at the same size. Flagged for Jon on the issue.
- The email in `content/site.json` is the address on this repo's commits, flagged for Jon to replace.
- An owned repo counts every commit in its history, so `Polymarket-Copy-Trading-Bot` carries the 99 commits of the history it was created from. Flagged for Jon on the issue.

## Notes and follow-ups
- On mobile a label may sit over a neutral disc where the square is too dense to avoid one (the placer charges a small cost for it and a ground-coloured text halo keeps the strokes apart); the accent discs and the other labels are never covered.
- The frame loop and the layout worker run while the hero is scrolled out of view. Per-frame cost is under a millisecond, so it passed; pausing both when the hero leaves the viewport would save battery on phones once zones 2 and 3 carry content.
- The hero's first activity dates come from GitHub's commit attribution to the `j0ntz` account, so `Edge wallet` reads `since 2026` even though the Edge work predates that.
