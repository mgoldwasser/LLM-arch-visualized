/* Universal approximation, built in front of the reader: one sigmoid is a soft
   step, two steps subtract into a bump, and scaled bumps sum into an arbitrary
   curve. Everything is evaluated live — the drawn paths are the actual output
   of the actual sum, so the staircase error you can see is the real error. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, figure, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, clamp } from '../../core/anim.js';
import { sigmoid } from './net.js';

const W = 720, H = 340;
const X0 = 58, X1 = 690, Y0 = 292, Y1 = 44;   // axes box, y inverted
const K = 120;                                 // step sharpness
const N = 12;                                  // bump count
const SAMP = 300;
const XLO = -0.05, XHI = 1.05;                 // drawn a little past [0, 1] so
                                               // the outermost steps ramp fully

const sx = (x) => X0 + ((x - XLO) / (XHI - XLO)) * (X1 - X0);
const sy = (v) => Y0 + v * (Y1 - Y0);

/* The target: an arbitrary continuous wiggle on [0, 1], nothing special. */
const target = (x) => 0.5 + 0.26 * Math.sin(2 * Math.PI * 1.4 * x + 0.5)
                          + 0.14 * Math.sin(2 * Math.PI * 2.7 * x + 2.0);

const step = (x, a) => sigmoid(K * (x - a));
const bump = (x, i) => step(x, i / N) - step(x, (i + 1) / N);
const height = (i) => target((i + 0.5) / N);

function pathOf(f) {
  let d = '';
  for (let s = 0; s <= SAMP; s++) {
    const x = XLO + (s / SAMP) * (XHI - XLO);
    d += `${s ? 'L' : 'M'} ${sx(x).toFixed(1)} ${sy(clamp(f(x), -0.12, 1.14)).toFixed(1)} `;
  }
  return d;
}

export function approxFigure() {
  const grid = svg('g', {},
    [0, 0.25, 0.5, 0.75, 1].map((v) => svg('line', {
      x1: X0, y1: sy(v), x2: X1, y2: sy(v), stroke: PAL.grid, 'stroke-width': 1,
    })),
    svg('line', { x1: X0, y1: sy(0), x2: X1, y2: sy(0), stroke: 'rgba(230,237,243,0.16)', 'stroke-width': 1 }),
    txt(X0 - 10, sy(0) + 4, '0', { size: 10, anchor: 'end', mono: true }),
    txt(X0 - 10, sy(1) + 4, '1', { size: 10, anchor: 'end', mono: true }),
    [0, 1].map((v) => svg('line', {
      x1: sx(v), y1: Y1 - 4, x2: sx(v), y2: Y0 + 6, stroke: PAL.grid, 'stroke-dasharray': '3 4',
    })),
    txt(sx(0), Y0 + 26, 'x = 0', { size: 10, anchor: 'middle', mono: true }),
    txt(sx(1), Y0 + 26, 'x = 1', { size: 10, anchor: 'middle', mono: true }),
    txt(sx(0.5), Y0 + 26, 'one input dimension, on a bounded interval', { size: 10.5, anchor: 'middle' }));

  const stepA = svg('path', { d: pathOf((x) => step(x, 0.30)), stroke: PAL.act, 'stroke-width': 2, fill: 'none', opacity: 0 });
  const stepB = svg('path', { d: pathOf((x) => step(x, 0.42)), stroke: PAL.act, 'stroke-width': 2, fill: 'none', 'stroke-dasharray': '5 4', opacity: 0 });
  const oneBump = svg('path', { d: pathOf((x) => step(x, 0.30) - step(x, 0.42)), stroke: PAL.act, 'stroke-width': 2.2, fill: 'none', opacity: 0 });

  const tgt = svg('path', { d: pathOf(target), stroke: PAL.mut, 'stroke-width': 1.8, fill: 'none', 'stroke-dasharray': '6 5', opacity: 0 });
  const parts = Array.from({ length: N }, (_, i) => svg('path', {
    d: pathOf((x) => height(i) * bump(x, i)), stroke: PAL.act, 'stroke-width': 1.1, fill: 'none', opacity: 0,
  }));
  const sum = svg('path', { d: '', stroke: PAL.act, 'stroke-width': 2.6, fill: 'none', opacity: 0 });

  const lab1 = txt(sx(0.44), sy(0.86), 'σ(w·x + b) — one neuron, one soft step', { size: 11.5, fill: PAL.act, opacity: 0 });
  const lab2 = txt(sx(0.46), sy(0.24), 'the difference of two steps is a bump', { size: 11.5, fill: PAL.act, opacity: 0 });
  const lab3 = txt(X0, Y1 - 14, '', { size: 11.5, fill: PAL.ink, opacity: 0 });
  const lab4 = txt(X1, Y1 - 14, 'target: an arbitrary continuous function', { size: 10.5, anchor: 'end', opacity: 0 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A single sigmoid drawn as a soft step, then a second step subtracted from it to leave a narrow bump, then twelve scaled bumps accumulating into a staircase that tracks an arbitrary wiggly target curve.',
  }, grid, tgt, parts, stepA, stepB, oneBump, sum, lab1, lab2, lab3, lab4);

  const node = figure(
    'the existence proof, drawn: two sigmoids make a bump, and scaled bumps tile any continuous curve to whatever accuracy you like. What the proof does not say is how many bumps, or how you would ever find them.',
    root, { wide: true, key: 'approx' });

  track(node, (p) => {
    const a = seg(p, 0.06, 0.2);
    const b = seg(p, 0.2, 0.32);
    const merge = seg(p, 0.32, 0.44);
    const fade = seg(p, 0.44, 0.52);

    stepA.setAttribute('opacity', a * (1 - 0.75 * merge) * (1 - fade));
    stepB.setAttribute('opacity', b * (1 - 0.75 * merge) * (1 - fade));
    oneBump.setAttribute('opacity', merge * (1 - fade));
    lab1.setAttribute('opacity', a * (1 - merge));
    lab2.setAttribute('opacity', merge * (1 - fade));

    const build = seg(p, 0.5, 0.92);
    const m = build * N;                       // how many bumps are in the sum
    tgt.setAttribute('opacity', seg(p, 0.46, 0.56) * 0.9);
    lab4.setAttribute('opacity', seg(p, 0.46, 0.56));
    parts.forEach((q, i) => q.setAttribute('opacity', 0.34 * clamp(m - i)));
    sum.setAttribute('opacity', build > 0.01 ? 1 : 0);
    sum.setAttribute('d', build > 0.01
      ? pathOf((x) => {
          let acc = 0;
          for (let i = 0; i < N; i++) acc += clamp(m - i) * height(i) * bump(x, i);
          return acc;
        })
      : '');

    lab3.setAttribute('opacity', seg(p, 0.54, 0.62));
    const used = Math.min(N, Math.ceil(m));
    lab3.textContent = `${used} bump${used === 1 ? '' : 's'} = ${used + 1} hidden neurons — sum of scaled steps`;
  });

  return node;
}
