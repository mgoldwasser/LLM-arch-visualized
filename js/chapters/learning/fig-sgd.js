/* Minibatch noise, computed rather than drawn. A 24-example toy dataset: each
   example has its own minimum, the full loss is their average, and a minibatch
   gradient is the exact average over four of them. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, figure, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, ease, rng } from '../../core/anim.js';

const M = 24, BATCH = 4, ETA = 0.25, STEPS = 18;
const CURV = [1, 3];                       // per-axis curvature of every example
const START = [0.2, 1.3];
const S = 85.3, PX0 = 40 + 1 * S, PY0 = 180;   // θ₁ = −1 at x = 40; θ₂ = 0 at y = 180
const px = (v) => PX0 + v * S;
const py = (v) => PY0 - v * S;

/* the dataset: 24 example minima, seeded so every load is identical */
function dataset() {
  const r = rng(17);
  const c = Array.from({ length: M }, () => [4.0 + (r() * 2 - 1) * 1.9, (r() * 2 - 1) * 1.15]);
  const mean = c.reduce((a, v) => [a[0] + v[0] / M, a[1] + v[1] / M], [0, 0]);
  return { c, mean };
}
const gradAt = (t, ctr) => [CURV[0] * (t[0] - ctr[0]), CURV[1] * (t[1] - ctr[1])];
const batchCentre = (c, idx) => idx.reduce((a, i) => [a[0] + c[i][0] / idx.length, a[1] + c[i][1] / idx.length], [0, 0]);

function pickBatch(r) {
  const idx = [];
  while (idx.length < BATCH) {
    const i = Math.floor(r() * M);
    if (!idx.includes(i)) idx.push(i);
  }
  return idx;
}

export function figSgd() {
  const W = 720, H = 380;
  const { c, mean } = dataset();

  /* trajectories: exact full-batch descent, and seeded minibatch descent */
  const full = [START];
  for (let k = 0; k < STEPS; k++) {
    const t = full[k], g = gradAt(t, mean);
    full.push([t[0] - ETA * g[0], t[1] - ETA * g[1]]);
  }
  const rs = rng(101);
  const sgd = [START];
  for (let k = 0; k < STEPS; k++) {
    const t = sgd[k], g = gradAt(t, batchCentre(c, pickBatch(rs)));
    sgd.push([t[0] - ETA * g[0], t[1] - ETA * g[1]]);
  }
  /* eight candidate minibatch gradients at the starting point */
  const rf = rng(5);
  const fan = Array.from({ length: 8 }, () => gradAt(START, batchCentre(c, pickBatch(rf))));
  const trueG = gradAt(START, mean);

  const contours = [0.15, 0.6, 1.5, 2.6, 4].map((v) => svg('ellipse', {
    cx: px(mean[0]), cy: py(mean[1]), rx: Math.sqrt(2 * v / CURV[0]) * S, ry: Math.sqrt(2 * v / CURV[1]) * S,
    fill: 'none', stroke: PAL.loss, 'stroke-opacity': 0.3, 'stroke-width': 1, opacity: 0,
  }));
  const exDots = c.map((v) => svg('circle', { cx: px(v[0]), cy: py(v[1]), r: 2.6, fill: PAL.mut, opacity: 0 }));
  const meanMark = svg('g', { opacity: 0 },
    svg('path', { d: `M ${px(mean[0]) - 6} ${py(mean[1])} h 12 M ${px(mean[0])} ${py(mean[1]) - 6} v 12`, stroke: PAL.train, 'stroke-width': 1.6 }),
    txt(px(mean[0]) + 10, py(mean[1]) - 12, 'minimum of the full loss', { size: 10, fill: PAL.train }));

  const step = (g) => [px(START[0] - ETA * g[0]), py(START[1] - ETA * g[1])];
  const fanArrows = fan.map((g) => svg('line', {
    x1: px(START[0]), y1: py(START[1]), x2: step(g)[0], y2: step(g)[1],
    stroke: PAL.loss, 'stroke-opacity': 0.42, 'stroke-width': 1.2, 'marker-end': 'url(#arrS4)', opacity: 0,
  }));
  const trueArrow = svg('line', {
    x1: px(START[0]), y1: py(START[1]), x2: step(trueG)[0], y2: step(trueG)[1],
    stroke: PAL.loss, 'stroke-width': 2.4, 'marker-end': 'url(#arrS4b)', opacity: 0,
  });
  const fanTag = txt(px(START[0]) - 6, py(START[1]) - 14, 'one minibatch of 4 → one noisy estimate', { size: 10, fill: PAL.loss, opacity: 0 });
  const trueTag = txt(px(START[0]) + 96, py(START[1]) + 6, '−η∇L over all 24', { size: 10.5, fill: PAL.loss, mono: true, opacity: 0 });

  const poly = (pts) => pts.map((t) => `${px(t[0])},${py(t[1])}`).join(' ');
  const fullLine = svg('polyline', { points: '', fill: 'none', stroke: PAL.mut, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' });
  const sgdLine = svg('polyline', { points: '', fill: 'none', stroke: PAL.train, 'stroke-width': 1.8, 'stroke-linejoin': 'round' });
  const sgdDots = sgd.map((t) => svg('circle', { cx: px(t[0]), cy: py(t[1]), r: 2.6, fill: PAL.train, opacity: 0 }));
  const legend = svg('g', { opacity: 0 },
    svg('line', { x1: 470, y1: 60, x2: 500, y2: 60, stroke: PAL.mut, 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }),
    txt(508, 64, 'full-batch — all 24 examples per step', { size: 10 }),
    svg('line', { x1: 470, y1: 78, x2: 500, y2: 78, stroke: PAL.train, 'stroke-width': 1.8 }),
    txt(508, 82, 'minibatch of 4 — same η, same start', { size: 10, fill: PAL.train }));

  const notes = [
    txt(40, 344, 'the minibatch gradient is unbiased: average enough of them and you recover ∇L exactly', { size: 10.5, opacity: 0 }),
    txt(40, 364, 'but a single one is wrong — so the path wanders, and near the minimum it never settles, it circulates in a ball whose radius scales with η', { size: 10.5, fill: PAL.tx, opacity: 0 }),
  ];

  const defs = svg('defs', {},
    svg('marker', { id: 'arrS4', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.loss, 'fill-opacity': 0.5 })),
    svg('marker', { id: 'arrS4b', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.loss })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A contour map of a loss averaged over 24 examples, each example minimum drawn as a small dot. Eight minibatch gradient arrows fan out around the true gradient arrow at the starting point. A dashed full-batch path descends smoothly to the minimum while a solid minibatch path wanders around it and keeps jittering near the bottom.',
  }, defs,
    txt(40, 26, 'a 24-example toy dataset — every example has its own minimum, the full loss is their average', { size: 11 }),
    contours, exDots, meanMark, fullLine, sgdLine, sgdDots,
    fanArrows, trueArrow, fanTag, trueTag, legend, notes);

  const fig = figure(
    `why minibatches work. The dashed path uses all 24 examples per step; the solid path uses four, drawn from a fixed seed. Same learning rate, same start, roughly the same destination — for a sixth of the arithmetic. The jitter near the bottom is not a bug in the drawing: it is the noise floor of stochastic gradient descent.`,
    root, { wide: true, key: 'sgd' });

  track(fig, (p) => {
    contours.forEach((e, i) => e.setAttribute('opacity', seg(p, 0.04 + i * 0.012, 0.12 + i * 0.012)));
    exDots.forEach((d, i) => d.setAttribute('opacity', seg(p, 0.06 + (i % 8) * 0.006, 0.15 + (i % 8) * 0.006) * 0.8));
    meanMark.setAttribute('opacity', seg(p, 0.12, 0.18));

    trueArrow.setAttribute('opacity', seg(p, 0.20, 0.26));
    trueTag.setAttribute('opacity', seg(p, 0.22, 0.28));
    fanArrows.forEach((a, i) => a.setAttribute('opacity', seg(p, 0.26 + i * 0.012, 0.33 + i * 0.012)));
    fanTag.setAttribute('opacity', seg(p, 0.30, 0.36));

    const nF = Math.round(STEPS * seg(p, 0.44, 0.66, ease.linear));
    fullLine.setAttribute('points', poly(full.slice(0, nF + 1)));
    legend.setAttribute('opacity', seg(p, 0.46, 0.52));
    const nS = Math.round(STEPS * seg(p, 0.56, 0.86, ease.linear));
    sgdLine.setAttribute('points', poly(sgd.slice(0, nS + 1)));
    sgdDots.forEach((d, i) => d.setAttribute('opacity', i <= nS ? 0.9 : 0));

    notes[0].setAttribute('opacity', seg(p, 0.72, 0.80));
    notes[1].setAttribute('opacity', seg(p, 0.84, 0.92));
  });
  return fig;
}
