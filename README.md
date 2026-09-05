# j0ntz-homepage

Jonathan Tzeng's one-page site: who he is, what he builds, and where to find the work, with a living graph of his public repos as the centrepiece. Built with Next.js.

`docs/design-system.md` is the design contract. Every UI change reads it first; `app/globals.css` is the token set that implements it.

## Develop

```bash
npm run dev            # http://localhost:3000
npm run build          # runs the design check first, then next build
npm run design-check   # the design lint on its own (or pass files)
npm run lint           # eslint
```

Prefix with `sfw` where the shell blocks bare `npm`.

## Design check

`scripts/design-check.mjs` fails the build on the contract's forbidden list: the banned font families, color literals outside the token file, the banned hue band, pure black or white backgrounds, the forbidden Tailwind utilities, and the words in `docs/data-banned-words.txt`. The `/design-check` skill in `.claude/skills/design-check/` runs the script and then reviews for the things a regex cannot catch.
