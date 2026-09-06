# Design contract

This file is the design decision record for j0ntz-homepage. Every UI task reads it before editing, and `app/globals.css` is the token source that implements it. A change to a decision here is a change to the site; a component that disagrees with this file is a bug in the component.

Decided 2026-09-04 from the taste board (kept: bruno-simon.com, samsy.ninja), the palette pick (cyan on deep navy), and the rule "no game, interactive animations yes".

## What the site is

The site is one page. A recruiter should know who Jon is, what he builds, and where to find the work within ten seconds, without touching anything. The centrepiece is a living graph of Jon's real public repos and projects, sized by activity, floating in 3D. It is the one loud thing on the page and everything else recedes.

It is not a game. No driving, no collecting, no scroll-jacked story. Interaction is hover (a node and its neighbours light up, a label appears) and click (the project opens). The graph drifts on its own and reacts to the cursor; it never needs the visitor.

## Color

Three hues, extended through tints and shades, and never a fourth.

| token | value | role |
|---|---|---|
| `--ground` | `#06121F` | the page. Deep navy, never pure black. |
| `--surface` | `#0B1A2B` | panels, the work list rows on hover |
| `--foreground` | `#E8F3F8` | text and neutral nodes |
| `--foreground-muted` | `#8FA3B3` | secondary text, node labels at rest, link edges |
| `--border` | `#16283A` | hairlines only when whitespace and a surface shift both fail |
| `--accent` | `#3DD6F5` | the cyan. Primary nodes, the one call to action, hover states, focus rings |
| `--accent-deep` | `#0E8FA8` | accent on light surfaces, pressed states |
| `--glow` | `hsl(190 90% 60% / 0.55)` | the halo behind accent nodes and the call to action. 55 percent is the ceiling. |

The site is dark by decision, not by default: the picker's two light controls were rejected. There is no light theme, and `color-scheme: dark` is declared so form controls match. No gradients anywhere except the radial glow behind accent nodes. No purple, no red, no green in the palette.

Contrast is measured with APCA. Body text on ground clears Lc 75; muted text clears Lc 60.

## Typography

The type system is two families, chosen by name, plus one data face. No Inter, Roboto, Open Sans, Poppins, Geist, or Space Grotesk in the tree.

- Display: **Bricolage Grotesque**, weight 700 for the name, 600 for section titles. Optical size at the large end. Letter-spacing -0.02em at display sizes.
- Body and UI: **Instrument Sans**, weights 400 and 500. Line-height 1.55 on body copy, measure 60 to 75 characters.
- Data: **JetBrains Mono**, weight 500, for the numbers the graph carries (commits, stars, dates) and for node labels. Never for prose.

Scale, from a 16px base with a ratio of 1.25: 16, 20, 25, 31, 39, 49, 61 (the name only). Section titles sit at 25 or 31. There is no size between 16 and 20. Weight carries hierarchy; extra families never do.

## Layout

Twelve columns, 80px gutters at desktop, 8px base unit, all vertical spacing a multiple of 24px. Content sits in columns 2 to 8; the graph bleeds full width behind it. The hero is off-centre by construction: name and line top-left, links top-right, the call to action bottom-left, the graph's visual mass to the right of the text.

Zones, top to bottom, in one scroll:

1. **Hero.** The graph, full-bleed, sized to the viewport minus enough room to show that the page continues. Over it: the name at 61, one line at 20, the three links (LinkedIn, GitHub, email) as underlined uppercase labels, and one accent call to action ("See the work") that scrolls to zone 2. The graph is visible and readable in the first frame; nothing waits on an animation.
2. **Selected work.** Four to six entries as a list, not cards: name, one sentence, a mono line of facts (language, first commit year, last activity), a link. Rows separate by whitespace and a surface shift on hover. Each entry is also a node in the graph; hovering a row lights its node.
3. **About and contact.** Three short paragraphs at most, the same three links, no form. No resume.

Section treatments differ: zone 1 is a scene, zone 2 is a list, zone 3 is prose. No three-up card row, no badge above the name, no stat banner, no logo strip, no numbered steps.

Mobile first at 390px: the graph shrinks to a square behind the name, hover becomes tap, the links stack. Nothing is hidden on mobile that is shown on desktop.

## Motion

Motion communicates state or directs attention; it never decorates.

- The graph drifts slowly at rest (a full rotation in about 90 seconds) and responds to the cursor with parallax. It eases with physical curves; nothing snaps.
- Hover on a node: the node and its neighbours brighten to accent over 150ms, the label fades in, unrelated nodes dim to 40 percent.
- The call to action has a hover state (glow widens) and a focus ring in accent.
- Scroll does not trigger animation. Sections are visible at rest.
- `prefers-reduced-motion` stops the drift and the parallax; hover states remain.
- Frame budget: 60fps on a 2020 laptop, 30fps on a mid-range phone. Layout runs in a worker; the main thread only draws.

## Copy

Every line in Jon's voice, specific over general. The test for a sentence: if it could sit on any engineer's site, it does not sit here. No adjectives from the startup-marketing register, no hedging, no superlatives; the design lint carries the exact word list in `docs/data-banned-words.txt`. The one line under the name names what he builds, not what he values.

## The graph

- Data: Jon's public repos and named projects, fetched at build time from the GitHub API, cached in the repo as JSON so a build never depends on the API being up. Node size from commit count in the last two years; edges from shared topics, shared language, and explicit links in the data file.
- Palette: nodes are `--foreground-muted` at rest, the eight most active in `--accent` with the glow. Edges are accent at 20 percent. Nothing else in the scene has color.
- Lighting reference: no scene lighting at all; flat discs and lines with the radial glow, the way the palette picker previewed it. No bloom pass, no orbs, no fog.
- Camera: fixed distance, slow orbit, parallax from the cursor. No user camera control.
- Density: 40 to 60 nodes on desktop, the 25 most active on mobile.

## Forbidden

Written down so no task has to guess. A pull request that reintroduces any of these fails review.

- Inter, Roboto, Open Sans, Poppins, Geist, Space Grotesk.
- Purple, violet, indigo, or a purple-to-blue gradient in any form.
- Pure `#000` or `#fff` backgrounds.
- Three feature cards in a row, a badge above the heading, stat banners, logo rows, numbered step rows, bento grids.
- `rounded-2xl shadow-lg p-6` and the uniform 16px radius; borders on every block.
- Glassmorphism, floating blobs, orbs, neon borders, bloom.
- Stock photography, generated illustration, emoji as section markers.
- Fade-in on every element, scroll-triggered reveals, anything that snaps.
- A resume link or PDF.
- Any word from `docs/data-banned-words.txt`, and any headline that could be another engineer's.

## Enforcement

Two layers, and a pull request has to clear both.

- `scripts/design-check.mjs` (the `design-check` package script, run by `prebuild` so every build runs it) is the mechanical layer. It scans the working tree, or the files it is given, and exits 1 with `file:line` findings on the forbidden font families, any color literal outside `app/globals.css`, purple, violet, or indigo by name or by hue (250 to 290), pure black or white backgrounds, `rounded-2xl`, `shadow-lg`, `backdrop-blur`, the gradient utilities, the Tailwind palette utilities, and any entry in `docs/data-banned-words.txt` inside `app/`, `components/`, or `content/`. It has no dependencies. `docs/` and `.claude/` are outside its scan because they quote the forbidden list on purpose.
- `/design-check` (`.claude/skills/design-check/SKILL.md`) is the judgment layer. It runs the script, reads this file, and reviews the code for what a regex cannot catch: card rows, badges over headings, stat banners, scroll-triggered motion, sizes off the scale, copy that could be any engineer's. The verify-code agent runs it before its cold review, and each of its findings is a change request.
