# Authoring guide — adding and editing chapters

The site is a zero-dependency, zero-build static site. Every chapter is a
directory of ES modules; the table of contents *is* the registry array. This
document is the complete contract for writing a chapter.

## Add a chapter in two steps

1. Create `js/chapters/<slug>/index.js` exporting a single function:

   ```js
   export function render({ id, num, title }) {
     return chapter(id, /* …nodes… */);
   }
   ```

   `render()` may be `async` if the chapter wants to `import()` something heavy.

2. Add one line to `js/registry.js`, in the position you want it read:

   ```js
   { id: 'myslug', part: 'machine', title: 'My chapter', load: () => import('./chapters/myslug/index.js') },
   ```

That's it. **Do not write a chapter number anywhere.** `main.js` mounts
chapters in registry order, derives every number from that order, builds the
TOC and the minimap, lazily loads each chapter as the reader approaches it,
and isolates failures (a broken chapter renders an inline error instead of
blanking the page).

Registry fields: `id` (stable slug — the DOM id, the anchor, and the
cross-reference key), `title`, `part` (see `PARTS`), `load`, plus optional
`sub: true` (numbers as `08B` off the previous chapter) and
`kind: 'front' | 'back'` (unnumbered, kept out of the TOC).

## Numbering is programmatic — never type a number

`js/core/numbering.js` derives everything from registry order. Inserting or
reordering a chapter renumbers the book *and every reference to it*
automatically. This is the one rule with no exceptions.

| Call | Gives |
|---|---|
| `figure(captionHtml, node, opts)` | claims the next figure number in this chapter, in call order |
| `claimFig('key')` | reserves the next number for a scene whose caption sits in a later `prose()` |
| `chRef('attention')` | `chapter 09`, as a link |
| `chRef('moe', { word: 'ch.' })` | `ch. 10` |
| `chRef('attention', { cap: true })` | `Chapter 09` |
| `figRef('attention', 'variants')` | `Fig. 9.5`, resolved after render |

Pass `{ key: 'variants' }` to `figure()` to make it referenceable. Because
prose is built before later figures exist, `figRef()` emits a placeholder that
`main.js` resolves once the target chapter has mounted — so forward references
and cross-chapter references both work.

**Statements in `render()` must appear in visual order**, since figure numbers
are claimed in call order. If you build a figure into a variable before the
`chapter(...)` call, keep those statements in page order too.

In prose — which is raw HTML strings — use backtick templates and interpolate:

```js
prose(`Attention is the only place tokens interact (${chRef('attention')}),
       and ${figRef('attention', 'variants')} counts what it costs to serve.`)
```

## One directory per chapter, one file per figure

```
js/chapters/attention/
  index.js               the chapter spine: render(), prose, terms, math asides
  shared.js              helpers used by more than one part file
  scene-five-stages.js   one export: the sticky scene's figure()
  fig-shapes.js          one export per figure
  widget-coreference.js  one export per widget
```

Keep files under ~250 lines; `index.js` should read as an outline of the
chapter. Import depth from inside `js/chapters/<slug>/` is `../../core/…` and
`../../../data/k3.js`.

Chapters are dynamically imported, and mounted only as the reader approaches
them — so a chapter's cost is paid only if it is actually read.

## Extend a chapter WITHOUT editing it (extensions)

Content can be inserted into an existing chapter from a separate file:

1. Create `js/extensions/<name>.js` exporting `render({ id, num, title })
   → Node` (use `frag(...)` for multiple top-level nodes).
2. Register it in `js/extensions/registry.js`:

   ```js
   { target: 'attention', load: () => import('./my-extension.js') },
   // optional: anchor: '.some-selector' → inserts after that element
   // inside the chapter; omitted → appends at the chapter's end
   ```

Extensions mount after their target chapter renders, in registry order, and a
failing extension is logged and skipped without harming its chapter. The full
component library and scene engine are available inside extensions. Import
depth from `js/extensions/` is `../core/…` and `../../data/k3.js`.

### The frontier section (standing convention)

Every chapter in Parts II–IV carries a `frontier-<id>` extension: the research
appendix answering (1) *what makes this component inefficient or
knowledge-scarce?* and (2) *what is the cutting edge doing about it — and what
might?* Build it from the dedicated components so all chapters match:

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
badged *speculative · our proposal*, and should name its own failure modes and
the cheapest experiment that would falsify it. Figures and scenes are welcome
here too.

**Part I (the foundations) is exempt.** Those chapters teach settled
mathematics — vectors, networks, optimization, probability, sequence models —
and close on a `takeaway()` instead.

### The consequence section (standing convention)

The other end-of-chapter band, also mounted via `js/extensions/`. Where
`frontier` asks *where is the field stuck*, `consequence` asks *given this
mechanism, what will bite the reader* — the failure the chapter's own machinery
predicts:

```js
consequence(num,
  failureMode('It cannot spell', '<p>…the symptom as the reader meets it…</p>'),
  because('<p>…the mechanism from THIS chapter that causes it…</p>'),
  workaround('<p>…what to do instead, and why that works…</p>'),
)
```

**The binding rule: a consequence section may only invoke mechanisms its own
chapter has already taught.** If explaining a failure needs machinery from
elsewhere, it belongs in that other chapter instead. This is what keeps these
sections from degenerating into a list of quirks — each one should land as
"the architecture I just learned *predicts* this".

Not every chapter has one; they exist where a mechanism has a sharp,
reader-visible cost. A chapter carrying both puts `consequence` first (the
reader-facing cost), then `frontier` (the research frontier) — order is set by
position in `js/extensions/registry.js`.

Date your claims. Where a section shows a specific model failing a specific
way, name the model and roughly when. These get patched, and an undated claim
ages badly.

## Building blocks (`js/core/components.js`)

| Component | Use |
|---|---|
| `chapter(id, ...children)` | section wrapper — always the outermost node |
| `chapterHead(num, kicker, title)` | `09 — THE MECHANISM` + headline |
| `prose(...htmlParagraphs)` | body paragraphs; raw HTML strings |
| `term(word, pos, defHtml)` | definition card (blue left border) |
| `mathAside(title, bodyHtml)` | collapsible "▸ The math — … (optional)"; equations in `<div class="eq">` |
| `figure(captionHtml, node, {wide, key})` | dark-canvas figure + auto-numbered caption |
| `widget(title, hint, bodyNode)` | interactive widget frame with badge |
| `takeaway(html)` | emphasized summary band |
| `consequence(num, ...)` | end-of-chapter "what this costs you" band (see below) |
| `failureMode / because / workaround` | the three cards inside a consequence band |
| `specTable(title, sub, rows)` | key/value spec sheet |
| `txt(x, y, s, opts)` | SVG text with the figure palette's defaults |
| `PAL` | the SVG color palette (see below) |

DOM helpers are in `js/core/dom.js`: `el(tag, attrs, ...kids)`,
`svg(tag, attrs, ...kids)`, `svgRoot(w, h, attrs, ...kids)`, `frag(...)`,
`empty(node)`. Attrs support `class`, `style` objects, `on*` handlers, `html`,
`dataset`.

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

## Pinned figures (`pin`)

A standalone figure — no step cards — animates the same way: pinned at the
middle of the viewport and scrubbed in place, rather than sliding upward
while it plays.

```js
const node = figure('caption…', svgRoot(720, 400, …), { key: 'atom' });
return pin(node, (p) => { /* set attributes from p */ });
```

`pin()` returns the **wrapper** — insert that into the chapter, not the bare
figure. It wraps the figure in a tall track (`extent` vh, default 190) inside
which the figure sticks; `p` runs 0→1 across the travel (extent − 100vh, so
the default is about one screen of scrubbing). Pass `{ extent }` to give a
long animation more room or a short one less.

The same discipline as scenes applies: set attributes idempotently from `p`,
never hold state outside the callback.

`track(el, cb)` still exists for animating a figure as it transits the
viewport, but pinned is the house style — every figure in the book uses it.
For simple fade-ups use `reveal(el)` (components apply it automatically).

Widgets are the exception: they are event-driven (buttons, sliders) and may
hold state.

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

A reader who has internalized "amber = weights, cyan = activations" in the
foundations should be able to read every later figure without a legend.

## Data

Model constants live in `data/k3.js` (`K3`, `PRESETS`). Never hard-code a
Kimi K3 number in a chapter — import it, so a spec update propagates
everywhere. Undisclosed dimensions use K2's blueprint and must be labeled
*illustrative* in captions.

## Conventions

- Figures are numbered automatically; never type `Fig. 4.2`.
- Math is written in Unicode/HTML (`x·Wᵢⱼ`, `√d_head`), monospace via
  `<div class="eq">` — no LaTeX dependency.
- Widgets must be keyboard-accessible (`<button>` / `<input>` for controls) and
  give every `svgRoot` a `role="img"` and an `aria-label`.
- Respect `prefers-reduced-motion`: continuous rAF loops should check it;
  scroll-scrub animations are exempt (user-controlled).
- All chapter modules are plain ES2022; no TypeScript, no build step.
- Voice: precise, concrete, unhurried. No marketing, no exclamation marks, no
  "simply" or "just".

## Local development

```sh
python3 -m http.server 8080        # or: npx http-server -p 8080
# open http://localhost:8080
```

ES modules require http(s) — `file://` won't work.
