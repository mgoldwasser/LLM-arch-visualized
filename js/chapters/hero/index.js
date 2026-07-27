/* Chapter 00 — hero. Title, stats, and an ambient stream of tokens
   flowing through a stylized model silhouette. */

import { el, svg, svgRoot } from '../../core/dom.js';
import { PAL } from '../../core/components.js';
import { rng } from '../../core/anim.js';
import { numberedChapters } from '../../core/numbering.js';
import { K3 } from '../../../data/k3.js';

/* Reading time and chapter count are DERIVED, never typed — adding a chapter
   updates the hero automatically. ~6 min of reading per chapter is the
   measured pace for this article's scroll-driven scenes. */
const MINUTES_PER_CHAPTER = 6;

/* Every stat has to mean something to a reader on page one, so each label
   spells out the quantity rather than naming the machinery behind it. */
const STATS = [
  ['2.8T', 'learned numbers (parameters)'],
  ['~50B', 'parameters used per token'],
  ['16<em>/</em>896', 'sub-networks run per token'],
  ['1M', 'tokens it can read at once'],
  ['13', 'numbers to retune its behavior'],
];

function ambientTokens() {
  // A quiet marquee of token chips drifting toward a model block that emits
  // a probability bar — the whole article in one looping image.
  const W = 960, H = 150;
  const words = ['The', ' capital', ' of', ' France', ' is', ' Paris', '.', ' The', ' integral', ' of', ' x²', ' is', ' x³/3', ' +', ' C'];
  const rand = rng(7);
  const chips = words.map((w, i) => {
    const g = svg('g', {},
      svg('rect', { x: -2, y: -14, rx: 5, width: w.length * 8.4 + 14, height: 24, fill: 'none', stroke: PAL.grid.replace('0.06', '0.25'), 'stroke-width': 1 }),
      svg('text', { x: 5, y: 3, fill: PAL.tx, 'font-family': 'monospace', 'font-size': 13 }, w.trim() || '·'));
    return { g, w, off: i * 95 + rand() * 30 };
  });
  const model = svg('g', {},
    svg('rect', { x: 610, y: 35, width: 120, height: 80, rx: 12, fill: 'rgba(90,200,220,0.08)', stroke: PAL.act, 'stroke-width': 1.2 }),
    svg('text', { x: 670, y: 70, fill: PAL.ink, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 13 }, 'Kimi K3'),
    svg('text', { x: 670, y: 90, fill: PAL.mut, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 10 }, 'p(next | context)'));
  const bars = Array.from({ length: 5 }, (_, i) =>
    svg('rect', { x: 775, y: 45 + i * 13, height: 8, rx: 2, width: 10, fill: PAL.act, opacity: 1 - i * 0.17 }));
  const root = svgRoot(W, H, { 'aria-hidden': 'true' },
    chips.map((c) => c.g), model, bars);

  let t = 0, running = true;
  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; }, {});
  io.observe(root);
  (function tick() {
    requestAnimationFrame(tick);
    if (!running || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    t += 0.6;
    for (const c of chips) {
      const x = 640 - ((c.off + t) % 1500);
      const fade = x > 520 ? Math.max(0, (610 - x) / 90) : x < 40 ? Math.max(0, x / 40) : 1;
      c.g.setAttribute('transform', `translate(${x}, 75)`);
      c.g.setAttribute('opacity', fade * 0.9);
    }
    bars.forEach((b, i) => {
      const w = 12 + Math.abs(Math.sin(t / 40 + i * 1.7)) * (110 - i * 22);
      b.setAttribute('width', w);
    });
  })();
  return root;
}

export function render() {
  const n = numberedChapters().length;
  const minutes = Math.round((n * MINUTES_PER_CHAPTER) / 5) * 5;
  return el('section', { class: 'chapter', id: 'hero', style: { marginTop: 0 } },
    el('div', { class: 'hero measure', style: { maxWidth: 'var(--col-wide)' } },
      el('div', { class: 'kicker' }, 'An interactive deep dive'),
      el('div', { class: 'meta' }, `~${minutes} min · ${n} chapters · scroll-driven figures · interactive widgets`),
      el('h1', {}, 'How a Trillion-Parameter Model Actually Works'),
      el('p', { class: 'lede' },
        'Training, attention, inference, and adaptation — traced through ',
        el('strong', {}, K3.name),
        `, a 2.8-trillion-parameter mixture-of-experts model, down to a fine-tune that changes 13 numbers. `,
        'Starts from vectors and dot products and does not skip a step. If you have had one linear-algebra course, you have everything you need. Everything here moves: scroll slowly, and watch the machine assemble itself.'),
      el('div', { class: 'hero-stats' },
        STATS.map(([v, k]) => el('div', { class: 'stat' },
          el('div', { class: 'v', html: v }),
          el('div', { class: 'k' }, k)))),
      el('div', { class: 'fig', style: { marginTop: '3rem', width: '100%' } },
        el('div', { class: 'fig-canvas' }, ambientTokens())),
      el('div', { class: 'hero-scroll-hint' },
        el('span', { class: 'arrow' }, '↓'),
        'scroll to begin')));
}
