/* Scroll scene — linear attention, the delta rule, KDA. The state matrix's
   cell intensities are a real simulation of all three update rules (naive sum,
   gated, delta) on one seeded token stream, snapshotted per step at build time
   and indexed by p, so scrubbing back rewinds exactly. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, ease, clamp, rng } from '../../core/anim.js';
import { DH } from './shared.js';

export function deltaScene(canvas) {
  const W = 720, H = 460;
  const DS = 6, N = 10;

  /* real simulations, seeded — naive sum vs gated vs delta rule */
  const r = rng(1234);
  const rv = () => {
    const v = Array.from({ length: DS }, () => r() * 2 - 1);
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  };
  const ks = Array.from({ length: N }, rv);
  const vs = Array.from({ length: N }, rv);
  ks[7] = ks[2].map((x) => x + (r() - 0.5) * 0.24);           // key collision demo
  const n7 = Math.hypot(...ks[7]); ks[7] = ks[7].map((x) => x / n7);

  const zeros = () => Array.from({ length: DS }, () => new Array(DS).fill(0));
  const snap = (S) => S.flat().map((x) => Math.abs(x));
  const runs = { naive: [snap(zeros())], gated: [snap(zeros())], delta: [snap(zeros())] };
  let A = zeros(), G = zeros(), C = zeros();
  for (let t = 0; t < N; t++) {
    const k = ks[t], v = vs[t];
    A = A.map((row, i) => row.map((s, j) => s + v[i] * k[j]));
    G = G.map((row, i) => row.map((s, j) => 0.86 * s + v[i] * k[j]));
    const pred = C.map((row) => row.reduce((s, x, j) => s + x * k[j], 0));
    C = C.map((row, i) => row.map((s, j) => s + 0.8 * (v[i] - pred[i]) * k[j]));
    runs.naive.push(snap(A)); runs.gated.push(snap(G)); runs.delta.push(snap(C));
  }

  const arrow = (id, fill) => svg('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
    svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill }));
  const defs = svg('defs', {}, arrow('delta-arr', PAL.mut), arrow('delta-arrR', PAL.loss), arrow('delta-arrT', PAL.train));

  /* token stream */
  const SUBS = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₁₀'];
  const tokChips = Array.from({ length: N }, (_, i) => svg('g', { transform: `translate(${40 + i * 52}, 26)` },
    svg('rect', { width: 42, height: 24, rx: 6, fill: 'rgba(90,200,220,0.1)', stroke: PAL.act, 'stroke-width': 1 }),
    txt(21, 16, 'x' + SUBS[i], { size: 11.5, fill: PAL.ink, anchor: 'middle', mono: true })));
  const tokLabel = txt(40 + N * 52 + 4, 42, 'tokens →', { size: 10 });

  /* left — softmax attention's growing cache */
  const lLabel = txt(40, 82, 'SOFTMAX ATTENTION', { size: 10, fill: PAL.attn });
  const cacheRows = Array.from({ length: N }, (_, i) => svg('g', { transform: `translate(40, ${96 + i * 21})`, opacity: 0 },
    svg('rect', { width: 36, height: 15, rx: 3, fill: 'rgba(180,140,224,0.3)', stroke: PAL.attn, 'stroke-width': 0.8 }),
    txt(18, 11, 'k' + SUBS[i], { size: 9.5, fill: PAL.attn, anchor: 'middle', mono: true }),
    svg('rect', { x: 40, width: 36, height: 15, rx: 3, fill: 'rgba(90,200,220,0.22)', stroke: PAL.act, 'stroke-width': 0.8 }),
    txt(58, 11, 'v' + SUBS[i], { size: 9.5, fill: PAL.act, anchor: 'middle', mono: true })));
  const cacheDots = txt(78, 96 + N * 21 + 12, '⋮ one row per token, forever', { size: 10, anchor: 'middle' });
  const cacheCost = txt(40, 366, 'memory O(T) · every step re-reads it all', { size: 10.5, fill: PAL.loss });
  const gLeft = svg('g', {}, lLabel, cacheRows, cacheDots, cacheCost);

  /* right — the fixed-size state */
  const sx0 = 330, sy0 = 104, cell = 26;
  const rLabel = txt(sx0, 82, 'LINEAR ATTENTION → KDA', { size: 10, fill: PAL.moe });
  const stateCells = [];
  for (let i = 0; i < DS; i++) for (let j = 0; j < DS; j++)
    stateCells.push(svg('rect', { x: sx0 + j * cell + 1, y: sy0 + i * cell + 1, width: cell - 2, height: cell - 2, rx: 3, fill: PAL.act, 'fill-opacity': 0 }));
  const stateFrame = svg('rect', { x: sx0 - 3, y: sy0 - 3, width: DS * cell + 6, height: DS * cell + 6, rx: 6, fill: 'none', stroke: PAL.moe, 'stroke-width': 1.5 });
  const stateTag = txt(sx0 + DS * cell / 2, sy0 + DS * cell + 18, `state S · d×d — constant (${DH}×${DH} per head in KDA)`, { size: 9.5, anchor: 'middle' });
  const collidePulse = svg('rect', { x: sx0 - 6, y: sy0 - 6, width: DS * cell + 12, height: DS * cell + 12, rx: 8, fill: 'none', stroke: PAL.loss, 'stroke-width': 2, opacity: 0 });
  const collideTag = txt(sx0 - 3, sy0 + DS * cell + 38, 'similar keys → overlapping writes → interference', { size: 10, fill: PAL.loss, opacity: 0 });

  /* per-channel gates (KDA) */
  const rg = rng(55);
  const gates = Array.from({ length: DS }, (_, j) => {
    const h = 6 + rg() * 12;
    return svg('rect', { x: sx0 + j * cell + 5, y: sy0 - 10 - h, width: cell - 10, height: h, rx: 2, fill: PAL.moe, 'fill-opacity': 0.8 });
  });
  const gateTag = txt(sx0 + DS * cell + 10, sy0 - 14, 'αₜ — a decay per channel', { size: 9.5, fill: PAL.moe });

  /* delta-rule pipeline */
  const px = 530;
  const chip = (y, w, stroke, fill, label, tcol) => svg('g', {},
    svg('rect', { x: px, y, width: w, height: 30, rx: 7, fill, stroke, 'stroke-width': 1.2 }),
    txt(px + w / 2, y + 19, label, { size: 10.5, fill: tcol, anchor: 'middle', mono: true }));
  const readChip = chip(110, 160, PAL.act, 'rgba(90,200,220,0.08)', 'read  v̂ = S kₜ', PAL.act);
  const readArrow = svg('path', { d: `M ${sx0 + DS * cell + 4} 125 L ${px - 6} 125`, stroke: PAL.act, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#delta-arr)' });
  const errChip = chip(168, 160, PAL.loss, 'rgba(240,120,80,0.08)', 'error  e = vₜ − v̂', PAL.loss);
  const errArrow = svg('path', { d: `M ${px + 80} 140 L ${px + 80} 162`, stroke: PAL.loss, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#delta-arrR)' });
  const writeChip = chip(226, 160, PAL.train, 'rgba(125,216,127,0.08)', 'write  S += β e kₜᵀ', PAL.train);
  const writeArrow = svg('path', { d: `M ${px - 6} 241 C ${sx0 + DS * cell + 40} 241, ${sx0 + DS * cell + 30} 200, ${sx0 + DS * cell + 4} 190`, stroke: PAL.train, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#delta-arrT)' });
  const pipeNote = txt(px, 282, 'only what the state got wrong is written', { size: 10, fill: PAL.tx });

  /* equations + notes (bottom right region) */
  const eqY = 316;
  const eq0 = txt(330, eqY, 'Sₜ = Sₜ₋₁ + vₜ kₜᵀ', { size: 13, fill: PAL.ink, mono: true });
  const eq1 = txt(330, eqY, 'Sₜ = Diag(αₜ) Sₜ₋₁ + vₜ kₜᵀ', { size: 13, fill: PAL.ink, mono: true, opacity: 0 });
  const eq2 = txt(330, eqY, 'Sₜ = Sₜ₋₁(I − βₜkₜkₜᵀ) + βₜvₜkₜᵀ', { size: 13, fill: PAL.ink, mono: true, opacity: 0 });
  const eqNote = txt(330, eqY + 22, '', { size: 10.5, fill: PAL.mut });
  const chunkTag = txt(330, eqY + 50, 'chunked form: dense matmuls inside a chunk; carry S across chunks', { size: 10, fill: PAL.moe, opacity: 0 });
  const k3Tag = txt(330, eqY + 70, 'K3: KDA in most layers · constant state · O(T) total', { size: 10.5, fill: PAL.ink, opacity: 0 });

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Linear attention versus softmax attention, animated: on the left a per-token key-value cache grows row by row without bound; on the right a fixed six-by-six state matrix absorbs the same tokens as outer-product writes. The state first saturates into a blur, then gating decays old content, then the delta rule is shown as a read-predict-error-correct loop: read the state’s prediction for the incoming key, compute the error against the true value, and write only the correction. Finally per-channel gates above the state depict Kimi Delta Attention.',
  }, defs, tokChips, tokLabel, gLeft,
    rLabel, stateCells, stateFrame, stateTag, collidePulse, collideTag,
    gates, gateTag,
    readArrow, readChip, errArrow, errChip, writeArrow, writeChip, pipeNote,
    eq0, eq1, eq2, eqNote, chunkTag, k3Tag));

  return (p) => {
    /* which family + how many tokens absorbed — all derived from p */
    let family, count;
    if (p < 0.2) { family = 'naive'; count = Math.round(5 * seg(p, 0.03, 0.17, ease.linear)); }
    else if (p < 0.4) { family = 'naive'; count = 5 + Math.round(5 * seg(p, 0.22, 0.34, ease.linear)); }
    else if (p < 0.6) { family = 'gated'; count = Math.round(10 * seg(p, 0.42, 0.55, ease.linear)); }
    else { family = 'delta'; count = p < 0.8 ? Math.round(10 * seg(p, 0.62, 0.74, ease.linear)) : 10; }
    const sn = runs[family][count];
    stateCells.forEach((c, i) => c.setAttribute('fill-opacity', clamp(sn[i] * 0.95, 0, 0.95)));
    stateFrame.setAttribute('opacity', seg(p, 0.02, 0.06));
    stateTag.setAttribute('opacity', seg(p, 0.05, 0.1));
    rLabel.setAttribute('opacity', seg(p, 0.02, 0.06));

    /* token chips light as consumed (cache count tracks steps 0–1, then holds) */
    const tCache = Math.min(10, family === 'naive' ? count : 10);
    tokChips.forEach((c, i) => c.setAttribute('opacity', i < count ? 1 : 0.25));
    tokLabel.setAttribute('opacity', seg(p, 0.02, 0.06));

    /* left panel: cache grows, then dims once the story moves on */
    const leftDim = 1 - 0.68 * seg(p, 0.42, 0.48);
    gLeft.setAttribute('opacity', seg(p, 0.02, 0.06) * leftDim);
    cacheRows.forEach((row, i) => row.setAttribute('opacity', i < tCache ? 1 : 0));
    cacheDots.setAttribute('opacity', seg(p, 0.24, 0.3));
    cacheCost.setAttribute('opacity', seg(p, 0.1, 0.16));

    /* step 1 — interference pulse when the colliding key lands */
    const pulse = seg(p, 0.29, 0.32) * (1 - seg(p, 0.36, 0.39));
    collidePulse.setAttribute('opacity', pulse);
    collideTag.setAttribute('opacity', seg(p, 0.3, 0.34) * (1 - seg(p, 0.4, 0.44)));

    /* equations per regime */
    eq0.setAttribute('opacity', 1 - seg(p, 0.4, 0.44));
    eq1.setAttribute('opacity', seg(p, 0.42, 0.46) * (1 - seg(p, 0.6, 0.64)));
    eq2.setAttribute('opacity', seg(p, 0.62, 0.66));
    eqNote.textContent = p < 0.42 ? 'a running sum of outer products — add, never remove'
      : p < 0.62 ? 'gates fade old content — forgetting, but still no correction'
      : 'anti-Hebbian erase of the old association for kₜ, then write the new one';
    eqNote.setAttribute('opacity', seg(p, 0.08, 0.14));

    /* step 3 — the read → error → write pipeline */
    const rOp = seg(p, 0.63, 0.67) * (1 - 0.45 * seg(p, 0.82, 0.86));
    readArrow.setAttribute('opacity', rOp); readChip.setAttribute('opacity', rOp);
    const eOp = seg(p, 0.67, 0.71) * (1 - 0.45 * seg(p, 0.82, 0.86));
    errArrow.setAttribute('opacity', eOp); errChip.setAttribute('opacity', eOp);
    const wOp = seg(p, 0.71, 0.75) * (1 - 0.45 * seg(p, 0.82, 0.86));
    writeArrow.setAttribute('opacity', wOp); writeChip.setAttribute('opacity', wOp);
    pipeNote.setAttribute('opacity', seg(p, 0.74, 0.78) * (1 - 0.45 * seg(p, 0.82, 0.86)));

    /* step 4 — KDA: per-channel gates + chunked form */
    gates.forEach((g2, i) => g2.setAttribute('opacity', seg(p, 0.81 + i * 0.012, 0.85 + i * 0.012)));
    gateTag.setAttribute('opacity', seg(p, 0.85, 0.89));
    chunkTag.setAttribute('opacity', seg(p, 0.87, 0.91));
    k3Tag.setAttribute('opacity', seg(p, 0.9, 0.94));
  };
}
