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
    el('div', { class: 'scene-step', dataset: { step: i } },
      el('div', { class: 'step-card' },
        s.n ? el('div', { class: 'step-n' }, s.n) : null,
        el('div', { class: 'step-body', html: s.html })))
  );
  const stepsCol = el('div', { class: 'scene-steps' }, stepEls);

  const track = cols
    ? el('div', { class: 'scene-track scene-cols' }, stepsCol, sticky)
    : el('div', { class: 'scene-track' }, sticky, stepsCol);

  // A custom property rather than an inline min-height: inline styles beat
  // media queries, so a scene asking for tall steps would keep them in the
  // stacked mobile layout, where they leave the reader staring at nothing
  // between cards.
  if (stepVh) track.style.setProperty('--step-vh', stepVh + 'vh');

  const root = el('section', { class: 'scene wide', id }, track);

  const update = figure(canvas) || (() => {});
  const n = steps.length;

  /* Paint the p=0 frame at build time, for the reason given in scroll.js's
     pin(). Only the figure's own update is called here — not fadeCards(),
     which measures geometry and would read zeros before the node is in the
     document. Card opacity is set on the first real frame instead. */
  update(0, 0, 0);
  stepEls[0]?.classList.add('active');

  const cards = stepEls.map((s) => s.querySelector('.step-card'));
  const mq = window.matchMedia('(max-width: 63.99rem)');

  /* Stacked (mobile) layout: the figure is pinned at the top and the cards
     travel up underneath it. Fade each card out as it approaches the figure's
     lower edge, so it is gone before it reaches the artwork rather than
     sliding across it. Purely a function of geometry, so it rewinds on
     reverse scroll like everything else. */
  function fadeCards() {
    if (!mq.matches) {
      for (const c of cards) c.style.opacity = '';
      return;
    }
    const edge = sticky.getBoundingClientRect().bottom;
    const room = window.innerHeight - edge;   // strip the cards travel through
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      // Spend on the fade whatever room is left once the card itself fits.
      // A fixed distance reads well on a large phone and swallows a tall card
      // whole on a small one, where the card only just fits below the figure.
      const fade = Math.min(150, Math.max(40, room - r.height));
      c.style.opacity = clamp((r.top - edge) / fade).toFixed(3);
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
