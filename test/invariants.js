/* The eight universal invariants — plan section 5.1.

   Every one of these is derived from the registries: no chapter, figure or
   scene is named anywhere in this file. A figure registered through pin(),
   createScene() or track() is swept the moment it exists.

   What each invariant actually catches is documented in test/README.md.     */

import { test, suite, setP, sweepPoints, figures, MOUNTED, chapterUrl, yieldToBrowser } from './harness.js';
import { snapshot, diff, nodeList, animatedKeys, serialize } from './snapshot.js';
import { beginChapter, chNum } from '../js/core/numbering.js';
import { beginCapture, endCapture, CAPTURED } from './shim-scroll.js';

const name = (fig) => `${fig.chapterId} · ${fig.label}`;

/* Progress values probed by the idempotence check. Deliberately includes both
   endpoints and values that fall inside, on, and outside typical seg()
   windows. */
const PROBES = [0, 0.11, 0.25, 0.37, 0.5, 0.63, 0.79, 1];

/* -------------------------------------------------- 1. idempotence -------- */

export async function idempotence(figs) {
  suite('5.1.1 idempotence');
  for (const fig of figs) {
    await test(name(fig), (t) => {
      for (const p of PROBES) {
        setP(fig, p);
        const first = snapshot(fig.el);
        /* Disturb hard: two other progress values, one either side. */
        setP(fig, p < 0.5 ? 0.93 : 0.07);
        setP(fig, p < 0.5 ? 0.41 : 0.58);
        setP(fig, p);
        const again = snapshot(fig.el);
        const d = diff(first, again, fig.el, 'first visit', 'revisit');
        if (d && !t.fail(`p=${p} is not idempotent — ${d}`)) return;
      }
    });
    await yieldToBrowser();
  }
}

/* -------------------------------------------------- 2. reversibility ------ */

export async function reversibility(figs, steps = 41) {
  suite('5.1.2 reversibility');
  const ps = sweepPoints(steps);
  for (const fig of figs) {
    await test(name(fig), (t) => {
      const forward = [];
      for (const p of ps) { setP(fig, p); forward.push(snapshot(fig.el)); }
      const back = new Array(ps.length);
      for (let i = ps.length - 1; i >= 0; i--) { setP(fig, ps[i]); back[i] = snapshot(fig.el); }
      for (let i = 0; i < ps.length; i++) {
        const d = diff(forward[i], back[i], fig.el, 'scrolling down', 'scrolling back up');
        if (d) { t.fail(`p=${ps[i].toFixed(3)} does not rewind — ${d}`); return; }
      }
    });
    await yieldToBrowser();
  }
}

/* Does the figure move at all? A scroll-driven figure whose DOM is identical
   at every p is either static (and should not be pinned) or wired to a
   callback that never runs. */
export async function respondsToProgress(figs) {
  suite('5.1 · responds to progress');
  for (const fig of figs) {
    await test(name(fig), (t) => {
      const snaps = sweepPoints(9).map((p) => { setP(fig, p); return snapshot(fig.el); });
      const keys = animatedKeys(snaps);
      t.ok(keys.length > 0,
        'nothing in this figure changes across a full 0→1 sweep — it is pinned or tracked but not animated');
      fig.animates = keys;
    });
  }
}

/* -------------------------------------------------- 3. endpoint stability - */

/* Compared against the ARTWORK only (.pin-stick / .scene-sticky), not the
   whole track. A scene marking its first step card `.active` at p=0 is the
   correct opening state, not a jump; the figure's own attributes are the
   claim being tested. */
export async function endpointStability(figs) {
  suite('5.1.3 endpoint stability');
  for (const fig of figs) {
    await test(name(fig), (t) => {
      setP(fig, 0);
      const atZero = snapshot(fig.art);
      const d = diff(fig.initialArt, atZero, fig.art, 'as built', 'p=0');
      t.ok(!d, `the figure changes between the DOM it was built with and p=0, so it can flash `
        + `the wrong state before the reader reaches it — ${d}`
        + '\n  fix: build the element with the value the update function assigns at p=0');
    });
  }
}

/* -------------------------------------------------- 4. no NaN / undefined - */

const BAD_ATTR = /(^|[^A-Za-z0-9_])(NaN|undefined|Infinity|null)([^A-Za-z0-9_]|$)/;
const BAD_TEXT = /(^|[^A-Za-z0-9_])(NaN|undefined)([^A-Za-z0-9_]|$)/;

/* Attributes that never carry prose, so a stray keyword in them is always a
   computation that went wrong rather than an English word. */
function scanForGarbage(root) {
  const out = [];
  const nodes = nodeList(root);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    for (const a of n.attributes) {
      if (a.name === 'aria-label' || a.name === 'title') continue;
      if (BAD_ATTR.test(a.value)) out.push(`<${n.tagName} ${a.name}="${trunc(a.value)}">`);
    }
    if (!n.firstElementChild && BAD_TEXT.test(n.textContent)) {
      out.push(`<${n.tagName}> text "${trunc(n.textContent)}"`);
    }
  }
  return out;
}
const trunc = (s) => (s.length > 70 ? s.slice(0, 70) + '…' : s);

export async function noGarbageValues(figs, steps = 41) {
  suite('5.1.4 no NaN / undefined');
  const ps = sweepPoints(steps);
  for (const fig of figs) {
    await test(name(fig), (t) => {
      for (const p of ps) {
        setP(fig, p);
        const bad = scanForGarbage(fig.el);
        if (bad.length) {
          t.fail(`p=${p.toFixed(3)} produced ${bad.length} bad value(s): ${bad.slice(0, 3).join('; ')}`);
          return;
        }
      }
    });
    await yieldToBrowser();
  }
}

/* -------------------------------------------------- 5. no layout escape --- */

/* getBBox() reports a box in the element's OWN user space, which ignores every
   transform on the way up — so a <g transform="translate(900 0)"> full of
   in-bounds children would pass. Client rects are measured after all
   transforms, and because the site's CSS gives every figure `width: 100%;
   height: auto`, the <svg> element's client rect is exactly its viewBox. */
const SKIP_SUBTREE = new Set(['defs', 'marker', 'clipPath', 'mask', 'pattern', 'symbol', 'linearGradient', 'radialGradient', 'filter']);

function effectivelyInvisible(node, stop) {
  for (let n = node; n && n !== stop.parentElement; n = n.parentElement) {
    const o = n.getAttribute && n.getAttribute('opacity');
    if (o != null && parseFloat(o) <= 0.02) return true;
    const so = n.style && n.style.opacity;
    if (so !== '' && so != null && parseFloat(so) <= 0.02) return true;
    if (n.style && (n.style.display === 'none' || n.style.visibility === 'hidden')) return true;
    if (n === stop) break;
  }
  return false;
}

function escapes(svgEl, tolPx) {
  const box = svgEl.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return [];      // not laid out
  const out = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (SKIP_SUBTREE.has(child.tagName)) continue;
      /* Escape hatch, and deliberately an explicit one: a figure whose whole
         point is content leaving the frame (a continuous zoom-out, a ribbon
         scrolling past a window) marks the group `data-allow-overflow`. An
         author has to write it down, so silence is a decision rather than an
         accident. */
      if (child.hasAttribute('data-allow-overflow')) continue;
      if (child.children.length) { walk(child); continue; }
      if (effectivelyInvisible(child, svgEl)) continue;
      const r = child.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const dx = Math.max(box.left - r.left, r.right - box.right);
      const dy = Math.max(box.top - r.top, r.bottom - box.bottom);
      const over = Math.max(dx, dy);
      if (over > tolPx) out.push({ tag: child.tagName, over: Math.round(over) });
    }
  };
  walk(svgEl);
  return out;
}

export async function noLayoutEscape(figs, samples = 7) {
  suite('5.1.5 no layout escape');
  for (const fig of figs) {
    await test(name(fig), (t) => {
      const roots = [...fig.el.querySelectorAll('svg')]
        .filter((s) => s.hasAttribute('viewBox') && !s.hasAttribute('data-allow-overflow'));
      if (!roots.length) return;                       // nothing to bound
      for (const p of sweepPoints(samples)) {
        setP(fig, p);
        for (const svgEl of roots) {
          /* Tolerance in CSS pixels, scaled from 2 viewBox units so a figure
             drawn at 720 units wide is judged the same whether it is rendered
             at 340px or 1100px. */
          const vb = svgEl.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
          const scale = svgEl.getBoundingClientRect().width / (vb[2] || 1);
          const bad = escapes(svgEl, TOLERANCE_UNITS * (scale || 1));
          if (bad.length) {
            const worst = bad.sort((a, b) => b.over - a.over).slice(0, 3)
              .map((b) => `<${b.tag}> +${b.over}px`).join(', ');
            t.fail(`p=${p.toFixed(2)}: ${bad.length} element(s) render outside the viewBox — ${worst}`);
            return;
          }
        }
      }
    });
    await yieldToBrowser();
  }
}
export const TOLERANCE_UNITS = 2;

/* -------------------------------------------------- 6. accessibility ------ */

const NATIVE_CONTROL = 'button, input, select, textarea, summary, a[href], label';

export async function accessibility() {
  suite('5.1.6 accessibility');
  const article = document.getElementById('article');

  /* Every svgRoot: role="img" + a non-empty aria-label. Roots only — a nested
     <svg> is rare here, and decorative inner marks are covered by the root's
     description. */
  const roots = [...article.querySelectorAll('svg')]
    .filter((s) => !s.parentElement.closest('svg'));
  for (const s of roots) {
    const owner = s.closest('.chapter');
    const fig = s.closest('figure.fig, .widget, .scene');
    const where = `${owner ? owner.id : '?'} · ${describe(fig || s)}`;
    await test(`svgRoot has role and label — ${where}`, (t) => {
      const hidden = s.getAttribute('aria-hidden') === 'true';
      if (hidden) return;                     // explicitly decorative: fine
      t.eq(s.getAttribute('role'), 'img', 'role');
      const label = (s.getAttribute('aria-label') || '').trim();
      t.ok(label.length > 0, 'aria-label is missing or empty');
    });
  }

  /* Widget controls must be real controls: keyboard focus and Enter/Space
     come free from <button> and <input> and from nothing else. */
  for (const w of article.querySelectorAll('.widget')) {
    const where = `${w.closest('.chapter') ? w.closest('.chapter').id : '?'} · ${describe(w)}`;
    await test(`widget controls are native elements — ${where}`, (t) => {
      const body = w.querySelector('.w-body') || w;
      const controls = body.querySelectorAll(NATIVE_CONTROL);
      t.ok(controls.length > 0, 'widget exposes no <button>/<input> control at all');
      const fakes = [];
      for (const n of body.querySelectorAll('*')) {
        if (n.matches(NATIVE_CONTROL) || n.closest(NATIVE_CONTROL)) continue;
        const looksClickable = n.hasAttribute('tabindex')
          || n.getAttribute('role') === 'button'
          || getComputedStyle(n).cursor === 'pointer';
        if (looksClickable) fakes.push(`<${n.tagName.toLowerCase()}${n.className ? ` class="${String(n.className).slice(0, 40)}"` : ''}>`);
      }
      t.ok(fakes.length === 0,
        `${fakes.length} clickable-looking non-control element(s): ${[...new Set(fakes)].slice(0, 3).join(', ')}`);
    });
  }
}

function describe(node) {
  if (!node) return '?';
  const n = node.querySelector && node.querySelector('.fig-n');
  if (n) return n.textContent.replace(/[—\s]+$/, '').trim();
  const wt = node.querySelector && node.querySelector('.w-title');
  if (wt) return wt.textContent.trim();
  return node.id || node.tagName.toLowerCase();
}

/* -------------------------------------------------- 7. determinism -------- */

/* Render every chapter a second time, into a detached container, and compare
   with the serialization taken the instant the first render returned. An
   unseeded Math.random(), a Date.now(), or a module-level counter that leaks
   between renders all show up here. */
export async function determinism() {
  suite('5.1.7 determinism across renders');
  for (const rec of MOUNTED) {
    if (rec.err || !rec.sig) { continue; }
    await test(`${rec.c.id}`, async (t) => {
      const from = beginCapture(`${rec.c.id}:determinism`);
      let second;
      try {
        const mod = await import(chapterUrl(rec.c));
        beginChapter(rec.c.id);
        second = await mod.render({ id: rec.c.id, num: chNum(rec.c.id), title: rec.c.title });
      } finally {
        /* Figures registered by the throwaway render must not be swept. */
        for (const e of endCapture(from)) e.throwaway = true;
      }
      const a = rec.sig.split('\n');
      const b = serialize(second).split('\n');
      if (a.length !== b.length) {
        t.fail(`second render produced ${b.length} nodes, first produced ${a.length}`);
        return;
      }
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          t.fail(`node #${i} differs between two renders — look for an unseeded Math.random(), a Date, or module-level state`
            + `\n  render 1: ${trunc(a[i].replace(/[\u001e\u001f]/g, ' '))}`
            + `\n  render 2: ${trunc(b[i].replace(/[\u001e\u001f]/g, ' '))}`);
          return;
        }
      }
    });
    await yieldToBrowser();
  }
}

/* -------------------------------------------------- 8. layout invariants -- */

export const LAYOUT = {
  /* A card counts as visible once it is this opaque. Below it the reader
     cannot read it, so passing behind the artwork is by design (that is
     exactly what scene.js's fadeCards() is for). */
  visibleOpacity: 0.08,
  /* Fraction of a visible card's area allowed to sit over the figure. */
  maxOverlapFraction: 0.02,
  /* Max over cards of (opacity × fraction of the card on screen). Below this
     the reader is looking at neither a card nor a legible one. */
  presenceFloor: 0.35,
  /* Minimum scrub travel, as a fraction of the viewport height. */
  minScrubVh: 0.25,
  /* Scroll positions sampled per scene. */
  samples: 15,
  /* Settle time after each scroll, in ms (CSS transitions on .step-card). */
  settleMs: 40,
};

const raf = () => new Promise((r) => requestAnimationFrame(r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* `behavior: 'instant'` is load-bearing: base.css sets
   `html { scroll-behavior: smooth }`, so a plain window.scrollTo(0, y)
   ANIMATES, and two frames later the page has moved about seventeen pixels
   toward a target thousands of pixels away. Every measurement would then be
   taken at the wrong scroll position — and, worse, would look plausible.

   Then two frames to let the scroll engine's rAF run and the layout settle,
   then a beat for the CSS opacity transition on .step-card, which is what the
   presence score reads. Without the beat a card caught mid-transition scores
   as half-there and the test flaps. */
async function scrollTo(y) {
  window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  await raf();
  await raf();
  await sleep(LAYOUT.settleMs);
  return Math.abs(window.scrollY - y) < 2 || y > document.documentElement.scrollHeight - window.innerHeight - 2;
}

function rectArea(r) { return Math.max(0, r.width) * Math.max(0, r.height); }
function intersect(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}
function onScreenFraction(r) {
  const vh = window.innerHeight;
  const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
  return r.height > 0 ? Math.max(0, Math.min(1, visible / r.height)) : 0;
}

/* Runs at whatever viewport the browser currently has. A page cannot resize
   itself, so an external driver sets the viewport and calls this again — see
   test/README.md. */
export async function layoutInvariants(figs) {
  const vp = `${window.innerWidth}×${window.innerHeight}`;
  suite(`5.1.8 layout @ ${vp}`);

  for (const fig of figs) {
    if (fig.kind === 'track') continue;                 // no pinning contract
    const trackEl = fig.el;
    const stickyEl = trackEl.querySelector('.scene-sticky, .pin-stick');
    if (!stickyEl) continue;
    const cards = [...trackEl.querySelectorAll('.step-card')];

    await test(`${name(fig)} — scrub range`, (t) => {
      const travel = trackEl.offsetHeight - window.innerHeight;
      const pinned = getComputedStyle(stickyEl).position === 'sticky';
      if (!pinned) return;                              // short-viewport fallback
      t.ok(travel >= LAYOUT.minScrubVh * window.innerHeight,
        `only ${Math.round(travel)}px of scrub travel at ${vp}`
        + ` (floor ${Math.round(LAYOUT.minScrubVh * window.innerHeight)}px) — the animation plays in a flick`);
    });

    if (!cards.length) continue;

    /* One scroll sweep, two verdicts. Scrolling is by far the most expensive
       thing the harness does — every position costs two frames plus a settle
       — so overlap and presence are measured in the same pass. */
    const m = await measureScene(trackEl, stickyEl, cards);

    await test(`${name(fig)} — cards never cover the figure`, (t) => {
      if (!t.ok(m.landed, 'the page did not reach the scroll positions asked for, so nothing was measured')) return;
      t.ok(m.worstOverlap <= LAYOUT.maxOverlapFraction,
        `at p≈${m.overlapAt.toFixed(2)} a readable card ("${m.overlapCard}") covers `
        + `${(m.worstOverlap * 100).toFixed(0)}% of its own area with the pinned figure `
        + `(ceiling ${(LAYOUT.maxOverlapFraction * 100).toFixed(0)}%)`);
    });

    await test(`${name(fig)} — a card is always present`, (t) => {
      t.ok(m.worstPresence >= LAYOUT.presenceFloor,
        `best card presence falls to ${m.worstPresence.toFixed(2)} at p≈${m.presenceAt.toFixed(2)} `
        + `(floor ${LAYOUT.presenceFloor}) — the reader is left with no legible card`);
    });
    await yieldToBrowser();
  }
  await scrollTo(0);
}

async function measureScene(trackEl, stickyEl, cards) {
  const top = trackEl.getBoundingClientRect().top + window.scrollY;
  const travel = Math.max(1, trackEl.offsetHeight - window.innerHeight);
  const m = {
    worstOverlap: 0, overlapAt: 0, overlapCard: '',
    worstPresence: 1, presenceAt: 0,
    landed: true,
  };
  for (let i = 0; i < LAYOUT.samples; i++) {
    const p = i / (LAYOUT.samples - 1);
    if (!await scrollTo(top + travel * p)) m.landed = false;
    const figRect = (stickyEl.querySelector('.fig-canvas') || stickyEl).getBoundingClientRect();
    let best = 0;
    for (const c of cards) {
      const op = parseFloat(getComputedStyle(c).opacity);
      const r = c.getBoundingClientRect();
      const area = rectArea(r);
      best = Math.max(best, op * onScreenFraction(r));
      if (!area || !(op > LAYOUT.visibleOpacity)) continue;
      const frac = intersect(r, figRect) / area;
      if (frac > m.worstOverlap) {
        m.worstOverlap = frac;
        m.overlapAt = p;
        m.overlapCard = (c.querySelector('.step-n') || c).textContent.trim().slice(0, 40);
      }
    }
    /* The first and last sample are the run-in and run-out, where the scene
       is half off-screen by design; presence is only owed in between. */
    if (i > 0 && i < LAYOUT.samples - 1 && best < m.worstPresence) {
      m.worstPresence = best;
      m.presenceAt = p;
    }
  }
  return m;
}

/* ------------------------------------------------------------ the sweep --- */

export async function runUniversalInvariants({ layout = true } = {}) {
  const figs = figures();
  await respondsToProgress(figs);
  await idempotence(figs);
  await reversibility(figs);
  await endpointStability(figs);
  await noGarbageValues(figs);
  await noLayoutEscape(figs);
  await accessibility();
  await determinism();
  if (layout) await layoutInvariants(figures());
  return figs;
}

export { CAPTURED };
