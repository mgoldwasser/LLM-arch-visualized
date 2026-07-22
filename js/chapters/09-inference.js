/* Chapter 09 — inference. Two serving regimes with opposite bottlenecks,
   the KV cache that makes decode affordable, and sampling as a dial.
   Sticky scene: prefill vs decode vs cache. Widget: temperature + top-p. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, widget, takeaway, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { track } from '../core/scroll.js';
import { seg, lerp, ease, clamp, norm, si, pct, fmtBytes } from '../core/anim.js';
import { softmax } from '../core/mathtools.js';
import { K3 } from '../../data/k3.js';

/* ---- the sticky figure: prefill (parallel) / decode (serial) / KV cache --- */

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
  const aBrace = svg('text', { x: AX, y: AY + ROWS * (CS + GAP) + 14, fill: PAL.act, 'font-family': 'monospace', 'font-size': 12, opacity: 0 }, '8,000 prompt tokens · in parallel');
  const aBox = svg('g', {},
    svg('rect', { x: 520, y: 46, width: 164, height: 62, rx: 10, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.3 }),
    svg('text', { x: 602, y: 72, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 13 }, 'GPU compute'),
    svg('text', { x: 602, y: 92, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, 'matrix multiplies'));
  const aPulse = svg('rect', { x: 520, y: 46, width: 164, height: 62, rx: 10, fill: 'none', stroke: PAL.act, 'stroke-width': 2.2, opacity: 0 });
  const aArrow = svg('path', { d: 'M 458 77 L 514 77', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#arr9)', opacity: 0 });
  const aTag = svg('text', { x: 602, y: 126, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, 'compute-bound');
  const gA = svg('g', {}, aLabel, aCells, aBrace, aArrow, aBox, aPulse, aTag);

  /* region B — DECODE: one token per step, weights streaming past compute */
  const bLabel = svg('text', { x: 36, y: 168, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, 'letter-spacing': 1 }, 'DECODE — ONE TOKEN PER STEP');
  const bPrompt = svg('g', {},
    svg('rect', { x: 36, y: 180, width: 112, height: 28, rx: 6, fill: 'rgba(107,118,131,0.14)', stroke: PAL.mut, 'stroke-width': 1 }),
    svg('text', { x: 92, y: 198, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 11 }, 'prompt · 8k'));
  const bChips = [0, 1, 2].map((i) => svg('g', { transform: `translate(${162 + i * 66}, 180)`, opacity: 0 },
    svg('rect', { width: 56, height: 28, rx: 6, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.1 }),
    svg('text', { x: 28, y: 18, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 12 }, `t+${i + 1}`)));
  const bBox = svg('g', {},
    svg('rect', { x: 560, y: 172, width: 124, height: 38, rx: 8, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.2 }),
    svg('text', { x: 622, y: 196, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 12 }, 'compute'));
  const bLane = svg('rect', { x: 36, y: 224, width: 648, height: 28, rx: 6, fill: 'none', stroke: PAL.grid.replace('0.06', '0.22'), 'stroke-width': 1 });
  const bandStripes = [0, 1, 2, 3, 4].map((i) =>
    svg('rect', { x: 6 + i * 30, y: 5, width: 16, height: 18, rx: 2, fill: PAL.weight, opacity: 0.55 }));
  const bandText = svg('text', { x: 77, y: -8, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 10 }, `all ${active} active weights`);
  const bBand = svg('g', { opacity: 0 },
    svg('rect', { width: 154, height: 28, rx: 6, fill: 'rgba(224,168,76,0.12)', stroke: PAL.weight, 'stroke-width': 1.2 }),
    bandStripes, bandText);
  const bLaneTag = svg('text', { x: 684, y: 266, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 }, '… each step re-reads all active weights');
  const bTag = svg('text', { x: 36, y: 266, fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, 'bandwidth-bound · arithmetic units mostly idle');
  const gB = svg('g', { opacity: 0 }, bLabel, bPrompt, bChips, bBox, bLane, bBand, bLaneTag, bTag);

  /* region C — KV CACHE: q,k,v for the new token; growing cached strip */
  const cLabel = svg('text', { x: 36, y: 300, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, 'letter-spacing': 1 }, 'KV CACHE — COMPUTE ONCE, REUSE');
  const cTok = svg('g', {},
    svg('rect', { x: 36, y: 312, width: 48, height: 26, rx: 6, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.1 }),
    svg('text', { x: 60, y: 329, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 12 }, 't+4'));
  const qkv = [['q', PAL.attn], ['k', PAL.act], ['v', PAL.act]].map(([n, col], i) =>
    svg('g', { transform: `translate(${104 + i * 32}, 314)`, opacity: 0 },
      svg('rect', { width: 24, height: 22, rx: 4, fill: 'none', stroke: col, 'stroke-width': 1.2 }),
      svg('text', { x: 12, y: 15, 'text-anchor': 'middle', fill: col, 'font-family': 'monospace', 'font-size': 12 }, n)));
  const cNote = svg('text', { x: 220, y: 329, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 }, 'new token only — attend against the cache, append');
  const NCELLS = 44, PITCH = 14.6, CX = 36, CY = 366;
  const cCells = Array.from({ length: NCELLS }, (_, i) =>
    svg('rect', { x: CX + i * PITCH, y: CY, width: 11, height: 16, rx: 2, fill: PAL.act, opacity: 0 }));
  const cStripLabel = svg('text', { x: 36, y: 358, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'cached K, V — all past tokens, all layers');
  const arcs = [3, 8, 13].map((i) =>
    svg('path', { d: `M 116 338 Q ${(116 + CX + i * PITCH) / 2} ${350} ${CX + i * PITCH + 5} ${CY - 2}`, stroke: PAL.attn, 'stroke-width': 1.1, fill: 'none', opacity: 0 }));
  const appendArrow = svg('g', { opacity: 0 },
    svg('path', { d: 'M 0 -14 L 0 -3', stroke: PAL.act, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#arr9c)' }));
  const cAxis = svg('g', { opacity: 0 },
    svg('line', { x1: 36, y1: 396, x2: 684, y2: 396, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('text', { x: 36, y: 412, fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, '0'),
    svg('text', { x: 360, y: 412, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, '…'),
    svg('text', { x: 684, y: 412, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, `${si(K3.contextWindow)} tokens`));
  const cCost = svg('text', { x: 36, y: 440, fill: PAL.loss, 'font-family': 'sans-serif', 'font-size': 12, opacity: 0 },
    'memory grows linearly with context — at 1M tokens, this strip is the whole ballgame');
  const gC = svg('g', { opacity: 0 }, cLabel, cTok, qkv, cNote, cStripLabel, cCells, arcs, appendArrow, cAxis, cCost);

  const defs = svg('defs', {},
    svg('marker', { id: 'arr9', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'arr9c', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
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

/* ---- Fig 9.1: KV-cache growth per 1,000 tokens, by attention variant ------ */

function kvGrowthFigure() {
  const L = K3.blueprint.layers, d = K3.blueprint.dModel;
  const per1k = {
    mha: 2 * L * d * 2 * 1000,          // K and V · bf16
    gqa: 2 * L * (d / 8) * 2 * 1000,    // 8 kv-groups
    mla: L * 576 * 2 * 1000,            // one 576-dim latent per token
  };
  const rows = [
    ['MHA', per1k.mha, `~${(per1k.mha / 1e9).toFixed(2)} GB`],
    ['GQA (8 kv-groups)', per1k.gqa, `~${Math.round(per1k.gqa / 1e6 / 10) * 10} MB`],
    ['MLA latent', per1k.mla, `~${Math.round(per1k.mla / 1e6 / 10) * 10} MB`],
  ];
  const W = 720, H = 252, BARX = 210, BARMAX = 420;

  const title = svg('text', { x: 36, y: 26, fill: PAL.ink, 'font-family': 'sans-serif', 'font-size': 13 }, 'KV cache growth per 1,000 tokens of context');
  const sub = svg('text', { x: 36, y: 44, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, `bf16 · illustrative ${L}-layer / d=${d} blueprint`);
  const barEls = rows.map(([name, v, label], i) => {
    const y = 66 + i * 40;
    return {
      v,
      label: svg('text', { x: 36, y: y + 14, fill: PAL.tx, 'font-family': 'monospace', 'font-size': 12 }, name),
      bar: svg('rect', { x: BARX, y, width: 0, height: 18, rx: 3, fill: PAL.act, opacity: 0.9 }),
      val: svg('text', { x: BARX + 8, y: y + 14, fill: PAL.act, 'font-family': 'monospace', 'font-size': 12, opacity: 0 }, label),
    };
  });
  const kY = 66 + 3 * 40;
  const kdaLabel = svg('text', { x: 36, y: kY + 14, fill: PAL.tx, 'font-family': 'monospace', 'font-size': 12 }, 'KDA (most K3 layers)');
  const kdaLine = svg('line', { x1: BARX, y1: kY + 9, x2: BARX + BARMAX, y2: kY + 9, stroke: PAL.moe, 'stroke-width': 2, 'stroke-dasharray': '6 5', pathLength: 1, 'stroke-dashoffset': 1 });
  const kdaState = svg('rect', { x: BARX, y: kY + 1, width: 16, height: 16, rx: 3, fill: PAL.moe, opacity: 0 });
  const kdaTag = svg('text', { x: BARX + BARMAX, y: kY - 4, 'text-anchor': 'end', fill: PAL.moe, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 }, 'constant-size state · independent of context length');
  const at1M = svg('text', { x: 36, y: 238, fill: PAL.loss, 'font-family': 'sans-serif', 'font-size': 12, opacity: 0 },
    `at a 1M-token context, MHA's cache would be ~${(per1k.mha * 1000 / 1e12).toFixed(2)} TB per sequence`);

  const node = svgRoot(W, H, { role: 'img', 'aria-label': 'Bar chart of KV cache memory per 1,000 tokens: MHA about 1.75 gigabytes, GQA with 8 groups about 220 megabytes, MLA latent about 70 megabytes, and KDA a constant-size state independent of context length.' },
    title, sub, barEls.map((b) => [b.label, b.bar, b.val]), kdaLabel, kdaLine, kdaState, kdaTag, at1M);

  const update = (p) => {
    barEls.forEach((b, i) => {
      const t = seg(p, 0.16 + i * 0.05, 0.36 + i * 0.05, ease.out);
      const w = Math.max(4, BARMAX * (b.v / per1k.mha)) * t;
      b.bar.setAttribute('width', w);
      b.val.setAttribute('opacity', t);
      b.val.setAttribute('x', BARX + w + 8);
    });
    kdaLine.setAttribute('stroke-dashoffset', 1 - seg(p, 0.32, 0.48));
    kdaState.setAttribute('opacity', seg(p, 0.32, 0.4));
    kdaTag.setAttribute('opacity', seg(p, 0.4, 0.48));
    at1M.setAttribute('opacity', seg(p, 0.44, 0.54));
  };
  return { node, update };
}

/* ---- widget: one distribution, three temperatures ------------------------- */

function samplingWidget() {
  // A fixed set of plausible next-token logits after "The capital of France is".
  const TOKS = [
    ['Paris', 8.9], ['the', 5.8], ['a', 5.3], ['located', 5.0], ['known', 4.4], ['in', 4.1],
    ['one', 3.8], ['Lyon', 3.6], ['also', 3.3], ['not', 3.0], ['called', 2.8], ['home', 2.5],
  ];
  const logits = TOKS.map((t) => t[1]);
  let T = 1.0, topP = 0.95;

  const W = 720, H = 296, BASE = 226, MAXH = 160, SLOT = (W - 76) / TOKS.length, X0 = 44, BARW = 34;
  const bx = (i) => X0 + i * SLOT + (SLOT - BARW) / 2;

  const ctxLine = svg('text', { x: W / 2, y: 26, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 13 }, '“The capital of France is …”');
  const bars = TOKS.map((_, i) => svg('rect', { x: bx(i), y: BASE, width: BARW, height: 0, rx: 3, fill: PAL.act }));
  const vals = TOKS.map((_, i) => svg('text', { x: bx(i) + BARW / 2, y: BASE - 6, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 10 }, ''));
  const labels = TOKS.map(([w], i) => svg('text', { x: bx(i) + BARW / 2, y: BASE + 18, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 11 }, w));
  const baseLine = svg('line', { x1: X0 - 8, y1: BASE, x2: W - 32, y2: BASE, stroke: PAL.grid.replace('0.06', '0.3'), 'stroke-width': 1 });
  const bound = svg('line', { x1: 0, y1: 42, x2: 0, y2: BASE + 24, stroke: PAL.attn, 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0 });
  const boundTag = svg('text', { x: 0, y: 54, fill: PAL.attn, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 }, 'top-p cutoff — nucleus | trimmed tail');
  const cutNote = svg('text', { x: W - 32, y: BASE + 40, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'grayed tokens: outside the nucleus, probability set to 0, rest renormalized');

  const svgNode = svgRoot(W, H, { role: 'img', 'aria-label': 'Histogram of next-token probabilities after the prompt “The capital of France is”, recomputed live as temperature and top-p change; tokens cut by top-p are grayed out beyond a nucleus boundary line.' },
    ctxLine, baseLine, bars, vals, labels, bound, boundTag, cutNote);

  /* controls */
  const tVal = el('span', { class: 'sl-v' }, T.toFixed(2));
  const pVal = el('span', { class: 'sl-v' }, topP.toFixed(2));
  const tSlider = el('input', { type: 'range', min: '0.1', max: '2', step: '0.05', value: String(T), 'aria-label': 'temperature T' });
  const pSlider = el('input', { type: 'range', min: '0.1', max: '1', step: '0.01', value: String(topP), 'aria-label': 'top-p' });

  const PRESETS9 = [
    ['T = 0.2 · nearly greedy', 0.2, 'precise, can loop'],
    ['T = 1.0 · as learned', 1.0, 'calibrated diversity'],
    ['T = 1.5 · flattened', 1.5, 'creative, error-prone — top-p trims the tail'],
  ];
  const desc = el('div', { class: 'w-note' }, 'calibrated diversity');
  const presetBtns = PRESETS9.map(([lab, val, d]) =>
    el('button', { class: 'tok', onclick: () => { T = val; tSlider.value = String(val); desc.textContent = d; update(); } }, lab));

  const cells = {
    pRaw: el('div', { class: 'sg-v' }, ''), pPol: el('div', { class: 'sg-v hi' }, ''),
    kept: el('div', { class: 'sg-v' }, ''), ent: el('div', { class: 'sg-v' }, ''),
  };
  const statGrid = el('div', { class: 'stat-grid' },
    el('div', { class: 'sg-cell' }, cells.pRaw, el('div', { class: 'sg-k' }, 'p(Paris) · softmax(z/T)')),
    el('div', { class: 'sg-cell' }, cells.pPol, el('div', { class: 'sg-k' }, 'p(Paris) · after top-p')),
    el('div', { class: 'sg-cell' }, cells.kept, el('div', { class: 'sg-k' }, 'tokens in nucleus')),
    el('div', { class: 'sg-cell' }, cells.ent, el('div', { class: 'sg-k' }, 'entropy of policy (bits)')));

  function update() {
    const ps = softmax(logits, T);
    let cum = 0, k = TOKS.length;
    for (let i = 0; i < ps.length; i++) { cum += ps[i]; if (cum >= topP - 1e-9) { k = i + 1; break; } }
    const keptSum = ps.slice(0, k).reduce((a, b) => a + b, 0);
    bars.forEach((b, i) => {
      const h = Math.max(ps[i] > 1e-4 ? 1.5 : 0, ps[i] * MAXH);
      b.setAttribute('height', h);
      b.setAttribute('y', BASE - h);
      b.setAttribute('fill', i < k ? PAL.act : '#4A5560');
      b.setAttribute('opacity', i < k ? 0.95 : 0.35);
      vals[i].textContent = ps[i] >= 0.01 ? (ps[i] * 100).toFixed(0) + '%' : '';
      vals[i].setAttribute('y', BASE - h - 6);
      vals[i].setAttribute('fill', i < k ? PAL.tx : PAL.mut);
      labels[i].setAttribute('fill', i < k ? PAL.tx : PAL.mut);
      labels[i].setAttribute('opacity', i < k ? 1 : 0.55);
    });
    const showB = k < TOKS.length;
    const xb = X0 + k * SLOT;
    bound.setAttribute('x1', xb); bound.setAttribute('x2', xb);
    bound.setAttribute('opacity', showB ? 0.9 : 0);
    // keep the tag clear of bar-value labels: sit on whichever side has room
    boundTag.setAttribute('text-anchor', xb > 420 ? 'end' : 'start');
    boundTag.setAttribute('x', xb > 420 ? xb - 8 : xb + 8);
    boundTag.setAttribute('opacity', showB ? 0.9 : 0);
    let ent = 0;
    for (let i = 0; i < k; i++) { const q = ps[i] / keptSum; if (q > 0) ent -= q * Math.log2(q); }
    cells.pRaw.textContent = pct(ps[0], 1);
    cells.pPol.textContent = pct(ps[0] / keptSum, 1);
    cells.kept.textContent = `${k} / ${TOKS.length}`;
    cells.ent.textContent = ent.toFixed(2);
    tVal.textContent = T.toFixed(2);
    pVal.textContent = topP.toFixed(2);
  }
  tSlider.addEventListener('input', () => { T = +tSlider.value; desc.textContent = 'custom'; update(); });
  pSlider.addEventListener('input', () => { topP = +pSlider.value; update(); });
  update();

  return el('div', {},
    el('div', { class: 'tokens', style: { marginBottom: '0.8rem' } }, presetBtns),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'temperature T'), tSlider, tVal),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'top-p (nucleus)'), pSlider, pVal),
    svgNode, statGrid, desc);
}

/* ---- chapter assembly ---------------------------------------------------- */

export function render({ id, num, title }) {
  const kv = kvGrowthFigure();
  const kvFig = el('figure', { class: 'fig measure', style: { margin: '2.2rem auto' } },
    el('div', { class: 'fig-canvas' }, kv.node),
    el('figcaption', {},
      el('span', { class: 'fig-n' }, 'Fig. 9.1 — '),
      el('span', { html: `the two phases, and why chapter 04's variant zoo exists: at ${si(K3.contextWindow)} tokens, MHA's cache would be ~1.75 TB <em>per sequence</em>. Bars computed from the illustrative K2 blueprint.` })));
  track(kvFig, kv.update);

  return chapter(id,
    chapterHead(num, 'Serving', title),
    prose(
      `Serving a trained model splits into two regimes with opposite bottlenecks. <strong>Prefill</strong> processes the whole prompt in one parallel pass — thousands of tokens' worth of matrix multiplies, compute-bound, and the phase you experience as time-to-first-token. <strong>Decode</strong> then generates one token at a time — and each step must stream all ~${si(K3.activeParams)} active parameters from memory to produce a single token, so it is bandwidth-bound: the GPU's arithmetic units mostly idle while weights stream past. Most serving-stack engineering (batching many users, splitting prefill from decode onto different nodes) exists to feed those idle units.`),
    term('rule of thumb', 'serving', 'single-stream decode speed ≤ memory bandwidth ÷ bytes of active weights: ~25 GB at 4-bit × ~3 TB/s HBM ⇒ low hundreds of tokens/sec, before batching'),

    createScene({
      id: 'inference-phases',
      figure: servingFigure,
      steps: [
        { n: 'Prefill — whole prompt, one pass', html: `<p>All 8,000 prompt tokens are processed in <em>one parallel pass</em> — thousands of tokens' worth of matrix multiplies saturating the GPU. Compute-bound. This is the phase you experience as time-to-first-token.</p>` },
        { n: 'Decode — one token per step', html: `<p>Then generation: one token at a time, and every step must stream <em>all ~${si(K3.activeParams)} active weights</em> from memory to emit a single token. Bandwidth-bound — the arithmetic units sit mostly idle while the amber band streams past, again and again.</p>` },
        { n: 'The KV cache', html: `<p>Attention needs every previous token's keys and values; recomputing them would make step <em>t</em> cost O(t). Instead they are computed once and cached — the new token computes q, k, v <em>only</em>, attends against the cache, and appends its own k, v.</p>` },
        { n: 'The price', html: `<p>Cache memory grows linearly with context — the strip just keeps stretching. At a ${si(K3.contextWindow)}-token window that price is the whole ballgame, and the direct motivation for chapter 04's attention variants.</p>` },
      ],
    }),
    prose(
      `Decode is only affordable because of the <strong>KV cache</strong>. Attention needs every previous token's keys and values; recomputing them each step would make step t cost O(t). Instead they're computed once and cached — turning generation into: compute q, k, v for the new token only, attend against the cache, append. The price is memory that grows linearly with context, and at 1M tokens that price is the whole ballgame — the direct motivation for chapter 04's variant zoo.`),
    term('KV cache', 'n.', 'stored K,V tensors for all past tokens, all layers; the reason long chats cost memory even while “idle”'),
    kvFig,

    prose(
      `Finally, the choice chapter 01 deferred: the model hands you a distribution — picking from it is <strong>sampling policy</strong>, applied at serving time to a frozen model. Greedy argmax is deterministic but degenerates into repetition loops. <strong>Temperature</strong> divides the logits before softmax, sharpening (T&lt;1) or flattening (T&gt;1) the distribution; <strong>top-p</strong> (nucleus) sampling truncates to the smallest set of tokens whose probabilities sum to p, cutting off the long tail of individually-unlikely junk that pure temperature sampling would occasionally emit.`),
    mathAside('softmax with temperature', `
      <div class="eq">pᵢ = e^(zᵢ/T) / Σⱼ e^(zⱼ/T)</div>
      <p>T→0 recovers argmax; T=1 the learned distribution. Dividing all logits by the same T preserves their order — temperature never changes <em>which</em> token is most likely, only how much the distribution concentrates on it.</p>`),
    widget('One distribution, three temperatures', 'drag T and top-p — every bar is recomputed live from softmax(z/T)', samplingWidget()),
    prose(
      `<em>Fig. 9.2 — one distribution, three temperatures. “Randomness” in LLM output is a serving-time dial, not a property of the weights.</em>`,
      `Weight precision is the last big lever. K3 ships in <strong>${K3.weightsFormat.split(' ')[0]}</strong> — ~4 bits per parameter, ~${fmtBytes(K3.totalParams * 0.5)} total — and because quantization-aware training baked that format in from the SFT stage, there is no post-hoc conversion loss; the low-precision model <em>is</em> the model.`),
    takeaway(
      `Together with KDA's constant-size state, that is what makes million-token serving of a ${si(K3.totalParams)}-parameter model an engineering exercise rather than an impossibility.`));
}
