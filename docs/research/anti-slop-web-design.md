# Not looking AI-generated: research notes

Synthesis of five sources read on 2026-09-04, distilled to what this site will enforce. The rules below feed `docs/design-system.md` (the design contract, not yet written) and the site's design lint.

Sources:

- [5 AI website design tips (Unpromptable)](https://unpromptable.substack.com/p/5-ai-website-design-tips-for-websites)
- [Avoiding AI slop: 7 prompt techniques (UI UX Pro Max)](https://ui-ux-pro-max-skill.com/blog/avoiding-ai-slop/)
- [AI slop web design guide (925 Studios)](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [AI slop design tells and fixes (vibecodekit)](https://vibecodekit.dev/ai-slop-design)
- [Stop AI-slop typography (Bruvora)](https://www.bruvora.com/blog/stop-ai-slop-typography)

## The one idea every source shares

Slop is the absence of a decision. A model asked for "modern and clean" returns the statistical average of the web. Every fix is the same move in a different place: replace a generality with a named choice, and write the choice down where every later edit has to read it.

## Tells, by area

Typography:

- Inter (or Roboto, Open Sans, Poppins, Geist, Space Grotesk) at default weights with no headline contrast. Named by four of five sources as the single strongest signature.
- A single serif-italic accent word, all-caps section labels, decorative monospace.
- Uniform sizes with no decisive jump from body to subhead to headline.

Color:

- Purple-to-blue or purple-to-indigo gradients in the hero, the CTA, or the accents.
- Default shadcn gray with Tailwind blue; lavender accents.
- Pure black or pure white backgrounds; timid palettes with no dominant color.
- Dark mode as a reflex, neon on dark with glowing borders, glassmorphism everywhere, floating orbs and blobs.

Layout:

- Centered hero with a badge above the H1, then exactly three feature cards, then a logo row, then pricing, then FAQ, then footer.
- Identical 16px radius, 24px padding, and card height everywhere; 1px gray borders on every card; nested cards; default bento grids.
- Numbered step rows, horizontal stat banners.

Copy:

- "Transform your workflow", "build the future of X", "your all-in-one platform", "scale without limits".
- Hedging ("may help", "can potentially") and superlatives ("best-in-class").

Imagery and motion:

- Stock photos of teams at laptops; illustrations that are too smooth and too symmetrical.
- The same fade-in on every element; buttons that snap instead of ease; decorative animation with no state to communicate.

## Rules this site adopts

Typography:

- Two typefaces, chosen by name: one display face with character, one quiet body face. No Inter, Roboto, Open Sans, Poppins, Geist, or Space Grotesk anywhere.
- A real scale with a decisive jump between levels. Tight tracking on display sizes, generous line-height on body, 60 to 80 characters per line, body at 16px or larger.
- Hierarchy through weight, not extra families.

Color:

- Three hues at most: a dominant (about 60 percent), a neutral (about 30 percent), a sharp accent (about 10 percent), extended through tints and shades rather than new hues. Semantic token names (`surface`, `foreground`, `accent`), never decorative ones.
- No purple-to-blue gradient in any form. No pure #000 or #fff backgrounds; tint them.
- Light and dark are a deliberate decision, not a default. Contrast measured with APCA, Lc 75 or better for body text.

Layout:

- One strong visual decision per screen: one focal point, one accent placement, and everything else recedes.
- A mandated grid and spacing rhythm written into the contract (column count, gutters, base unit), with the hero off-center.
- Separation by whitespace first, then a 3 to 5 percent background shift, then soft elevation. Borders only when all three fail.
- Section treatments vary down the page. No three-up card row, no badge over the H1, no template skeleton.

Copy:

- Every line in Jon's own voice, specific over general. If a sentence could sit on any developer's site, it does not sit on this one.
- Tone decided before layout, so layout follows voice.

Imagery and motion:

- Real artifacts only: the live repo graph, real screenshots, real data. No stock, no generic illustration.
- Motion communicates state or directs attention. Micro-interactions on the primary actions first; scroll-driven motion only where it carries the narrative. Ease, never snap.

## Process rules (how the site gets designed, not just how it looks)

1. Taste before tools: collect 10 to 15 references and name what each one does right (whitespace, type, how the hero uses the medium). Every source puts this first.
2. Anchor prompts in named references and eras, never adjectives. "A Linear product page from late 2024" beats "modern".
3. Forbid the tells out loud at the top of the contract. A short prohibition list does more than paragraphs of positive direction.
4. Sketch the hierarchy by hand (boxes and labels) before any generation, so the model cannot fill gaps with averages.
5. Lock the decisions in a design contract at the repo root and make every UI task read it. Without a system the defaults creep back on the next page.
6. Iterate by deleting: after a first pass, remove the three things that shout "a model did this" and see whether the page survives.
7. Squint test on every review: shrink to a thumbnail; the hierarchy must survive the blur.
8. The work is never finished by the model alone. The refinement pass (type, color, copy, motion) is where a human spends the time the model saved.

## What this means for a three.js centrepiece

The living repo graph is the kind of real, specific artifact every source asks for, and the 3D layer carries the same risk as everything else: default lighting, a floating-blob palette, and a purple glow read as slop instantly. The contract will fix the graph's palette to the site's three hues, its motion to physical easing, and its lighting to one named reference, before the first line of shader work.

Reference portfolios that stand out for a chosen concept rather than effects: [bruno-simon.com](https://bruno-simon.com), [bilal.show](https://bilal.show), [sebastien-lempens.com](https://sebastien-lempens.com), [aimees-papercraft-world.com](https://aimees-papercraft-world.com), [samsy.ninja](https://samsy.ninja). Compiled from [Best Three.js portfolio examples (CreativeDevJobs)](https://www.creativedevjobs.com/blog/best-threejs-portfolio-examples-2025).
