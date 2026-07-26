/* Sticky scene — six raw logits are exponentiated, normalized into a
   distribution, and then the truth arrives: the cross-entropy sum collapses to
   a single −log p term, and that number is the loss.

   Every value drawn here is computed from the logit list below. Nothing is
   hard-coded; a reader recomputing e^z / Σ e^z by hand will match the pixels. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease } from '../../core/anim.js';
import { softmax } from '../../core/mathtools.js';
import { K3 } from '../../../data/k3.js';

export const CONTEXT = 'The cat sat on the';
const CANDIDATES = [
  ['mat', 3.6], ['floor', 2.4], ['couch', 1.9], ['table', 1.2], ['roof', 0.5], ['sill', -0.4],
];
const TRUTH = 1;                                   // the corpus continued “floor”

const Z = CANDIDATES.map(([, z]) => z);
const EXP = Z.map(Math.exp);
const SUM = EXP.reduce((a, b) => a + b, 0);
const P = softmax(Z);

/* Exported so the surrounding prose can quote the same live numbers. */
export const SCENE = {
  truth: CANDIDATES[TRUTH][0],
  top: CANDIDATES[0][0],
  pTruth: P[TRUTH],
  pTop: P[0],
  loss: -Math.log(P[TRUTH]),
  ppl: 1 / P[TRUTH],
  sum: SUM,
  n: CANDIDATES.length,
};

function softmaxFigure(canvas) {
  const W = 720, H = 486;
  const N = CANDIDATES.length;
  const X0 = 60, SLOT = 74, BW = 42, BASE = 300, MAXH = 190;
  const bx = (i) => X0 + i * SLOT + (SLOT - BW) / 2;
  const cx = (i) => bx(i) + BW / 2;
  const SX = 566, SW = 54;                          // the stacked total column

  const maxAbsZ = Math.max(...Z.map(Math.abs));
  const maxE = Math.max(...EXP);
  const hL = Z.map((z) => (z / maxAbsZ) * MAXH * 0.92);
  const hE = EXP.map((e) => (e / maxE) * MAXH);
  const hP = P.map((q) => q * MAXH);

  const ctxLine = txt(X0, 28, `“${CONTEXT} …”`, { size: 14, fill: PAL.ink, mono: true });
  const sub = txt(X0, 46, `${N} of ${K3.vocab.toLocaleString('en-US')} vocabulary entries`, { size: 10.5 });
  const stageTag = txt(X0, 72, '', { size: 11.5, fill: PAL.act, mono: true });

  const zeroLine = svg('line', { x1: X0 - 12, y1: BASE, x2: X0 + N * SLOT, y2: BASE, stroke: PAL.grid.replace('0.06', '0.34'), 'stroke-width': 1 });
  const zeroTag = txt(X0 - 16, BASE + 4, '0', { size: 10, anchor: 'end', mono: true });
  const oneLine = svg('line', { x1: X0 - 12, y1: BASE - MAXH, x2: X0 + N * SLOT, y2: BASE - MAXH, stroke: PAL.act, 'stroke-width': 1, 'stroke-dasharray': '5 4', opacity: 0 });
  const oneTag = txt(X0 - 16, BASE - MAXH + 4, 'p = 1', { size: 10, anchor: 'end', mono: true, fill: PAL.act, opacity: 0 });

  const bars = CANDIDATES.map((_, i) => svg('rect', { x: bx(i), y: BASE, width: BW, height: 0, rx: 3, fill: PAL.act, opacity: 0.9 }));
  const ring = svg('rect', { x: bx(TRUTH) - 4, y: BASE, width: BW + 8, height: 0, rx: 5, fill: 'none', stroke: PAL.loss, 'stroke-width': 1.8, opacity: 0 });
  const vals = CANDIDATES.map((_, i) => txt(cx(i), BASE, '', { size: 11, anchor: 'middle', mono: true, fill: PAL.tx }));
  const names = CANDIDATES.map(([w], i) => txt(cx(i), BASE + 52, w, { size: 12, anchor: 'middle', mono: true, fill: PAL.tx }));

  /* the total column: six segments that stack to Σ e^z — and to exactly 1 */
  let cum = 0;
  const segs = P.map((q) => {
    const h = q * MAXH;
    const r = svg('rect', { x: SX, y: BASE - cum - h, width: SW, height: h, rx: 2, fill: PAL.act, opacity: 0.28 + 0.5 * q });
    cum += h;
    return r;
  });
  const stackFrame = svg('rect', { x: SX - 2, y: BASE - MAXH - 2, width: SW + 4, height: MAXH + 4, rx: 4, fill: 'none', stroke: PAL.act, 'stroke-width': 1.2 });
  const sumLabel = txt(SX + SW / 2, BASE - MAXH - 12, `Σⱼ e^zⱼ = ${SUM.toFixed(2)}`, { size: 11.5, anchor: 'middle', mono: true, fill: PAL.act });
  const oneLabel = txt(SX + SW / 2, BASE - MAXH - 12, 'total = 1.00', { size: 11.5, anchor: 'middle', mono: true, fill: PAL.act, opacity: 0 });
  const stack = svg('g', { opacity: 0 }, segs, stackFrame);

  /* the truth, and the six terms of the cross-entropy sum */
  const truthLab = txt(SX - 30, 400, 'y — one-hot truth', { size: 10.5, fill: PAL.loss });
  const termLab = txt(SX - 30, 434, '−yᵢ log pᵢ — the terms', { size: 10.5, fill: PAL.loss });
  const cells = CANDIDATES.map((_, i) => svg('rect', {
    x: cx(i) - 15, y: 384, width: 30, height: 22, rx: 4,
    fill: i === TRUTH ? 'rgba(240,120,80,0.18)' : 'none',
    stroke: i === TRUTH ? PAL.loss : PAL.mut, 'stroke-width': 1,
  }));
  const cellVals = CANDIDATES.map((_, i) => txt(cx(i), 400, i === TRUTH ? '1' : '0', {
    size: 12, anchor: 'middle', mono: true, fill: i === TRUTH ? PAL.loss : PAL.mut,
  }));
  const terms = CANDIDATES.map((_, i) => txt(cx(i), 434, i === TRUTH ? SCENE.loss.toFixed(3) : '0.000', {
    size: 12, anchor: 'middle', mono: true, fill: i === TRUTH ? PAL.loss : PAL.mut,
  }));
  const gTruth = svg('g', { opacity: 0 }, truthLab, cells, cellVals);
  const gTerms = svg('g', { opacity: 0 }, termLab);
  const result = txt(W / 2, 470, `L = −log p(${SCENE.truth}) = ${SCENE.loss.toFixed(3)} nats · perplexity e^L = ${SCENE.ppl.toFixed(2)}`,
    { size: 13.5, anchor: 'middle', mono: true, fill: PAL.loss, opacity: 0 });

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': `Six candidate next tokens after the words “${CONTEXT}”. Their raw logits are exponentiated, then divided by their sum to give a probability distribution that stacks to exactly one. The true next token “${SCENE.truth}” is then revealed as a one-hot vector, every other term of the cross-entropy sum is multiplied by zero, and the single surviving term, minus the log of ${SCENE.pTruth.toFixed(4)}, is the loss of ${SCENE.loss.toFixed(3)} nats.`,
  }, ctxLine, sub, stageTag, zeroLine, zeroTag, oneLine, oneTag, stack, sumLabel, oneLabel,
     bars, ring, vals, names, gTruth, terms, gTerms, result));

  return (p) => {
    const tIn = seg(p, 0.02, 0.15, ease.out);
    const t2 = seg(p, 0.22, 0.36);                  // → e^z
    const t3 = seg(p, 0.44, 0.56);                  // → ÷ Σ

    bars.forEach((b, i) => {
      const h = lerp(lerp(hL[i], hE[i], t2), hP[i], t3) * tIn;
      b.setAttribute('y', h >= 0 ? BASE - h : BASE);
      b.setAttribute('height', Math.abs(h));
      vals[i].setAttribute('y', h >= 0 ? BASE - h - 8 : BASE + Math.abs(h) + 15);
      vals[i].setAttribute('opacity', tIn);
      vals[i].textContent = p < 0.30 ? Z[i].toFixed(1)
        : p < 0.50 ? EXP[i].toFixed(2)
        : (P[i] * 100).toFixed(1) + '%';
      names[i].setAttribute('opacity', tIn);
    });
    const hT = lerp(lerp(hL[TRUTH], hE[TRUTH], t2), hP[TRUTH], t3) * tIn;
    ring.setAttribute('y', BASE - hT - 4);
    ring.setAttribute('height', Math.abs(hT) + 8);
    ring.setAttribute('opacity', seg(p, 0.62, 0.72));

    zeroLine.setAttribute('opacity', 1);
    zeroTag.setAttribute('opacity', 1 - seg(p, 0.44, 0.52));
    oneLine.setAttribute('opacity', seg(p, 0.46, 0.56) * 0.75);
    oneTag.setAttribute('opacity', seg(p, 0.46, 0.56));

    stack.setAttribute('opacity', seg(p, 0.26, 0.34));
    sumLabel.setAttribute('opacity', seg(p, 0.26, 0.34) * (1 - seg(p, 0.44, 0.50)));
    oneLabel.setAttribute('opacity', seg(p, 0.50, 0.57));

    gTruth.setAttribute('opacity', seg(p, 0.62, 0.72));
    gTerms.setAttribute('opacity', seg(p, 0.70, 0.80));
    const fade = 1 - seg(p, 0.84, 0.92);
    terms.forEach((t, i) => t.setAttribute('opacity', seg(p, 0.70, 0.80) * (i === TRUTH ? 1 : fade)));
    result.setAttribute('opacity', seg(p, 0.88, 0.97));

    stageTag.textContent =
      p < 0.20 ? 'LOGITS — arbitrary reals, one per vocabulary entry' :
      p < 0.40 ? 'EXPONENTIATE — e^zᵢ > 0, gaps become ratios' :
      p < 0.60 ? 'NORMALIZE — divide by the sum, and it is a distribution' :
      p < 0.80 ? 'THE TRUTH — y is one-hot, so five terms are multiplied by 0' :
                 `THE LOSS — one term survives: −log p(${SCENE.truth})`;
  };
}

export function softmaxScene() {
  const e1 = Math.E.toFixed(3);
  return createScene({
    id: 'softmax-collapse',
    figure: softmaxFigure,
    steps: [
      { n: 'STEP 1 / 5 — LOGITS', html: `<p>The final layer emits one real number per vocabulary entry — a <strong>logit</strong>. They are unbounded, they can be negative (<code>sill</code> here is), and they do not sum to anything in particular. They are scores, not probabilities.</p>` },
      { n: 'STEP 2 / 5 — EXPONENTIATE', html: `<p>Apply e^z to each. Two things happen at once: every value becomes strictly positive, and <em>differences</em> in logits become <em>ratios</em> in weight. A gap of one logit is a factor of e ≈ ${e1}, whatever the two logits were — which is why only the gaps ever matter.</p>` },
      { n: 'STEP 3 / 5 — NORMALIZE', html: `<p>Add the six exponentials up (${SUM.toFixed(2)}) and divide each by that total. The column on the right is the same six numbers seen as one stack: before division it is worth Σⱼ e^zⱼ, after division it is worth exactly 1. Normalization does not change the shape — it changes the units. That is softmax, and the result is a genuine distribution.</p>` },
      { n: 'STEP 4 / 5 — THE TRUTH ARRIVES', html: `<p>The corpus says the next token was <code>${SCENE.truth}</code>. Encode that as a vector y that is 1 there and 0 everywhere else, and write the loss as L = −Σᵢ yᵢ log pᵢ. Look at what the zeros do: ${SCENE.n - 1} of the ${SCENE.n} terms — and in reality ${(K3.vocab - 1).toLocaleString('en-US')} of ${K3.vocab.toLocaleString('en-US')} — are multiplied by zero and vanish.</p>` },
      { n: 'STEP 5 / 5 — THE LOSS', html: `<p>What is left is a single number: −log p(<code>${SCENE.truth}</code>) = ${SCENE.loss.toFixed(3)} nats. The model's favourite token was <code>${SCENE.top}</code> at ${(SCENE.pTop * 100).toFixed(1)}%, but it is only ever scored on the token that actually occurred, to which it gave ${(SCENE.pTruth * 100).toFixed(1)}%. Exponentiate the loss and you get its perplexity, ${SCENE.ppl.toFixed(2)} — as uncertain as an even choice among ${SCENE.ppl.toFixed(1)} equally likely tokens.</p>` },
    ],
  });
}
