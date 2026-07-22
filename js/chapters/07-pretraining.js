/* Chapter 07 — pretraining: the loop that costs millions.
   Sticky scene: one training step in four beats (forward, loss, backward,
   update), then the economics (6·N·D) and the parallelism menu. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, figure, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { seg, lerp, ease, clamp, rng, si } from '../core/anim.js';
import { track } from '../core/scroll.js';
import { K3 } from '../../data/k3.js';

/* ---- sticky figure: one training step, four beats ------------------------ */

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
  const slabs = [], expertCells = [];
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
  const arrowUp = svg('path', { d: 'M 370 90 L 370 68', stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#arr7)', opacity: 0 });

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
  const arrowIn = svg('path', { d: 'M 370 372 L 370 340', stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#arr7)', opacity: 0 });

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
  const gradArrow = svg('line', { x1: 284, y1: 70, x2: 284, y2: 70, stroke: PAL.loss, 'stroke-width': 1.6, 'marker-end': 'url(#arrG7)', opacity: 0 });
  const gradLabel = svg('text', { x: 276, y: 150, 'text-anchor': 'end', fill: PAL.loss, 'font-family': 'monospace', 'font-size': 12, opacity: 0 }, '∂L/∂θ');
  const gradCost = svg('text', { x: 276, y: 166, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 }, 'cost ≈ 2× forward');

  /* update: optimizer + loop + loss curve */
  const optBox = svg('g', { opacity: 0 },
    svg('rect', { x: 54, y: 236, width: 192, height: 60, rx: 10, fill: 'rgba(125,216,127,0.07)', stroke: PAL.train, 'stroke-width': 1.4 }),
    svg('text', { x: 150, y: 254, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'optimizer'),
    svg('text', { x: 150, y: 271, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 13 }, K3.optimizer),
    svg('text', { x: 150, y: 288, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 10 }, 'θ ← θ − η · update'));
  const optArrow = svg('path', { d: 'M 248 266 L 292 266', stroke: PAL.train, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#arrT7)', opacity: 0 });
  const optArrowTag = svg('text', { x: 270, y: 258, 'text-anchor': 'middle', fill: PAL.train, 'font-family': 'monospace', 'font-size': 10, opacity: 0 }, 'Δθ');
  const loopPath = svg('path', {
    d: 'M 150 298 C 150 386, 175 398, 244 398',
    stroke: PAL.weight, 'stroke-width': 1.5, fill: 'none', 'stroke-dasharray': '5 5', 'marker-end': 'url(#arrW7)', opacity: 0,
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
    ['arr7', PAL.mut, 'arrG7', PAL.loss, 'arrT7', PAL.train, 'arrW7', PAL.weight].reduce((acc, v, i, arr) => {
      if (i % 2 === 0) acc.push(svg('marker', { id: v, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
        svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: arr[i + 1] })));
      return acc;
    }, []));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'One training step: a batch flows up through the layer stack producing predictions at every position, cross-entropy loss is computed, gradients flow back down, and the optimizer nudges the weights — a loop repeated millions of times while the loss curve grinds down a power law.',
  },
    defs,
    batchCells, batchLabel, arrowIn,
    slabs, expertCells, stackLabel, fwdPulse, gradPulse,
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

/* ---- Fig 7.2 — the 6·N·D compute formula, dense vs MoE ------------------- */

function computeFigure() {
  const W = 720, H = 420;
  const denseH = 300, moeH = denseH / 56;   // dense 2.8T pays ~56× per token
  const baseY = 380;

  const formula = svg('g', { opacity: 0 },
    svg('text', { x: 40, y: 110, fill: PAL.ink, 'font-family': 'monospace', 'font-size': 26 }, 'compute ≈ 6 · N · D'),
    svg('text', { x: 40, y: 148, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, '2 FLOPs per parameter per token forward, ~4 backward'));
  const termN = svg('g', { opacity: 0 },
    svg('text', { x: 40, y: 196, fill: PAL.act, 'font-family': 'monospace', 'font-size': 14 }, `N ≈ ${si(K3.activeParams)} active parameters`));
  const termD = svg('g', { opacity: 0 },
    svg('text', { x: 40, y: 224, fill: PAL.tx, 'font-family': 'monospace', 'font-size': 14 }, 'D ≈ 15T tokens'));
  const result = svg('g', { opacity: 0 },
    svg('text', { x: 40, y: 268, fill: PAL.loss, 'font-family': 'monospace', 'font-size': 17 }, '→ ≈ 4.5×10²⁴ FLOPs'),
    svg('text', { x: 40, y: 292, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'months on tens of thousands of accelerators'));

  const moeBar = svg('rect', { x: 430, y: baseY, width: 70, height: 0, fill: PAL.moe });
  const moeLab = svg('g', { opacity: 0 },
    svg('text', { x: 465, y: baseY - moeH - 26, 'text-anchor': 'middle', fill: PAL.moe, 'font-family': 'sans-serif', 'font-size': 11 }, `K3 (MoE, ${si(K3.activeParams)} active)`),
    svg('text', { x: 465, y: baseY - moeH - 12, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 10 }, '≈ 4.5×10²⁴'));
  const denseBar = svg('rect', { x: 560, y: baseY, width: 70, height: 0, fill: 'rgba(107,118,131,0.55)', stroke: PAL.mut, 'stroke-width': 1 });
  const denseLab = svg('g', { opacity: 0 },
    svg('text', { x: 595, y: baseY - denseH - 26, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11 }, 'dense 2.8T, same tokens'),
    svg('text', { x: 595, y: baseY - denseH - 12, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, '≈ 2.5×10²⁶'));
  const brace = svg('g', { opacity: 0 },
    svg('line', { x1: 516, y1: baseY - denseH, x2: 516, y2: baseY - moeH, stroke: PAL.loss, 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
    svg('text', { x: 522, y: baseY - denseH / 2, fill: PAL.loss, 'font-family': 'monospace', 'font-size': 13 }, '~56×'));
  const axis = svg('line', { x1: 410, y1: baseY, x2: 660, y2: baseY, stroke: PAL.mut, 'stroke-width': 1 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Training compute is roughly 6 times N times D. With 50 billion active parameters and 15 trillion tokens that is about 4.5 times 10 to the 24 FLOPs; a dense 2.8-trillion-parameter model would cost about 56 times more, shown as a much taller bar.',
  }, formula, termN, termD, result, axis, moeBar, moeLab, denseBar, denseLab, brace);

  const fig = figure('7.2',
    `the folk formula for training cost, and the entire economic case for MoE: sparsity buys trillion-scale capacity at ${si(K3.activeParams)}-scale compute. Bars to scale — the dense bar is ~56× taller.`,
    root, { wide: true });

  track(fig, (p) => {
    formula.setAttribute('opacity', seg(p, 0.10, 0.18));
    termN.setAttribute('opacity', seg(p, 0.16, 0.24));
    termD.setAttribute('opacity', seg(p, 0.20, 0.28));
    result.setAttribute('opacity', seg(p, 0.26, 0.34));
    const tMoe = seg(p, 0.30, 0.38, ease.out);
    moeBar.setAttribute('height', Math.max(1.5, moeH * tMoe));
    moeBar.setAttribute('y', baseY - Math.max(1.5, moeH * tMoe));
    moeLab.setAttribute('opacity', seg(p, 0.34, 0.40));
    const tDense = seg(p, 0.38, 0.56, ease.inOut);
    denseBar.setAttribute('height', denseH * tDense);
    denseBar.setAttribute('y', baseY - denseH * tDense);
    denseLab.setAttribute('opacity', seg(p, 0.52, 0.60));
    brace.setAttribute('opacity', seg(p, 0.56, 0.64));
  });
  return fig;
}

/* ---- Fig 7.3 — four ways of slicing one model + batch -------------------- */

function parallelismFigure() {
  const W = 720, H = 440;
  const GPU = [PAL.act, PAL.attn, PAL.moe, PAL.weight];   // gpu 0..3
  const rand = rng(11);

  /* one panel: a "model+batch" rectangle (x = batch, y = layer stack) */
  const panels = [];
  const panelDefs = [
    {
      title: 'data parallelism', sub: 'split the batch · replicate (or ZeRO-shard) weights',
      draw(g, x0, y0, w, h) {
        for (let i = 0; i < 4; i++)
          g.append(svg('rect', { x: x0 + (w / 4) * i + 1, y: y0, width: w / 4 - 2, height: h, fill: GPU[i], opacity: 0.30, stroke: GPU[i], 'stroke-width': 1 }));
      },
    },
    {
      title: 'tensor parallelism', sub: 'split each matrix across GPUs',
      draw(g, x0, y0, w, h) {
        const layers = 5, lh = h / layers;
        for (let l = 0; l < layers; l++)
          for (let i = 0; i < 4; i++)
            g.append(svg('rect', { x: x0, y: y0 + l * lh + (lh / 4) * i + 0.5, width: w, height: lh / 4 - 1.4, fill: GPU[i], opacity: 0.30 }));
      },
    },
    {
      title: 'pipeline parallelism', sub: 'split the layer stack into stages',
      draw(g, x0, y0, w, h) {
        for (let i = 0; i < 4; i++)
          g.append(svg('rect', { x: x0, y: y0 + (h / 4) * i + 1, width: w, height: h / 4 - 2, fill: GPU[i], opacity: 0.30, stroke: GPU[i], 'stroke-width': 1 }));
      },
    },
    {
      title: 'expert parallelism', sub: 'scatter experts · route tokens cross-GPU',
      draw(g, x0, y0, w, h) {
        const cols = 8, rows = 5, cw = w / cols, ch = h / rows;
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            const gpu = Math.floor(rand() * 4);
            g.append(svg('rect', { x: x0 + c * cw + 1, y: y0 + r * ch + 1, width: cw - 2, height: ch - 2, rx: 2, fill: GPU[gpu], opacity: 0.30 }));
          }
      },
    },
  ];

  const nodes = panelDefs.map((def, i) => {
    const px = 24 + (i % 2) * 360, py = 30 + Math.floor(i / 2) * 205;
    const g = svg('g', { opacity: 0 });
    g.append(
      svg('text', { x: px, y: py - 8, fill: PAL.ink, 'font-family': 'sans-serif', 'font-size': 12, 'font-weight': 600 }, def.title),
      svg('rect', { x: px, y: py, width: 300, height: 130, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, rx: 4 }));
    def.draw(g, px, py, 300, 130);
    g.append(
      svg('text', { x: px, y: py + 146, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5 }, def.sub),
      svg('text', { x: px + 300, y: py + 146, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'batch →'),
      svg('text', { x: px - 7, y: py + 65, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, transform: `rotate(-90 ${px - 7} ${py + 65})` }, 'layers'));
    panels.push(g);
    return g;
  });

  const legend = svg('g', { opacity: 0 },
    GPU.map((c, i) => [
      svg('rect', { x: 250 + i * 60, y: H - 22, width: 10, height: 10, rx: 2, fill: c, opacity: 0.7 }),
      svg('text', { x: 264 + i * 60, y: H - 13, fill: PAL.tx, 'font-family': 'monospace', 'font-size': 10 }, `gpu ${i}`),
    ]));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Four small multiples of the same model-plus-batch rectangle, each sliced across four GPUs a different way: data parallelism slices the batch, tensor parallelism slices each matrix, pipeline parallelism slices the layer stack into stages, and expert parallelism scatters experts across GPUs.',
  }, nodes, legend);

  const fig = figure('7.3',
    `four ways to cut one model + one batch across a GPU fleet — a frontier run uses all of them at once, plus MoE's own expert parallelism from chapter 05.`,
    root, { wide: true });

  track(fig, (p) => {
    panels.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.10 + i * 0.11, 0.20 + i * 0.11, ease.out)));
    legend.setAttribute('opacity', seg(p, 0.14, 0.22));
  });
  return fig;
}

/* ---- chapter assembly ---------------------------------------------------- */

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'Learning', title),
    prose(
      `Training is a search problem: among all possible settings of the 2.8 trillion weights, find one that makes the corpus likely. The corpus itself is a product — web crawl, code, books, papers, increasingly multimodal data, pushed through aggressive deduplication, quality filtering, and mixture tuning (Kimi K2.5's pretraining run used ~15 trillion tokens). The search algorithm is the same stochastic gradient descent you know from any deep model; what's different at this scale is the industrial machinery wrapped around four repeating beats. Scroll.`),

    createScene({
      id: 'pretraining-step',
      figure: trainStepFigure,
      steps: [
        { n: 'BEAT 1 / 4 — BATCH & FORWARD', html: `<p>Sample a batch of token sequences — millions of tokens per step at frontier scale. One forward pass produces a next-token distribution at <em>every position simultaneously</em>: thanks to the causal mask, position 900's prediction provably can't peek at position 901, so a single 4,096-token sequence yields 4,096 training examples for the price of one pass. This is the trick that makes pretraining tractable at all.</p>` },
        { n: 'BEAT 2 / 4 — LOSS', html: `<p>At each position, compare the predicted distribution against the token that actually came next: <strong>cross-entropy</strong>, −log&nbsp;p(correct token), averaged over the batch. One scalar summarizes how surprised the model was by reality. Its exponential is <em>perplexity</em> — the effective number of tokens the model is torn between.</p>` },
        { n: 'BEAT 3 / 4 — BACKWARD', html: `<p><strong>Backpropagation</strong>: the chain rule, applied mechanically from the loss back down through unembedding, all ~61 layers, to the embedding — reusing the forward pass's cached activations to compute ∂L/∂θ for every parameter. Cost: roughly 2× the forward pass. Every routed expert that fired, every attention projection, every RMSNorm gain receives its own gradient.</p>` },
        { n: 'BEAT 4 / 4 — UPDATE', html: `<p>An optimizer converts gradients into weight changes. The workhorse is <strong>Adam</strong>, which keeps two running statistics per parameter — remember that 3× bookkeeping; it returns as the villain of chapter 10. The Kimi lineage instead uses <strong>Muon</strong>, which orthogonalizes each weight matrix's update; K3 extends it to Per-Head Muon, giving every attention head its own treatment.</p><p>Then repeat — millions of steps, weeks of wall-clock, the loss curve grinding down a power law.</p>` },
      ],
    }),
    prose(
      `<em>Fig. 7.1 — one training step: batch → forward (T predictions per sequence), loss (−log p of the actual next token), backward (∂L/∂θ for all 2.8T weights), update θ (Per-Head Muon) — repeated ~10⁶–10⁷ times.</em>`),
    term('perplexity', 'n.', 'e<sup>loss</sup> — the effective number of tokens the model is torn between; a loss of 2.0 nats ≈ choosing among e² ≈ 7.4 plausible next tokens'),

    prose(
      `The economics compress into one folk formula: training compute ≈ <strong>6 × N × D</strong> floating-point operations, with N the active parameters and D the tokens seen (2 FLOPs per parameter per token forward, ~4 backward). Plug in MoE-scale numbers — N ≈ 50B active, D ≈ 15T — and you get ~4.5×10²⁴ FLOPs: months on tens of thousands of accelerators, and the entire reason MoE exists. A dense 2.8T model would cost ~56× more per token; sparsity buys trillion-scale capacity at 50B-scale compute. This is also why scaling laws matter: loss falls as a smooth power law in N and D, so labs fit the curve on small runs and choose N, D, and the data mixture before committing the budget — the Chinchilla result (train longer on a smaller model) reshaped the field's ratios in exactly this way.`),
    computeFigure(),
    term('scaling law', 'n.', 'an empirical power law relating loss to parameters N and tokens D — fit on cheap small runs, then used to choose N, D, and the data mixture before the real budget is committed'),

    prose(
      `No single device holds any of this, so the model is cut along every available axis at once: <strong>data parallelism</strong> (replicate weights or shard them ZeRO-style, split the batch), <strong>tensor parallelism</strong> (split individual matrices across GPUs), <strong>pipeline parallelism</strong> (split the layer stack into stages), and MoE's own <strong>expert parallelism</strong> from chapter 05. A frontier training job is as much a distributed-systems artifact as a statistical one — K3's headline innovations (Quantile Balancing, static-shape expert dispatch, Attention Residuals' 25% training-efficiency gain) are all attacks on this layer of the problem.`),
    parallelismFigure(),

    mathAside('cross-entropy, backprop through one matrix', `
      <p>Per position, with predicted distribution p and true next token y: L = −log&nbsp;p(y). Batch loss averages over all positions. Perplexity = e<sup>L</sup>; a loss of 2.0 nats ≈ &ldquo;choosing among e² ≈ 7.4 plausible tokens&rdquo;. For any weight matrix W computing z = Wx somewhere in the stack, the chain rule gives</p>
      <div class="eq">∂L/∂W = (∂L/∂z) xᵀ      ∂L/∂x = Wᵀ (∂L/∂z)</div>
      <p>— the outer product updates the weights, the transpose product passes the error signal to earlier layers. Backprop is just this pair applied recursively; the cached x for every matrix in the stack is why training's activation memory dwarfs the weights themselves (and why &ldquo;gradient checkpointing&rdquo; — recomputing activations during backward — is standard).</p>`),
    mathAside('Adam, and the memory bill it runs up', `
      <p>Adam keeps exponential moving averages of the gradient (m) and its square (v) for every parameter, updating θ ← θ − η·m̂/(√v̂ + ε). Two extra fp32 tensors per parameter, plus fp32 master weights in mixed-precision training: ≈ <strong>16 bytes of optimizer/gradient state per parameter</strong>, against 2 for the bf16 weight itself. Full fine-tuning a 7B model therefore wants ~112 GB before a single activation is allocated — the arithmetic behind chapter 10. Muon departs from per-coordinate scaling: it treats each weight matrix as the unit and orthogonalizes its update (via Newton–Schulz iterations), which Moonshot found markedly more compute-efficient at scale; Per-Head Muon in K3 applies the treatment per attention head.</p>`));
}
