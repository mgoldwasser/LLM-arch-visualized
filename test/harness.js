/* The runner: a tiny assertion library, a registry-driven mount, and the
   orchestration that sweeps every figure the registries produce.

   Zero dependencies, no build step — this is a plain ES module loaded by
   test/index.html and run in the browser, exactly like the site itself.

   Everything the harness works on is DERIVED, never listed:

     js/registry.js            → which chapters exist, and their numbers
     js/extensions/registry.js → which extensions exist, and their targets
     String(entry.load)        → the module URL of each chapter / extension
     static import graph       → every part file a chapter actually uses
     test/shim-scroll.js       → every pin() / createScene() / track() figure

   Add a chapter or a figure and it is covered on the next page load.        */

import { CHAPTERS, PARTS } from '../js/registry.js';
import { EXTENSIONS } from '../js/extensions/registry.js';
import { chNum, beginChapter, resolveFigRefs } from '../js/core/numbering.js';
import { CAPTURED, beginCapture, endCapture } from './shim-scroll.js';
import { serialize, digest } from './snapshot.js';

/* ---------------------------------------------------------------- results */

export const RESULTS = { passed: 0, failed: 0, total: 0, failures: [] };
export const LOG = [];                       // every test, pass or fail

let currentSuite = '';
let ctx = null;

class Ctx {
  constructor() { this.failures = []; }
  fail(detail) { this.failures.push(String(detail)); return false; }
  ok(cond, detail) { return cond ? true : this.fail(detail); }
  eq(a, b, detail) {
    return a === b ? true : this.fail(`${detail} — expected ${fmt(b)}, got ${fmt(a)}`);
  }
  close(a, b, eps, detail) {
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps) return true;
    return this.fail(`${detail} — expected ${fmt(b)} ±${eps}, got ${fmt(a)}`);
  }
  /* Every assertion helper returns a boolean so a check can bail early:
       if (!t.ok(grid, 'grid missing')) return; */
}

const fmt = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));

/* Run one test. `fn` receives an assertion context and may be async. A test
   passes when it neither throws nor records an assertion failure. */
export async function test(name, fn) {
  const t = new Ctx();
  ctx = t;
  let thrown = null;
  try {
    await fn(t);
  } catch (err) {
    thrown = err && err.stack ? `${err.message}\n${firstFrames(err.stack)}` : String(err);
  }
  ctx = null;
  RESULTS.total += 1;
  const details = thrown ? [thrown, ...t.failures] : t.failures;
  if (details.length === 0) {
    RESULTS.passed += 1;
    LOG.push({ suite: currentSuite, name, ok: true });
  } else {
    RESULTS.failed += 1;
    const detail = details.length === 1 ? details[0]
      : `${details[0]}   (+${details.length - 1} more)`;
    RESULTS.failures.push({ suite: currentSuite, name, detail });
    LOG.push({ suite: currentSuite, name, ok: false, detail, all: details });
  }
}

function firstFrames(stack) {
  return stack.split('\n').slice(1, 3).map((s) => s.trim()).join(' ');
}

export function suite(name) { currentSuite = name; }
export const skip = (name, why) => {
  LOG.push({ suite: currentSuite, name, ok: true, skipped: why });
};

/* ------------------------------------------------------- browser plumbing */

export const raf = () => new Promise((r) => requestAnimationFrame(r));
export const yieldToBrowser = () => new Promise((r) => setTimeout(r, 0));

export const SITE_ROOT = new URL('../', location.href);

/* ------------------------------------------------ registry-derived module URLs */

/* `load: () => import('./chapters/hero/index.js')` — the specifier is the only
   place the module path is written down, so read it back out of the function
   source rather than maintaining a second list. */
function loaderUrl(entry, base) {
  const m = /import\(\s*['"`]([^'"`]+)['"`]\s*\)/.exec(String(entry.load));
  return m ? new URL(m[1], base).href : null;
}

export const chapterUrl = (c) => loaderUrl(c, new URL('js/registry.js', SITE_ROOT));
export const extensionUrl = (e) => loaderUrl(e, new URL('js/extensions/registry.js', SITE_ROOT));

/* Three shapes cover every import in this codebase: `… from '…'`,
   `import('…')`, and a bare side-effect `import '…'`. */
const SPEC_RES = [
  /\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
];

/* Walk the static import graph from every chapter and extension entry point,
   staying inside js/chapters and js/extensions. Returns [{ url, src }] — the
   complete set of files that count as "chapter source" for the content
   checks, and the complete set of modules that may export `checks`. */
let sourceCache = null;
export function collectChapterSources() {
  sourceCache = sourceCache || fetchChapterSources();
  return sourceCache;
}

async function fetchChapterSources() {
  const roots = [
    ...CHAPTERS.map(chapterUrl),
    ...EXTENSIONS.map(extensionUrl),
  ].filter(Boolean);

  const seen = new Map();
  const queue = [...roots];
  const inScope = (u) => /\/js\/(chapters|extensions)\//.test(u);

  while (queue.length) {
    const url = queue.shift().split('#')[0];
    if (seen.has(url) || !inScope(url)) continue;
    let src;
    try {
      const res = await fetch(url);
      if (!res.ok) { seen.set(url, { url, src: null, error: `HTTP ${res.status}` }); continue; }
      src = await res.text();
    } catch (err) {
      seen.set(url, { url, src: null, error: String(err) });
      continue;
    }
    seen.set(url, { url, src });
    for (const re of SPEC_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        const spec = m[1];
        if (!spec || !spec.startsWith('.')) continue;
        queue.push(new URL(spec, url).href);
      }
    }
  }
  return [...seen.values()];
}

/* -------------------------------------------------------------- mounting */

export const MOUNTED = [];   // { c, node, err, figs, sig }

function figLabel(entry) {
  const el = entry.el;
  if (entry.kind === 'scene') {
    const sec = el.closest('.scene');
    if (sec && sec.id) return `scene ${sec.id}`;
  }
  const fig = el.querySelector('figure.fig');
  if (fig) {
    const n = fig.querySelector('.fig-n');
    const id = fig.id ? ` ${fig.id}` : '';
    return `${entry.kind} ${(n ? n.textContent.replace(/[—\s]+$/, '') : 'figure')}${id}`.trim();
  }
  return `${entry.kind} #${entry.index}`;
}

export async function mountAll(only) {
  const article = document.getElementById('article');
  for (const c of CHAPTERS) {
    if (only && !only.has(c.id)) continue;
    const ctxArg = { id: c.id, num: chNum(c.id), title: c.title };
    const from = beginCapture(c.id);
    const rec = { c, node: null, err: null, figs: [], sig: null, extErrors: [] };
    try {
      const mod = await c.load();
      beginChapter(c.id);
      const node = await mod.render(ctxArg);
      /* Serialized immediately, before the node is attached and before the
         scroll engine can touch it — this is the baseline that the
         determinism suite compares a second render against. */
      rec.sig = serialize(node);
      rec.node = node;
      article.append(node);
      for (const ext of EXTENSIONS.filter((e) => e.target === c.id)) {
        try {
          const m = await ext.load();
          const n = await m.render(ctxArg);
          const at = ext.anchor && node.querySelector(ext.anchor);
          if (at) at.after(n); else node.append(n);
        } catch (err) {
          rec.extErrors.push({ url: extensionUrl(ext), err });
        }
      }
    } catch (err) {
      rec.err = err;
    }
    rec.figs = endCapture(from);
    MOUNTED.push(rec);
    await yieldToBrowser();
  }
  resolveFigRefs();
  return MOUNTED;
}

/* Every captured figure, with a stable human label. Derived purely from what
   the registries mounted — nothing here names a chapter or a figure. */
export function figures() {
  return CAPTURED.filter((e) => !e.throwaway).map((e) => ({ ...e, label: figLabel(e) }));
}

/* -------------------------------------------------------- sweep utilities */

/* Set a figure's progress. Synchronous: the callback the scroll engine was
   handed is invoked directly, so a snapshot taken on the next line cannot
   race a requestAnimationFrame.

   One argument only, deliberately. The harness holds the callback that
   trackScene()/pin() received — for a scene that is createScene's own
   wrapper, which derives stepIdx and stepP from p and forwards them to the
   figure's update. Driving it with p alone therefore exercises exactly the
   code path a real scroll does. */
export function setP(fig, p) {
  fig.cb(p);
}

export const sweepPoints = (n = 41) =>
  Array.from({ length: n }, (_, i) => i / (n - 1));

/* --------------------------------------------------------------- reporting */

export function finish() {
  window.__TEST_RESULTS__ = {
    passed: RESULTS.passed,
    failed: RESULTS.failed,
    total: RESULTS.total,
    failures: RESULTS.failures,
    /* extras — the four keys above are the contract; these are convenience */
    viewport: { w: window.innerWidth, h: window.innerHeight },
    figures: figures().length,
    chapters: MOUNTED.length,
  };
  window.__TEST_DONE__ = true;
  return window.__TEST_RESULTS__;
}

export function domDigest() {
  return digest(serialize(document.getElementById('article')));
}

/* Start over — used when an external driver resizes the viewport and re-runs
   a suite, so the second run reports its own numbers rather than the sum. */
export function resetResults() {
  RESULTS.passed = RESULTS.failed = RESULTS.total = 0;
  RESULTS.failures.length = 0;
  LOG.length = 0;
  window.__TEST_DONE__ = false;
}

/* --------------------------------------------------------------- the page */

let statusEl = null;
let bodyEl = null;

export function mountReport() {
  const panel = document.createElement('div');
  panel.id = 'report';
  panel.innerHTML = `
    <div class="r-head">
      <strong>Test harness</strong>
      <span class="r-vp"></span>
      <button type="button" class="r-toggle" aria-expanded="true">hide</button>
    </div>
    <div class="r-status">booting…</div>
    <div class="r-body"></div>`;
  document.body.prepend(panel);
  panel.querySelector('.r-vp').textContent = `${window.innerWidth}×${window.innerHeight}`;
  const toggle = panel.querySelector('.r-toggle');
  toggle.addEventListener('click', () => {
    const hidden = panel.classList.toggle('collapsed');
    toggle.textContent = hidden ? 'show' : 'hide';
    toggle.setAttribute('aria-expanded', String(!hidden));
  });
  statusEl = panel.querySelector('.r-status');
  bodyEl = panel.querySelector('.r-body');
  return panel;
}

export function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function renderReport() {
  if (!bodyEl) return;
  const bySuite = new Map();
  for (const r of LOG) {
    if (!bySuite.has(r.suite)) bySuite.set(r.suite, []);
    bySuite.get(r.suite).push(r);
  }
  const out = [];
  const verdict = RESULTS.failed === 0 ? 'pass' : 'fail';
  out.push(`<div class="r-verdict r-${verdict}">
      ${RESULTS.failed === 0 ? 'ALL PASS' : `${RESULTS.failed} FAILED`}
      <span>${RESULTS.passed} passed · ${RESULTS.total} total · ${figures().length} figures · ${MOUNTED.length} chapters</span>
    </div>`);

  for (const [name, rows] of bySuite) {
    const bad = rows.filter((r) => !r.ok);
    out.push(`<details class="r-suite ${bad.length ? 'has-fail' : ''}" ${bad.length ? 'open' : ''}>
      <summary><span class="r-n">${rows.length - bad.length}/${rows.length}</span> ${esc(name)}</summary>`);
    for (const r of rows) {
      if (r.ok) {
        out.push(`<div class="r-row r-ok">${esc(r.name)}</div>`);
      } else {
        const all = (r.all || [r.detail]).map((d) => `<div class="r-detail">${esc(d)}</div>`).join('');
        out.push(`<div class="r-row r-bad"><div class="r-name">${esc(r.name)}</div>${all}</div>`);
      }
    }
    out.push('</details>');
  }
  bodyEl.innerHTML = out.join('');
}

export { PARTS };
