/* Scroll engine — one passive scroll listener + one rAF loop drives
   every scroll-linked animation on the page.

   API:
     track(el, cb)        cb(p) with p = progress of el through the viewport,
                          0 = el top at viewport bottom, 1 = el bottom at top.
                          Fires only while el is within one viewport of view.
     trackScene(el, cb)   cb(p) with p = progress through a TALL wrapper whose
                          child is sticky: 0 when wrapper top hits viewport
                          top, 1 when wrapper bottom hits viewport bottom.
     reveal(el)           adds .in class when el enters the viewport.
     onScrollY(cb)        cb(scrollY, docProgress) every frame the page moved.
*/

import { clamp } from './anim.js';
import { el } from './dom.js';

const tracked = [];   // { el, cb, mode }
const yWatchers = [];
let ticking = false;
let lastY = -1;

function measure(entry, vh) {
  const r = entry.el.getBoundingClientRect();
  if (entry.mode === 'scene') {
    // progress through the scrollable extent of a sticky wrapper
    const total = r.height - vh;
    if (total <= 0) return r.top < 0 ? 1 : 0;
    return clamp(-r.top / total);
  }
  // viewport transit: 0 at enter-bottom, 1 at exit-top
  return clamp((vh - r.top) / (vh + r.height));
}

function frame() {
  ticking = false;
  const y = window.scrollY;
  if (y === lastY && !forceNext) return;
  forceNext = false;
  lastY = y;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const docP = clamp(y / Math.max(1, doc.scrollHeight - vh));
  for (const cb of yWatchers) cb(y, docP);
  for (const entry of tracked) {
    const r = entry.el.getBoundingClientRect();
    // skip work when far off-screen, but always deliver terminal values once
    const near = r.bottom > -vh && r.top < vh * 2;
    if (!near && entry.settled) continue;
    const p = measure(entry, vh);
    if (p !== entry.last) {
      entry.last = p;
      entry.cb(p);
    }
    entry.settled = !near;
  }
}

let forceNext = false;
function schedule() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(frame);
  }
}

export function refresh() {
  forceNext = true;
  // Drop the memoized progress too. A resize can leave p unchanged while the
  // geometry underneath it moved — a scene's cards are laid out against the
  // new viewport but were last painted against the old one — and the
  // `p !== entry.last` guard would otherwise skip the repaint until the
  // reader happens to scroll.
  for (const entry of tracked) entry.last = -1;
  schedule();
}

window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', refresh);

export function track(el, cb) {
  tracked.push({ el, cb, mode: 'transit', last: -1, settled: false });
  refresh();
}

export function trackScene(el, cb) {
  tracked.push({ el, cb, mode: 'scene', last: -1, settled: false });
  refresh();
}

export function onScrollY(cb) {
  yWatchers.push(cb);
  refresh();
}

/* Pin a standalone figure to the middle of the viewport and scrub its
   animation while the reader scrolls past it — the same feel as a
   createScene() sticky figure, but without step cards.

     return pin(node, (p) => { ...set attributes from p... });

   The figure is wrapped in a tall track; it sticks, centred, for the whole
   of it, and p runs 0..1 across the travel. `extent` is the track height in
   vh, so travel = extent − 100vh (190 → about one screen of scrubbing).

   Returns the WRAPPER — insert that into the chapter, not the figure. */
export function pin(node, cb, { extent = 190 } = {}) {
  const stick = el('div', { class: 'pin-stick' }, node);
  const wrap = el('div', { class: 'pin-track', style: { height: `${extent}vh` } }, stick);
  trackScene(wrap, cb);
  return wrap;
}

/* Reveal-on-enter, via IntersectionObserver (cheap, one-shot). */
const revealer = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          revealer.unobserve(e.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px' })
  : null;

export function reveal(el) {
  el.classList.add('reveal');
  if (revealer) revealer.observe(el);
  else el.classList.add('in');
  return el;
}
