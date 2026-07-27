/* Figure — the training loss and the held-out loss, and the point where they
   stop telling the same story.

   Both curves are generated: an exponential approach to a floor for the loss
   the model can honestly claim, plus a growing term for the part of the fit
   that is specific to the training corpus. The marker is not placed — it is
   the argmin of the held-out series, found by scanning it. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, figure, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, ease, rng } from '../../core/anim.js';

const N = 160;
const FLOOR = 1.6, AMP = 3.2, K = 3.2;   // the part both splits agree on
const G = 1.5, GP = 3.2;                 // the part only the training split gets

const trainF = (t) => FLOOR + AMP * Math.exp(-K * t);
const memoF = (t) => G * Math.pow(t, GP);

export function overfitFigure() {
  const W = 720, H = 432;
  const X0 = 76, X1 = 612, Y0 = 54, Y1 = 330;

  const jt = rng(29), jv = rng(97);
  const pts = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1);
    return {
      t,
      train: trainF(t) + (jt() - 0.5) * 0.040,
      val: trainF(t) + memoF(t) + (jv() - 0.5) * 0.075,
    };
  });

  /* the onset of overfitting, read off the data: where held-out loss bottoms */
  let cut = 0;
  for (let i = 1; i < N; i++) if (pts[i].val < pts[cut].val) cut = i;

  const all = pts.flatMap((d) => [d.train, d.val]);
  const LMAX = Math.ceil(Math.max(...all));
  const LMIN = Math.floor(Math.min(...all));
  const x = (t) => X0 + t * (X1 - X0);
  const y = (L) => Y1 - ((L - LMIN) / (LMAX - LMIN)) * (Y1 - Y0);
  const ticks = [];
  for (let L = LMIN; L <= LMAX; L++) ticks.push(L);

  const axes = svg('g', { opacity: 0 },
    svg('line', { x1: X0, y1: Y0 - 14, x2: X0, y2: Y1, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: X0, y1: Y1, x2: X1 + 12, y2: Y1, stroke: PAL.mut, 'stroke-width': 1 }),
    ticks.map((L) => [
      svg('line', { x1: X0 - 5, y1: y(L), x2: X0, y2: y(L), stroke: PAL.mut, 'stroke-width': 1 }),
      txt(X0 - 9, y(L) + 4, String(L), { size: 10, anchor: 'end', mono: true }),
    ]),
    txt(X0, Y0 - 24, 'loss — nats per token', { size: 10.5 }),
    txt((X0 + X1) / 2, Y1 + 26, 'tokens seen →', { size: 10, anchor: 'middle' }));

  const poly = (k, upto) => pts.slice(0, Math.max(2, upto)).map((d) => `${x(d.t)},${y(d[k])}`).join(' ');
  const trainLine = svg('polyline', { points: '', fill: 'none', stroke: PAL.loss, 'stroke-width': 2, 'stroke-linejoin': 'round' });
  const valLine = svg('polyline', { points: '', fill: 'none', stroke: PAL.loss, 'stroke-opacity': 0.62, 'stroke-width': 2, 'stroke-dasharray': '7 4', 'stroke-linejoin': 'round' });

  const endTrain = svg('g', { opacity: 0 },
    txt(X1 + 16, y(pts[N - 1].train) + 4, 'training loss', { size: 11, fill: PAL.loss }),
    txt(X1 + 16, y(pts[N - 1].train) + 19, 'still falling', { size: 9.5 }));
  const endVal = svg('g', { opacity: 0 },
    txt(X1 + 16, y(pts[N - 1].val) + 4, 'held-out loss', { size: 11, fill: PAL.loss }),
    txt(X1 + 16, y(pts[N - 1].val) + 19, 'rising', { size: 9.5 }));

  /* the wedge between the curves, from the marker onward */
  const wedge = svg('path', {
    d: `M ${pts.slice(cut).map((d) => `${x(d.t)},${y(d.val)}`).join(' L ')} L ${pts.slice(cut).reverse().map((d) => `${x(d.t)},${y(d.train)}`).join(' L ')} Z`,
    fill: 'rgba(240,120,80,0.14)', stroke: 'none', opacity: 0,
  });

  const cutPct = Math.round((pts[cut].t) * 100);
  const marker = svg('g', { opacity: 0 },
    svg('line', { x1: x(pts[cut].t), y1: Y0 - 14, x2: x(pts[cut].t), y2: Y1, stroke: PAL.ink, 'stroke-width': 1, 'stroke-dasharray': '3 4' }),
    svg('circle', { cx: x(pts[cut].t), cy: y(pts[cut].val), r: 4.5, fill: PAL.bg, stroke: PAL.ink, 'stroke-width': 1.8 }),
    txt(x(pts[cut].t) + 10, Y0 - 2, 'the held-out loss stops falling', { size: 11.5, fill: PAL.ink }),
    txt(x(pts[cut].t) + 10, Y0 + 14, `${cutPct}% of the way through this run`, { size: 10 }));
  const wedgeLab = txt(x(pts[Math.round(N * 0.86)].t), y(pts[Math.round(N * 0.86)].train) + 20,
    'everything in here is memorization', { size: 10.5, fill: PAL.loss, anchor: 'middle', opacity: 0 });

  const legend = svg('g', { opacity: 0 },
    svg('line', { x1: X0 + 16, y1: Y1 - 26, x2: X0 + 46, y2: Y1 - 26, stroke: PAL.loss, 'stroke-width': 2 }),
    txt(X0 + 54, Y1 - 22, 'loss on the data it is training on', { size: 10, fill: PAL.tx }),
    svg('line', { x1: X0 + 16, y1: Y1 - 10, x2: X0 + 46, y2: Y1 - 10, stroke: PAL.loss, 'stroke-opacity': 0.62, 'stroke-width': 2, 'stroke-dasharray': '7 4' }),
    txt(X0 + 54, Y1 - 6, 'loss on a split it has never seen', { size: 10, fill: PAL.tx }));

  const notes = [
    txt(76, 366, 'the training loss falls the whole way and never reports a problem — on its own it is not evidence of anything', { size: 10.5, fill: PAL.tx, opacity: 0 }),
    txt(76, 388, 'you want a model that writes like the corpus, not one that returns it — only held-out data can tell those apart', { size: 10.5, fill: PAL.tx, opacity: 0 }),
    txt(76, 410, 'past the mark, extra steps buy the second thing — and buy back some of the first', { size: 10.5, fill: PAL.loss, opacity: 0 }),
  ];

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Two loss curves against tokens seen. They descend together; the solid training curve keeps falling to the end, while the dashed held-out curve bottoms out ${cutPct} percent of the way through the run and then rises. The gap after that point is shaded and labelled as memorization.`,
  }, axes, wedge, valLine, trainLine, marker, wedgeLab, endTrain, endVal, legend, notes);

  const fig = figure(
    `the one measurement that can tell learning from memorizing. Both curves are computed — a shared exponential approach to a floor, plus a term that grows only on the split being trained on — and the marker is the argmin of the held-out series, found by scanning it rather than placed by eye. Full-scale pretraining runs rarely reach this point, because they see most tokens once; every fine-tune does.`,
    root, { wide: true, key: 'holdout' });

  return pin(fig, (p) => {
    axes.setAttribute('opacity', seg(p, 0.03, 0.10));
    legend.setAttribute('opacity', seg(p, 0.06, 0.13));
    trainLine.setAttribute('points', poly('train', Math.round(N * seg(p, 0.12, 0.42, ease.linear))));
    valLine.setAttribute('points', poly('val', Math.round(N * seg(p, 0.18, 0.50, ease.linear))));
    endTrain.setAttribute('opacity', seg(p, 0.46, 0.53));
    endVal.setAttribute('opacity', seg(p, 0.50, 0.57));
    marker.setAttribute('opacity', seg(p, 0.58, 0.66));
    wedge.setAttribute('opacity', seg(p, 0.66, 0.74));
    wedgeLab.setAttribute('opacity', seg(p, 0.70, 0.78));
    notes.forEach((n, i) => n.setAttribute('opacity', seg(p, 0.76 + i * 0.06, 0.83 + i * 0.06)));
  });
}
