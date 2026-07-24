/* Stage 2 · SCORE — every query dotted against every key into a masked T×T
   matrix. Returns { g, u }. */

import { svg } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, rng } from '../../core/anim.js';
import { SUB, stageTitle } from './shared.js';

export function stageScore() {
  const g = svg('g', {});
  const T = 6, cell = 44, gx0 = 230, gy0 = 96;
  const rand = rng(42);
  const heads = [], lows = [], masks = [];
  for (let j = 0; j < T; j++) heads.push(txt(gx0 + j * cell + 22, 88, 'k' + SUB[j], { size: 11, anchor: 'middle', mono: true }));
  for (let i = 0; i < T; i++) heads.push(txt(gx0 - 12, gy0 + i * cell + 27, 'q' + SUB[i], { size: 11, anchor: 'end', mono: true }));
  heads.push(txt(gx0 + T * cell / 2, 70, 'cols = keys (j)', { size: 10, anchor: 'middle' }));
  heads.push(svg('text', { x: 190, y: gy0 + T * cell / 2, fill: PAL.mut, 'font-size': 10, 'font-family': 'sans-serif', 'text-anchor': 'middle', transform: `rotate(-90, 190, ${gy0 + T * cell / 2})` }, 'rows = queries (i)'));
  for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) {
    const x = gx0 + j * cell + 1, y = gy0 + i * cell + 1;
    if (j <= i) {
      lows.push(svg('rect', { x, y, width: cell - 2, height: cell - 2, rx: 4, fill: PAL.attn, 'fill-opacity': 0.14 + rand() * 0.68 }));
    } else {
      masks.push(svg('g', {},
        svg('rect', { x, y, width: cell - 2, height: cell - 2, rx: 4, fill: '#0B0F14', stroke: PAL.grid }),
        txt(x + 21, y + 26, '−∞', { size: 12, anchor: 'middle', mono: true })));
    }
  }
  const maskAnno = svg('g', {},
    txt(560, 108, 'causal mask:', { size: 11, fill: PAL.ink }),
    txt(560, 124, 'j ≤ i only —', { size: 11 }),
    txt(560, 140, 'no token may', { size: 11 }),
    txt(560, 156, 'see its future', { size: 11 }),
    svg('path', { d: 'M 556 116 C 530 118, 512 124, 492 134', stroke: PAL.mut, 'stroke-width': 1.2, fill: 'none', 'marker-end': 'url(#attn-arr)' }));
  const footer = txt(gx0 + T * cell / 2, 392, 'T×T scores, one multiply', { size: 11, anchor: 'middle' });
  const headG = svg('g', {}, heads);
  g.append(...stageTitle('2 · SCORE', 'S = QKᵀ / √d_head'), headG, ...lows, ...masks, maskAnno, footer);

  const u = (q) => {
    headG.setAttribute('opacity', seg(q, 0, 0.12));
    lows.forEach((c, i) => c.setAttribute('opacity', seg(q, 0.05 + i * 0.02, 0.11 + i * 0.02)));
    masks.forEach((c, i) => c.setAttribute('opacity', seg(q, 0.55 + i * 0.014, 0.62 + i * 0.014)));
    footer.setAttribute('opacity', seg(q, 0.48, 0.58));
    maskAnno.setAttribute('opacity', seg(q, 0.74, 0.86));
  };
  return { g, u };
}
