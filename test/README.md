# The test harness

A browser-run test page. Zero dependencies, no build step, no `package.json` —
the same constraint the site itself keeps. It is served by the same static
server as the book and it is written in the same plain ES2022 modules.

It implements section 5 of `docs/KARPATHY-PLAN.md`: the eight universal
invariants (5.1), the mechanism for per-figure assertions (5.2), and the
content checks (5.3). It deliberately does **not** do screenshot or visual-diff
testing (5.4) — that would fail on every font tweak and teach us to ignore it.

---

## Run it

```sh
python3 -m http.server 8080        # from the repo root
open http://localhost:8080/test/
```

Every chapter and extension in the registries is mounted into one page, every
scroll-driven figure is swept, and a report renders in the panel on the right.
The same result is written to `window.__TEST_RESULTS__`:

```js
{ passed, failed, total, failures: [ { suite, name, detail } ] }
```

plus `viewport`, `figures`, `chapters`, `durationMs` and `domDigest` for
convenience. `window.__TEST_DONE__` flips to `true` when the run finishes.

A full run at 1440×900 takes about 25 seconds, most of it the layout suite,
which has to physically scroll the page.

### Query parameters

| Parameter | Effect |
|---|---|
| `?suite=content,figures,invariants,layout` | run only these (default `all`) |
| `?layout=0` | skip 5.1.8 — the slow suite; the rest runs in ~5 s |
| `?ch=attention,moe` | mount and test only these chapter ids |
| `?ui=0` | no report panel (headless runs) |
| `?theme=dark` | force the dark theme |

Nothing is ever hard-coded: the chapter list comes from `js/registry.js`, the
extension list from `js/extensions/registry.js`, the file list from the static
import graph, and the figure list from every `pin()` / `createScene()` /
`track()` call the mounted chapters make. **A new figure is covered the moment
it is registered — there is nothing to add here.**

> **`?ch=` is for iterating, not for judging layout.** Mounting a subset
> changes the height of the document, which changes where every scene sits and
> therefore what the 5.1.8 layout suite measures. A `?ch=` run will also report
> per-figure checks and takeaway-convention checks for chapters it did not
> mount, as "the figure did not render" — that noise is expected.
>
> This has already produced one false alarm in both directions: a layout
> failure that reproduced under `?ch=residual,anatomy` and did **not** exist in
> a full run. Before believing any 5.1.8 result — pass or fail — re-run without
> `?ch=`. Only the full-book run is authoritative for layout.

---

## Run it headlessly

Any browser automation tool works. Load the page, wait for `__TEST_DONE__`,
read `__TEST_RESULTS__`.

```js
// Playwright
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:8080/test/');
await page.waitForFunction('window.__TEST_DONE__', null, { timeout: 300_000 });
const r = await page.evaluate('window.__TEST_RESULTS__');
if (r.failed) { console.error(r.failures); process.exit(1); }
```

If you have Chrome but no test-runner dependency, the same thing is about
forty lines of Node against the DevTools protocol — Node 22+ has a global
`WebSocket` and `fetch`, so it needs nothing installed:

```js
spawn(CHROME, ['--headless=new', '--remote-debugging-port=9222',
               `--window-size=${W},${H}`, '--user-data-dir=/tmp/x', 'about:blank']);
const page = (await (await fetch('http://127.0.0.1:9222/json/list')).json())
  .find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
// → Page.navigate, then Runtime.evaluate with awaitPromise:true on:
//   (async () => { while (!window.__TEST_DONE__) await new Promise(r => setTimeout(r, 250));
//                  return JSON.stringify(window.__TEST_RESULTS__); })()
```

### The layout suite needs an external driver

Invariant 8 must run at several viewport sizes, and **a page cannot resize
itself**. The driver sets the viewport and either reloads, or calls the exposed
handle to re-run just the layout suite against the already-mounted page:

```js
for (const [w, h] of [[375, 667], [393, 852], [950, 870], [1440, 900]]) {
  await page.setViewportSize({ width: w, height: h });
  const r = await page.evaluate('window.__TEST__.runLayout()');   // resets counters
  console.log(w, h, r.passed, '/', r.total, r.failures);
}
```

`window.__TEST__` also exposes `run()`, `figures()`, `results`, `log` and
`domDigest()`.

Those four sizes are the ones the plan names, and they are not arbitrary:
1440×900 and 950×870 straddle the 64 rem breakpoint where scenes switch from
two columns to stacked, and 375×667 additionally trips the `max-height: 46rem`
rule where step cards start parking with `position: sticky`.

### Determinism across separate loads

Invariant 7 compares two renders inside one page, which catches an unseeded
`Math.random()` in a figure. To also catch state that survives a reload
(a cache, a `localStorage` read, a `Date`), compare `domDigest()` across two
fresh loads:

```js
const a = await load(); const b = await load();   // two page loads
assert.equal(a.domDigest, b.domDigest);
```

---

## How the harness reaches a figure's update function

This is the one piece of machinery worth understanding before changing
anything here.

Every scroll-driven figure hands its update closure to `js/core/scroll.js`:

```js
return pin(node, (p) => { …set attributes from p… });
```

That closure is never exported and never stored on the DOM node, so a test page
cannot reach it by inspecting the rendered document — and without it there is
no way to set `p` directly, which every one of the sweep invariants needs.

`test/index.html` therefore ships an **import map** that rewrites
`../js/core/scroll.js` to `test/shim-scroll.js`. Chapter modules import the
scroll engine as `../../core/scroll.js`, which resolves to exactly that URL, so
every chapter and extension in the book gets the shim instead. The shim imports
the real module under `?harness-passthrough=1` (a different URL, so the import
map does not match it), forwards every call to it, and *also* keeps a reference
to the element and the callback.

**No production file is modified, no bundler is involved, and the site behaves
exactly as it does for a reader** — the real scroll engine is still driving
everything; the shim only takes notes.

Two deliberate test-environment differences, both in `shim-scroll.js`:

1. **`reveal()` adds `.in` immediately** instead of waiting for an
   `IntersectionObserver`. Un-revealed content is `opacity: 0`, which would
   make every bounding-box and layout measurement meaningless for figures that
   happen to be off-screen when a suite runs.
2. **The pre-scroll snapshot is taken at registration time**, synchronously,
   before the engine has ever called the update function. That is the baseline
   invariant 3 compares against, and that instant is the only place it can be
   captured.

---

## What each invariant catches

### 5.1.1 Idempotence — `test/invariants.js`

Sets `p = x`, snapshots, sets two other values of `p`, sets `p = x` again,
snapshots, and requires the two to be identical. Probed at eight values of `p`
including both endpoints.

**Catches:** animation state held outside the update function — the single most
common bug in this codebase's style. A counter that increments per call, a
`lastValue` captured in the closure, an element appended rather than updated,
a step index derived from "which direction did we come from". Anything where
scrolling to the same place twice does not look the same twice.

### 5.1.2 Reversibility

Sweeps `p` 0→1 in 41 steps recording a snapshot at each, then sweeps 1→0, and
compares at matched `p`.

**Catches:** the same class of bug where it only shows up on the way back —
which is most of them, because figures are authored by scrolling forwards.
Also catches easing applied to a value derived from the *previous* frame.

### 5.1.3 Endpoint stability

Requires the `p = 0` snapshot of the artwork (`.pin-stick` / `.scene-sticky`)
to equal the DOM the figure was built with.

**Catches:** a figure that flashes a different state before its first update
runs. The usual shapes are an element built visible and hidden at `p = 0`
(`opacity` absent → `"0"`), a geometry attribute never set at build time
(`y` absent → `"117"`, so the element sits at 0 until the first frame), or a
`<text>` built empty and filled at `p = 0`.

Step-card `.active` state is deliberately excluded: a scene marking its first
card active at `p = 0` is the correct opening state, not a jump.

> **Known baseline.** Most figures in the book currently fail this, because the
> house style is to build an empty shell and fill it from `p`. In practice the
> scroll engine's first `requestAnimationFrame` usually lands before the first
> paint, so the flash is rarely visible — but the hazard is real and the fix is
> mechanical: either build each element with the value the update function
> assigns at `p = 0`, or have `pin()`/`createScene()` call the update once at
> registration. The second would clear the whole category in two lines.

### 5.1.4 No NaN / undefined

Scans every attribute and every text leaf at all 41 sweep steps for `NaN`,
`undefined`, `Infinity` or `null`.

**Catches:** the classic `seg(p, a, b)` divide-by-zero when `a === b`,
`lerp` against an undefined bound, a `.toFixed()` on a missing array element,
and any formatting helper handed a value it did not expect. `aria-label` and
`title` are exempt, since those carry prose.

### 5.1.5 No layout escape

At seven values of `p`, requires every visible leaf element inside an `<svg>`
with a `viewBox` to render inside that `viewBox`, within 2 user units.

Measured with **client rects, not `getBBox()`**: `getBBox()` reports a box in
the element's own user space and ignores every transform on the way up, so a
`<g transform="translate(900 0)">` full of in-bounds children would sail
through. Elements that are effectively invisible (opacity ≤ 0.02 anywhere up
the chain, `display: none`, `visibility: hidden`) are skipped, as are `<defs>`,
markers, gradients, clip paths, masks and filters.

**Catches:** a label that runs off the right edge as a number grows, a bar that
overshoots its axis, a figure authored at one canvas size and reused at
another. The outermost `<svg>` clips silently, so these never look like errors
— they look like a missing label.

**Opt-out.** A figure whose whole point is content leaving the frame — a
continuous zoom-out, a ribbon scrolling past a window — marks the group (or the
`<svg>`) `data-allow-overflow`:

```js
svg('g', { 'data-allow-overflow': '' }, …the thing that scales out of frame…)
```

It has to be written down, so silence is a decision rather than an accident.

### 5.1.6 Accessibility

Every `svgRoot` carries `role="img"` and a non-empty `aria-label` (unless it is
explicitly `aria-hidden="true"`). Every `.widget` exposes at least one native
`<button>` / `<input>` / `<select>` / `<textarea>`, and contains no
clickable-looking element (`cursor: pointer`, `role="button"`, or a `tabindex`)
that is not one.

**Catches:** the figure that shipped without a description, and the widget
control built as a styled `<div>` — which no keyboard can reach.

### 5.1.7 Determinism across renders

Renders every chapter a second time into a detached container and compares it
with the serialization taken the instant the first render returned.

**Catches:** an unseeded `Math.random()` — figures must use `rng(seed)` from
`js/core/anim.js` — plus `Date.now()`, and module-level state that leaks from
one render into the next. See above for the cross-*load* version.

### 5.1.8 Layout invariants

Physically scrolls each scene through 15 positions and measures:

- **Cards never cover the figure.** No card that is readable (computed opacity
  above 0.08) may overlap the pinned artwork by more than 2 % of its own area.
  In the stacked layout, cards travel *behind* the figure on purpose — this
  asserts that `scene.js`'s `fadeCards()` has finished fading them before they
  get there.
- **A card is always present.** The best card presence score — the maximum over
  cards of `opacity × fraction of the card on screen` — never drops below 0.35
  between the run-in and the run-out. This is the "reader is staring at
  nothing" check.
- **Usable scrub range.** Every pinned figure and scene has at least 0.25
  viewport-heights of scroll travel, so its animation does not play in a flick.

All three thresholds are in one place, `LAYOUT` at the bottom of
`test/invariants.js`.

`window.scrollTo` is called with `behavior: 'instant'` and the landing position
is verified, because `css/base.css` sets `html { scroll-behavior: smooth }` —
without that, every measurement is taken a few pixels from where the page
started and looks entirely plausible.

### 5.3 Content checks — `test/content.js`

- Every `figRef()` placeholder resolves; no `Fig. __`, `undefined` or `NaN`
  survives into rendered prose, captions or step cards.
- Every `chRef()` link points at a chapter id that exists.
- No hard-coded number appears in any chapter or extension source:
  `/\bFig\. \d/`, `/\bchapter \d/`, `/\bch\. \d/`, all case-sensitive so that a
  `Chapter 04 —` file-header comment is not a false positive. The file list is
  the static import graph reachable from the registries, so every part file is
  linted, not just `index.js`.
- Every `researchItem()` has a four-digit year (optionally a range) and one of
  `deployed` / `research` / `contested`, a non-empty name and a real body.
- Plus registry hygiene (unique ids, extensions targeting chapters that exist,
  every numbered chapter getting a number) and the standing section convention
  from `docs/AUTHORING.md`.

---

## Adding a per-figure check (5.2)

The universal invariants prove a figure is *well-behaved*. They cannot prove it
is *correct*. That is what these are for, and they are where the value is.

Export a `checks` array from the part file that builds the figure. The harness
walks the import graph from the registries, so it is discovered automatically:

```js
// js/chapters/attention/fig-worked-example.js
export const checks = [
  {
    fig:  '#fig-worked',            // CSS selector for the figure
    p:    0.5,                      // drive the figure here first
    name: 'A rows sum to 1',
    assert(root) {
      const A = readMatrix(root, '#a');
      for (const row of A) {
        const s = row.reduce((x, y) => x + y, 0);
        if (Math.abs(s - 1) > 1e-9) throw new Error(`row sums to ${s}, not 1`);
      }
    },
  },
];
```

- `fig` — selector for the element `assert` receives. A figure created with
  `figure(caption, node, { key: 'worked' })` gets `id="fig-worked"`; a scene
  gets the `id` passed to `createScene`.
- `p` — optional. If given, the harness finds the `pin()` / `createScene()`
  figure that contains (or is contained by) the target and sets its progress
  before asserting.
- `assert(root)` — **throw**, or return `false`, or return a string, to fail.
  Anything else passes.

`assert` must not import anything from `test/`. Chapter code is production
code, and production code must not depend on the harness — throw a plain
`Error`. Everything a reference computation needs is already in
`js/core/mathtools.js`, which is exactly where it should come from.

### The rule that makes this worth doing

> **Assert against a reference computation, never against a transcribed
> constant.**

`expect(cell).toBe(5.5)` passes forever, including after someone breaks
`matmul`. `expect(cell).toBe(reference(A, B)[1][0])` fails the moment the
figure and the math disagree — which is the only failure mode worth catching.

Better still, read the *inputs* off the figure too. Then the check does not
even know what numbers the example uses, so changing the example does not break
it, and only broken arithmetic does. Both shipped examples do this:

- **`test/checks/attention-worked.js`** reads Q, K and V out of the rendered
  grids, computes `attention(Q, K, V, 2)` with `js/core/mathtools.js`, and
  requires the rendered S and A to match — plus an exact causal mask and rows
  that sum to 1. Change one displayed cell of A and it fails with
  `A[0][0] displays 0.42 but softmax(S[0]) gives 1`.
- **`test/checks/vectors-dot.js`** parses the figure's own printed working
  (`= 4.00×2.00 + 1.00×3.00`) to learn what `a` and `b` are, then requires the
  printed `a·b`, the headline value, `|a|`, `|b|` and `|a||b|cos θ` to agree
  with `dot()` and `Math.hypot()`. Its tolerances are *derived* from the
  figure's own two-decimal display rounding rather than guessed, so it neither
  hides a real error nor trips on a rounding boundary.

Both live in `test/checks/` only because the harness may not edit `js/`.
`test/checks/index.js` exports `EXTRA_CHECKS`, which the harness merges — use
it for figures you do not own. **The normal home for a `checks` array is beside
the figure it checks**, so the two cannot drift apart.

---

## Files

| File | Role |
|---|---|
| `index.html` | the page: import map, real stylesheets, report panel, orchestration |
| `harness.js` | assertion library, registry-driven mount, module discovery, report |
| `shim-scroll.js` | the intercept that makes every figure's update function reachable |
| `snapshot.js` | DOM snapshot / diff / animated-attribute discovery |
| `invariants.js` | the eight universal invariants (5.1) |
| `content.js` | the content checks (5.3) |
| `figure-checks.js` | discovery and execution of per-figure `checks` (5.2) |
| `checks/` | worked examples of the per-figure mechanism |

### What a snapshot is

An array of strings, one per element in document order: tag, every attribute
sorted by name, and the text of elements with no element children. Attributes
are recorded wholesale rather than from a fixed list, so an attribute a figure
starts animating tomorrow is covered today; `animatedKeys()` derives which ones
actually move by diffing snapshots across a sweep.

Two normalizations, both deliberate: an absent `opacity` is recorded as
`opacity=1` (SVG's default, so setting it to `"1"` is not a change the reader
can see), and `.xref` leaves are collapsed to a token, because `resolveFigRefs()`
rewrites `Fig. __` into `Fig. 9.5` long after a figure is built and that is a
content operation, not an animation. Inline `style` is compared verbatim —
several figures animate through `node.style.transform`.
