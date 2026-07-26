/* Stage 1 · PROJECT — one stream vector through W_Q, W_K, W_V into q, k, v.
   Returns { g, u }: a group node, and update(q) driven by stage progress. */

import { svg } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, lerp, ease } from '../../core/anim.js';
import { BP, stageTitle } from './shared.js';

export function stageProject() {
  const g = svg('g', {});
  const gx = svg('g', {},
    txt(30, 122, 'stream vector', { size: 11 }),
    svg('rect', { x: 56, y: 132, width: 28, height: 168, rx: 7, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.4 }),
    [1, 2, 3, 4, 5].map((i) => svg('line', { x1: 58, y1: 132 + i * 28, x2: 82, y2: 132 + i * 28, stroke: PAL.grid })),
    txt(70, 322, 'xₜ ∈ ℝᵈ', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true }),
    txt(70, 340, `d = ${BP.dModel}`, { size: 10, anchor: 'middle', mono: true }));

  const names = ['W_Q', 'W_K', 'W_V'];
  const chipTxt = [['q', 'what I seek', 'ℝ^d_head = ℝ¹²⁸'], ['k', 'what I advertise', 'ℝ^d_head'], ['v', 'what I hand over', 'ℝ^d_head']];
  const boxes = [], arr1 = [], arr2 = [], chips = [];
  const by = [72, 192, 312], cy = [80, 200, 320];
  for (let i = 0; i < 3; i++) {
    boxes.push(svg('g', {},
      svg('rect', { x: 240, y: by[i], width: 110, height: 76, rx: 10, fill: 'rgba(224,168,76,0.13)', stroke: PAL.weight, 'stroke-width': 1.4 }),
      txt(295, by[i] + 36, names[i], { size: 15, fill: PAL.weight, anchor: 'middle', mono: true }),
      txt(295, by[i] + 58, `${BP.dModel} × ${BP.dHead}`, { size: 10, anchor: 'middle', mono: true })));
    arr1.push(svg('path', { d: `M 88 ${216} C 150 216, 160 ${by[i] + 38}, 234 ${by[i] + 38}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#attn-arr)' }));
    arr2.push(svg('path', { d: `M 352 ${by[i] + 38} L 452 ${cy[i] + 16}`, stroke: PAL.attn, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#attn-arrA)' }));
    chips.push(svg('g', {},
      svg('rect', { x: 458, y: cy[i], width: 64, height: 32, rx: 8, fill: 'rgba(180,140,224,0.16)', stroke: PAL.attn, 'stroke-width': 1.3 }),
      txt(490, cy[i] + 21, chipTxt[i][0], { size: 15, fill: PAL.attn, anchor: 'middle', mono: true }),
      txt(534, cy[i] + 14, chipTxt[i][1], { size: 12, fill: PAL.tx }),
      txt(534, cy[i] + 30, chipTxt[i][2], { size: 10, mono: true })));
  }
  g.append(...stageTitle('1 · PROJECT', 'q = W_Q x   k = W_K x   v = W_V x'), gx, ...boxes, ...arr1, ...arr2, ...chips);

  const u = (q) => {
    gx.setAttribute('opacity', seg(q, 0, 0.18));
    for (let i = 0; i < 3; i++) {
      boxes[i].setAttribute('opacity', seg(q, 0.14 + i * 0.06, 0.34 + i * 0.06));
      arr1[i].setAttribute('opacity', seg(q, 0.28 + i * 0.06, 0.42 + i * 0.06));
      arr2[i].setAttribute('opacity', seg(q, 0.44 + i * 0.06, 0.58 + i * 0.06));
      const t = seg(q, 0.52 + i * 0.08, 0.72 + i * 0.08, ease.out);
      chips[i].setAttribute('opacity', t);
      chips[i].setAttribute('transform', `translate(${lerp(-12, 0, t)}, 0)`);
    }
  };
  return { g, u };
}
