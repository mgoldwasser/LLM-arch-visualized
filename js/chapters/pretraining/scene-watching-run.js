/* Sticky scene — what a pretraining run looks like from the inside.

   Left: the loss curve, generated from a power law in the step count, with a
   seeded per-step noise band around it. Right: the same prompt continued at
   three checkpoints. The scrub selects the checkpoint; the sample texts are
   fixtures, everything numeric is computed. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL, claimFig, chRef, figRef } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, clamp, ease, rng } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

const MAX_STEP = 32000;
const START = Math.log(K3.vocab);   // step zero is the uniform baseline: ln V
const FLOOR = 1.9;                  // measured anchor — where a run of this size lands
const S0 = 30, ALPHA = 0.32;        // the shape of the power law

/* the whole curve, as one function of the step number */
export const lossAt = (s) => FLOOR + (START - FLOOR) * Math.pow(1 + s / S0, -ALPHA);

export const CHECKPOINTS = [20, 400, MAX_STEP];
const PROMPT = 'The';
const SAMPLES = [
  {
    note: 'no structure at all — token soup',
    lines: ['"),[ oreferrer .SizeMode urovsk ;} QUEST',
            '=" ((( disproportion ]); .swing iterator',
            ',, 0439 uing --> Reilly  ISK  .cmp  ~~'],
  },
  {
    note: 'word shapes, English rhythm, no meaning',
    lines: [' mant was a stre of the counter, and the',
            ' pare of his hand seemed to wear that the',
            ' light of the some thing that he could.'],
  },
  {
    note: 'fluent — and inventing the details',
    lines: [' manuscript was found in a sealed crate',
            ' beneath the observatory, dated to the',
            ' spring of 1911 and left unsigned.'],
  },
];

const nInt = (x) => Math.round(x).toLocaleString('en-US');

function runFigure(canvas) {
  const W = 720, H = 470;
  const AX = 66, X1 = 336, Y0 = 62, Y1 = 366;
  const LMAX = Math.ceil(START);
  const x = (s) => AX + (Math.log(Math.max(1, s)) / Math.log(MAX_STEP)) * (X1 - AX);
  const y = (L) => Y1 - (L / LMAX) * (Y1 - Y0);

  /* the series: log-spaced steps, smooth curve plus a seeded noise band */
  const N = 200;
  const jit = rng(43);
  const series = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1);
    const s = Math.exp(t * Math.log(MAX_STEP));
    const amp = 0.9 * Math.pow(1 - t, 1.4) + 0.06;
    return { s, L: lossAt(s), noisy: lossAt(s) + (jit() - 0.5) * amp };
  });
  const poly = (pts, k) => pts.map((d) => `${x(d.s)},${y(d[k])}`).join(' ');

  const grid = svg('g', { opacity: 0 },
    svg('line', { x1: AX, y1: Y0 - 14, x2: AX, y2: Y1, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: AX, y1: Y1, x2: X1 + 10, y2: Y1, stroke: PAL.mut, 'stroke-width': 1 }),
    [0, 1, 2, 3, 4].map((i) => (i * LMAX) / 4).map((L) => [
      svg('line', { x1: AX - 5, y1: y(L), x2: AX, y2: y(L), stroke: PAL.mut, 'stroke-width': 1 }),
      txt(AX - 9, y(L) + 4, String(L), { size: 9.5, anchor: 'end', mono: true }),
    ]),
    [1, 10, 100, 1000, 10000].map((s) => txt(x(s), Y1 + 14, nInt(s), { size: 9, anchor: 'middle', mono: true })),
    txt(AX, Y0 - 24, 'loss — nats per token', { size: 10.5 }),
    txt((AX + X1) / 2, Y1 + 32, 'step (log scale) →', { size: 10, anchor: 'middle' }),
    txt(X1 + 8, y(START) + 4, 'ln V', { size: 9.5, fill: PAL.mut, mono: true }));

  const noiseLine = svg('polyline', { points: '', fill: 'none', stroke: PAL.loss, 'stroke-opacity': 0.22, 'stroke-width': 1 });
  const meanLine = svg('polyline', { points: '', fill: 'none', stroke: PAL.loss, 'stroke-width': 2, 'stroke-linejoin': 'round' });
  const marks = CHECKPOINTS.map((s) => svg('circle', { cx: x(s), cy: y(lossAt(s)), r: 4, fill: PAL.bg, stroke: PAL.loss, 'stroke-width': 1.8, opacity: 0 }));
  const cursor = svg('g', { opacity: 0 },
    svg('line', { x1: 0, y1: Y0 - 14, x2: 0, y2: Y1, stroke: PAL.loss, 'stroke-width': 1, 'stroke-dasharray': '3 4' }));
  const readout = txt(AX, Y0 - 40, '', { size: 15, fill: PAL.loss, mono: true, opacity: 0 });

  /* the sample panel */
  const PX = 372, PW = 328;
  const panel = svg('g', { opacity: 0 },
    svg('rect', { x: PX, y: Y0 - 42, width: PW, height: 322, rx: 10, fill: 'rgba(90,200,220,0.04)', stroke: PAL.act, 'stroke-width': 1 }),
    txt(PX + 16, Y0 - 22, 'the same prompt, continued', { size: 10.5 }),
    txt(PX + 16, Y0 + 4, `prompt ▸ ${PROMPT}`, { size: 12, fill: PAL.act, mono: true }));
  const sampleLines = [0, 1, 2].map((i) => txt(PX + 16, Y0 + 44 + i * 22, '', { size: 11.5, fill: PAL.ink, mono: true }));
  const sampleNote = txt(PX + 16, Y0 + 132, '', { size: 10.5, fill: PAL.act });
  const statRows = ['step', 'loss', 'perplexity'].map((k, i) => ({
    k: txt(PX + 16, Y0 + 176 + i * 24, k, { size: 10.5 }),
    v: txt(PX + PW - 16, Y0 + 176 + i * 24, '', { size: 12, fill: PAL.tx, anchor: 'end', mono: true }),
  }));
  const statBox = svg('g', { opacity: 0 },
    svg('line', { x1: PX + 16, y1: Y0 + 156, x2: PX + PW - 16, y2: Y0 + 156, stroke: PAL.mut, 'stroke-width': 0.8 }),
    statRows.map((r) => [r.k, r.v]));

  const closing = txt(66, 438, '', { size: 11, fill: PAL.tx, opacity: 0 });

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A loss curve descending on a logarithmic step axis, with three checkpoints marked. Beside it, a panel shows the same prompt continued by the model at the selected checkpoint: token soup early, word-shaped gibberish in the middle, fluent prose at the end, with the step, loss and perplexity for each.',
  }, grid, noiseLine, meanLine, marks, cursor, readout, panel, sampleLines, sampleNote, statBox, closing));

  return (p, stepIdx) => {
    grid.setAttribute('opacity', seg(p, 0.01, 0.06));
    panel.setAttribute('opacity', seg(p, 0.02, 0.07));
    statBox.setAttribute('opacity', seg(p, 0.03, 0.08));

    /* the curve reaches checkpoint i exactly at the end of card i */
    const ci = clamp(stepIdx, 0, CHECKPOINTS.length - 1);
    const within = clamp(p * CHECKPOINTS.length - ci);
    const idxOf = (c) => {
      const i = series.findIndex((d) => d.s >= CHECKPOINTS[c]);
      return i < 0 ? series.length - 1 : i;
    };
    const from = ci === 0 ? 0 : idxOf(ci - 1);
    const upto = Math.round(lerp(from, idxOf(ci), ease.out(within))) + 1;
    const shown = series.slice(0, Math.max(2, upto));
    meanLine.setAttribute('points', poly(shown, 'L'));
    noiseLine.setAttribute('points', poly(shown, 'noisy'));

    const head = shown[shown.length - 1];
    cursor.setAttribute('opacity', seg(p, 0.04, 0.09));
    cursor.setAttribute('transform', `translate(${x(head.s)} 0)`);
    readout.setAttribute('opacity', seg(p, 0.04, 0.09));
    readout.textContent = `loss ${head.L.toFixed(2)}`;
    marks.forEach((m, i) => m.setAttribute('opacity', head.s >= CHECKPOINTS[i] ? 1 : 0));

    /* the panel always shows the checkpoint the scrub has selected */
    const cp = CHECKPOINTS[ci], L = lossAt(cp);
    SAMPLES[ci].lines.forEach((s, i) => { sampleLines[i].textContent = s; });
    sampleLines.forEach((t) => t.setAttribute('opacity', seg(p, 0.05, 0.10)));
    sampleNote.textContent = SAMPLES[ci].note;
    sampleNote.setAttribute('opacity', seg(p, 0.06, 0.11));
    statRows[0].v.textContent = nInt(cp);
    statRows[1].v.textContent = `${L.toFixed(2)} nats`;
    statRows[2].v.textContent = nInt(Math.exp(L));

    closing.textContent = 'three weeks of wall-clock sit between the second frame and the third';
    closing.setAttribute('opacity', seg(p, 0.86, 0.94));
  };
}

export function watchingRunScene() {
  /* the caption for this scene lives in the prose beneath it, so the number
     is claimed here — at the point on the page where the figure appears */
  claimFig('run');
  return createScene({
    id: 'pretraining-run',
    figure: runFigure,
    steps: [
      { n: 'STEP 1 / 3 — MINUTE ONE', html: `<p>Twenty steps in, the weights are still close to their random initialization and the loss is still close to the line it starts from — ln&nbsp;V, the uniform guess of ${figRef('pretraining', 'baseline')}. Sample from the model and you get token soup: the vocabulary is being drawn from more or less at random, because nothing has yet taught it that some tokens are common and most are not. Everything visible here was bought with about a second of the fleet&rsquo;s time.</p>` },
      { n: 'STEP 2 / 3 — HOUR ONE', html: `<p>Four hundred steps. The loss has fallen by more than a third and the sample has crossed a threshold that is hard to unsee: the output now has the <em>shape</em> of English. Word lengths are right, spaces fall in plausible places, common function words appear where common function words go. It means nothing, and it is composed entirely of correct-looking pieces. What the model has learned so far is the statistics a bigram table would have learned, and a little more.</p>` },
      { n: 'STEP 3 / 3 — WEEK THREE', html: `<p>Thirty-two thousand steps and a bill in the millions, and the samples are fluent. Note what fluency is not: the sentence here is well-formed and its details are invented, because nothing in the objective ever asked for true — it asked for likely. That gap is the whole subject of ${chRef('base-model')}.</p><p>Between the three frames sit weeks in which the run does not visibly change. The researcher&rsquo;s job for most of that time is to watch one number go down, and to know what it should be doing — which is why ${figRef('pretraining', 'baseline')} had to come first.</p>` },
    ],
  });
}
