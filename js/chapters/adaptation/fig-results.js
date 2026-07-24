/* GSM8K results — the headline bars, growing as the figure transits the
   viewport. Figure number is claimed by figure(); key 'results'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { track } from '../../core/scroll.js';

export function resultsFigure() {
  const W = 720, H = 292, Y0 = 70, Y1 = 100, TOP = 44, BOT = 232;
  const y = (v) => BOT - ((v - Y0) / (Y1 - Y0)) * (BOT - TOP);
  const BARS = [
    { v: 76.0, label: '76%', name: ['Qwen2.5-7B', 'Instruct · base'], fill: '#5A6470', op: 0.8 },
    { v: 80.0, label: '~80%', name: ['TinyLoRA', '1 parameter'], fill: PAL.train, op: 0.5 },
    { v: 91.8, label: '~91.8%', name: ['TinyLoRA', '13 parameters'], fill: PAL.train, op: 0.95 },
    { v: 93.5, label: '~93.5%', name: ['full fine-tuning', '(illustrative)'], fill: PAL.weight, op: 0.8 },
  ];
  const X = (i) => 116 + i * 148, BW = 92;

  const grid = [70, 80, 90, 100].map((v) => svg('g', {},
    svg('line', { x1: 60, y1: y(v), x2: 690, y2: y(v), stroke: PAL.grid.replace('0.06', '0.14'), 'stroke-width': 1 }),
    txt(52, y(v) + 4, v, { size: 10, anchor: 'end', mono: true })));
  const axisTitle = txt(60, 24, 'GSM8K accuracy (%) · trained with GRPO on math problems', { size: 11 });
  const els = BARS.map((b, i) => ({
    ...b,
    bar: svg('rect', { x: X(i), y: BOT, width: BW, height: 0, rx: 4, fill: b.fill, opacity: b.op }),
    val: txt(X(i) + BW / 2, y(b.v) - 8, b.label,
      { size: 13, fill: b.fill === '#5A6470' ? PAL.tx : b.fill, anchor: 'middle', mono: true, opacity: 0 }),
    name: svg('text', { x: X(i) + BW / 2, y: BOT + 18, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11 },
      svg('tspan', { x: X(i) + BW / 2, dy: 0 }, b.name[0]),
      svg('tspan', { x: X(i) + BW / 2, dy: 14 }, b.name[1])),
  }));
  const gain = svg('g', { opacity: 0 },
    svg('path', { d: `M ${X(0) + BW / 2} ${y(76) - 26} C ${X(0) + BW / 2 + 100} ${y(96)}, ${X(2)} ${y(96)}, ${X(2) + BW / 2 - 6} ${y(91.8) - 24}`, stroke: PAL.train, 'stroke-width': 1.2, fill: 'none', 'stroke-dasharray': '5 4', 'marker-end': 'url(#ad-arrR)' }),
    txt((X(0) + X(2) + BW) / 2, y(97), '+15.8 points from 26 bytes', { size: 11, fill: PAL.train, anchor: 'middle' }));
  const defs = svg('defs', {},
    svg('marker', { id: 'ad-arrR', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.train })));

  const node = svgRoot(W, H, { role: 'img', 'aria-label': 'Bar chart: GSM8K accuracy rises from 76 percent for the Qwen2.5-7B-Instruct base model, to about 80 percent with one trained parameter, to about 91.8 percent with TinyLoRA’s 13 parameters, near an illustrative full fine-tuning bar.' },
    defs, grid, axisTitle, els.map((e) => [e.bar, e.val, e.name]), gain);

  const fig = figure(
    'GSM8K, Qwen2.5-7B-Instruct, trained with GRPO on math problems. Thirteen parameters recover ~90% of the fine-tuning gains at ~1000× fewer trained parameters; even a single parameter buys about four points. Full fine-tuning bar illustrative.',
    node, { key: 'results' });

  track(fig, (p) => {
    els.forEach((e, i) => {
      const t = seg(p, 0.16 + i * 0.05, 0.38 + i * 0.05, ease.out);
      const h = (BOT - y(e.v)) * t;
      e.bar.setAttribute('height', h);
      e.bar.setAttribute('y', BOT - h);
      e.val.setAttribute('opacity', seg(t, 0.7, 1));
    });
    gain.setAttribute('opacity', seg(p, 0.42, 0.52));
  });
  return fig;
}
