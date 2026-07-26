/* Scroll-tracked figure — the surprise curve, −log p. Scrolling sweeps a probe
   from p = 1 (surprise 0) down toward p → 0 (surprise unbounded); the curve is
   rebuilt from the probe's position on every frame, so nothing about it is
   stored anywhere but the scroll offset. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, ease, clamp } from '../../core/anim.js';

const P_MIN = 0.015;                                  // left edge of the sweep
const S_MAX = -Math.log(P_MIN);                        // ≈ 4.2 nats — the y-ceiling

export function surpriseFigure() {
  const W = 720, H = 356;
  const L = 92, R = 566, TOP = 66, BOT = 286;          // plot rectangle
  const X = (q) => L + q * (R - L);
  const Y = (s) => BOT - clamp(s / S_MAX) * (BOT - TOP);

  const grid = [];
  for (let s = 0; s <= 4; s++) {
    grid.push(svg('line', { x1: L, y1: Y(s), x2: R, y2: Y(s), stroke: PAL.grid, 'stroke-width': 1 }));
    grid.push(txt(L - 10, Y(s) + 4, String(s), { size: 10, anchor: 'end', mono: true }));
  }
  const xticks = [0, 0.25, 0.5, 0.75, 1].map((q) => [
    svg('line', { x1: X(q), y1: BOT, x2: X(q), y2: BOT + 5, stroke: PAL.mut, 'stroke-width': 1 }),
    txt(X(q), BOT + 18, q.toFixed(2), { size: 10, anchor: 'middle', mono: true }),
  ]);
  const axes = svg('g', {},
    svg('line', { x1: L, y1: TOP - 10, x2: R, y2: TOP - 10, stroke: PAL.grid, 'stroke-width': 1 }),
    svg('line', { x1: L, y1: BOT, x2: R, y2: BOT, stroke: PAL.mut, 'stroke-width': 1.2 }),
    svg('line', { x1: L, y1: TOP - 10, x2: L, y2: BOT, stroke: PAL.mut, 'stroke-width': 1.2 }));
  const xLab = txt((L + R) / 2, BOT + 38, 'p — the probability the model gave the token that actually occurred', { size: 11, anchor: 'middle' });
  const yLab = txt(34, 32, 'surprise · −log p (nats)', { size: 11, fill: PAL.loss, mono: true });
  const asym = txt(L + 6, 52, 'unbounded as p → 0 — no ceiling on the penalty', { size: 11, fill: PAL.loss, opacity: 0 });

  /* Worked points, marked once the sweep has passed them. The curve is convex
     and decreasing, so the space above-right of a point (and below-left of it)
     is always clear — labels go there, whichever side has room. */
  const MARKS = [0.5, 0.2, 0.05].map((q) => {
    const s = -Math.log(q);
    const low = q >= 0.5;                              // sits low and to the right
    return {
      s,
      dot: svg('circle', { cx: X(q), cy: Y(s), r: 3.4, fill: PAL.loss, opacity: 0 }),
      lab: txt(X(q) + (low ? -10 : 10), Y(s) + (low ? 16 : -10),
        `p = ${q} → ${s.toFixed(2)} nats · perplexity ${(1 / q).toFixed(0)}`,
        { size: 10.5, mono: true, fill: PAL.tx, anchor: low ? 'end' : 'start', opacity: 0 }),
    };
  });

  const curve = svg('path', { d: '', fill: 'none', stroke: PAL.loss, 'stroke-width': 2.2, 'stroke-linecap': 'round' });
  const probe = svg('circle', { cx: X(1), cy: Y(0), r: 5, fill: PAL.loss, opacity: 0 });
  const dropV = svg('line', { x1: X(1), y1: Y(0), x2: X(1), y2: BOT, stroke: PAL.loss, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0 });
  const dropH = svg('line', { x1: L, y1: Y(0), x2: X(1), y2: Y(0), stroke: PAL.loss, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0 });

  /* live readout, parked to the right of the plot */
  const RX = 592;
  const KEYS = [
    ['p(true token)', PAL.ink],
    ['surprise, nats', PAL.loss],
    ['surprise, bits', PAL.tx],
    ['perplexity = 1/p', PAL.act],
  ];
  const read = KEYS.map(([, fill], i) => txt(RX, TOP + 8 + i * 34, '', { size: 13, mono: true, fill }));
  const readLabs = KEYS.map(([k], i) => txt(RX, TOP + 22 + i * 34, k, { size: 9 }));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The surprise curve, minus log p plotted against p. It is zero at p equal to 1, reaches 0.69 nats at p equal to one half, 1.61 nats at p equal to 0.2 and 3.00 nats at p equal to 0.05, and rises without bound as p approaches zero. A live readout gives the same value in bits and the perplexity, which for a single prediction is one over p.',
  }, grid, xticks, axes, xLab, yLab, asym, curve, MARKS.map((m) => m.dot),
     dropV, dropH, probe, MARKS.map((m) => m.lab), readLabs, read);

  const node = figure(
    'surprise, −log p. At p = 1 the model was certain and correct and pays nothing; the penalty grows gently across the middle of the range and then without bound as p → 0. This is the whole shape of the training signal — being confidently wrong is arbitrarily expensive, which is what pushes a model toward honest probabilities rather than bravado.',
    root, { wide: true, key: 'surprise' });

  return pin(node, (p) => {
    const t = seg(p, 0.20, 0.62, ease.linear);
    const s = t * S_MAX;                               // the sweep is linear in surprise
    const q = Math.exp(-s);                            // …hence log-uniform in p

    const STEPS = 140;
    let d = '';
    for (let i = 0; i <= STEPS; i++) {
      const si = (s * i) / STEPS;
      d += `${i ? 'L' : 'M'} ${X(Math.exp(-si)).toFixed(2)} ${Y(si).toFixed(2)} `;
    }
    curve.setAttribute('d', d);

    const vis = seg(p, 0.20, 0.25);
    probe.setAttribute('opacity', vis);
    probe.setAttribute('cx', X(q));
    probe.setAttribute('cy', Y(s));
    dropV.setAttribute('opacity', vis * 0.8);
    dropV.setAttribute('x1', X(q)); dropV.setAttribute('x2', X(q)); dropV.setAttribute('y1', Y(s));
    dropH.setAttribute('opacity', vis * 0.8);
    dropH.setAttribute('x2', X(q)); dropH.setAttribute('y1', Y(s)); dropH.setAttribute('y2', Y(s));

    MARKS.forEach((m) => {
      const o = clamp((s - m.s) / 0.22) * vis;
      m.dot.setAttribute('opacity', o);
      m.lab.setAttribute('opacity', o);
    });

    read[0].textContent = q >= 0.02 ? q.toFixed(3) : q.toExponential(2);
    read[1].textContent = s.toFixed(2);
    read[2].textContent = (s / Math.LN2).toFixed(2);
    read[3].textContent = (1 / q).toFixed(1);
    read.forEach((r) => r.setAttribute('opacity', vis));
    readLabs.forEach((r) => r.setAttribute('opacity', vis * 0.9));
    asym.setAttribute('opacity', seg(p, 0.52, 0.62));
  });
}
