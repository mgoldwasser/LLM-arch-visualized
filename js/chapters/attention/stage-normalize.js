/* Stage 3 · NORMALIZE — one row of scores through softmax into weights that
   sum to 1. The weights are computed live, never hard-coded. Returns { g, u }. */

import { svg } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { softmax, round } from '../../core/mathtools.js';
import { SCENE_W, stageTitle } from './shared.js';

export function stageNormalize() {
  const g = svg('g', {});
  const scores = [0.57, 1.25, -0.41, -0.04, -0.66];
  const weights = softmax(scores).map((v) => round(v, 2)); // .24 .47 .09 .13 .07 — computed, not hard-coded
  const x0 = 130, y0 = 92, cw = 64, ch = 38;
  const fmt = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);

  const rowLabel = txt(x0, 80, 'one row of S  (i = 5)', { size: 11 });
  const cells = scores.map((s, j) => svg('g', {},
    svg('rect', { x: x0 + j * cw, y: y0, width: cw - 4, height: ch, rx: 5, fill: PAL.attn, 'fill-opacity': 0.14 + weights[j] * 1.2, stroke: 'rgba(180,140,224,0.4)' }),
    txt(x0 + j * cw + 30, y0 + 24, fmt(s), { size: 12, fill: PAL.ink, anchor: 'middle', mono: true })));
  cells.push(svg('g', {},
    svg('rect', { x: x0 + 5 * cw, y: y0, width: cw - 4, height: ch, rx: 5, fill: '#0B0F14', stroke: PAL.grid }),
    txt(x0 + 5 * cw + 30, y0 + 24, '−∞', { size: 12, anchor: 'middle', mono: true })));

  const mid = x0 + 3 * cw - 4;
  const a1 = svg('path', { d: `M ${mid} ${y0 + ch + 6} L ${mid} 166`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#attn-arr)' });
  const box = svg('g', {},
    svg('rect', { x: mid - 90, y: 170, width: 180, height: 46, rx: 10, fill: 'rgba(230,237,243,0.04)', stroke: PAL.tx, 'stroke-width': 1.2 }),
    txt(mid, 190, 'softmax', { size: 14, fill: PAL.ink, anchor: 'middle', mono: true }),
    txt(mid, 208, 'eˢ / Σ eˢ', { size: 10, anchor: 'middle', mono: true }));
  const a2 = svg('path', { d: `M ${mid} 218 L ${mid} 248`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#attn-arr)' });

  const bx = 110, byy = 256, bh = 36, bw = 470;
  const segOp = [0.95, 0.8, 0.5, 0.62, 0.42];
  const segRects = weights.map((w, j) => svg('rect', { x: bx, y: byy, height: bh, width: 0, fill: PAL.attn, 'fill-opacity': segOp[j], stroke: PAL.bg, 'stroke-width': 1 }));
  const segLabels = weights.map((w) => txt(0, byy + 23, '.' + String(Math.round(w * 100)).padStart(2, '0'), { size: 12, fill: '#10141A', anchor: 'middle', mono: true }));
  const maskNote = txt(bx + bw + 8, byy + 23, '−∞ → 0', { size: 11, mono: true });
  const bracket = svg('g', {},
    svg('path', { d: `M ${bx} ${byy + 46} L ${bx} ${byy + 52} L ${bx + bw} ${byy + 52} L ${bx + bw} ${byy + 46}`, stroke: PAL.mut, fill: 'none', 'stroke-width': 1.2 }),
    txt(bx + bw / 2, byy + 72, '≥ 0 · sums to 1', { size: 12, fill: PAL.tx, anchor: 'middle' }));
  const note = txt(SCENE_W / 2, 420, 'a weighted blend of every match — differentiable end to end', { size: 11, anchor: 'middle' });

  g.append(...stageTitle('3 · NORMALIZE', 'A = softmax(row):  aᵢⱼ = eˢᵢⱼ / Σⱼ eˢᵢⱼ'),
    rowLabel, ...cells, a1, box, a2, ...segRects, ...segLabels, maskNote, bracket, note);

  const u = (q) => {
    rowLabel.setAttribute('opacity', seg(q, 0, 0.1));
    cells.forEach((c, j) => c.setAttribute('opacity', seg(q, j * 0.03, 0.14 + j * 0.03)));
    a1.setAttribute('opacity', seg(q, 0.18, 0.27));
    box.setAttribute('opacity', seg(q, 0.24, 0.35));
    a2.setAttribute('opacity', seg(q, 0.33, 0.42));
    let x = bx;
    weights.forEach((w, j) => {
      const t = seg(q, 0.42 + j * 0.06, 0.58 + j * 0.06, ease.out);
      const wpx = w * bw * t;
      segRects[j].setAttribute('x', x);
      segRects[j].setAttribute('width', wpx);
      segLabels[j].setAttribute('x', x + wpx / 2);
      segLabels[j].setAttribute('opacity', seg(q, 0.58 + j * 0.06, 0.66 + j * 0.06));
      x += wpx;
    });
    maskNote.setAttribute('opacity', seg(q, 0.76, 0.85));
    bracket.setAttribute('opacity', seg(q, 0.8, 0.9));
    note.setAttribute('opacity', seg(q, 0.88, 0.98));
  };
  return { g, u };
}
