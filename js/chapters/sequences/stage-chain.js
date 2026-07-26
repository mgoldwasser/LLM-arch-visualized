/* Scene steps 2 and 3 — the recurrent chain built left to right, then the
   gradient sent back along it, shrinking by γ at every hop. Both stages draw
   the same chain, so it is built by one helper. */

import { svg } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, clamp, lerp, ease } from '../../core/anim.js';
import { TOK, T, SUB, GAMMA, sci, stageTag, stageFormula } from './shared.js';

/* The h₀…h_T boxes and the arrows between them. */
function chain(dim) {
  const bx = 30, pitch = 96, bw = 68, bh = 40, by = 140;
  const boxes = [], arrows = [];
  for (let i = 0; i <= T; i++) {
    boxes.push(svg('g', {},
      svg('rect', {
        x: bx + i * pitch, y: by, width: bw, height: bh, rx: 9,
        fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.3, 'stroke-opacity': dim ? 0.4 : 1,
      }),
      txt(bx + i * pitch + bw / 2, by + 25, 'h' + SUB[i], { size: 13, fill: PAL.ink, anchor: 'middle', mono: true })));
    if (i < T) arrows.push(svg('line', {
      x1: bx + i * pitch + bw + 2, y1: by + bh / 2, x2: bx + (i + 1) * pitch - 3, y2: by + bh / 2,
      stroke: PAL.act, 'stroke-width': 1.4, 'stroke-opacity': dim ? 0.25 : 1, 'marker-end': 'url(#seq-arr-act)',
    }));
  }
  return { bx, pitch, bw, bh, by, boxes, arrows };
}

/* ---- step 2 · RECUR -------------------------------------------------------- */
export function stageRecur() {
  const g = svg('g', {});
  const c = chain(false);
  const wLabels = c.arrows.map((_, i) => txt(
    c.bx + i * c.pitch + c.bw + (c.pitch - c.bw) / 2, c.by + c.bh / 2 - 8, 'W_h',
    { size: 9, fill: PAL.weight, anchor: 'middle', mono: true }));

  const toks = [], ups = [], segs = [], segFills = [];
  for (let i = 1; i <= T; i++) {
    const x = c.bx + i * c.pitch;
    toks.push(svg('g', {},
      svg('rect', { x, y: 246, width: c.bw, height: 28, rx: 7, fill: 'rgba(90,200,220,0.08)', stroke: PAL.act, 'stroke-width': 1, 'stroke-opacity': 0.5 }),
      txt(x + c.bw / 2, 265, TOK[i - 1], { size: 11.5, fill: PAL.tx, anchor: 'middle', mono: true })));
    ups.push(svg('g', {},
      svg('line', { x1: x + c.bw / 2, y1: 242, x2: x + c.bw / 2, y2: c.by + c.bh + 6, stroke: PAL.act, 'stroke-width': 1.2, 'stroke-opacity': 0.7, 'marker-end': 'url(#seq-arr-act)' }),
      txt(x + c.bw / 2 + 5, 224, 'W_x', { size: 9, fill: PAL.weight, mono: true })));
    segs.push(svg('rect', { x, y: 320, width: c.bw, height: 8, rx: 4, fill: 'rgba(230,237,243,0.07)' }));
    segFills.push(svg('rect', { x, y: 320, width: 0, height: 8, rx: 4, fill: PAL.act }));
  }

  const counter = txt(30, 356, '', { size: 11.5, fill: PAL.ink, mono: true });
  const notes = [
    txt(30, 400, 'One matrix pair, W_h and W_x, reused at every step: a six-token sentence and a six-thousand-token', { size: 11 }),
    txt(30, 418, 'document use exactly the same parameters, and h is a dense vector, so similar words share evidence.', { size: 11 }),
    txt(30, 442, 'The cost is the chain. Step t cannot begin until step t−1 has finished.', { size: 11.5, fill: PAL.ink }),
  ];

  g.append(stageTag('STEP 2 / 4 · RECUR', PAL.act), stageFormula('hₜ = σ(W_h hₜ₋₁ + W_x xₜ)'),
    ...c.arrows, ...wLabels, ...c.boxes, ...toks, ...ups, ...segs, ...segFills, counter, ...notes);

  const u = (q) => {
    const k = lerp(0, T, seg(q, 0.1, 0.82, ease.linear));
    c.boxes.forEach((b, i) => b.setAttribute('opacity', clamp((k - i + 1) / 0.8)));
    c.arrows.forEach((a, i) => a.setAttribute('opacity', clamp((k - i - 0.2) / 0.6)));
    wLabels.forEach((w, i) => w.setAttribute('opacity', clamp((k - i - 0.2) / 0.6) * 0.9));
    toks.forEach((t, i) => t.setAttribute('opacity', clamp((k - i + 0.9) / 0.8)));
    ups.forEach((a, i) => a.setAttribute('opacity', clamp((k - i + 0.7) / 0.8)));
    segs.forEach((s, i) => s.setAttribute('opacity', clamp((k - i + 1) / 0.8)));
    segFills.forEach((s, i) => s.setAttribute('width', clamp(k - i) * c.bw));
    const done = Math.min(T, Math.max(1, Math.ceil(k)));
    counter.setAttribute('opacity', seg(q, 0.12, 0.2));
    counter.textContent = `step ${done} of ${T} — h${SUB[done]} waits for h${SUB[done - 1]}`;
    notes.forEach((n, i) => n.setAttribute('opacity', seg(q, 0.8 + i * 0.04, 0.88 + i * 0.04)));
  };
  return { g, u };
}

/* ---- step 3 · SHRINK ------------------------------------------------------- */
export function stageShrink() {
  const g = svg('g', {});
  const c = chain(true);
  const back = [], vals = [];
  for (let j = T - 1; j >= 0; j--) {
    const m = GAMMA ** (T - j);                          // signal after (T−j) hops
    back.push(svg('line', {
      x1: c.bx + (j + 1) * c.pitch - 2, y1: c.by - 14, x2: c.bx + j * c.pitch + c.bw + 3, y2: c.by - 14,
      stroke: PAL.loss, 'stroke-width': 0.8 + m * 5.5, 'stroke-opacity': clamp(0.25 + m * 1.4),
      'marker-end': 'url(#seq-arr-loss)',
    }));
    vals.push(txt(c.bx + j * c.pitch + c.bw + (c.pitch - c.bw) / 2 + 4, c.by - 26, m.toFixed(2),
      { size: 10, fill: PAL.loss, anchor: 'middle', mono: true }));
  }
  const lossX = c.bx + T * c.pitch + c.bw / 2;
  const lossTag = svg('g', {},
    txt(lossX, 96, 'loss', { size: 12, fill: PAL.loss, anchor: 'middle', mono: true }),
    svg('line', { x1: lossX, y1: 104, x2: lossX, y2: c.by - 4, stroke: PAL.loss, 'stroke-width': 1.4, 'marker-end': 'url(#seq-arr-loss)' }));

  const readouts = [
    txt(30, 300, `each hop multiplies the gradient by ‖J‖ ≈ ${GAMMA.toFixed(2)}`, { size: 11.5, fill: PAL.tx }),
    txt(30, 322, `after ${T} hops: ${(GAMMA ** T).toFixed(3)} of full strength   ·   after 100 hops: ${sci(GAMMA ** 100)}`, { size: 12, fill: PAL.ink, mono: true }),
  ];
  const notes = [
    txt(30, 374, 'The dependency the model most needs to learn — agreement with something far behind —', { size: 11 }),
    txt(30, 392, 'is exactly the one whose gradient arrives smallest. Below 1 it vanishes; above 1 it explodes.', { size: 11 }),
    txt(30, 428, 'LSTM and GRU gates add a near-additive path through time to hold ‖J‖ near 1: a partial fix.', { size: 11.5, fill: PAL.ink }),
  ];

  g.append(stageTag('STEP 3 / 4 · SHRINK', PAL.loss),
    stageFormula(`∂L/∂h₁ = ∂L/∂h${SUB[T]} · ∏ₖ (∂hₖ₊₁/∂hₖ)`),
    ...c.arrows, ...c.boxes, lossTag, ...back, ...vals, ...readouts, ...notes);

  const u = (q) => {
    c.boxes.forEach((b) => b.setAttribute('opacity', seg(q, 0, 0.08)));
    c.arrows.forEach((a) => a.setAttribute('opacity', seg(q, 0, 0.08)));
    lossTag.setAttribute('opacity', seg(q, 0.06, 0.16));
    const w = lerp(0, T, seg(q, 0.14, 0.72, ease.linear));   // the backward wave, right to left
    back.forEach((b, i) => {
      const t = clamp((w - i) / 0.7);
      b.setAttribute('opacity', t);
      vals[i].setAttribute('opacity', t);
    });
    readouts.forEach((r, i) => r.setAttribute('opacity', seg(q, 0.7 + i * 0.05, 0.8 + i * 0.05)));
    notes.forEach((n, i) => n.setAttribute('opacity', seg(q, 0.82 + i * 0.04, 0.9 + i * 0.04)));
  };
  return { g, u };
}
