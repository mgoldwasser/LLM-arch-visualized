/* The serving scene — prefill (parallel, compute-bound), decode (serial,
   bandwidth-bound), and the KV cache that makes decode affordable.

   The scene's caption lives in the prose that follows it in the chapter, so
   the figure number is reserved here with claimFig('phases') — this function
   is called at the point in render() where the scene appears, which keeps
   numbering in visual order. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, claimFig, chRef, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease, clamp, norm, si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

function servingFigure(canvas) {
  const W = 720, H = 470;
  const active = `~${si(K3.activeParams)}`;

  /* region A — PREFILL: a block of 8,000 prompt tokens, one parallel pass */
  const COLS = 32, ROWS = 6, CS = 11, GAP = 2, AX = 36, AY = 40;
  const aCells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      aCells.push(svg('rect', { x: AX + c * (CS + GAP), y: AY + r * (CS + GAP), width: CS, height: CS, rx: 2, fill: PAL.act, opacity: 0 }));
  const aLabel = svg('text', { x: AX, y: 28, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, 'letter-spacing': 1 }, 'PREFILL — WHOLE PROMPT, ONE PASS');
  const aBrace = txt(AX, AY + ROWS * (CS + GAP) + 14, '8,000 prompt tokens · in parallel', { size: 12, fill: PAL.act, mono: true, opacity: 0 });
  const aBox = svg('g', {},
    svg('rect', { x: 520, y: 46, width: 164, height: 62, rx: 10, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.3 }),
    txt(602, 72, 'GPU compute', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true }),
    txt(602, 92, 'matrix multiplies', { size: 10, anchor: 'middle', mono: true }));
  const aPulse = svg('rect', { x: 520, y: 46, width: 164, height: 62, rx: 10, fill: 'none', stroke: PAL.act, 'stroke-width': 2.2, opacity: 0 });
  const aArrow = svg('path', { d: 'M 458 77 L 514 77', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#inf-arr)', opacity: 0 });
  const aTag = txt(602, 126, 'compute-bound', { size: 11, fill: PAL.act, anchor: 'middle', opacity: 0 });
  const gA = svg('g', {}, aLabel, aCells, aBrace, aArrow, aBox, aPulse, aTag);

  /* region B — DECODE: one token per step, weights streaming past compute */
  const bLabel = svg('text', { x: 36, y: 168, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, 'letter-spacing': 1 }, 'DECODE — ONE TOKEN PER STEP');
  const bPrompt = svg('g', {},
    svg('rect', { x: 36, y: 180, width: 112, height: 28, rx: 6, fill: 'rgba(107,118,131,0.14)', stroke: PAL.mut, 'stroke-width': 1 }),
    txt(92, 198, 'prompt · 8k', { size: 11, anchor: 'middle', mono: true }));
  const bChips = [0, 1, 2].map((i) => svg('g', { transform: `translate(${162 + i * 66}, 180)`, opacity: 0 },
    svg('rect', { width: 56, height: 28, rx: 6, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.1 }),
    txt(28, 18, `t+${i + 1}`, { size: 12, fill: PAL.ink, anchor: 'middle', mono: true })));
  const bBox = svg('g', {},
    svg('rect', { x: 560, y: 172, width: 124, height: 38, rx: 8, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.2 }),
    txt(622, 196, 'compute', { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }));
  const bLane = svg('rect', { x: 36, y: 224, width: 648, height: 28, rx: 6, fill: 'none', stroke: PAL.grid.replace('0.06', '0.22'), 'stroke-width': 1 });
  const bandStripes = [0, 1, 2, 3, 4].map((i) =>
    svg('rect', { x: 6 + i * 30, y: 5, width: 16, height: 18, rx: 2, fill: PAL.weight, opacity: 0.55 }));
  const bandText = txt(77, -8, `all ${active} active weights`, { size: 10, fill: PAL.weight, anchor: 'middle', mono: true });
  const bBand = svg('g', { opacity: 0 },
    svg('rect', { width: 154, height: 28, rx: 6, fill: 'rgba(224,168,76,0.12)', stroke: PAL.weight, 'stroke-width': 1.2 }),
    bandStripes, bandText);
  const bLaneTag = txt(684, 266, '… each step re-reads all active weights', { size: 10, anchor: 'end', opacity: 0 });
  const bTag = txt(36, 266, 'bandwidth-bound · arithmetic units mostly idle', { size: 11, fill: PAL.weight, opacity: 0 });
  const gB = svg('g', { opacity: 0 }, bLabel, bPrompt, bChips, bBox, bLane, bBand, bLaneTag, bTag);

  /* region C — KV CACHE: q,k,v for the new token; growing cached strip */
  const cLabel = svg('text', { x: 36, y: 300, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, 'letter-spacing': 1 }, 'KV CACHE — COMPUTE ONCE, REUSE');
  const cTok = svg('g', {},
    svg('rect', { x: 36, y: 312, width: 48, height: 26, rx: 6, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.1 }),
    txt(60, 329, 't+4', { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }));
  const qkv = [['q', PAL.attn], ['k', PAL.act], ['v', PAL.act]].map(([n, col], i) =>
    svg('g', { transform: `translate(${104 + i * 32}, 314)`, opacity: 0 },
      svg('rect', { width: 24, height: 22, rx: 4, fill: 'none', stroke: col, 'stroke-width': 1.2 }),
      txt(12, 15, n, { size: 12, fill: col, anchor: 'middle', mono: true })));
  const cNote = txt(220, 329, 'new token only — attend against the cache, append', { size: 10, opacity: 0 });
  const NCELLS = 44, PITCH = 14.6, CX = 36, CY = 366;
  const cCells = Array.from({ length: NCELLS }, (_, i) =>
    svg('rect', { x: CX + i * PITCH, y: CY, width: 11, height: 16, rx: 2, fill: PAL.act, opacity: 0 }));
  const cStripLabel = txt(36, 358, 'cached K, V — all past tokens, all layers', { size: 10 });
  const arcs = [3, 8, 13].map((i) =>
    svg('path', { d: `M 116 338 Q ${(116 + CX + i * PITCH) / 2} ${350} ${CX + i * PITCH + 5} ${CY - 2}`, stroke: PAL.attn, 'stroke-width': 1.1, fill: 'none', opacity: 0 }));
  const appendArrow = svg('g', { opacity: 0 },
    svg('path', { d: 'M 0 -14 L 0 -3', stroke: PAL.act, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#inf-arr-c)' }));
  const cAxis = svg('g', { opacity: 0 },
    svg('line', { x1: 36, y1: 396, x2: 684, y2: 396, stroke: PAL.mut, 'stroke-width': 1 }),
    txt(36, 412, '0', { size: 10, mono: true }),
    txt(360, 412, '…', { size: 10, anchor: 'middle', mono: true }),
    txt(684, 412, `${si(K3.contextWindow)} tokens`, { size: 10, anchor: 'end', mono: true }));
  const cCost = txt(36, 440, 'memory grows linearly with context — at 1M tokens, this strip is the whole ballgame',
    { size: 12, fill: PAL.loss, opacity: 0 });
  const gC = svg('g', { opacity: 0 }, cLabel, cTok, qkv, cNote, cStripLabel, cCells, arcs, appendArrow, cAxis, cCost);

  const defs = svg('defs', {},
    svg('marker', { id: 'inf-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'inf-arr-c', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })));

  canvas.append(svgRoot(W, H, { role: 'img', 'aria-label': 'Two serving regimes: prefill processes 8,000 prompt tokens in one parallel compute-bound pass; decode generates one token per step while all active weights stream from memory; the KV cache stores keys and values for every past token and grows linearly toward one million tokens.' },
    defs, gA, gB, gC));

  return (p) => {
    /* step 0 — prefill: the whole block lights at once */
    const tA = seg(p, 0.03, 0.1, ease.out);
    aCells.forEach((c) => c.setAttribute('opacity', tA * 0.9));
    aBrace.setAttribute('opacity', seg(p, 0.08, 0.13));
    aArrow.setAttribute('opacity', seg(p, 0.08, 0.13));
    const tAf = seg(p, 0.11, 0.2);
    aPulse.setAttribute('opacity', tAf * (1 - tAf) * 4);
    aTag.setAttribute('opacity', seg(p, 0.13, 0.19));
    gA.setAttribute('opacity', lerp(1, 0.4, seg(p, 0.25, 0.3)));

    /* step 1 — decode: t+1..t+3 appear as the weight band streams past, once per step */
    gB.setAttribute('opacity', seg(p, 0.26, 0.3) * lerp(1, 0.45, seg(p, 0.51, 0.55)));
    const u = clamp(norm(p, 0.29, 0.47));           // 3 decode steps inside this window
    const passIdx = Math.min(2, Math.floor(u * 3));
    const passT = p >= 0.47 ? 1 : (u * 3) - passIdx;
    bBand.setAttribute('opacity', seg(p, 0.28, 0.31));
    bBand.setAttribute('transform', `translate(${lerp(36, 530, ease.inOut(passT))}, 224)`);
    bChips.forEach((c, i) => c.setAttribute('opacity', seg(u, (i + 0.72) / 3, (i + 1) / 3)));
    bTag.setAttribute('opacity', seg(p, 0.33, 0.39));
    bLaneTag.setAttribute('opacity', seg(p, 0.36, 0.42));

    /* step 2 — KV cache grows; step 3 — it stretches toward 1M */
    gC.setAttribute('opacity', seg(p, 0.51, 0.55));
    qkv.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.53 + i * 0.015, 0.575 + i * 0.015)));
    cNote.setAttribute('opacity', seg(p, 0.57, 0.62));
    const n = 4
      + Math.round(14 * seg(p, 0.55, 0.74, ease.linear))
      + Math.round(26 * seg(p, 0.77, 0.9, ease.linear));
    cCells.forEach((c, i) => c.setAttribute('opacity', i < n ? 0.9 : 0));
    arcs.forEach((a, i) => a.setAttribute('opacity', seg(p, 0.58 + i * 0.015, 0.63 + i * 0.015) * 0.8));
    appendArrow.setAttribute('opacity', seg(p, 0.56, 0.6));
    appendArrow.setAttribute('transform', `translate(${Math.min(CX + n * PITCH + 5, 672)}, ${CY})`);
    cAxis.setAttribute('opacity', seg(p, 0.78, 0.84));
    cCost.setAttribute('opacity', seg(p, 0.85, 0.93));
  };
}

export function servingScene() {
  claimFig('phases');
  return createScene({
    id: 'inference-phases',
    figure: servingFigure,
    steps: [
      { n: 'Prefill — whole prompt, one pass', html: `<p>All 8,000 prompt tokens are processed in <em>one parallel pass</em> — thousands of tokens' worth of matrix multiplies saturating the GPU. Compute-bound. This is the phase you experience as time-to-first-token.</p>` },
      { n: 'Decode — one token per step', html: `<p>Then generation: one token at a time, and every step must stream <em>all ~${si(K3.activeParams)} active weights</em> from memory to emit a single token. Bandwidth-bound — the arithmetic units sit mostly idle while the amber band streams past, again and again.</p>` },
      { n: 'The KV cache', html: `<p>Attention needs every previous token's keys and values; recomputing them would make step <em>t</em> cost O(t). Instead they are computed once and cached — the new token computes q, k, v <em>only</em>, attends against the cache, and appends its own k, v.</p>` },
      { n: 'The price', html: `<p>Cache memory grows linearly with context — the strip just keeps stretching. At a ${si(K3.contextWindow)}-token window that price is the whole ballgame, and the direct motivation for ${chRef('attention')}'s attention variants.</p>` },
    ],
  });
}
