/* Epilogue — nine years, one story. A scroll-lit timeline from the
   transformer paper to a 26-byte fine-tune, the closing thought, sources. */

import { el, svg, svgRoot } from '../../core/dom.js';
import { chapter, prose, takeaway, chRef, PAL } from '../../core/components.js';
import { reveal, pin } from '../../core/scroll.js';
import { seg, ease, si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

/* Milestones. Color follows the site's grammar: violet = attention,
   green = adaptation/trainable, red-orange = training signal, teal = MoE,
   amber = the weights themselves. */
const EVENTS = [
  { year: 2017, lines: ['Attention Is', 'All You Need'], color: PAL.attn },
  { year: 2021, lines: ['RoPE · LoRA'], color: PAL.train },
  { year: 2022, lines: ['Chinchilla', 'scaling laws'], color: PAL.loss },
  { year: 2023, lines: ['QLoRA'], color: PAL.train },
  { year: 2024, lines: ['GRPO ·', 'DeepSeek-V3'], color: PAL.moe },
  { year: 2026, lines: ['K3 + TinyLoRA —', 'a 26-byte fine-tune'], color: PAL.weight },
];

function timelineFigure() {
  const W = 720, H = 236, X0 = 56, X1 = 664, MIDY = 118;
  const x = (year) => X0 + ((year - 2017) / 9) * (X1 - X0);

  const baseLine = svg('line', { x1: X0 - 14, y1: MIDY, x2: X1 + 26, y2: MIDY, stroke: PAL.grid.replace('0.06', '0.25'), 'stroke-width': 1.5 });
  const litLine = svg('line', { x1: X0 - 14, y1: MIDY, x2: X1 + 26, y2: MIDY, stroke: PAL.act, 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1, opacity: 0.85 });

  const nodes = EVENTS.map((e, i) => {
    const cx = x(e.year);
    const above = i % 2 === 0;                       // alternate above/below the line
    const anchor = i === 0 ? 'start' : i === EVENTS.length - 1 ? 'end' : 'middle';
    const tx = i === 0 ? cx - 18 : i === EVENTS.length - 1 ? cx + 26 : cx;
    const yYear = above ? MIDY - 62 : MIDY + 42;
    const dir = above ? 16 : -16;
    const halo = svg('circle', { cx, cy: MIDY, r: 13, fill: 'none', stroke: e.color, 'stroke-width': 1.2, opacity: 0 });
    const dot = svg('circle', { cx, cy: MIDY, r: 6, fill: e.color, opacity: 0 });
    const stem = svg('line', { x1: cx, y1: MIDY + (above ? -10 : 10), x2: cx, y2: above ? MIDY - 26 : MIDY + 26, stroke: e.color, 'stroke-width': 1, opacity: 0 });
    const label = svg('g', { opacity: 0, transform: `translate(0, ${dir})` },
      svg('text', { x: tx, y: yYear, 'text-anchor': anchor, fill: e.color, 'font-family': 'monospace', 'font-size': 13, 'font-weight': 700 }, e.year),
      svg('text', { x: tx, y: yYear + 17, 'text-anchor': anchor, fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11 },
        e.lines.map((l, k) => svg('tspan', { x: tx, dy: k === 0 ? 0 : 14 }, l))));
    return { cx, halo, dot, stem, label, dir };
  });

  const node = svgRoot(W, H, { role: 'img', 'aria-label': 'Timeline from 2017 to 2026: Attention Is All You Need in 2017, RoPE and LoRA in 2021, Chinchilla scaling laws in 2022, QLoRA in 2023, GRPO and DeepSeek-V3 in 2024, and Kimi K3 plus TinyLoRA’s 26-byte fine-tune in 2026, each node lighting in turn along a line.' },
    baseLine, litLine, nodes.map((n) => [n.stem, n.halo, n.dot, n.label]));

  const update = (p) => {
    const draw = seg(p, 0.12, 0.62, ease.inOut);
    litLine.setAttribute('stroke-dashoffset', 1 - draw);
    nodes.forEach((n) => {
      // a node lights the moment the drawn line reaches its x position
      const at = (n.cx - (X0 - 14)) / (X1 + 26 - (X0 - 14));
      const t = seg(draw, at, Math.min(1, at + 0.09), ease.out);
      n.dot.setAttribute('opacity', t);
      n.dot.setAttribute('r', 3 + 3 * t);
      n.halo.setAttribute('opacity', t * (1 - t) * 2.4 + t * 0.25);
      n.stem.setAttribute('opacity', t * 0.7);
      n.label.setAttribute('opacity', t);
      n.label.setAttribute('transform', `translate(0, ${(1 - t) * n.dir})`);
    });
  };
  return { node, update };
}

export function render({ id, title }) {
  const tl = timelineFigure();
  const tlFig = el('figure', { class: 'fig measure', style: { margin: '2.2rem auto' } },
    el('div', { class: 'fig-canvas' }, tl.node),
    el('figcaption', {},
      el('span', { class: 'fig-n' }, 'Nine years — '),
      el('span', { html: `from the transformer paper to a fine-tune of ${K3.name} that fits in 26 bytes.` })));
  const tlPinned = pin(tlFig, tl.update);

  return chapter(id,
    reveal(el('header', { class: 'ch-head measure' },
      el('div', { class: 'ch-kicker' }, 'Epilogue'),
      el('h2', {}, title))),
    tlPinned,
    prose(
      `Every mechanism in this book is assembled from the operations of the opening chapters. Attention is the dot product of ${chRef('vectors')} normalized by the softmax of ${chRef('probability')}; the MoE router is that same pair pointed at experts instead of positions; every weight was placed by the gradient descent of ${chRef('learning')} running over the layered neurons of ${chRef('networks')}; and the parallelism that makes any of it affordable is the answer to the wall ${chRef('sequences')} ends on. Nothing after Part I introduces a new kind of arithmetic — only far more of it, arranged more carefully.`),
    takeaway(
      `Nine years separate “Attention Is All You Need” from a 26-byte fine-tune. Read as one story: attention made scale possible; scale moved capability into pretraining; MoE made further scale affordable; and adaptation has been shrinking ever since — from rewriting the model, to patching it, to merely steering it. The ${si(K3.totalParams).replace('T', '')} trillion parameters are the library. Increasingly, everything after is just deciding which books to open.`),
    reveal(el('div', { class: 'sources measure' },
      el('div', { class: 's-label' }, 'Sources'),
      el('div', { html: 'Attention Is All You Need (2017) · RoPE (2021) · LoRA (2021) · Chinchilla scaling laws (2022) · QLoRA (2023) · GRPO / DeepSeekMath (2024) · DeepSeek-V3 (2024) · Kimi K3 tech blog (2026) · TinyLoRA — <em>Learning to Reason in 13 Parameters</em> (2026)' }),
      el('div', { style: { marginTop: '0.7rem' } },
        'Attention weights, expert routings, and undisclosed K3 dimensions are illustrative; all disclosed figures are sourced.'))));
}
