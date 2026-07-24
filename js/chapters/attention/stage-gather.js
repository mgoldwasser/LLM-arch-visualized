/* Stage 4 · GATHER — the weighted blend of value vectors, through W_O and back
   into the residual stream. Returns { g, u }. */

import { svg } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, lerp, ease, clamp } from '../../core/anim.js';
import { softmax, round } from '../../core/mathtools.js';
import { SCENE_W, SUB, stageTitle } from './shared.js';

export function stageGather() {
  const g = svg('g', {});
  const weights = softmax([0.57, 1.25, -0.41, -0.04, -0.66]).map((v) => round(v, 2));
  const chips = [], wLabels = [], lines = [];
  const zx = 352, zy = 222;
  weights.forEach((w, j) => {
    const x = 120 + j * 100;
    wLabels.push(txt(x + 32, 88, '× .' + String(Math.round(w * 100)).padStart(2, '0'), { size: 11, fill: PAL.attn, anchor: 'middle', mono: true }));
    chips.push(svg('g', {},
      svg('rect', { x, y: 98, width: 64, height: 30, rx: 8, fill: 'rgba(180,140,224,0.13)', stroke: PAL.attn, 'stroke-width': 1.2 }),
      txt(x + 32, 118, 'v' + SUB[j], { size: 13, fill: PAL.ink, anchor: 'middle', mono: true })));
    lines.push(svg('line', { x1: x + 32, y1: 130, x2: zx, y2: zy - 2, stroke: PAL.attn, 'stroke-width': 1 + w * 7, 'stroke-opacity': clamp(0.3 + w * 1.4) }));
  });
  const z = svg('g', {},
    svg('rect', { x: zx - 30, y: zy, width: 60, height: 32, rx: 8, fill: 'rgba(180,140,224,0.32)', stroke: PAL.attn, 'stroke-width': 1.4 }),
    txt(zx, zy + 21, 'z', { size: 14, fill: PAL.ink, anchor: 'middle', mono: true }));
  const a1 = svg('path', { d: `M ${zx} ${zy + 34} L ${zx} 282`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#attn-arr)' });
  const wo = svg('g', {},
    svg('rect', { x: zx - 60, y: 286, width: 120, height: 50, rx: 10, fill: 'rgba(224,168,76,0.13)', stroke: PAL.weight, 'stroke-width': 1.4 }),
    txt(zx, 308, 'W_O', { size: 15, fill: PAL.weight, anchor: 'middle', mono: true }),
    txt(zx, 326, 'back to d_model', { size: 9.5, anchor: 'middle' }));
  const a2 = svg('path', { d: `M ${zx} 336 L ${zx} 372`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#attn-arr)' });
  const stream = svg('g', {},
    svg('rect', { x: 110, y: 386, width: 500, height: 16, rx: 8, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.2 }),
    svg('circle', { cx: zx, cy: 394, r: 10, fill: PAL.bg, stroke: PAL.act, 'stroke-width': 1.4 }),
    txt(zx, 398.5, '+', { size: 13, fill: PAL.act, anchor: 'middle', mono: true }),
    txt(610, 378, 'residual stream', { size: 11, anchor: 'end' }));
  const note = txt(SCENE_W / 2, 432, 'attention transports · the MLP transforms', { size: 11, anchor: 'middle' });
  g.append(...stageTitle('4 · GATHER', 'zᵢ = Σⱼ aᵢⱼ vⱼ ,  then  W_O z → stream'),
    ...wLabels, ...chips, ...lines, z, a1, wo, a2, stream, note);

  const u = (q) => {
    chips.forEach((c, j) => {
      const t = seg(q, j * 0.05, 0.16 + j * 0.05);
      c.setAttribute('opacity', t);
      wLabels[j].setAttribute('opacity', t);
    });
    lines.forEach((l, j) => l.setAttribute('opacity', seg(q, 0.22 + j * 0.04, 0.38 + j * 0.04)));
    const tz = seg(q, 0.44, 0.54, ease.out);
    z.setAttribute('opacity', tz);
    z.setAttribute('transform', `translate(0, ${lerp(8, 0, tz)})`);
    a1.setAttribute('opacity', seg(q, 0.54, 0.62));
    wo.setAttribute('opacity', seg(q, 0.58, 0.7));
    a2.setAttribute('opacity', seg(q, 0.7, 0.78));
    stream.setAttribute('opacity', seg(q, 0.75, 0.88));
    note.setAttribute('opacity', seg(q, 0.88, 0.98));
  };
  return { g, u };
}
