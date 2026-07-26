/* One transformer layer, built up in four sticky-scroll steps: persistent
   per-token residual streams, attention (tokens mix), a per-token MLP, then a
   zoom-out to the full stack. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, chRef, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

const SUB = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈'];

/* ---- the sticky figure --------------------------------------------------- */

function layerFigure(canvas) {
  const W = 720, H = 470;
  const SX = [170, 300, 430, 560];          // the four token streams
  const L = K3.blueprint.layers;

  const defs = svg('defs', {},
    ['arrA03', PAL.act, 'arrV03', PAL.attn, 'arrT03', PAL.moe, 'arrM03', PAL.mut]
      .reduce((acc, v, i, arr) => (i % 2 === 0 ? acc.concat([svg('marker',
        { id: v, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
        svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: arr[i + 1] }))]) : acc), []));

  /* --- everything inside one layer lives in gLayer (scaled in step 4) --- */

  const streams = SX.map((x) => svg('line', {
    x1: x, y1: 416, x2: x, y2: 416, stroke: PAL.act, 'stroke-width': 2, opacity: 0, 'marker-end': 'url(#arrA03)',
  }));
  const tokChips = SX.map((x, i) => svg('g', { opacity: 0 },
    svg('rect', { x: x - 27, y: 420, width: 54, height: 26, rx: 6, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
    txt(x, 438, `x${SUB[i]}`, { size: 13, fill: PAL.ink, anchor: 'middle', mono: true })));
  const tokLabel = txt(24, 438, 'xₜ ∈ ℝᵈ', { mono: true, opacity: 0 });
  const streamLabel = txt(24, 70, 'residual stream · ℝᵈ', { fill: PAL.act, opacity: 0 });

  const rmsChip = (x, y) => svg('g', { opacity: 0 },
    svg('rect', { x: x - 39, y: y - 11, width: 78, height: 22, rx: 6, fill: '#182029', stroke: PAL.mut, 'stroke-width': 1 }),
    txt(x, y + 4, 'RMSNorm', { fill: PAL.tx, anchor: 'middle', mono: true }));
  const rms1 = SX.map((x) => rmsChip(x, 372));
  const rms2 = SX.map((x) => rmsChip(x, 232));

  const attnBox = svg('rect', {
    x: 132, y: 296, width: 496, height: 46, rx: 10, fill: 'rgba(180,140,224,0.08)', stroke: PAL.attn, 'stroke-width': 1.3, opacity: 0,
  });
  const attnLabel = svg('g', { opacity: 0 },
    txt(124, 315, 'attn', { size: 13, fill: PAL.attn, anchor: 'end', mono: true }),
    txt(124, 331, 'tokens mix', { anchor: 'end' }));
  const mixPairs = [[0, 1], [1, 2], [0, 2], [2, 3], [1, 3]];
  const mixArrows = mixPairs.map(([a, b]) => svg('path', {
    d: `M ${SX[a]} 336 C ${(SX[a] + SX[b]) / 2} 303, ${(SX[a] + SX[b]) / 2} 303, ${SX[b] - 9} 331`,
    stroke: PAL.attn, 'stroke-width': 1.3, fill: 'none', opacity: 0, 'marker-end': 'url(#arrV03)',
  }));
  const plusNode = (x, y) => svg('g', { opacity: 0 },
    svg('circle', { cx: x, cy: y, r: 9, fill: '#182029', stroke: PAL.act, 'stroke-width': 1.4 }),
    txt(x, y + 4, '+', { size: 12, fill: PAL.act, anchor: 'middle', mono: true }));
  const plus1 = SX.map((x) => plusNode(x, 268));
  const d1 = SX.map((x) => svg('path', {
    d: `M ${x + 26} 296 C ${x + 26} 280, ${x + 19} 273, ${x + 12} 270`,
    stroke: PAL.attn, 'stroke-width': 1.2, fill: 'none', opacity: 0, 'marker-end': 'url(#arrV03)',
  }));

  const mlpBoxes = SX.map((x) => svg('g', { opacity: 0 },
    svg('rect', { x: x - 48, y: 156, width: 96, height: 52, rx: 9, fill: 'rgba(76,201,168,0.08)', stroke: PAL.moe, 'stroke-width': 1.3 }),
    txt(x, 178, 'MLP', { size: 13, fill: PAL.moe, anchor: 'middle', mono: true }),
    txt(x, 196, 'per token', { anchor: 'middle' })));
  const mlpLabel = txt(116, 186, 'up·σ·down', { fill: PAL.moe, anchor: 'end', mono: true, opacity: 0 });
  const plus2 = SX.map((x) => plusNode(x, 128));
  const d2 = SX.map((x) => svg('path', {
    d: `M ${x + 26} 156 C ${x + 26} 140, ${x + 19} 133, ${x + 12} 130`,
    stroke: PAL.moe, 'stroke-width': 1.2, fill: 'none', opacity: 0, 'marker-end': 'url(#arrT03)',
  }));

  const outline = svg('g', { opacity: 0 },
    svg('rect', { x: 110, y: 100, width: 506, height: 316, rx: 12, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '5 5' }),
    txt(122, 113, 'one transformer layer'),
    txt(604, 404, 'reads · computes · adds', { anchor: 'end' }));

  const gLayer = svg('g', {},
    streams, tokChips, tokLabel, streamLabel, rms1, attnBox, attnLabel, mixArrows,
    d1, plus1, rms2, mlpBoxes, mlpLabel, d2, plus2, outline);

  /* --- step 4: the full stack + final pipeline (outside gLayer) --- */

  const HIL = 38;
  const slabY = (i) => 108 + i * 4.95;
  const slabs = Array.from({ length: L }, (_, i) => svg('rect', {
    x: 440, y: slabY(i), width: 180, height: 3.1, rx: 1.2,
    fill: i === HIL ? PAL.act : 'rgba(230,237,243,0.16)', opacity: 0,
  }));
  const conn = [
    svg('line', { x1: 306, y1: 198, x2: 440, y2: slabY(HIL), stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0 }),
    svg('line', { x1: 306, y1: 328, x2: 440, y2: slabY(HIL) + 3.1, stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0 }),
  ];
  const stackLabel = txt(530, 430, `× ${L} layers (illustrative)`, { size: 11.5, anchor: 'middle', opacity: 0 });
  const pipe = svg('g', { opacity: 0 },
    svg('path', { d: 'M 530 104 L 530 84', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#arrM03)' }),
    txt(530, 68, 'final RMSNorm → unembedding → logits', { size: 12, fill: PAL.tx, anchor: 'middle', mono: true }));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': `One transformer layer built up step by step: four token columns each own a persistent vertical residual-stream vector; an attention sublayer lets tokens interact and adds its delta back; a per-token MLP sublayer adds its delta back; then the view zooms out to show the block repeated ${L} times, ending in a final RMSNorm, the unembedding, and logits.`,
  }, defs, conn, slabs, stackLabel, pipe, gLayer));

  return (p) => {
    const tS = seg(p, 0.03, 0.15);
    streams.forEach((s, i) => {
      const ti = seg(tS, i * 0.08, 0.7 + i * 0.08, ease.out);
      s.setAttribute('y2', lerp(416, 74, ti));
      s.setAttribute('opacity', ti > 0 ? 0.95 : 0);
    });
    tokChips.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.02 + i * 0.015, 0.09 + i * 0.015)));
    tokLabel.setAttribute('opacity', seg(p, 0.03, 0.1));
    streamLabel.setAttribute('opacity', seg(p, 0.10, 0.16));
    rms1.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.16 + i * 0.01, 0.22 + i * 0.01)));

    attnBox.setAttribute('opacity', seg(p, 0.27, 0.33));
    attnLabel.setAttribute('opacity', seg(p, 0.28, 0.34));
    mixArrows.forEach((a, i) => a.setAttribute('opacity', seg(p, 0.33 + i * 0.018, 0.40 + i * 0.018)));
    d1.forEach((a) => a.setAttribute('opacity', seg(p, 0.42, 0.47)));
    plus1.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.44 + i * 0.01, 0.49 + i * 0.01)));

    rms2.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.52 + i * 0.01, 0.57 + i * 0.01)));
    mlpBoxes.forEach((b, i) => b.setAttribute('opacity', seg(p, 0.56 + i * 0.02, 0.63 + i * 0.02)));
    mlpLabel.setAttribute('opacity', seg(p, 0.57, 0.63));
    d2.forEach((a) => a.setAttribute('opacity', seg(p, 0.65, 0.70)));
    plus2.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.67 + i * 0.01, 0.72 + i * 0.01)));
    outline.setAttribute('opacity', seg(p, 0.72, 0.76));

    // step 4: zoom out — the layer shrinks to become one slab among many
    const tZ = seg(p, 0.78, 0.90);
    const s = lerp(1, 0.42, tZ);
    const cx = lerp(363, 200, tZ), cy = lerp(245, 255, tZ);
    gLayer.setAttribute('transform', `translate(${cx - 363 * s} ${cy - 245 * s}) scale(${s})`);

    const tSt = seg(p, 0.80, 0.92);
    slabs.forEach((r, i) => r.setAttribute('opacity', seg(tSt, i / (L * 1.3), (i + 12) / (L * 1.3)) * (i === HIL ? 1 : 0.9)));
    conn.forEach((l) => l.setAttribute('opacity', seg(p, 0.88, 0.93) * 0.8));
    stackLabel.setAttribute('opacity', seg(p, 0.86, 0.92));
    pipe.setAttribute('opacity', seg(p, 0.91, 0.98));
  };
}

/* ---- the scene ----------------------------------------------------------- */

export function sceneLayer() {
  const L = K3.blueprint.layers;
  return createScene({
    id: 'one-layer',
    figure: layerFigure,
    steps: [
      { n: 'STEP 1 / 4 — THE STREAM', html: `<p><strong>The stream.</strong> Each of the T tokens in context owns one vector of width d_model that persists through the whole network. Residual addition is why hundred-layer networks are trainable at all: gradients flow straight down the identity path without vanishing, and an untrained sublayer defaults to “change nothing”.</p><p>Before every sublayer the vector is rescaled by <strong>RMSNorm</strong> — divide by the root-mean-square of its entries, multiply by a learned per-dimension gain — which keeps activations in a numerically stable range regardless of depth.</p>` },
      { n: 'STEP 2 / 4 — ATTENTION', html: `<p><strong>Sublayer one: attention.</strong> The only place in the entire architecture where tokens interact. Each token reads the stream, gathers information from earlier tokens (${chRef('attention')} is devoted to how), and adds the gathered summary back into its own stream.</p><p>Everything else in the network processes each token in isolation.</p>` },
      { n: 'STEP 3 / 4 — THE MLP', html: `<p><strong>Sublayer two: the MLP.</strong> A per-token feed-forward block: project the d_model vector up to a wider space, apply an elementwise nonlinearity, project back down. This is where the bulk of the parameters — and, per interpretability research, most stored factual knowledge — lives.</p><p>In K3 this sublayer is where the mixture-of-experts substitution happens: ${K3.experts.routed} small MLPs instead of one big one (${chRef('moe')}).</p>` },
      { n: 'STEP 4 / 4 — STACK IT', html: `<p><strong>Stack it.</strong> That two-sublayer block repeats ~${L} times (K2’s figure; K3’s is undisclosed). Depth buys iterative refinement: early layers resolve syntax and local structure, middle layers assemble entities and relations, late layers converge on the next-token decision — you can watch this by decoding the stream early (“logit lens”).</p><p>After the last layer: one final RMSNorm, the unembedding, softmax. That’s the whole forward pass.</p>` },
    ],
  });
}
