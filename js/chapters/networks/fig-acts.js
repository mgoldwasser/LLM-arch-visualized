/* Two activation functions and their slopes, side by side. The point is not
   which one is better but what each does to the gradient that has to travel
   back through it — the quantity the next chapter is entirely about. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, figure, chRef, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, clamp } from '../../core/anim.js';
import { sigmoid, relu } from './net.js';

const W = 720, H = 268;
const PW = 296, PH = 168;                  // one panel's plot box
const LO = -6, HI = 6, SAMP = 180;
const VLO = -0.3, VHI = 1.4;               // value range drawn in a panel

function panel(x0, y0, f, df, dScale) {
  const sx = (z) => x0 + ((z - LO) / (HI - LO)) * PW;
  const sy = (v) => y0 + PH - ((clamp(v, VLO, VHI) - VLO) / (VHI - VLO)) * PH;
  const path = (g) => {
    let d = '';
    for (let s = 0; s <= SAMP; s++) {
      const z = LO + (s / SAMP) * (HI - LO);
      d += `${s ? 'L' : 'M'} ${sx(z).toFixed(1)} ${sy(g(z)).toFixed(2)} `;
    }
    return d;
  };
  return {
    grid: svg('g', {},
      svg('rect', { x: x0, y: y0, width: PW, height: PH, fill: 'rgba(230,237,243,0.02)', stroke: PAL.grid, 'stroke-width': 1 }),
      svg('line', { x1: x0, y1: sy(0), x2: x0 + PW, y2: sy(0), stroke: 'rgba(230,237,243,0.16)' }),
      svg('line', { x1: sx(0), y1: y0, x2: sx(0), y2: y0 + PH, stroke: PAL.grid }),
      svg('line', { x1: x0, y1: sy(1), x2: x0 + PW, y2: sy(1), stroke: PAL.grid, 'stroke-dasharray': '3 4' }),
      txt(x0 - 8, sy(0) + 4, '0', { size: 10, anchor: 'end', mono: true }),
      txt(x0 - 8, sy(1) + 4, '1', { size: 10, anchor: 'end', mono: true }),
      txt(sx(HI), y0 + PH + 15, 'z', { size: 10.5, anchor: 'end', mono: true })),
    curve: svg('path', {
      d: path(f), stroke: PAL.act, 'stroke-width': 2.4, fill: 'none',
      pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1,
    }),
    slope: svg('path', {
      d: path((z) => df(z) * dScale), stroke: PAL.loss, 'stroke-width': 1.6,
      fill: 'none', 'stroke-dasharray': '5 4', opacity: 0,
    }),
  };
}

export function actsFigure() {
  const dSig = (z) => sigmoid(z) * (1 - sigmoid(z));
  const A = panel(52, 56, sigmoid, dSig, 4);
  const B = panel(400, 56, relu, (z) => (z > 0 ? 1 : 0), 1);

  const heads = [
    txt(52, 36, 'sigmoid  σ(z) = 1 / (1 + e⁻ᶻ)', { size: 12.5, fill: PAL.ink, mono: true }),
    txt(400, 36, 'ReLU  max(0, z)', { size: 12.5, fill: PAL.ink, mono: true }),
  ];
  const notes = [
    txt(52, 254, 'slope (drawn ×4) peaks at ¼ and dies past |z| ≈ 5 — saturation', { size: 10.5, fill: PAL.loss, opacity: 0 }),
    txt(400, 254, 'slope is exactly 0 or 1 — no attenuation, but half the domain is flat', { size: 10.5, fill: PAL.loss, opacity: 0 }),
  ];
  const clipNote = txt(696, 236, 'unbounded above — the curve leaves the panel', { size: 9.5, anchor: 'end', opacity: 0 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Two panels. On the left the sigmoid curve with its derivative, which peaks at one quarter and flattens toward zero at both extremes. On the right the ReLU curve, a flat segment then a straight rise out of the panel, with its derivative a step that is exactly zero then exactly one.',
  }, heads, A.grid, B.grid, A.curve, B.curve, A.slope, B.slope, notes, clipNote);

  const node = figure(
    `the two activations this chapter needs. Both are nonlinear, so both break the collapse; they differ in what they do to the <em>slope</em>, which is the quantity training depends on. Production blocks use smoothed and gated relatives of these — ${chRef('anatomy')} takes the catalog apart.`,
    root, { wide: true, key: 'acts' });

  track(node, (p) => {
    A.curve.setAttribute('stroke-dashoffset', 1 - seg(p, 0.1, 0.36));
    B.curve.setAttribute('stroke-dashoffset', 1 - seg(p, 0.18, 0.44));
    A.slope.setAttribute('opacity', seg(p, 0.42, 0.56));
    B.slope.setAttribute('opacity', seg(p, 0.48, 0.62));
    notes.forEach((n, i) => n.setAttribute('opacity', seg(p, 0.56 + i * 0.04, 0.68 + i * 0.04)));
    clipNote.setAttribute('opacity', seg(p, 0.3, 0.42) * 0.9);
  });

  return node;
}
