/* Figure — router collapse, and the fix. Traffic starts uniform, drifts into
   the rich-get-richer loop, then Quantile Balancing restores the allocation. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, lerp, rng } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { K3 } from '../../../data/k3.js';

const E = K3.experts;

export function collapseFigure() {
  const W = 720, H = 300;
  const N = 26, bw = 17, gap = 5, x0 = 74, baseY = 236, u = 64;
  const winners = new Set([4, 12, 19]);
  const rand = rng(55);
  const collapsedH = Array.from({ length: N }, (_, i) => (winners.has(i) ? 186 : 6 + rand() * 12));

  const bars = [], overlays = [];
  for (let i = 0; i < N; i++) {
    bars.push(svg('rect', { x: x0 + i * (bw + gap), y: baseY - u, width: bw, height: u, rx: 2, fill: PAL.moe, 'fill-opacity': 0.85 }));
    overlays.push(svg('rect', { x: x0 + i * (bw + gap), y: baseY - u, width: bw, height: u, rx: 2, fill: PAL.loss, 'fill-opacity': 0 }));
  }
  const axis = svg('line', { x1: x0 - 6, y1: baseY, x2: x0 + N * (bw + gap), y2: baseY, stroke: PAL.grid, 'stroke-width': 1.2 });
  const xl = txt(x0, 256, 'expert 1', { size: 10, mono: true });
  const xr = txt(x0 + N * (bw + gap) - gap, 256, `expert ${N} … of ${E.routed}`, { size: 10, anchor: 'end', mono: true });
  const yLab = txt(x0 - 6, 278, 'bar height = share of tokens routed to each expert (one layer)', { size: 10.5 });

  const t0Label = txt(x0, 40, 'expert traffic — starts uniform', { size: 11, fill: PAL.tx });
  const collapseLabel = txt(W / 2, 32, 'rich get richer: traffic → gradient → better → more traffic', { size: 11.5, fill: PAL.loss, anchor: 'middle' });
  const qbLine = svg('line', { x1: x0 - 6, y1: baseY - u, x2: x0 + N * (bw + gap), y2: baseY - u, stroke: PAL.moe, 'stroke-width': 1.2, 'stroke-dasharray': '5 4' });
  const qbLabel = txt(W / 2, 40, 'Quantile Balancing — allocation from router-score quantiles, no tuned coefficient', { size: 11.5, fill: PAL.moe, anchor: 'middle' });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Bar chart of routing traffic across experts. It starts uniform, then a few bars grow while the rest atrophy as the rich-get-richer loop takes hold, and Quantile Balancing restores a uniform allocation.',
  }, axis, bars, overlays, xl, xr, yLab, t0Label, collapseLabel, qbLine, qbLabel);

  const node = figure(
    `the routing feedback loop, and its fix. Left alone, early-lucky experts absorb the traffic and the gradient while the rest atrophy; K3&rsquo;s Quantile Balancing derives each expert&rsquo;s allocation directly from the router-score quantiles, with no hand-tuned coefficient to get wrong.`,
    root, { wide: true, key: 'collapse' });

  return pin(node, (p) => {
    const c = seg(p, 0.14, 0.48);           // drift into collapse
    const b = seg(p, 0.58, 0.86);           // quantile balancing restores
    for (let i = 0; i < N; i++) {
      const h = lerp(lerp(u, collapsedH[i], c), u, b);
      bars[i].setAttribute('height', h);
      bars[i].setAttribute('y', baseY - h);
      bars[i].setAttribute('fill-opacity', winners.has(i) ? 0.85 : 0.85 - 0.55 * c * (1 - b));
      overlays[i].setAttribute('height', h);
      overlays[i].setAttribute('y', baseY - h);
      overlays[i].setAttribute('fill-opacity', winners.has(i) ? 0.75 * c * (1 - b) : 0);
    }
    t0Label.setAttribute('opacity', (1 - seg(p, 0.12, 0.2)));
    collapseLabel.setAttribute('opacity', c * (1 - b));
    qbLine.setAttribute('opacity', b);
    qbLabel.setAttribute('opacity', b);
  });
}
