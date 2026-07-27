/* Scrollytelling scene — a pinned figure that animates while step-cards
   of prose scroll past it. The workhorse layout of the whole site.

   createScene({
     id: 'attention-steps',
     steps: [ { n:'STEP 1 / 5 — PROJECT', html:'<p>…</p>' }, … ],
     figure: (canvas) => update,   // build the SVG inside `canvas`
                                   // return update(p, stepIdx, stepP)
     cols: true,                   // side-by-side on desktop (default true)
     stepVh: 88,                   // min-height per step, in vh
   }) → DOM node

   update() receives:
     p       overall scene progress 0..1
     stepIdx index of the active step
     stepP   progress 0..1 *within* the active step's window
*/

import { el } from './dom.js';
import { trackScene } from './scroll.js';
import { clamp } from './anim.js';

export function createScene({ id, steps, figure, cols = true, stepVh }) {
  const canvas = el('div', { class: 'fig-canvas' });
  const sticky = el('div', { class: 'scene-sticky' }, canvas);

  const stepEls = steps.map((s, i) =>
    el('div', { class: 'scene-step', dataset: { step: i }, style: stepVh ? { minHeight: stepVh + 'vh' } : null },
      el('div', { class: 'step-card' },
        s.n ? el('div', { class: 'step-n' }, s.n) : null,
        el('div', { class: 'step-body', html: s.html })))
  );
  const stepsCol = el('div', { class: 'scene-steps' }, stepEls);

  const track = cols
    ? el('div', { class: 'scene-track scene-cols' }, stepsCol, sticky)
    : el('div', { class: 'scene-track' }, sticky, stepsCol);

  const root = el('section', { class: 'scene wide', id }, track);

  const update = figure(canvas) || (() => {});
  const n = steps.length;

  const cards = stepEls.map((s) => s.querySelector('.step-card'));
  const mq = window.matchMedia('(max-width: 63.99rem)');

  /* Stacked (mobile) layout: the figure is pinned at the top and the cards
     travel up underneath it. Fade each card out as it approaches the figure's
     lower edge, so it is gone before it reaches the artwork rather than
     sliding across it. Purely a function of geometry, so it rewinds on
     reverse scroll like everything else. */
  const FADE = 150;                     // px over which a card fades out
  function fadeCards() {
    if (!mq.matches) {
      for (const c of cards) c.style.opacity = '';
      return;
    }
    const edge = sticky.getBoundingClientRect().bottom;
    for (const c of cards) {
      const gap = c.getBoundingClientRect().top - edge;
      c.style.opacity = clamp(gap / FADE).toFixed(3);
    }
  }

  trackScene(track, (p) => {
    // Active step: which card is nearest mid-viewport. Deriving from p keeps
    // figure state and card highlight perfectly in sync.
    const scaled = clamp(p * n, 0, n - 1e-6);
    const idx = Math.floor(scaled);
    const stepP = scaled - idx;
    stepEls.forEach((s, i) => s.classList.toggle('active', i === idx));
    update(p, idx, stepP);
    fadeCards();
  });

  // In stacked (mobile) layout the DOM order must put the sticky figure first.
  const order = () => {
    if (cols) {
      if (mq.matches) track.prepend(sticky);
      else track.append(sticky);
    }
    fadeCards();          // crossing the breakpoint changes which rule applies
  };
  mq.addEventListener?.('change', order);
  order();

  return root;
}
