/* Sticky scene — one training step in four beats: batch & forward, loss,
   backward, update. The mechanics were built in the foundation chapters; what
   this scene shows is the same loop at industrial scale. */

import { svg, svgRoot } from '../../core/dom.js';
import { PAL, chRef } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease, rng } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

function trainStepFigure(canvas) {
  const W = 720, H = 470;
  const rand = rng(7);

  /* the layer stack — 6 illustrative slabs standing in for ~61 layers */
  const SX = 300, SW = 140, SLABS = 6, slabH = 32;
  const slabY = (i) => 96 + i * 40;
  const fired = Array.from({ length: SLABS }, () => {
    const a = Math.floor(rand() * 4);
    let b = Math.floor(rand() * 4);
    if (b === a) b = (b + 1) % 4;
    return [a, b];
  });
  const slabs = [], attnStrips = [], expertCells = [];
  for (let i = 0; i < SLABS; i++) {
    const y = slabY(i);
    const box = svg('rect', { x: SX, y, width: SW, height: slabH, rx: 6, fill: 'rgba(224,168,76,0.06)', stroke: PAL.weight, 'stroke-width': 1.2 });
    const attnStrip = svg('rect', { x: SX + 8, y: y + 6, width: 26, height: slabH - 12, rx: 3, fill: 'rgba(180,140,224,0.25)', stroke: PAL.attn, 'stroke-width': 0.8 });
    const cells = [0, 1, 2, 3].map((j) => svg('rect', {
      x: SX + 44 + j * 24, y: y + 6, width: 18, height: slabH - 12, rx: 3,
      fill: 'rgba(76,201,168,0.18)', stroke: PAL.moe, 'stroke-width': 0.8,
      opacity: fired[i].includes(j) ? 1 : 0.4,
    }));
    slabs.push(box);
    attnStrips.push(attnStrip);
    expertCells.push(cells);
  }
  const stackLabel = svg('text', { x: SX + SW + 12, y: slabY(2) + 44, fill: PAL.mut, 'font-family': 'monospace', 'font-size': 11 }, `⋮ ≈${K3.blueprint.layers} layers`);

  /* predictions row (top) — a distribution at every position */
  const PN = 10, PCW = 17, PCG = 3;
  const predX = (j) => 272 + j * (PCW + PCG);
  const predCells = Array.from({ length: PN }, (_, j) => svg('rect', {
    x: predX(j), y: 42, width: PCW, height: 18, rx: 3,
    fill: 'rgba(90,200,220,0.30)', stroke: PAL.act, 'stroke-width': 0.9, opacity: 0,
  }));
  const predLabel = svg('text', { x: 370, y: 30, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 },
    'a next-token distribution at every position — simultaneously');
  const arrowUp = svg('path', { d: 'M 370 90 L 370 68', stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#pt-arr)', opacity: 0 });

  /* batch (bottom) — three sequences of token cells */
  const BN = 12, BCW = 15, BCG = 2;
  const batchCells = [];
  for (let r = 0; r < 3; r++)
    for (let j = 0; j < BN; j++)
      batchCells.push(svg('rect', {
        x: 252 + j * (BCW + BCG), y: 376 + r * 16, width: BCW, height: 12, rx: 2,
        fill: 'rgba(90,200,220,0.22)', stroke: PAL.act, 'stroke-width': 0.6, opacity: 0,
      }));
  const batchLabel = svg('text', { x: 252, y: 444, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 },
    'batch — millions of tokens per step');
  const arrowIn = svg('path', { d: 'M 370 372 L 370 340', stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#pt-arr)', opacity: 0 });

  /* forward sweep pulse */
  const fwdPulse = svg('rect', { x: SX - 8, y: 0, width: SW + 16, height: 26, rx: 6, fill: 'rgba(90,200,220,0.18)', opacity: 0 });

  /* causal-mask callout (left top) */
  const causal = svg('g', { opacity: 0 },
    svg('text', { x: 36, y: 56, fill: PAL.ink, 'font-family': 'sans-serif', 'font-size': 12, 'font-weight': 600 }, 'the causal-mask trick'),
    svg('text', { x: 36, y: 74, fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11 }, 'position 900 provably can’t peek at 901,'),
    svg('text', { x: 36, y: 90, fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11 }, 'so one 4,096-token sequence yields'),
    svg('text', { x: 36, y: 106, fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11 }, '4,096 training examples per pass'));

  /* loss panel (right top) */
  const distData = [['the', 0.31], ['a', 0.14], ['fox', 0.10], ['dog', 0.07]];
  const lossTitle = svg('text', { x: 476, y: 54, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, 'cross-entropy at one position');
  const lossRows = distData.map(([w, pr], i) => {
    const y = 66 + i * 22;
    return {
      label: svg('text', { x: 534, y: y + 12, 'text-anchor': 'end', fill: w === 'fox' ? PAL.ink : PAL.tx, 'font-family': 'monospace', 'font-size': 12, opacity: 0 }, w),
      bar: svg('rect', { x: 542, y, width: 0, height: 14, rx: 2, fill: PAL.act, opacity: 0.85 }),
      val: svg('text', { x: 548, y: y + 11, fill: PAL.tx, 'font-family': 'monospace', 'font-size': 10, opacity: 0 }, pr.toFixed(2)),
      pr,
    };
  });
  const actualRing = svg('rect', { x: 500, y: 106, width: 190, height: 20, rx: 4, fill: 'none', stroke: PAL.weight, 'stroke-width': 1.4, opacity: 0 });
  const actualTag = svg('text', { x: 694, y: 120, 'text-anchor': 'end', fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 }, 'actual next');
  const scalarBox = svg('g', { opacity: 0 },
    svg('rect', { x: 500, y: 160, width: 196, height: 44, rx: 8, fill: 'rgba(240,120,80,0.12)', stroke: PAL.loss, 'stroke-width': 1.4 }),
    svg('text', { x: 598, y: 178, 'text-anchor': 'middle', fill: PAL.loss, 'font-family': 'monospace', 'font-size': 12 }, 'L = −log 0.10 ≈ 2.3 nats'),
    svg('text', { x: 598, y: 196, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, 'perplexity = e^L ≈ 10 tokens'));
  const lossLink = svg('path', { d: 'M 424 52 C 450 52, 460 60, 496 66', stroke: PAL.loss, 'stroke-width': 1, fill: 'none', 'stroke-dasharray': '3 4', opacity: 0 });

  /* backward: wave + gradient arrow */
  const gradPulse = svg('rect', { x: SX - 8, y: 0, width: SW + 16, height: 26, rx: 6, fill: 'rgba(240,120,80,0.20)', opacity: 0 });
  const gradArrow = svg('line', { x1: 284, y1: 70, x2: 284, y2: 70, stroke: PAL.loss, 'stroke-width': 1.6, 'marker-end': 'url(#pt-arrG)', opacity: 0 });
  const gradLabel = svg('text', { x: 276, y: 150, 'text-anchor': 'end', fill: PAL.loss, 'font-family': 'monospace', 'font-size': 12, opacity: 0 }, '∂L/∂θ');
  const gradCost = svg('text', { x: 276, y: 166, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 }, 'cost ≈ 2× forward');

  /* update: optimizer + loop + loss curve */
  const optBox = svg('g', { opacity: 0 },
    svg('rect', { x: 54, y: 236, width: 192, height: 60, rx: 10, fill: 'rgba(125,216,127,0.07)', stroke: PAL.train, 'stroke-width': 1.4 }),
    svg('text', { x: 150, y: 254, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'optimizer'),
    svg('text', { x: 150, y: 271, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 13 }, K3.optimizer),
    svg('text', { x: 150, y: 288, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 10 }, 'θ ← θ − η · update'));
  const optArrow = svg('path', { d: 'M 248 266 L 292 266', stroke: PAL.train, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#pt-arrT)', opacity: 0 });
  const optArrowTag = svg('text', { x: 270, y: 258, 'text-anchor': 'middle', fill: PAL.train, 'font-family': 'monospace', 'font-size': 10, opacity: 0 }, 'Δθ');
  const loopPath = svg('path', {
    d: 'M 150 298 C 150 386, 175 398, 244 398',
    stroke: PAL.weight, 'stroke-width': 1.5, fill: 'none', 'stroke-dasharray': '5 5', 'marker-end': 'url(#pt-arrW)', opacity: 0,
  });
  const loopTag = svg('text', { x: 60, y: 350, fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, 'repeat ~10⁶–10⁷ times');

  /* loss curve panel: power law on a log-x axis, drawn progressively */
  const CX0 = 486, CX1 = 684, CY0 = 262, CY1 = 420;
  const curveRand = rng(21);
  const curvePts = Array.from({ length: 64 }, (_, i) => {
    const t = i / 63;
    const y = CY0 + 8 + (CY1 - CY0 - 22) * (1 - Math.pow(1 - t, 2.4)) + (curveRand() - 0.5) * 5;
    return [lerp(CX0 + 4, CX1 - 6, t), y];
  });
  const curveAxes = svg('g', { opacity: 0 },
    svg('line', { x1: CX0, y1: CY0 - 12, x2: CX0, y2: CY1, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: CX0, y1: CY1, x2: CX1 + 6, y2: CY1, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('text', { x: CX0 - 10, y: CY0 - 4, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'loss'),
    svg('text', { x: (CX0 + CX1) / 2, y: 444, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'tokens seen (log) →'),
    ['10⁹', '10¹⁰', '10¹¹', '10¹²', '10¹³'].map((lab, i) => svg('text', {
      x: CX0 + 8 + i * 44, y: CY1 + 13, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 9,
    }, lab)),
    svg('text', { x: CX1 + 4, y: CY0 + 6, 'text-anchor': 'end', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10 }, 'a power law — predictable'),
    svg('text', { x: CX1 + 4, y: CY0 + 19, 'text-anchor': 'end', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10 }, 'before you spend the money'));
  const curveLine = svg('polyline', { points: '', fill: 'none', stroke: PAL.loss, 'stroke-width': 2, 'stroke-linejoin': 'round' });

  const defs = svg('defs', {},
    [['pt-arr', PAL.mut], ['pt-arrG', PAL.loss], ['pt-arrT', PAL.train], ['pt-arrW', PAL.weight]].map(([mid, fill]) =>
      svg('marker', { id: mid, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
        svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill }))));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'One training step: a batch flows up through the layer stack producing predictions at every position, cross-entropy loss is computed, gradients flow back down, and the optimizer nudges the weights — a loop repeated millions of times while the loss curve grinds down a power law.',
  },
    defs,
    batchCells, batchLabel, arrowIn,
    slabs, attnStrips, expertCells, stackLabel, fwdPulse, gradPulse,
    arrowUp, predCells, predLabel, causal,
    lossLink, lossTitle, lossRows.map((r) => [r.bar, r.label, r.val]), actualRing, actualTag, scalarBox,
    gradArrow, gradLabel, gradCost,
    optBox, optArrow, optArrowTag, loopPath, loopTag,
    curveAxes, curveLine));

  return (p) => {
    /* BEAT 1 — batch appears, forward sweep, predictions everywhere */
    batchCells.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.01 + (i % BN) * 0.003, 0.06 + (i % BN) * 0.003, ease.out)));
    batchLabel.setAttribute('opacity', seg(p, 0.03, 0.07));
    arrowIn.setAttribute('opacity', seg(p, 0.06, 0.09));

    const tFwd = seg(p, 0.08, 0.17, ease.inOut);
    fwdPulse.setAttribute('y', lerp(slabY(SLABS - 1) + 4, slabY(0) - 2, tFwd));
    fwdPulse.setAttribute('opacity', tFwd > 0 && tFwd < 1 ? 0.9 : 0);
    const fwdY = lerp(slabY(SLABS - 1), slabY(0), tFwd);
    slabs.forEach((s, i) => {
      const lit = tFwd > 0 && fwdY <= slabY(i) + 2;
      s.setAttribute('fill', lit ? 'rgba(224,168,76,0.12)' : 'rgba(224,168,76,0.06)');
    });

    arrowUp.setAttribute('opacity', seg(p, 0.16, 0.19));
    const tPred = seg(p, 0.17, 0.21, ease.out);
    predCells.forEach((c) => c.setAttribute('opacity', tPred));      // all at once — that's the point
    predLabel.setAttribute('opacity', seg(p, 0.18, 0.22));
    causal.setAttribute('opacity', seg(p, 0.20, 0.245));

    /* BEAT 2 — loss */
    lossLink.setAttribute('opacity', seg(p, 0.26, 0.30) * 0.8);
    lossTitle.setAttribute('opacity', seg(p, 0.26, 0.30));
    lossRows.forEach((r, i) => {
      const t = seg(p, 0.28 + i * 0.015, 0.35 + i * 0.015, ease.out);
      r.bar.setAttribute('width', 130 * (r.pr / 0.31) * t);
      r.label.setAttribute('opacity', t);
      r.val.setAttribute('opacity', t);
      r.val.setAttribute('x', 548 + 130 * (r.pr / 0.31) * t);
    });
    const tActual = seg(p, 0.36, 0.40);
    actualRing.setAttribute('opacity', tActual);
    actualTag.setAttribute('opacity', tActual);
    scalarBox.setAttribute('opacity', seg(p, 0.41, 0.47));

    /* BEAT 3 — backward wave descending */
    const tBwd = seg(p, 0.52, 0.66, ease.inOut);
    const bwdY = lerp(slabY(0) - 2, slabY(SLABS - 1) + 8, tBwd);
    gradPulse.setAttribute('y', bwdY);
    gradPulse.setAttribute('opacity', tBwd > 0 && tBwd < 1 ? 0.9 : 0);
    gradArrow.setAttribute('opacity', seg(p, 0.52, 0.56));
    gradArrow.setAttribute('y2', lerp(70, 336, tBwd));
    gradLabel.setAttribute('opacity', seg(p, 0.54, 0.58));
    gradCost.setAttribute('opacity', seg(p, 0.58, 0.62));
    const touched = (i) => tBwd > 0 && bwdY >= slabY(i) - 4;
    expertCells.forEach((cells, i) => cells.forEach((c, j) => {
      const isFired = fired[i].includes(j);
      const hot = isFired && touched(i);
      c.setAttribute('stroke', hot ? PAL.loss : PAL.moe);
      c.setAttribute('fill', hot ? 'rgba(240,120,80,0.25)' : 'rgba(76,201,168,0.18)');
    }));

    /* BEAT 4 — optimizer, nudge, loop, loss curve */
    optBox.setAttribute('opacity', seg(p, 0.76, 0.81));
    const tOptA = seg(p, 0.79, 0.83);
    optArrow.setAttribute('opacity', tOptA);
    optArrowTag.setAttribute('opacity', tOptA);
    const tNudge = seg(p, 0.80, 0.90);
    const pulse = tNudge * (1 - tNudge) * 4;
    slabs.forEach((s) => {
      s.setAttribute('stroke-width', 1.2 + pulse * 1.4);
      s.setAttribute('stroke', pulse > 0.2 ? PAL.train : PAL.weight);
    });
    const tLoop = seg(p, 0.84, 0.89);
    loopPath.setAttribute('opacity', tLoop);
    loopTag.setAttribute('opacity', tLoop);
    curveAxes.setAttribute('opacity', seg(p, 0.87, 0.92));
    const tCurve = seg(p, 0.89, 1.0, ease.linear);
    const n = Math.max(0, Math.floor(curvePts.length * tCurve));
    curveLine.setAttribute('points', curvePts.slice(0, n).map(([x, y]) => `${x},${y}`).join(' '));
  };
}

export function trainStepScene() {
  return createScene({
    id: 'pretraining-step',
    figure: trainStepFigure,
    steps: [
      { n: 'BEAT 1 / 4 — BATCH & FORWARD', html: `<p>Sample a batch of token sequences — millions of tokens per step at frontier scale. One forward pass produces a next-token distribution at <em>every position simultaneously</em>: thanks to the causal mask, position 900&rsquo;s prediction provably can&rsquo;t peek at position 901, so a single 4,096-token sequence yields 4,096 training examples for the price of one pass. This is the trick that makes pretraining tractable at all.</p>` },
      { n: 'BEAT 2 / 4 — LOSS', html: `<p>At each position, score the predicted distribution against the token that actually came next with <strong>cross-entropy</strong> — the surprise measure from ${chRef('probability')}, −log&nbsp;p(correct token), here averaged over millions of positions at once. One scalar per step summarizes how surprised a ${K3.blueprint.layers}-layer model was by the entire batch, and it is the only number the whole industrial apparatus is trying to move.</p>` },
      { n: 'BEAT 3 / 4 — BACKWARD', html: `<p><strong>Backpropagation</strong>, exactly as derived in ${chRef('learning')}, run at production scale: the chain rule applied mechanically from the loss back down through unembedding, all ~${K3.blueprint.layers} layers, to the embedding, reusing the forward pass&rsquo;s cached activations. Cost: roughly 2× the forward pass — and every routed expert that fired, every attention projection, every RMSNorm gain receives its own ∂L/∂θ.</p>` },
      { n: 'BEAT 4 / 4 — UPDATE', html: `<p>An optimizer converts gradients into weight changes. The workhorse is <strong>Adam</strong>, which keeps two running statistics per parameter — remember that 3× bookkeeping; it returns as the villain of ${chRef('adaptation')}. The Kimi lineage instead uses <strong>Muon</strong>, which treats a whole weight matrix as one object and reshapes its update so that the different directions of change do not fight each other; K3 extends it to ${K3.optimizer}, giving every attention head its own treatment.</p><p>Then repeat — millions of steps, weeks of wall-clock, the loss curve grinding down a power law.</p>` },
    ],
  });
}
