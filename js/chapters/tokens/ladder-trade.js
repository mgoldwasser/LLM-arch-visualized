/* The trade, plotted: vocabulary size against sequence length, both on log
   axes. The plot holds no numbers of its own — it is handed the points the
   ladder measured and derives every coordinate from them. */

import { svg } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { clamp } from '../../core/anim.js';

const L = 52, R = 16, T = 26, B = 26;   // padding inside the plot box

/* tradePlot({ x, y, w, h, points }) → { node, update(ts) }
   points: [{ label, v, n }] in ladder order; ts: matching array of 0..1 */
export function tradePlot({ x, y, w, h, points }) {
  const lv = points.map((p) => Math.log10(p.v));
  const ln = points.map((p) => Math.log10(p.n));
  const vLo = Math.min(...lv), vHi = Math.max(...lv);
  const nLo = Math.min(...ln), nHi = Math.max(...ln);
  const px = (v) => x + L + (Math.log10(v) - vLo) / (vHi - vLo) * (w - L - R);
  const py = (n) => y + h - B - (Math.log10(n) - nLo) / (nHi - nLo) * (h - T - B);

  const axisX = y + h - B, axisY = x + L;
  const spineY = (y + T + axisX) / 2;
  const frame = svg('g', {},
    svg('line', { x1: axisY, y1: y + T - 12, x2: axisY, y2: axisX, stroke: PAL.mut, 'stroke-width': 1, opacity: 0.5 }),
    svg('line', { x1: axisY, y1: axisX, x2: x + w - R + 6, y2: axisX, stroke: PAL.mut, 'stroke-width': 1, opacity: 0.5 }),
    svg('g', { transform: `rotate(-90 ${x + 11} ${spineY})` },
      txt(x + 11, spineY, '← sequence length', { size: 9, anchor: 'middle' })),
    txt(axisY + 8, axisX - 9, 'vocabulary size →', { size: 9 }),
    txt(x + 2, y + 10, 'the trade', { size: 10, fill: PAL.tx }));

  // one tick per plotted point, on each axis
  const ticks = points.map((pt) => svg('g', { opacity: 0 },
    svg('line', { x1: px(pt.v), y1: axisX, x2: px(pt.v), y2: axisX + 4, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: axisY - 4, y1: py(pt.n), x2: axisY, y2: py(pt.n), stroke: PAL.mut, 'stroke-width': 1 }),
    txt(axisY - 7, py(pt.n) + 3, String(pt.n), { size: 9, fill: PAL.act, anchor: 'end', mono: true })));

  const legs = points.slice(1).map((pt, i) => svg('line', {
    x1: px(points[i].v), y1: py(points[i].n), x2: px(pt.v), y2: py(pt.n),
    stroke: PAL.act, 'stroke-width': 1.3, 'stroke-dasharray': '5 4', opacity: 0,
  }));

  const dots = points.map((pt, i) => {
    const last = i === points.length - 1;
    return svg('g', { opacity: 0 },
      svg('circle', { cx: px(pt.v), cy: py(pt.n), r: 4.5, fill: PAL.act }),
      txt(px(pt.v) + (last ? -9 : 9), py(pt.n) + (i === 0 ? 3.5 : last ? 3.5 : -8), pt.label,
        { size: 10, fill: PAL.ink, anchor: last ? 'end' : 'start', mono: true }),
      txt(px(pt.v), axisX + 15, pt.v >= 1000 ? `${Math.round(pt.v / 1000)}k` : String(pt.v),
        { size: 9, fill: PAL.weight, anchor: 'middle', mono: true }));
  });

  const node = svg('g', {}, frame, ticks, legs, dots);

  /* ts[i] in 0..1 — how far the ladder has reached that rung. Legs light once
     both of their endpoints are up, so the curve draws itself in order. */
  function update(ts) {
    dots.forEach((g, i) => {
      const t = clamp(ts[i] ?? 0);
      g.setAttribute('opacity', t);
      ticks[i].setAttribute('opacity', t * 0.9);
    });
    legs.forEach((leg, i) => {
      leg.setAttribute('opacity', clamp(ts[i] ?? 0) * clamp(ts[i + 1] ?? 0) * 0.75);
    });
  }

  return { node, update };
}
