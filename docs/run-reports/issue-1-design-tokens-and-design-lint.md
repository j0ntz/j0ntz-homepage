<!-- orch -->
# Agent run report: Design tokens and design lint

**Live preview: https://j0ntz-homepage-51h896gp3-jontz.vercel.app**  |  **PR: https://github.com/j0ntz/j0ntz-homepage/pull/3**

| field | value |
|---|---|
| Task | #1 · https://github.com/j0ntz/j0ntz-homepage/issues/1 |
| PR | https://github.com/j0ntz/j0ntz-homepage/pull/3 |
| Preview | https://j0ntz-homepage-51h896gp3-jontz.vercel.app |
| Branch | jon/task-1 |
| Verified | pass |
| Date | 2026-09-05 |

## Summary
The design contract's tokens now live in `app/globals.css`, and `scripts/design-check.mjs` fails the build on the contract's forbidden list. The live preview renders the placeholder name in Bricolage Grotesque on the navy ground at desktop and at 390px with no horizontal overflow. The cold review on head `c8dbee5` found nothing that needs a code change.

## What changed
- `app/globals.css`: the eight color tokens, `color-scheme: dark`, the seven-step type scale, the 8px base and 24px rhythm, and the three faces with real fallback stacks. The Tailwind palette and serif stack are wiped and the tokens are registered as utilities in their place.
- `app/layout.tsx`: Bricolage Grotesque, Instrument Sans, and JetBrains Mono through `next/font/google`. Geist, the starter page, and the starter SVGs are gone.
- `app/page.tsx`: the name at `--step-6`, weight 700, top-left on the ground color.
- `scripts/design-check.mjs`: a dependency-free lint with six rules (font, literal-color, hue, background, utility, copy), exposed as the `design-check` package script and run by `prebuild`.
- `.claude/skills/design-check/SKILL.md`: the judgment tier. `verify-code` step 3 runs it before the cold review.
- `docs/design-system.md`: the Enforcement section. The README describes the project.

## Test evidence
- `verify-preview.sh` result: pass against https://j0ntz-homepage-51h896gp3-jontz.vercel.app (HTTP 200, mobile `overflowBy: 0`).
- The live HTML renders `<h1 class="font-display text-step-6 font-bold tracking-display text-foreground">Jonathan Tzeng</h1>`. The built CSS carries `color-scheme:dark`, `--ground:#06121f`, `--leading-body:1.55`, and `@font-face` rules for all three families.
- The design check on the tree exits 0. A probe file under `app/` with `font-family: Inter`, `#7c3aed`, and `background: #000` exits 1 with five file:line findings; a `.tsx` probe with `bg-indigo-500`, `rounded-2xl`, and three banned words exits 1 with six. Both probes were deleted.
- `eslint` exits 0. No Inter, Geist, `dark:`, or Tailwind palette name remains under `app/`.
- Screenshots committed under `docs/screenshots/`, one desktop and one mobile (~390px) capture:
  - Desktop: [issue-1-desktop.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-1/docs/screenshots/issue-1-desktop.png)
  - Mobile: [issue-1-mobile.png](https://github.com/j0ntz/j0ntz-homepage/blob/jon/task-1/docs/screenshots/issue-1-mobile.png)

## Decisions (defaults taken)
- `docs/` and `.claude/` are outside the lint's tree scan because they quote the forbidden list on purpose. The acceptance line "adding `font-family: Inter` to any file" is read as any file the site ships, and the Enforcement section records the exclusion. Reversible by editing `excludedPrefixes` in the script.
- The lint also flags Tailwind palette utilities and the Tailwind 4 gradient spellings, both drawn from the contract rather than the issue text.

## Notes and follow-ups
- Two earlier Verify passes were blocked on infrastructure, not code: the repo had no Vercel project, then Vercel Authentication hid the preview. Both are fixed on the Vercel side.
- The h1 inherits the 1.55 body line-height, so the name wraps with a wide gap at 390px. The contract sets no display line-height, and the hero task replaces this placeholder.
- This machine's package-manager config has `ignore-scripts=true`, so a local build here skips `prebuild`. Vercel's build does not, and its deploy of this head succeeded.
