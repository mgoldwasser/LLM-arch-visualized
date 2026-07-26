/* The SFT-vs-RL asymmetry at tiny capacity — two accuracy curves against
   update size, drawn on scroll. Figure number is claimed by figure();
   key 'asymmetry'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

export function asymmetryFigure() {
  const W = 720, H = 300, TOP = 40, BOT = 240, X0 = 84, X1 = 664;
  const TICKS = ['1', '10', '100', '1k', '10k', '100k', '1M'];
  const x = (i) => X0 + (i / 6) * (X1 - X0);
  const y = (v) => BOT - ((v - 70) / 25) * (BOT - TOP);
  const RL = [[0, 80], [1.11, 91.8], [2, 92.3], [3, 92.8], [4, 93.0], [5, 93.2], [6, 93.4]];
  const SFT = [[0, 76.2], [1, 76.8], [2, 78.5], [3, 84.0], [4, 91.0], [5, 92.5], [6, 93.2]];
  const path = (pts) => pts.map(([i, v], k) => `${k ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  const axis = svg('g', { 'font-family': 'monospace', 'font-size': 10 },
    svg('line', { x1: X0 - 10, y1: BOT, x2: X1 + 14, y2: BOT, stroke: PAL.mut, 'stroke-width': 1 }),
    TICKS.map((t, i) => svg('g', {},
      svg('line', { x1: x(i), y1: BOT, x2: x(i), y2: BOT + 5, stroke: PAL.mut, 'stroke-width': 1 }),
      svg('text', { x: x(i), y: BOT + 19, 'text-anchor': 'middle', fill: PAL.mut }, t))),
    [70, 80, 90].map((v) => svg('g', {},
      svg('line', { x1: X0 - 10, y1: y(v), x2: X1 + 14, y2: y(v), stroke: PAL.grid.replace('0.06', '0.12'), 'stroke-width': 1 }),
      svg('text', { x: X0 - 18, y: y(v) + 4, 'text-anchor': 'end', fill: PAL.mut }, v))),
    txt((X0 + X1) / 2, BOT + 38, 'trainable parameters in the update (log scale)', { size: 11, anchor: 'middle' }),
    txt(X0 - 10, 24, 'GSM8K accuracy (%) · illustrative curves', { size: 11 }));

  const rlPath = svg('path', { d: path(RL), stroke: PAL.train, 'stroke-width': 2.2, fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
  const sftPath = svg('path', { d: path(SFT), stroke: PAL.loss, 'stroke-width': 2.2, fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
  const rlDot = svg('circle', { cx: x(1.11), cy: y(91.8), r: 5, fill: PAL.train, opacity: 0 });
  const rlDotTag = txt(x(1.11) + 12, y(91.8) + 24, 'RL · 13 params', { size: 11, fill: PAL.train, mono: true, opacity: 0 });
  const rlTag = txt(X1 + 10, y(93.4) - 12, 'RL (GRPO) — selects', { size: 12, fill: PAL.train, anchor: 'end', opacity: 0 });
  const sftTag = txt(x(3.4), y(80.6) + 22, 'SFT — must absorb', { size: 12, fill: PAL.loss, opacity: 0 });
  const gap = svg('g', { opacity: 0 },
    svg('line', { x1: x(1.11), y1: y(91.8), x2: x(4.15), y2: y(91.8), stroke: PAL.mut, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', 'marker-start': 'url(#ad-arrG)', 'marker-end': 'url(#ad-arrG)' }),
    txt((x(1.11) + x(4.15)) / 2, y(91.8) - 8, 'SFT needs a 100–1000× larger update to match',
      { size: 11, fill: PAL.tx, anchor: 'middle' }));
  const defs = svg('defs', {},
    svg('marker', { id: 'ad-arrG', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const node = svgRoot(W, H, { role: 'img', 'aria-label': 'Two curves of accuracy versus update size on a log scale: the RL curve reaches about 91.8 percent at just 13 parameters, while the SFT curve stays near the base model until the update is 100 to 1000 times larger.' },
    defs, axis, sftPath, rlPath, rlDot, rlDotTag, rlTag, sftTag, gap);

  const fig = figure(
    'the asymmetry: at equal tiny capacity, SFT fails where RL succeeds, needing 100–1000× larger updates to match. Curves illustrative, after the TinyLoRA paper.',
    node, { key: 'asymmetry' });

  return pin(fig, (p) => {
    rlPath.setAttribute('stroke-dashoffset', 1 - seg(p, 0.14, 0.36, ease.inOut));
    sftPath.setAttribute('stroke-dashoffset', 1 - seg(p, 0.2, 0.44, ease.inOut));
    rlDot.setAttribute('opacity', seg(p, 0.3, 0.36));
    rlDotTag.setAttribute('opacity', seg(p, 0.32, 0.38));
    rlTag.setAttribute('opacity', seg(p, 0.36, 0.42));
    sftTag.setAttribute('opacity', seg(p, 0.4, 0.46));
    gap.setAttribute('opacity', seg(p, 0.46, 0.55));
  });
}
