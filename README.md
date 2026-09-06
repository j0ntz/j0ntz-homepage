# j0ntz-homepage

Jonathan Tzeng's one-page site: who he is, what he builds, and where to find the work, with a living graph of his public repos as the centrepiece. Built with Next.js.

`docs/design-system.md` is the design contract. Every UI change reads it first; `app/globals.css` is the token set that implements it.

## Develop

```bash
npm run dev            # http://localhost:3000
npm run build          # runs the design check first, then next build
npm run design-check   # the design lint on its own (or pass files)
npm run lint           # eslint
npm run graph:data     # refresh content/graph.json from the GitHub API
```

Prefix with `sfw` where the shell blocks bare `npm`.

## Design check

`scripts/design-check.mjs` fails the build on the contract's forbidden list: the banned font families, color literals outside the token file, the banned hue band, pure black or white backgrounds, the forbidden Tailwind utilities, and the words in `docs/data-banned-words.txt`. The `/design-check` skill in `.claude/skills/design-check/` runs the script and then reviews for the things a regex cannot catch.

## The graph

`content/graph.json` is the build input for the hero graph: Jon's public repos and the named projects in `content/projects.json`, with commit counts, edges, and a converged 3D layout. The `graph:data` script (Node 22.18 or newer, a GitHub token in `GITHUB_TOKEN` or from `gh auth token`) refreshes it; a build never calls the API, so a stale file is a stale graph and never a failed build. `components/GraphSnapshot.tsx` renders the same picture as SVG on the server for the first frame, crawlers, and browsers without WebGL; `components/RepoGraph.tsx` swaps in the WebGL scene once it has drawn, and `workers/graph-layout.worker.ts` keeps the layout ticking off the main thread.
