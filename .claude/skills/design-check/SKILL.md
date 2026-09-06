---
name: design-check
description: Check the tree (or the files passed) against docs/design-system.md. Runs scripts/design-check.mjs for the mechanical forbidden list, then reads the contract and reviews for the judgment-level violations the script cannot catch (card rows, badges over headings, scroll-triggered reveals, copy that could be any engineer's). Reports file:line findings; never fixes. Invoked as `/design-check [files...]`; the verify-code agent runs it before its cold review. Repo-local.
---

<goal>Report every way the current tree (or the files passed as `/design-check [files...]`) disagrees with `docs/design-system.md`. Two tiers: the script catches the contract's mechanical forbidden list; you catch the rest by reading the code against the contract. Findings only; the caller decides what to do with them.</goal>

<rules>
<rule id="check-not-fix">Do not edit files. Every problem is a finding anchored to `file:line` with the contract rule it breaks and the fix it wants.</rule>
<rule id="contract-is-truth">`docs/design-system.md` decides. If the contract and `CLAUDE.md` disagree on a point, report the disagreement as a finding instead of picking a side.</rule>
<rule id="no-invented-findings">A finding names a specific line and a specific contract rule. "Feels generic" is not a finding until you can say which rule it breaks; "this headline could sit on any engineer's site" is, because the Copy section says exactly that.</rule>
</rules>

<step id="1" name="Run the script">
`node scripts/design-check.mjs` with no arguments for the whole tree, or with the file list you were given. Prefix with `sfw` if the shell blocks bare node. Record every `path:line: rule: detail` line and the exit code. A non-zero exit is one finding per line; do not stop here.
</step>

<step id="2" name="Read the contract">
Read `docs/design-system.md` in full. The sections that carry judgment rules are Typography (scale and weights), Layout (the zones, what each is and is not), Motion (what may trigger it), Copy (the voice test), and Forbidden (the list).
</step>

<step id="3" name="Review for what the script cannot see">
Read every file under `app/`, `components/`, and `content/` (or the files passed) and look for:

- **Layout patterns.** Three or more equal cards in a row, a bento grid, a badge or eyebrow label above a heading, a stat banner, a logo strip, numbered step rows, a centred hero where the contract wants it off-centre, borders on every block, one radius everywhere.
- **Type.** A size that is not on the scale (16, 20, 25, 31, 39, 49, 61), the display face on body copy or the mono face on prose, hierarchy carried by a fourth family instead of weight, body line-height that is not 1.55.
- **Color.** A fourth hue arriving through an image, an SVG fill, a chart, or a library default; a gradient that is not the radial glow; glow opacity above 55 percent; borders where whitespace or a surface shift would do.
- **Motion.** Anything keyed to scroll position or an intersection observer, fade-in on every element, transitions that snap, drift or parallax that ignores `prefers-reduced-motion`, a graph that is not readable in the first frame.
- **Copy.** Any headline or line that could sit on another engineer's site, hedging, superlatives, startup-marketing adjectives the word list happens to miss, a line under the name that names values instead of what he builds.
- **The forbidden list.** Glassmorphism, blobs, orbs, neon borders, bloom, stock photography, generated illustration, emoji as section markers, a resume link or PDF.
</step>

<step id="4" name="Report">
Print two blocks. `mechanical:` with the script's exit code and its finding lines verbatim (or `clean`). `judgment:` with one line per finding, `path:line: <what> (contract: <section>) -> <fix>`, or `clean`. End with one line: `design-check: <n> mechanical, <m> judgment`. Nothing else.
</step>
