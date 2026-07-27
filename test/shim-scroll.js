/* Test-only stand-in for js/core/scroll.js.

   HOW THIS IS INSTALLED — and why it needs no production change.

   Every scroll-driven figure in the book reaches the scroll engine through one
   of three calls in js/core/scroll.js:

       pin(node, cb, opts)     a standalone scrubbed figure
       trackScene(el, cb)      a createScene() sticky figure
       track(el, cb)           a figure animated as it transits the viewport

   The update function `cb` is a closure. It is never exported, never stored on
   the DOM node, and nothing in the codebase hands it back to a caller — so a
   test page cannot reach it by inspecting the rendered document.

   test/index.html therefore ships an import map that rewrites
   "/js/core/scroll.js" to this file. Chapter modules import it by relative
   path ("../../core/scroll.js"), which resolves to that same absolute URL, so
   every chapter and extension in the book gets this module instead — with no
   edit to js/, no bundler, and no build step. The real module is still loaded
   here, under a URL with a query string so the import map does not match it,
   and every registration is forwarded to it. The page therefore behaves
   exactly like production; this module only *also* keeps a reference.

   Two deliberate test-environment differences, both documented in test/README:

   1. reveal() adds `.in` immediately instead of waiting for an
      IntersectionObserver. Un-revealed content is `opacity: 0`, which would
      make bounding-box and layout measurements meaningless for any figure
      that happens to be off-screen when a suite runs.
   2. The initial DOM snapshot of every figure is taken here, synchronously,
      at registration time — before the scroll engine has ever called the
      update function. That is the "pre-scroll initial render" that invariant
      3 (endpoint stability) compares against, and it can only be captured at
      this exact moment.                                                      */

import * as real from '../js/core/scroll.js?harness-passthrough=1';
import { snapshot } from './snapshot.js';

export const CAPTURED = [];

let currentChapter = null;

/* The harness brackets each chapter mount with these so every figure is
   attributed to the chapter (or extension) that registered it. */
export function beginCapture(chapterId) {
  currentChapter = chapterId;
  return CAPTURED.length;
}
export function endCapture(from) {
  currentChapter = null;
  return CAPTURED.slice(from);
}

function record(kind, el, cb) {
  /* The artwork alone, without the step cards that travel past it. Endpoint
     stability is a claim about the figure — a scene marking its first step
     card `.active` at p=0 is the correct opening state, not a jump. */
  const art = el.querySelector('.scene-sticky, .pin-stick') || el;
  CAPTURED.push({
    kind,
    el,
    art,
    cb,
    chapterId: currentChapter,
    /* Captured before the engine has ever run cb — see note 2 above. */
    initial: snapshot(el),
    initialArt: snapshot(art),
    index: CAPTURED.length,
  });
  return CAPTURED[CAPTURED.length - 1];
}

export function track(el, cb) {
  record('track', el, cb);
  return real.track(el, cb);
}

export function trackScene(el, cb) {
  record('scene', el, cb);
  return real.trackScene(el, cb);
}

export function pin(node, cb, opts) {
  const wrap = real.pin(node, cb, opts);
  record('pin', wrap, cb);
  return wrap;
}

export function reveal(el) {
  const r = real.reveal(el);
  el.classList.add('in');
  return r;
}

export const refresh = real.refresh;
export const onScrollY = real.onScrollY;
