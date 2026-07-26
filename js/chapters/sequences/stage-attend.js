/* Scene step 4 — the teaser. The same sentence as an all-pairs triangular
   grid, filled in one parallel step, with the T² cost made visible. */

import { svg } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, ease, rng } from '../../core/anim.js';
import { TOK, T, stageTag, stageFormula } from './shared.js';

export function stageAttend() {
  const g = svg('g', {});
  const cell = 42, gx = 232, gy = 116;
  const rand = rng(77);
  const cells = [], masked = [];
  for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) {
    const x = gx + j * cell + 1, y = gy + i * cell + 1;
    (j <= i ? cells : masked).push(svg('rect', {
      x, y, width: cell - 2, height: cell - 2, rx: 4,
      fill: j <= i ? PAL.attn : '#0B0F14', 'fill-opacity': j <= i ? 0.16 + rand() * 0.66 : 1,
      stroke: j <= i ? 'none' : PAL.grid,
    }));
  }
  const labels = svg('g', {}, TOK.map((t, j) => [
    txt(gx + j * cell + cell / 2, gy - 8, t, { size: 9.5, anchor: 'middle', mono: true }),
    txt(gx - 8, gy + j * cell + cell / 2 + 4, t, { size: 9.5, anchor: 'end', mono: true }),
  ]));

  const pairs = (T * (T + 1)) / 2;
  const panel = [
    txt(510, 152, 'every position compares itself', { size: 11.5, fill: PAL.ink }),
    txt(510, 170, 'against every earlier position —', { size: 11.5, fill: PAL.ink }),
    txt(510, 188, 'in one matrix multiply.', { size: 11.5, fill: PAL.ink }),
    txt(510, 220, `${pairs} pairs = T(T+1)/2`, { size: 11, fill: PAL.attn, mono: true }),
    txt(510, 240, 'depth: 1 step, not T', { size: 11, fill: PAL.attn, mono: true }),
  ];

  const barY = 400;
  const compare = svg('g', {},
    txt(30, barY - 22, `recurrence: ${T} steps, strictly in order`, { size: 11 }),
    Array.from({ length: T }, (_, i) => svg('rect', { x: 30 + i * 40, y: barY - 12, width: 34, height: 12, rx: 3, fill: PAL.act, 'fill-opacity': 0.5 })),
    txt(30, barY + 26, 'attention: 1 step, T² work', { size: 11 }),
    svg('rect', { x: 30, y: barY + 36, width: 34, height: 12, rx: 3, fill: PAL.attn }),
    txt(74, barY + 46, '— the trade: a chain of length T, for a square of side T', { size: 11, fill: PAL.tx }));

  g.append(stageTag('STEP 4 / 4 · ATTEND', PAL.attn),
    stageFormula('all pairs at once — one matrix multiply, no chain'),
    ...masked, ...cells, labels, ...panel, compare);

  const u = (q) => {
    const t = seg(q, 0.06, 0.3, ease.out);            // the whole grid fills together
    masked.forEach((m) => m.setAttribute('opacity', t));
    cells.forEach((c) => c.setAttribute('opacity', t));
    labels.setAttribute('opacity', seg(q, 0.1, 0.26));
    panel.forEach((n, i) => n.setAttribute('opacity', seg(q, 0.34 + i * 0.05, 0.44 + i * 0.05)));
    compare.setAttribute('opacity', seg(q, 0.7, 0.84));
  };
  return { g, u };
}
