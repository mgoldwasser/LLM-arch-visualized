/* Figure — what a loss number is worth, on a calibrated axis.

   The top of the axis is the loss you get for knowing nothing: predict every
   token uniformly and cross-entropy is exactly ln V. That line, the axis
   scale, the tick spacing, every gap and every perplexity below are computed
   from the vocabulary constant.

   Two levels on the canvas are measurements rather than derivations — a
   previous-token bigram, and a trained transformer, both in nats per token
   over a vocabulary of this size. They are order-of-magnitude anchors, not
   any one model's scoreboard, and the caption says so. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, figure, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, ease } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

const V = K3.vocab;
const UNIFORM = Math.log(V);
const BIGRAM = 7.0;      // measured anchor — a previous-token model, nats/token
const XFORMER = 2.2;     // measured anchor — a trained transformer, nats/token

const n0 = (x) => Math.round(x).toLocaleString('en-US');

export function bigramBaselineFigure() {
  const W = 720, H = 450;
  const AX = 150, LX = 520, Y0 = 52, Y1 = 352;

  /* the axis is derived from the data it has to hold */
  const LMAX = Math.ceil(UNIFORM);
  const TICK = Math.max(1, Math.round(LMAX / 6));
  const y = (L) => Y1 - (L / LMAX) * (Y1 - Y0);
  const ticks = [];
  for (let L = 0; L <= LMAX; L += TICK) ticks.push(L);
  const midY = (Y0 + Y1) / 2;

  const axis = svg('g', { opacity: 0 },
    svg('line', { x1: AX, y1: Y0 - 16, x2: AX, y2: Y1 + 8, stroke: PAL.mut, 'stroke-width': 1 }),
    ticks.map((L) => [
      svg('line', { x1: AX - 5, y1: y(L), x2: AX, y2: y(L), stroke: PAL.mut, 'stroke-width': 1 }),
      txt(AX - 10, y(L) + 4, String(L), { size: 10, anchor: 'end', mono: true }),
    ]),
    svg('g', { transform: `rotate(-90 ${AX - 46} ${midY})` },
      txt(AX - 46, midY, 'loss — nats per token', { size: 11, anchor: 'middle' })),
    svg('line', { x1: AX, y1: Y1, x2: LX, y2: Y1, stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '2 5' }),
    txt(LX + 10, Y1 + 4, 'L = 0 — never reached', { size: 10 }));

  /* one marked loss level: a line that draws left-to-right, plus its labels */
  function level(L, title, sub, { bold = false } = {}) {
    const line = svg('line', {
      x1: AX, y1: y(L), x2: AX, y2: y(L),
      stroke: PAL.loss, 'stroke-width': bold ? 2.2 : 1.6,
      ...(bold ? {} : { 'stroke-dasharray': '7 4' }),
    });
    const lab = svg('g', { opacity: 0 },
      txt(AX + 10, y(L) - 12, title, { size: 12, fill: PAL.ink }),
      txt(AX + 10, y(L) + 15, sub, { size: 10.5, fill: PAL.tx }),
      txt(LX + 10, y(L) + 4, `perplexity ${n0(Math.exp(L))}`, { size: 10.5, fill: PAL.mut, mono: true }));
    return { line, lab };
  }

  const uni = level(UNIFORM, `know nothing — uniform over all ${n0(V)} tokens`,
    `L = ln V = ${UNIFORM.toFixed(2)} nats`, { bold: true });
  const big = level(BIGRAM, 'know only the previous token — a bigram table',
    `L ≈ ${BIGRAM.toFixed(1)} nats`);
  const xfm = level(XFORMER, 'a trained transformer',
    `L ≈ ${XFORMER.toFixed(1)} nats`, { bold: true });

  /* the two gaps, measured off the levels rather than drawn to taste */
  function gap(hi, lo, label) {
    const mid = (y(hi) + y(lo)) / 2;
    return svg('g', { opacity: 0 },
      svg('line', { x1: 470, y1: y(hi), x2: 470, y2: y(lo), stroke: PAL.loss, 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
      svg('path', { d: `M 465 ${y(hi)} h 10 M 465 ${y(lo)} h 10`, stroke: PAL.loss, 'stroke-width': 1 }),
      txt(462, mid - 3, `${(hi - lo).toFixed(2)} nats`, { size: 11.5, fill: PAL.loss, anchor: 'end', mono: true }),
      txt(462, mid + 13, label, { size: 10.5, fill: PAL.tx, anchor: 'end' }));
  }
  const gapA = gap(UNIFORM, BIGRAM, 'what one token of context buys');
  const gapB = gap(BIGRAM, XFORMER, 'what the rest of this book buys');

  const notes = [
    txt(44, 388, `a loss is readable only against its own vocabulary: ${UNIFORM.toFixed(2)} nats is free, and the axis has nowhere below zero to go`, { size: 10.5, fill: PAL.tx, opacity: 0 }),
    txt(44, 410, `each nat removed divides the perplexity by e — from ${n0(V)} plausible next tokens down to about ${n0(Math.exp(XFORMER))}`, { size: 10.5, fill: PAL.tx, opacity: 0 }),
    txt(44, 432, 'the lower gap is the whole argument of the machine: it is bought with architecture, parameters and tokens, and nothing else', { size: 10.5, fill: PAL.loss, opacity: 0 }),
  ];

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `A vertical loss axis in nats per token. A line at ${UNIFORM.toFixed(2)} nats marks the loss of predicting uniformly over a ${n0(V)}-token vocabulary, a second line marks a model that knows only the previous token, and a third marks a trained transformer. The two gaps between them are measured and labelled.`,
  }, axis, uni.line, big.line, xfm.line, gapA, gapB, uni.lab, big.lab, xfm.lab, notes);

  const fig = figure(
    `the reader&rsquo;s first calibrated loss number. The top line is exact — cross-entropy under a uniform guess is ln&nbsp;V, so for K3&rsquo;s ${n0(V)}-token vocabulary a model that has learned nothing scores ${UNIFORM.toFixed(2)} nats. The bigram and transformer levels are order-of-magnitude anchors for a corpus over a vocabulary this size rather than any one model&rsquo;s result; the sizes of the two gaps are the point.`,
    root, { wide: true, key: 'baseline' });

  /* a level's line grows from the axis to full width across its own window */
  const draw = (lv, p, a, b) =>
    lv.line.setAttribute('x2', AX + (LX - AX) * seg(p, a, b, ease.out));

  return pin(fig, (p) => {
    axis.setAttribute('opacity', seg(p, 0.03, 0.10));
    draw(uni, p, 0.12, 0.24);
    uni.lab.setAttribute('opacity', seg(p, 0.20, 0.27));
    draw(big, p, 0.32, 0.42);
    big.lab.setAttribute('opacity', seg(p, 0.39, 0.46));
    gapA.setAttribute('opacity', seg(p, 0.46, 0.53));
    draw(xfm, p, 0.56, 0.66);
    xfm.lab.setAttribute('opacity', seg(p, 0.63, 0.70));
    gapB.setAttribute('opacity', seg(p, 0.70, 0.77));
    notes.forEach((n, i) => n.setAttribute('opacity', seg(p, 0.80 + i * 0.05, 0.86 + i * 0.05)));
  });
}
