/* Per-figure assertions — plan section 5.2. The mechanism, not the checks.

   THE CONTRACT
   ------------
   Any module a chapter imports — the part file that builds the figure is the
   natural home — may export a `checks` array:

       export const checks = [
         {
           fig:    '#fig-worked',        // CSS selector for the figure
           p:      0.5,                  // progress to drive it to first
           name:   'A rows sum to 1',
           assert: (root) => { … },      // throw, or return false, to fail
         },
       ];

   The harness discovers these by walking the static import graph from every
   registry entry and importing each module — so a check added to a part file
   runs on the next page load with nothing else to register.

   `assert(root)` receives the element `fig` matched. It may:
     • throw            → fail, with the thrown message
     • return false     → fail
     • return a string  → fail, with that string as the reason
     • return anything else (including undefined) → pass

   Assertions must not import anything from test/ — chapter code is production
   code, and production code must not depend on the harness. Throw a plain
   Error. The helpers you need (softmax, matmul, attention, dot) already live
   in js/core/mathtools.js, which is exactly where a reference computation
   should come from.

   THE RULE THAT MAKES THIS WORTH DOING
   ------------------------------------
   Assert against a reference computation, never against a transcribed
   constant. See test/README.md.

   FOR FIGURES YOU DO NOT WANT TO TOUCH
   ------------------------------------
   test/checks/index.js exports EXTRA_CHECKS in the same shape, merged in
   below. That is where the harness's own worked examples live.              */

import { test, suite, setP, figures, collectChapterSources, SITE_ROOT } from './harness.js';
import { EXTRA_CHECKS } from './checks/index.js';

export async function collectFigureChecks() {
  const found = [];
  for (const { url, src } of await collectChapterSources()) {
    if (src == null || !/\bchecks\b/.test(src)) continue;    // cheap pre-filter
    let mod;
    try {
      mod = await import(url);
    } catch {
      continue;                     // a module that fails to import is already
    }                               // reported by the mount suite
    if (Array.isArray(mod.checks)) {
      for (const c of mod.checks) found.push({ ...c, source: url.replace(SITE_ROOT.href, '') });
    }
  }
  for (const c of EXTRA_CHECKS) found.push({ ...c, source: c.source || 'test/checks' });
  return found;
}

/* The figure whose update function drives `root`. Pins wrap their figure, so
   the captured element contains the target; scenes are the other way round —
   the captured element is the .scene-track inside the <section> a check
   selects. Both are accepted. */
function driverFor(root, figs) {
  return figs.find((f) => f.el.contains(root))
      || figs.find((f) => root.contains(f.el));
}

export async function runFigureChecks() {
  suite('5.2 per-figure assertions');
  const checks = await collectFigureChecks();
  const figs = figures();

  await test('per-figure checks were discovered', (t) => {
    t.ok(checks.length > 0,
      'no module exported a `checks` array — see the contract at the top of test/figure-checks.js');
  });

  for (const c of checks) {
    const label = `${c.source} · ${c.name || c.fig}`;
    await test(label, (t) => {
      const root = document.querySelector(c.fig);
      if (!t.ok(root, `no element matches ${JSON.stringify(c.fig)} — the figure did not render`)) return;
      if (typeof c.p === 'number') {
        const driver = driverFor(root, figs);
        if (!t.ok(driver,
          `${JSON.stringify(c.fig)} is not inside (or around) any pin()/createScene() figure, `
          + 'so there is no progress to set — drop `p`, or point `fig` at the animated figure')) return;
        setP(driver, c.p);
      }
      let result;
      try {
        result = c.assert(root);
      } catch (err) {
        t.fail(`${err && err.message ? err.message : String(err)}`);
        return;
      }
      if (result === false) t.fail('assert() returned false');
      else if (typeof result === 'string') t.fail(result);
    });
  }
}
