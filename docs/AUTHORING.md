# Authoring guide — adding and editing chapters

The site is a zero-dependency, zero-build static site. Every chapter is one ES
module; the table of contents *is* the registry array. This document is the
complete contract for writing a chapter.

## Add a chapter in two steps

1. Create `js/chapters/<nn>-<slug>.js` exporting a single function:

   ```js
   export function render({ id, num, title }) {
     return chapter(id, /* …nodes… */);
   }
   ```

2. Add one line to `js/registry.js`:

   ```js
   { id: 'myslug', num: '11', toc: true, title: 'My chapter', load: () => import('./chapters/11-myslug.js') },
   ```

That's it. `main.js` mounts chapters in registry order, builds the TOC and the
minimap dots, and isolates failures (a broken chapter renders an inline error
instead of blanking the page).

## Extend a chapter WITHOUT editing it (extensions)

Content can be inserted into an existing chapter from a separate file — no
rewrite of the chapter module:

1. Create `js/extensions/<name>.js` exporting `render({ target, num, title })
   → Node` (use `frag(...)` for multiple top-level nodes).
2. Register it in `js/extensions/registry.js`:

   ```js
   { target: 'attention', load: () => import('./my-extension.js') },
   // optional: anchor: '.some-selector' → inserts after that element
   // inside the chapter; omitted → appends at the chapter's end
   ```

Extensions mount after their target chapter renders, in registry order, and a
failing extension is logged and skipped without harming its chapter. The full
component library and scene engine are available inside extensions.

### The frontier section (standing convention)

Every chapter carries a `frontier-<id>` extension: the research appendix
answering (1) *what makes this component inefficient or knowledge-scarce?*
and (2) *what is the cutting edge doing about it — and what might?* Build it
from the dedicated components so all chapters match:

```js
frontier(num,
  bottleneck('<p>…the inefficiency analysis…</p>'),
  researchItem('FlashAttention-3', '2024', 'deployed', '<p>…</p>'),
  researchItem('Name', 'year', 'research' | 'deployed' | 'contested', '…'),
  novelIdea('Title', '<p>…clearly-speculative proposal…</p>'),
)
```

Rules of the frontier: `researchItem` is for real, citable work only — name
the paper/system and year, and if unsure of a detail, generalize rather than
invent. Anything original or unproven goes in `novelIdea`, which is visibly
badged *speculative · our proposal*. Figures and scenes are welcome here too.

## Building blocks (`js/core/components.js`)

| Component | Use |
|---|---|
| `chapter(id, ...children)` | section wrapper — always the outermost node |
| `chapterHead(num, kicker, title)` | `04 — THE MECHANISM` + headline |
| `prose(...htmlParagraphs)` | body paragraphs; raw HTML strings |
| `term(word, pos, defHtml)` | definition card (blue left border) |
| `mathAside(title, bodyHtml)` | collapsible "▸ The math — … (optional)"; equations in `<div class="eq">` |
| `figure(figNum, captionHtml, svgNode, {wide})` | dark-canvas figure + caption |
| `widget(title, hint, bodyNode)` | interactive widget frame with badge |
| `takeaway(html)` | emphasized summary band |
| `specTable(title, sub, rows)` | key/value spec sheet |
| `PAL` | the SVG color palette (see below) |

DOM helpers are in `js/core/dom.js`: `el(tag, attrs, ...kids)`,
`svg(tag, attrs, ...kids)`, `svgRoot(w, h, attrs, ...kids)`, `empty(node)`.
Attrs support `class`, `style` objects, `on*` handlers, `html`, `dataset`.

## Scroll-driven scenes (`js/core/scene.js`)

The signature layout: a pinned figure animates while prose step-cards scroll
past.

```js
createScene({
  id: 'my-scene',
  steps: [
    { n: 'STEP 1 / 4 — LABEL', html: '<p>…</p>' },
    …
  ],
  figure: (canvas) => {
    canvas.append(svgRoot(720, 460, {}, …));
    return (p, stepIdx, stepP) => { /* update SVG attributes */ };
  },
})
```

- `p` — overall scene progress `0..1` (0 = scene entered, 1 = scene done)
- `stepIdx` — index of the active step card
- `stepP` — progress within the active step

Drive **everything from `p`** using `seg(p, a, b, ease)` from
`js/core/anim.js`, which maps the global progress into a local `0..1` window —
`seg(p, 0.2, 0.5)` is 0 before 20 %, 1 after 50 %. This makes scenes
scrubbable: scrolling backwards must rewind the animation, so **never keep
animation state outside the update function** — set attributes idempotently
from `p` every call.

For non-sticky figures that animate as they transit the viewport, use
`track(el, cb)` from `js/core/scroll.js` (`cb(p)` with p = viewport transit).
For simple fade-ups use `reveal(el)` (components apply it automatically).

## Animation & math utilities

- `js/core/anim.js` — `clamp lerp norm ease seg stepAt rng si pct fmtBytes`.
  `rng(seed)` is a seeded PRNG: figures must render identically on every load.
- `js/core/mathtools.js` — `softmax dot matmul transpose attention round` for
  real numerics in widgets (the attention worked example computes actual
  softmax rows, not hard-coded values).

## Color semantics (strict — this is the site's visual grammar)

Every figure draws on the same dark canvas (`PAL.bg`) and uses color by
*meaning*, not decoration:

| `PAL.…` | Meaning |
|---|---|
| `weight` (amber) | learned weights, frozen at inference |
| `act` (cyan) | activations, the residual stream, data-in-flight |
| `attn` (violet) | attention machinery |
| `moe` (teal) | experts / MoE |
| `loss` (red-orange) | loss, gradients, training signal |
| `train` (green) | parameters trainable during adaptation |
| `ink / tx / mut` | text emphasis levels on the dark canvas |

A reader who has internalized "amber = weights, cyan = activations" in chapter
03 should be able to read every later figure without a legend.

## Data

Model constants live in `data/k3.js` (`K3`, `PRESETS`). Never hard-code a
Kimi K3 number in a chapter — import it, so a spec update propagates
everywhere. Undisclosed dimensions use K2's blueprint and must be labeled
*illustrative* in captions.

## Conventions

- Figures are numbered `<chapter>.<n>` (e.g. `Fig. 4.2`) in captions.
- Math is written in Unicode/HTML (`x·Wᵢⱼ`, `√d_head`), monospace via
  `<div class="eq">` — no LaTeX dependency.
- Widgets must be keyboard-accessible (`<button>` for clickables) and give
  every `svgRoot` an `aria-label`.
- Respect `prefers-reduced-motion`: continuous rAF loops should check it;
  scroll-scrub animations are exempt (user-controlled).
- All chapter modules are plain ES2022; no TypeScript, no build step.

## Local development

```sh
python3 -m http.server 8080        # or: npx http-server -p 8080
# open http://localhost:8080
```

ES modules require http(s) — `file://` won't work.
