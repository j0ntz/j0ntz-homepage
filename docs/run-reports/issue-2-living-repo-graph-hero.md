<!-- orch -->
# Agent run report: Living repo graph hero

**Live preview: https://j0ntz-homepage-pt08gid9q-jontz.vercel.app**  |  **PR: https://github.com/j0ntz/j0ntz-homepage/pull/4**

| field | value |
|---|---|
| Task | #2 · https://github.com/j0ntz/j0ntz-homepage/issues/2 |
| PR | https://github.com/j0ntz/j0ntz-homepage/pull/4 |
| Preview | https://j0ntz-homepage-pt08gid9q-jontz.vercel.app |
| Branch | jon/task-2 |
| Verified | pass |
| Date | 2026-09-05 |

## Summary
The hero renders the repo graph as server-side SVG in the first frame, and the WebGL scene takes over at the same positions 0.9 to 1.5 s after navigation on the live preview. Hover lights a node and its neighbours with the mono label, click opens the repo in a new tab, tap then tap opens on mobile, and reduced motion holds the scene still. Lighthouse mobile scores 93 against the preview. The cold review of head `d7845e8` found nothing that needs a code change.

## What changed
- `scripts/fetch-graph-data.mjs` and the `graph:data` script build `content/graph.json` from the GitHub API: 23 nodes (20 public repos with commits attributed to Jon, plus the three projects in `content/projects.json`), 45 edges, and a converged 3D layout. A build never calls the API.
- `lib/graph-force.ts`, `lib/graph-scene.ts`, `lib/graph-types.ts`: the force simulation and camera constants shared by the data script, the SVG snapshot, the worker, and the scene.
- `components/GraphSnapshot.tsx`: the SVG the server renders, one per viewport variant, every node a link.
- `components/RepoGraph.tsx`, `components/RepoGraphCanvas.tsx`, `workers/graph-layout.worker.ts`: react-three-fiber scene with three draw calls, colors read from the CSS tokens at mount, layout ticking in a worker, orbit and parallax and hover on the main thread. Every effect returns a cleanup; the worker is terminated and the GPU buffers disposed on unmount.
- `app/page.tsx`, `app/globals.css`, `content/site.json`: the hero zone (name at 61px, line at 20px, three links top-right, the call to action bottom-left) and the stubs for zones 2 and 3.

## Test evidence
- `verify-preview.sh` result: pass against https://j0ntz-homepage-pt08gid9q-jontz.vercel.app (HTTP 200, mobile `overflowBy: 0`, "See the work" in the HTML).
- Live scene over the DevTools protocol in headless Chrome on a hardware GPU, at 1440x900: the WebGL canvas takes over from the SVG after 1466 ms, both snapshots are then `display: none`, and the canvas fills the hero at 1440x828. Moving the mouse onto the largest node shows `Edge wallet / TypeScript · 366 commits · 691 stars · since 2026` in JetBrains Mono with a pointer cursor; a click calls `window.open` with the repo URL, `_blank`, `noopener,noreferrer`; leaving the node clears the label and the cursor.
- At 390x844 with touch emulation: the scene takes over after 886 ms, a first tap shows the same label without opening anything, a second tap opens the repo.
- Reduced motion (`prefers-reduced-motion: reduce`): six screenshots over seven seconds at 390 wide have the same hash, two screenshots 1.5 s apart at 1440 are the same PNG, and hover still shows the label.
- No console errors in either run. The one warning is react-three-fiber's `THREE.Clock` deprecation notice, not from this code.
- Lighthouse 12, mobile preset, against the live preview: performance 93, first contentful paint 1.2 s, largest contentful paint 3.1 s, total blocking time 70 ms, cumulative layout shift 0.
- `tsc --noEmit` exits 0, `eslint` exits 0, `scripts/design-check.mjs` exits 0 on the tree (28 files). The judgment tier of `/design-check` found no violation: sizes on the scale, tokens only, no scroll-triggered motion, the one line names what he builds.
- Screenshots committed under `docs/screenshots/`, one desktop and one mobile (~390px) capture from `verify-preview.sh`, plus the live scene at 1440x900 at rest and on hover:
  - Desktop: [issue-2-desktop.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-desktop.png)
  - Mobile: [issue-2-mobile.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-mobile.png)
  - 1440x900 at rest: [issue-2-desktop-1440.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-desktop-1440.png)
  - 1440x900 on hover: [issue-2-desktop-1440-hover.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-2/docs/screenshots/issue-2-desktop-1440-hover.png)

## Decisions (defaults taken)
- The graph has 23 nodes, under the contract's 40 to 60 on desktop, because that is every public repo GitHub attributes commits by `j0ntz` to plus the three named projects. The issue forbids inventing projects, and the builder's issue comment lists what was excluded and why. Reversible by making a private repo public or adding an entry to `content/projects.json`, then `npm run graph:data`.
- `project:agent-evals` links one repo (`edge-dev-agents`) and so sits beside it at the same size. Flagged for Jon on the issue; drop it or point it at a dedicated repo if it reads as a duplicate.
- The email in `content/site.json` is the address on this repo's commits, flagged for Jon to replace.

## Notes and follow-ups
- The frame loop runs at full rate while the hero is scrolled out of view. Per-frame cost is small (0.35 ms scripting in the PR's trace), so it passed, but pausing the loop when the hero leaves the viewport would save battery on phones once zones 2 and 3 carry content.
- At 1440x900 the top-right accent node's halo sits under the LinkedIn link at rest. The link stays legible and the orbit moves the node away within seconds, so it passed; if the overlap bothers Jon, a smaller `--graph-shift` or a lower graph top fixes it.
- The Claude in Chrome extension's tab reported `visibilityState: hidden` with no animation frames, so the live checks ran through headless Chrome over the DevTools protocol with `--use-angle=metal` instead.
