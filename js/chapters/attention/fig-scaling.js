/* Figure — why the scores are divided by √d_head. Twelve keys and twenty-four
   queries of unit-variance Gaussian coordinates (seeded, so the figure is the
   same on every load). Scrubbing raises the dimension from 4 to 256 by taking
   longer prefixes of the same vectors, so the dot products are genuine and
   move continuously. The bars are the mean softmax profile, sorted, over the
   twenty-four queries; the variance readouts come from all 288 scores. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, clamp, rng } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { softmax } from '../../core/mathtools.js';

const DMAX = 256, NK = 12, NQ = 24, SEED = 12345;

const rand = rng(SEED);
const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const QV = Array.from({ length: NQ }, () => Array.from({ length: DMAX }, gauss));
const KV = Array.from({ length: NK }, () => Array.from({ length: DMAX }, gauss));
/* PREF[i][j][d] = qᵢ · kⱼ truncated to the first d coordinates. */
const PREF = QV.map((q) => KV.map((k) => {
  const a = new Float64Array(DMAX + 1);
  let s = 0;
  for (let c = 0; c < DMAX; c++) { s += q[c] * k[c]; a[c + 1] = s; }
  return a;
}));

const varOf = (xs) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
};

export function scalingFigure() {
  const W = 720, H = 438, BASE = 300, TALL = 180, BW = 18, BGAP = 5;

  const panel = (x0, title) => {
    const bars = Array.from({ length: NK }, (_, j) =>
      svg('rect', { x: x0 + j * (BW + BGAP), y: BASE, width: BW, height: 0, rx: 2, fill: PAL.attn, 'fill-opacity': 0.8 }));
    const span = NK * (BW + BGAP) - BGAP;
    return {
      bars,
      g: svg('g', {},
        txt(x0, 102, title, { size: 12, fill: PAL.ink, mono: true }),
        svg('line', { x1: x0, y1: BASE - TALL / NK, x2: x0 + span, y2: BASE - TALL / NK, stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
        txt(x0 + span + 7, BASE - TALL / NK + 4, '1/12', { size: 9, mono: true }),
        bars,
        svg('line', { x1: x0, y1: BASE, x2: x0 + span, y2: BASE, stroke: PAL.grid, 'stroke-width': 1.2 })),
      v1: txt(x0, BASE + 26, '', { size: 11, fill: PAL.tx, mono: true }),
      v2: txt(x0, BASE + 46, '', { size: 11, mono: true }),
    };
  };
  const left = panel(44, 'unscaled:  sⱼ = q·kⱼ');
  const right = panel(380, 'scaled:    sⱼ = q·kⱼ / √d_head');

  const head = txt(24, 28, 'twenty-four seeded Gaussian queries against twelve seeded keys', { size: 11 });
  const sub = txt(24, 46, 'read to more and more of their coordinates; each bar is the mean softmax weight, sorted largest first', { size: 10.5 });
  const dOut = txt(360, 78, '', { size: 16, fill: PAL.act, anchor: 'middle', mono: true });
  const say1 = txt(24, 386, 'unscaled, the score variance grows with d_head — and softmax turns variance into sharpness', { size: 11.5, fill: PAL.ink });
  const say2 = txt(24, 406, 'at initialization every token would then attend almost entirely to one other token,', { size: 11 });
  const say3 = txt(24, 424, 'where the softmax gradient is near zero and there is nothing for training to move', { size: 11 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Two bar charts of softmax attention weights side by side as the head dimension is raised from 4 to 256. The unscaled chart collapses towards a single tall bar and its score variance climbs with the dimension; the chart scaled by one over the square root of the dimension keeps its bars near the uniform level and its variance near one.',
  }, head, sub, dOut, left.g, right.g, left.v1, left.v2, right.v1, right.v2, say1, say2, say3);

  const node = figure(
    'the softmax does not care how big the scores are, only how far apart. Dot products of d independent unit-variance coordinates have variance d, so raising d_head sharpens every row towards one-hot on its own — an artifact of the dimension, not of the data. Dividing by √d_head cancels it exactly, which is the whole reason the term is there.',
    root, { wide: true, key: 'scaling' });

  const update = (p) => {
    const d = clamp(Math.round(2 ** (2 + 6 * p)), 4, DMAX);
    const rise = seg(p, 0, 0.05);
    const profU = new Array(NK).fill(0), profS = new Array(NK).fill(0), all = [];
    const rt = Math.sqrt(d);
    for (let i = 0; i < NQ; i++) {
      const sc = PREF[i].map((a) => a[d]);
      for (const v of sc) all.push(v);
      softmax(sc).sort((a, b) => b - a).forEach((v, j) => { profU[j] += v / NQ; });
      softmax(sc.map((v) => v / rt)).sort((a, b) => b - a).forEach((v, j) => { profS[j] += v / NQ; });
    }

    dOut.textContent = `d_head = ${d}`;
    dOut.setAttribute('opacity', rise);
    left.g.setAttribute('opacity', rise);
    right.g.setAttribute('opacity', rise);
    head.setAttribute('opacity', rise);
    sub.setAttribute('opacity', rise);
    say1.setAttribute('opacity', seg(p, 0.18, 0.28));
    say2.setAttribute('opacity', seg(p, 0.24, 0.34));
    say3.setAttribute('opacity', seg(p, 0.28, 0.38));

    [[left, profU], [right, profS]].forEach(([pan, prof]) => {
      pan.bars.forEach((b, j) => {
        const h = prof[j] * TALL;
        b.setAttribute('y', BASE - h);
        b.setAttribute('height', h);
      });
    });
    const vU = varOf(all), vS = varOf(all.map((v) => v / rt));
    left.v1.textContent = `var(s) = ${vU.toFixed(1)}   ·   theory: d = ${d}`;
    right.v1.textContent = `var(s) = ${vS.toFixed(2)}   ·   theory: 1`;
    left.v2.textContent = `largest weight ${profU[0].toFixed(3)}`;
    right.v2.textContent = `largest weight ${profS[0].toFixed(3)}`;
    [left, right].forEach((pan) => {
      pan.v1.setAttribute('opacity', rise);
      pan.v2.setAttribute('opacity', rise);
    });
  };
  update(0);
  return pin(node, update, { extent: 300 });
}
