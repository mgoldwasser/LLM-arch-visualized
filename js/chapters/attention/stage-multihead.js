/* Stage 5 · MULTI-HEAD — h independent lanes in parallel, concatenated and
   mixed by W_O. Returns { g, u }. */

import { svg } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, lerp, ease, rng } from '../../core/anim.js';
import { BP, SCENE_W, stageTitle } from './shared.js';

export function stageMultiHead() {
  const g = svg('g', {});
  const W = SCENE_W;
  const lw = 104, lh = 196, gap = 16, x0 = (W - (5 * lw + 4 * gap)) / 2, y0 = 64;
  const names = ['head 1', 'head 2', 'head 3', '…', `head ${BP.heads}`];
  const lanes = names.map((name, i) => {
    const lx = x0 + i * (lw + gap);
    const lane = svg('g', {});
    if (name === '…') {
      lane.append(
        svg('rect', { x: lx, y: y0, width: lw, height: lh, rx: 10, fill: 'none', stroke: 'rgba(180,140,224,0.3)', 'stroke-dasharray': '4 5' }),
        txt(lx + lw / 2, y0 + lh / 2 + 8, '…', { size: 24, anchor: 'middle' }));
      return lane;
    }
    const r = rng(31 + i * 7);
    lane.append(svg('rect', { x: lx, y: y0, width: lw, height: lh, rx: 10, fill: 'rgba(180,140,224,0.05)', stroke: 'rgba(180,140,224,0.45)', 'stroke-width': 1.2 }));
    for (let k = 0; k < 3; k++)
      lane.append(svg('rect', { x: lx + 10 + k * 29, y: y0 + 14, width: 26, height: 11, rx: 3, fill: 'rgba(224,168,76,0.45)' }));
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++)
      lane.append(svg('rect', {
        x: lx + 24 + b * 14, y: y0 + 40 + a * 14, width: 12, height: 12, rx: 2,
        fill: b <= a ? PAL.attn : '#0B0F14',
        'fill-opacity': b <= a ? 0.2 + r() * 0.7 : 1,
        stroke: b > a ? PAL.grid : 'none',
      }));
    let sx = lx + 12;
    const parts = [r(), r(), r(), r()];
    const tot = parts.reduce((s, v) => s + v, 0);
    parts.forEach((v, k) => {
      const wseg = (v / tot) * 80;
      lane.append(svg('rect', { x: sx, y: y0 + 110, width: Math.max(1, wseg - 1), height: 10, rx: 2, fill: PAL.attn, 'fill-opacity': 0.35 + 0.6 * (v / tot) * 2 }));
      sx += wseg;
    });
    lane.append(
      svg('rect', { x: lx + 38, y: y0 + 134, width: 28, height: 12, rx: 3, fill: 'rgba(180,140,224,0.4)' }),
      txt(lx + lw / 2, y0 + 178, name, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }));
    return lane;
  });
  const laneArrows = names.map((_, i) => {
    const cx = x0 + i * (lw + gap) + lw / 2;
    return svg('line', { x1: cx, y1: y0 + lh + 4, x2: cx, y2: y0 + lh + 26, stroke: PAL.mut, 'stroke-width': 1.2, 'marker-end': 'url(#attn-arr)' });
  });
  const concat = svg('g', {},
    svg('rect', { x: 100, y: 294, width: 520, height: 30, rx: 8, fill: 'rgba(90,200,220,0.1)', stroke: PAL.act, 'stroke-width': 1.2 }),
    txt(360, 313, `concat → T × (${BP.heads}·${BP.dHead}) = T × ${BP.heads * BP.dHead}`, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }));
  const a1 = svg('path', { d: 'M 360 324 L 360 344', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#attn-arr)' });
  const wo = svg('g', {},
    svg('rect', { x: 300, y: 348, width: 120, height: 44, rx: 10, fill: 'rgba(224,168,76,0.13)', stroke: PAL.weight, 'stroke-width': 1.4 }),
    txt(360, 370, 'W_O', { size: 14, fill: PAL.weight, anchor: 'middle', mono: true }),
    txt(360, 386, `${BP.heads * BP.dHead} × ${BP.dModel}`, { size: 9.5, anchor: 'middle', mono: true }));
  const out = svg('g', {},
    svg('path', { d: 'M 422 370 L 508 370', stroke: PAL.act, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#attn-arrC)' }),
    txt(516, 374, '+ residual stream', { size: 12, fill: PAL.act }));
  const note = txt(W / 2, 428, 'same total cost per layer as one full-width head', { size: 11, anchor: 'middle' });
  g.append(...stageTitle('5 · MULTI-HEAD', `× h heads in parallel  (h = ${BP.heads} in K2)`),
    ...lanes, ...laneArrows, concat, a1, wo, out, note);

  const u = (q) => {
    lanes.forEach((l, i) => {
      const t = seg(q, i * 0.08, 0.2 + i * 0.08, ease.out);
      l.setAttribute('opacity', t);
      l.setAttribute('transform', `translate(0, ${lerp(14, 0, t)})`);
      laneArrows[i].setAttribute('opacity', seg(q, 0.46, 0.58));
    });
    concat.setAttribute('opacity', seg(q, 0.54, 0.66));
    a1.setAttribute('opacity', seg(q, 0.64, 0.72));
    wo.setAttribute('opacity', seg(q, 0.68, 0.78));
    out.setAttribute('opacity', seg(q, 0.78, 0.88));
    note.setAttribute('opacity', seg(q, 0.88, 0.98));
  };
  return { g, u };
}
