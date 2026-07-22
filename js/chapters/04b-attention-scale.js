/* Chapter 04B — attention at scale. Everything about long context is a war
   against two quantities: the O(T²) score matrix (training / prefill) and the
   O(T) KV cache (decode). Chapter 04 built the mechanism; chapter 09 shows the
   serving story; this chapter is the machinery in between — FlashAttention's
   tiling, the KV-compression lineage down to MLA's 576 dims, linear attention
   and the delta rule (KDA), hybrid layouts, and context extension. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, figure, takeaway, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { seg, lerp, ease, clamp, rng, si } from '../core/anim.js';
import { track, reveal } from '../core/scroll.js';
import { K3 } from '../../data/k3.js';

const BP = K3.blueprint;                      // illustrative K2 dims
const L = BP.layers, D = BP.dModel, NH = BP.heads, DH = BP.dHead;
const T1M = K3.contextWindow;                 // 1,000,000
const B = 2;                                  // bf16 bytes

/* ---- the numbers, computed from the blueprint (never hard-coded) ---------- */
const mhaPerTok  = 2 * L * D * B;             // K+V, all layers ≈ 1.75 MB/token
const mhaAt1M    = mhaPerTok * T1M;           // ≈ 1.75 TB per sequence
const gqaAt1M    = mhaAt1M / 8;               // 8 KV groups
const MLA_C = 512, MLA_R = 64;                // DeepSeek-style latent + RoPE dims
const mlaPerTok  = L * (MLA_C + MLA_R) * B;
const mlaAt1M    = mlaPerTok * T1M;           // ≈ 70 GB
const scoresOne  = T1M * T1M * B;             // one head, one layer, bf16 ≈ 2 TB
const scoresAll  = scoresOne * NH * L;        // ≈ 7.8 PB
const mhaLayerB  = 2 * NH * DH * B;           // per token per layer: 32,768 B
const gqaLayerB  = 2 * 8 * DH * B;            //                       4,096 B
const mlaLayerB  = (MLA_C + MLA_R) * B;       //                       1,152 B

const fmtBig = (b) => {
  if (b >= 1e15) return (b / 1e15).toFixed(1).replace(/\.0$/, '') + ' PB';
  if (b >= 1e12) return (b / 1e12).toFixed(2).replace(/0$/, '').replace(/\.$/, '') + ' TB';
  if (b >= 1e9) return Math.round(b / 1e9) + ' GB';
  return Math.round(b / 1e6) + ' MB';
};

/* ---- tiny local helpers (same idioms as chapter 04) ----------------------- */

const txt = (x, y, s, { size = 11, fill = PAL.mut, anchor = 'start', mono = false, opacity } = {}) =>
  svg('text', {
    x, y, fill, 'text-anchor': anchor, 'font-size': size,
    'font-family': mono ? 'monospace' : 'sans-serif',
    ...(opacity != null ? { opacity } : {}),
  }, s);

const subhead = (s) => reveal(el('h3', { class: 'measure', style: { margin: '3.2rem auto 1rem', fontSize: '1.32rem' } }, s));

/* ===========================================================================
   Fig 4B.1 — the wall, quantified (log scale)
   =========================================================================== */

function wallFigure() {
  const W = 760, H = 302;
  const axY = 218, axX0 = 64, axX1 = 716;
  const LOG0 = 10, LOG1 = 16;                                 // 10 GB … 10 PB
  const xOf = (v) => axX0 + ((Math.log10(v) - LOG0) / (LOG1 - LOG0)) * (axX1 - axX0);

  const title = txt(24, 28, `what one ${si(T1M)}-token sequence asks of the hardware (bf16 · illustrative ${L}-layer / d=${D} blueprint)`, { size: 11.5, fill: PAL.ink });
  const subtitle = txt(24, 46, 'log scale — every gridline is 10× the last', { size: 10 });

  const ticks = [];
  for (let e = LOG0; e <= LOG1; e++) {
    const x = xOf(10 ** e);
    ticks.push(svg('line', { x1: x, y1: 64, x2: x, y2: axY, stroke: PAL.grid, 'stroke-width': 1 }));
    ticks.push(txt(x, axY + 18, ['10 GB', '100 GB', '1 TB', '10 TB', '100 TB', '1 PB', '10 PB'][e - LOG0], { size: 10, anchor: 'middle', mono: true }));
  }
  const axis = svg('line', { x1: axX0 - 6, y1: axY, x2: axX1 + 6, y2: axY, stroke: PAL.mut, 'stroke-width': 1.2 });

  // the only thing you actually have: one GPU's HBM
  const hbmA = xOf(80e9), hbmB = xOf(192e9);
  const hbmBand = svg('rect', { x: hbmA, y: 64, width: hbmB - hbmA, height: axY - 64, fill: 'rgba(76,201,168,0.12)', stroke: PAL.moe, 'stroke-width': 1, 'stroke-dasharray': '3 4' });
  const hbmLabel = txt(hbmA - 4, 58, 'one H-class GPU · 80–192 GB HBM', { size: 10.5, fill: PAL.moe });

  // lollipop items: [value, labelY, color, text, anchor]
  const items = [
    { v: mlaAt1M, y: 172, c: PAL.attn, s: `MLA cache @ ${si(T1M)} · ${fmtBig(mlaAt1M)}`, a: 'end' },
    { v: gqaAt1M, y: 128, c: PAL.attn, s: `GQA (8 groups) · ${fmtBig(gqaAt1M)}`, a: 'start' },
    { v: mhaAt1M, y: 84, c: PAL.attn, s: `MHA KV cache · ${fmtBig(mhaAt1M)}`, a: 'end' },
    { v: scoresOne, y: 150, c: PAL.loss, s: `T×T scores, ONE head, ONE layer · ${fmtBig(scoresOne)}`, a: 'start' },
    { v: scoresAll, y: 96, c: PAL.loss, s: `all ${NH}×${L} score matrices · ${fmtBig(scoresAll)}`, a: 'end' },
  ].map((it) => {
    const x = xOf(it.v);
    const g = svg('g', {},
      svg('line', { x1: x, y1: it.y + 6, x2: x, y2: axY, stroke: it.c, 'stroke-width': 1.4, 'stroke-opacity': 0.7 }),
      svg('circle', { cx: x, cy: axY, r: 4, fill: it.c }),
      txt(it.a === 'end' ? x - 7 : x + 7, it.y, it.s, { size: 10.5, fill: it.c, anchor: it.a, mono: true }));
    return { g };
  });

  const foot = txt(24, 284, `the ${fmtBig(scoresOne)} score matrix is per head per layer — ${(T1M / 1e6) * (T1M / 1e6)}×10¹² scores each. Nothing right of the green band fits; everything right of it must be tiled, compressed, or deleted.`, { size: 10.5, fill: PAL.tx });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Log-scale chart of memory demands at one million tokens of context: a single GPU offers 80 to 192 gigabytes of HBM, while the MLA cache needs about 70 gigabytes, GQA about 219 gigabytes, a full MHA KV cache about 1.75 terabytes, one T-by-T score matrix about 2 terabytes, and all score matrices across heads and layers about 7.8 petabytes.`,
  }, title, subtitle, ticks, axis, hbmBand, hbmLabel, items.map((i) => i.g), foot);

  const node = figure('4B.1', `the two enemies on one axis. The <span style="color:var(--fig-attn)">violet</span> items are the O(T) cache (decode&rsquo;s problem); the <span style="color:var(--fig-loss)">red</span> items are the O(T²) score matrix (training/prefill&rsquo;s problem) — if it were ever materialized. All computed from the K2 blueprint in <code>data/k3.js</code>.`, root, { wide: true });
  track(node, (p) => {
    title.setAttribute('opacity', seg(p, 0.08, 0.16));
    subtitle.setAttribute('opacity', seg(p, 0.1, 0.18));
    ticks.forEach((t, i) => t.setAttribute('opacity', seg(p, 0.12 + i * 0.006, 0.2 + i * 0.006)));
    axis.setAttribute('opacity', seg(p, 0.12, 0.2));
    hbmBand.setAttribute('opacity', seg(p, 0.2, 0.28));
    hbmLabel.setAttribute('opacity', seg(p, 0.22, 0.3));
    items.forEach((it, i) => {
      const t = seg(p, 0.26 + i * 0.05, 0.36 + i * 0.05, ease.out);
      it.g.setAttribute('opacity', t);
      it.g.setAttribute('transform', `translate(0, ${lerp(8, 0, t)})`);
    });
    foot.setAttribute('opacity', seg(p, 0.55, 0.65));
  });
  return node;
}

/* ===========================================================================
   Scene — FlashAttention: tiles, SRAM, online softmax (the crown jewel)
   =========================================================================== */

function flashFigure(canvas) {
  const W = 720, H = 460;
  const NC = 12, cs = 23, x0 = 44, y0 = 84;   // 12×12 minicells = 6×6 tiles of 2×2
  const tile = cs * 2, NB = 6;
  const mSize = NC * cs;                      // 276

  const defs = svg('defs', {},
    svg('marker', { id: 'ch4b-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'ch4b-arrG', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.moe })));

  /* -- matrix of minicells --------------------------------------------------- */
  const r = rng(4042);
  const cells = [];
  for (let mi = 0; mi < NC; mi++) for (let mj = 0; mj < NC; mj++) {
    const causal = mj <= mi;
    const rect = causal
      ? svg('rect', { x: x0 + mj * cs + 1, y: y0 + mi * cs + 1, width: cs - 2, height: cs - 2, rx: 2, fill: PAL.attn, opacity: 0 })
      : svg('rect', { x: x0 + mj * cs + 1, y: y0 + mi * cs + 1, width: cs - 2, height: cs - 2, rx: 2, fill: '#0B0F14', stroke: PAL.grid, opacity: 0 });
    cells.push({ rect, mi, mj, ti: mi >> 1, tj: mj >> 1, causal, base: 0.18 + r() * 0.62 });
  }
  const mLabelK = txt(x0, 74, 'keys j →', { size: 10 });
  const mLabelQ = svg('text', { x: 30, y: y0 + mSize / 2, fill: PAL.mut, 'font-size': 10, 'font-family': 'sans-serif', 'text-anchor': 'middle', transform: `rotate(-90, 30, ${y0 + mSize / 2})` }, 'queries i ↓');
  const mFrame = svg('rect', { x: x0, y: y0, width: mSize, height: mSize, rx: 3, fill: 'none', stroke: 'rgba(230,237,243,0.18)', 'stroke-width': 1 });
  const sTag = txt(x0 + 4, y0 + 16, 'S = QKᵀ — T×T', { size: 11, fill: PAL.ink, mono: true, opacity: 0 });

  /* -- tile grid + row band + cursor ----------------------------------------- */
  const gridLines = [];
  for (let i = 1; i < NB; i++) {
    gridLines.push(svg('line', { x1: x0 + i * tile, y1: y0, x2: x0 + i * tile, y2: y0 + mSize, stroke: PAL.ink, 'stroke-width': 1, 'stroke-opacity': 0.35 }));
    gridLines.push(svg('line', { x1: x0, y1: y0 + i * tile, x2: x0 + mSize, y2: y0 + i * tile, stroke: PAL.ink, 'stroke-width': 1, 'stroke-opacity': 0.35 }));
  }
  const bandY = y0 + 3 * tile;
  const rowBand = svg('rect', { x: x0 - 2, y: bandY, width: mSize + 4, height: tile, rx: 3, fill: 'none', stroke: PAL.act, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' });
  const rowBandTag = txt(x0 + mSize + 10, bandY + tile / 2 + 4, 'Qᵢ', { size: 11, fill: PAL.act, mono: true });
  const cursor = svg('rect', { x: x0, y: bandY, width: tile, height: tile, rx: 3, fill: 'none', stroke: PAL.ink, 'stroke-width': 2 });

  /* -- HBM ------------------------------------------------------------------- */
  const hx = 396, hy = 50, hw = 292, hh = 136;
  const strip = (label, y, w, fill) => svg('g', {},
    txt(hx + 14, y + 10, label, { size: 10, mono: true, fill: PAL.tx }),
    svg('rect', { x: hx + 44, y, width: w, height: 12, rx: 3, fill, 'fill-opacity': 0.55 }));
  const hbm = svg('g', {},
    svg('rect', { x: hx, y: hy, width: hw, height: hh, rx: 10, fill: 'rgba(230,237,243,0.03)', stroke: PAL.mut, 'stroke-width': 1.2 }),
    txt(hx + 12, hy + 18, 'HBM — off-chip · ~3 TB/s', { size: 10.5, fill: PAL.ink }),
    strip('Q', hy + 30, 220, PAL.act), strip('K', hy + 48, 220, PAL.act),
    strip('V', hy + 66, 220, PAL.act), strip('O', hy + 84, 220, PAL.moe));
  const sGhost = svg('g', { opacity: 0 },
    svg('rect', { x: hx + 44, y: hy + 106, width: 220, height: 16, rx: 3, fill: PAL.attn, 'fill-opacity': 0.5 }),
    txt(hx + 14, hy + 118, 'S', { size: 10, mono: true, fill: PAL.attn }),
    txt(hx + 154, hy + 118, 'T×T — the problem', { size: 9.5, fill: '#10141A', anchor: 'middle', mono: true }));
  const sGhostCross = svg('g', { opacity: 0 },
    svg('line', { x1: hx + 44, y1: hy + 106, x2: hx + 264, y2: hy + 122, stroke: PAL.loss, 'stroke-width': 2 }),
    txt(hx + 268, hy + 118, 'never written', { size: 9.5, fill: PAL.moe }));

  const naiveArrow = svg('path', { d: `M ${x0 + mSize + 6} 150 C 360 140, 370 125, ${hx - 6} 118`, stroke: PAL.loss, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#ch4b-arr)' });
  const naiveArrowTag = txt(352, 108, '3 round-trips', { size: 9.5, fill: PAL.loss });

  /* -- SRAM ------------------------------------------------------------------ */
  const sx = 460, sy = 210, sw = 228, sh = 74;
  const sram = svg('g', {},
    svg('rect', { x: sx, y: sy, width: sw, height: sh, rx: 10, fill: 'rgba(76,201,168,0.06)', stroke: PAL.moe, 'stroke-width': 1.3 }),
    txt(sx + 12, sy + 17, 'SRAM — on-chip · ~20× faster · KB-scale', { size: 10, fill: PAL.moe }),
    svg('path', { d: `M ${hx + 146} ${hy + hh + 2} L ${sx + 110} ${sy - 4}`, stroke: PAL.moe, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch4b-arrG)' }));
  const kChip = svg('g', {},
    svg('rect', { width: 62, height: 20, rx: 5, fill: 'rgba(90,200,220,0.16)', stroke: PAL.act, 'stroke-width': 1.1 }),
    txt(31, 14, 'Kⱼ tile', { size: 10, fill: PAL.act, anchor: 'middle', mono: true }));
  const vChip = svg('g', {},
    svg('rect', { width: 62, height: 20, rx: 5, fill: 'rgba(90,200,220,0.16)', stroke: PAL.act, 'stroke-width': 1.1 }),
    txt(31, 14, 'Vⱼ tile', { size: 10, fill: PAL.act, anchor: 'middle', mono: true }));
  const sChipTile = svg('g', {},
    svg('rect', { width: 74, height: 20, rx: 5, fill: 'rgba(180,140,224,0.2)', stroke: PAL.attn, 'stroke-width': 1.1 }),
    txt(37, 14, 'Sᵢⱼ tile', { size: 10, fill: PAL.attn, anchor: 'middle', mono: true }));

  /* -- online-softmax statistics (real recursion, computed at build) ---------- */
  const rs = rng(77);
  const tileScores = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => -1 + rs() * 3));
  let m = -Infinity, l = 0;
  const states = tileScores.map((scores) => {
    const tm = Math.max(...scores);
    const mNew = Math.max(m, tm);
    const scale = m === -Infinity ? 1 : Math.exp(m - mNew);
    l = l * scale + scores.reduce((s, v) => s + Math.exp(v - mNew), 0);
    m = mNew;
    return { m, l, scale };
  });
  const statT = txt(396, 314, '', { size: 11.5, fill: PAL.ink, mono: true });
  const statM = txt(396, 336, '', { size: 12, fill: PAL.tx, mono: true });
  const statL = txt(396, 356, '', { size: 12, fill: PAL.tx, mono: true });
  const statO = txt(396, 376, '', { size: 12, fill: PAL.moe, mono: true });

  /* -- naive cost / result readouts ------------------------------------------ */
  const cost1 = txt(44, 394, `at T = ${si(T1M)}: 10¹² scores per head per layer`, { size: 11.5, fill: PAL.loss });
  const cost2 = txt(44, 412, `${fmtBig(scoresOne)} in bf16 — written and re-read from HBM`, { size: 11.5, fill: PAL.loss });

  const check = txt(396, 400, '✓ exact — bit-for-the-same output as naive', { size: 12, fill: PAL.moe });
  const nBarTag = txt(44, 388, 'HBM traffic · naive — O(T²)', { size: 10 });
  const nBar = svg('rect', { x: 44, y: 394, width: 0, height: 13, rx: 3, fill: PAL.loss, 'fill-opacity': 0.8 });
  const fBarTag = txt(44, 424, 'FlashAttention — O(T²·d / M): tiles in, output out once', { size: 10 });
  const fBar = svg('rect', { x: 44, y: 430, width: 0, height: 13, rx: 3, fill: PAL.moe });

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'FlashAttention animated: a T-by-T attention matrix is first shown fully materialized in slow HBM memory, then partitioned into tiles; a cursor sweeps one row-block column-tile by column-tile, loading K and V tiles into fast on-chip SRAM, updating a running row maximum and denominator (online softmax), and rescaling the output accumulator — so the full matrix is never written to memory and the result is exact.',
  }, defs, mLabelK, mLabelQ, mFrame, cells.map((c) => c.rect), sTag,
    gridLines, rowBand, rowBandTag, cursor,
    hbm, sGhost, sGhostCross, naiveArrow, naiveArrowTag,
    sram, kChip, vChip, sChipTile,
    statT, statM, statL, statO,
    cost1, cost2, check, nBarTag, nBar, fBarTag, fBar));

  return (p) => {
    /* step 0 — naive materialization */
    const dim = seg(p, 0.26, 0.32);
    const tileF = clamp((p - 0.52) / 0.20 * 4, 0, 3.999);
    const curJ = Math.floor(tileF);
    cells.forEach((c, i) => {
      const appear = seg(p, 0.02 + i * 0.0011, 0.05 + i * 0.0011);
      if (!c.causal) { c.rect.setAttribute('opacity', appear * (1 - 0.6 * dim)); return; }
      let o = c.base * appear * (1 - 0.85 * dim);
      if (c.ti === 3 && p > 0.5) {
        const rel = c.tj <= curJ ? seg(p, 0.52 + c.tj * 0.05, 0.545 + c.tj * 0.05) : 0;
        o = Math.max(o, c.base * rel);
      }
      c.rect.setAttribute('opacity', o);
    });
    sTag.setAttribute('opacity', seg(p, 0.16, 0.2) * (1 - dim));
    naiveArrow.setAttribute('opacity', seg(p, 0.1, 0.15) * (1 - seg(p, 0.25, 0.29)));
    naiveArrowTag.setAttribute('opacity', seg(p, 0.12, 0.17) * (1 - seg(p, 0.25, 0.29)));
    sGhost.setAttribute('opacity', seg(p, 0.13, 0.18) * (1 - 0.75 * seg(p, 0.27, 0.31)));
    cost1.setAttribute('opacity', seg(p, 0.16, 0.21) * (1 - seg(p, 0.25, 0.28)));
    cost2.setAttribute('opacity', seg(p, 0.18, 0.23) * (1 - seg(p, 0.25, 0.28)));

    /* step 1 — tiles + SRAM */
    gridLines.forEach((g2, i) => g2.setAttribute('opacity', seg(p, 0.27 + i * 0.004, 0.32 + i * 0.004)));
    rowBand.setAttribute('opacity', seg(p, 0.33, 0.38));
    rowBandTag.setAttribute('opacity', seg(p, 0.33, 0.38));
    sram.setAttribute('opacity', seg(p, 0.34, 0.4));
    sGhostCross.setAttribute('opacity', seg(p, 0.36, 0.42));
    const travel = seg(p, 0.4, 0.48, ease.inOut);
    kChip.setAttribute('opacity', seg(p, 0.39, 0.43));
    vChip.setAttribute('opacity', seg(p, 0.41, 0.45));
    kChip.setAttribute('transform', `translate(${lerp(hx + 44, sx + 14, travel)}, ${lerp(hy + 46, sy + 28, travel)})`);
    vChip.setAttribute('transform', `translate(${lerp(hx + 44, sx + 14, travel)}, ${lerp(hy + 64, sy + 50, travel)})`);
    sChipTile.setAttribute('opacity', seg(p, 0.47, 0.5));
    sChipTile.setAttribute('transform', `translate(${sx + 120}, ${sy + 39})`);

    /* step 2 — the sweep + online softmax */
    cursor.setAttribute('opacity', seg(p, 0.51, 0.53) * (1 - seg(p, 0.74, 0.77)));
    cursor.setAttribute('x', x0 + Math.min(tileF, 3) * tile);
    const statOp = seg(p, 0.51, 0.55) * (1 - 0.55 * seg(p, 0.76, 0.8));
    const st = states[curJ];
    statT.textContent = `tile ${curJ + 1} / 4 of row-block i`;
    statM.textContent = `m = ${st.m.toFixed(2)}   running row max`;
    statL.textContent = `ℓ = ${st.l.toFixed(2)}   running denominator`;
    statO.textContent = st.scale < 1 ? `O ← O × ${st.scale.toFixed(2)}   rescaled — max rose` : `O ← O × 1.00   max unchanged`;
    [statT, statM, statL, statO].forEach((t2) => t2.setAttribute('opacity', statOp));

    /* step 3 — exact + traffic */
    check.setAttribute('opacity', seg(p, 0.77, 0.83));
    nBarTag.setAttribute('opacity', seg(p, 0.79, 0.84));
    nBar.setAttribute('width', 300 * seg(p, 0.8, 0.9, ease.out));
    fBarTag.setAttribute('opacity', seg(p, 0.84, 0.89));
    fBar.setAttribute('width', 34 * seg(p, 0.86, 0.94, ease.out));
  };
}

/* ===========================================================================
   Fig 4B.3 — one token's cache to scale, and MLA's decompression path
   =========================================================================== */

function mlaFigure() {
  const W = 760, H = 442;
  const bx0 = 152, bMax = 580;
  const rows = [
    { name: 'MHA', bytes: mhaLayerB, note: `2 × ${NH} heads × ${DH} × bf16`, inside: true },
    { name: 'GQA', bytes: gqaLayerB, note: `8 KV groups → ${gqaLayerB.toLocaleString('en-US')} B` },
    { name: 'MLA', bytes: mlaLayerB, note: `${MLA_C}-d latent + ${MLA_R}-d RoPE key = ${MLA_C + MLA_R} values → ${mlaLayerB.toLocaleString('en-US')} B (${Math.round(mhaLayerB / mlaLayerB)}× less)` },
  ];
  const barEls = rows.map((row, i) => {
    const y = 58 + i * 46;
    const w = (row.bytes / mhaLayerB) * bMax;
    return {
      w,
      name: txt(24, y + 15, row.name, { size: 12.5, fill: PAL.ink, mono: true }),
      bar: svg('rect', { x: bx0, y, width: 0, height: 22, rx: 4, fill: PAL.attn, 'fill-opacity': 0.85 - i * 0.05 }),
      note: row.inside
        ? txt(bx0 + 10, y + 15, `${row.note} = ${row.bytes.toLocaleString('en-US')} B / token / layer`, { size: 10.5, fill: '#10141A', mono: true })
        : txt(0, y + 15, row.note, { size: 10.5, fill: PAL.tx, mono: true }),
      inside: row.inside,
    };
  });
  const head = txt(24, 34, 'one token’s cache footprint, per layer — drawn to scale in bytes (illustrative K2 dims)', { size: 11.5, fill: PAL.ink });

  /* decompression path (animates) */
  const py = 232;
  const latent = svg('g', {},
    svg('rect', { x: 34, y: py + 26, width: 104, height: 36, rx: 8, fill: 'rgba(90,200,220,0.13)', stroke: PAL.act, 'stroke-width': 1.4 }),
    txt(86, py + 42, 'cₜ ∈ ℝ⁵¹²', { size: 12, fill: PAL.act, anchor: 'middle', mono: true }),
    txt(86, py + 56, 'the cached latent', { size: 9, anchor: 'middle' }),
    txt(86, py + 14, 'THE ONLY THING STORED', { size: 9, fill: PAL.act, anchor: 'middle' }));
  const ropeChip = svg('g', {},
    svg('rect', { x: 34, y: py + 146, width: 104, height: 30, rx: 8, fill: 'rgba(180,140,224,0.13)', stroke: PAL.attn, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }),
    txt(86, py + 165, 'kᴿ ∈ ℝ⁶⁴ · RoPE', { size: 10.5, fill: PAL.attn, anchor: 'middle', mono: true }),
    txt(146, py + 165, '← decoupled position key, cached too — shared by all heads', { size: 9.5, fill: PAL.mut }));
  const upBoxes = [['W_UK', py], ['W_UV', py + 72]].map(([n, y]) => svg('g', {},
    svg('rect', { x: 222, y, width: 104, height: 44, rx: 9, fill: 'rgba(224,168,76,0.13)', stroke: PAL.weight, 'stroke-width': 1.4 }),
    txt(274, y + 19, n, { size: 13, fill: PAL.weight, anchor: 'middle', mono: true }),
    txt(274, y + 35, `${MLA_C} × ${NH}·${DH}`, { size: 9, anchor: 'middle', mono: true })));
  const upArrows = [py + 22, py + 94].map((y) =>
    svg('path', { d: `M 140 ${py + 44} C 180 ${py + 44}, 184 ${y}, 216 ${y}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch4b-arr2)' }));
  const fans = [];
  const headYs = [-26, -9, 8, 25];
  [[py + 22, 'k'], [py + 94, 'v']].forEach(([cy, letter]) => {
    headYs.forEach((dy, i2) => {
      fans.push(svg('line', { x1: 330, y1: cy, x2: 402, y2: cy + dy, stroke: PAL.attn, 'stroke-width': 1, 'stroke-opacity': 0.7 }));
      fans.push(svg('g', {},
        svg('rect', { x: 404, y: cy + dy - 8, width: 42, height: 16, rx: 4, fill: 'rgba(180,140,224,0.16)', stroke: PAL.attn, 'stroke-width': 0.8 }),
        txt(425, cy + dy + 4, i2 === 3 ? `${letter}₆₄` : `${letter}${['₁', '₂', '₃'][i2]}`, { size: 9.5, fill: PAL.attn, anchor: 'middle', mono: true })));
    });
  });
  fans.push(txt(425, py + 142, `⋮ ${NH} heads each — at attend time only`, { size: 9, anchor: 'middle' }));
  const absorb = svg('g', {},
    svg('rect', { x: 486, y: py - 8, width: 252, height: 140, rx: 10, fill: 'none', stroke: PAL.weight, 'stroke-width': 1.1, 'stroke-dasharray': '5 4' }),
    txt(500, py + 14, 'the absorption trick (decode):', { size: 10.5, fill: PAL.weight }),
    txt(500, py + 34, 'qᵀk = (xᵀW_Qᵀ W_UK) c — fold W_UK', { size: 9.5, fill: PAL.tx, mono: true }),
    txt(500, py + 50, 'into the query path, W_UV into W_O.', { size: 9.5, fill: PAL.tx, mono: true }),
    txt(500, py + 72, 'per-head K,V are never materialized;', { size: 9.5, fill: PAL.tx }),
    txt(500, py + 88, 'attention runs against the 576-dim', { size: 9.5, fill: PAL.tx }),
    txt(500, py + 104, 'latents directly. RoPE can’t pass', { size: 9.5, fill: PAL.tx }),
    txt(500, py + 120, 'through the fold — hence the kᴿ bypass.', { size: 9.5, fill: PAL.tx }));

  const defs = svg('defs', {},
    svg('marker', { id: 'ch4b-arr2', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Top: bars drawn to byte scale comparing one token’s per-layer cache under MHA (32,768 bytes), GQA with eight groups (4,096 bytes), and MLA (1,152 bytes). Bottom: MLA’s decompression path — the cached 512-dimensional latent is expanded through learned up-projection matrices into 64 per-head keys and values only at attend time, a decoupled 64-dimensional RoPE key bypasses the compression to carry position, and an absorption note explains why the per-head keys and values are never materialized at decode.',
  }, defs, head, barEls.map((b2) => [b2.name, b2.bar, b2.note]), latent, ropeChip, upArrows, upBoxes, fans, absorb);

  const node = figure('4B.3', `what one token leaves behind, to scale — and MLA&rsquo;s trick in full. Chapter 04&rsquo;s Fig 4.5 counted the values; here is the byte anatomy and the decompression path. Latent/RoPE dims are DeepSeek-V3/K2-style (${MLA_C}+${MLA_R}); K3&rsquo;s exact MLA dims are undisclosed.`, root, { wide: true });
  track(node, (p) => {
    head.setAttribute('opacity', seg(p, 0.08, 0.14));
    barEls.forEach((b2, i) => {
      const t = seg(p, 0.1 + i * 0.06, 0.24 + i * 0.06, ease.out);
      b2.name.setAttribute('opacity', t);
      const w = Math.max(4, b2.w * t);
      b2.bar.setAttribute('width', w);
      b2.note.setAttribute('opacity', seg(p, 0.18 + i * 0.06, 0.3 + i * 0.06));
      if (!b2.inside) b2.note.setAttribute('x', bx0 + w + 10);
    });
    latent.setAttribute('opacity', seg(p, 0.3, 0.38));
    upArrows.forEach((a, i) => a.setAttribute('opacity', seg(p, 0.36 + i * 0.03, 0.44 + i * 0.03)));
    upBoxes.forEach((b2, i) => b2.setAttribute('opacity', seg(p, 0.38 + i * 0.03, 0.46 + i * 0.03)));
    fans.forEach((f, i) => f.setAttribute('opacity', seg(p, 0.44 + i * 0.008, 0.52 + i * 0.008)));
    ropeChip.setAttribute('opacity', seg(p, 0.52, 0.6));
    absorb.setAttribute('opacity', seg(p, 0.56, 0.66));
  });
  return node;
}

/* ===========================================================================
   Scene — linear attention, the delta rule, KDA (second centerpiece)
   =========================================================================== */

function deltaFigure(canvas) {
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

  const defs = svg('defs', {},
    svg('marker', { id: 'ch4b-arr3', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'ch4b-arrR', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.loss })),
    svg('marker', { id: 'ch4b-arrT', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.train })));

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
  const readArrow = svg('path', { d: `M ${sx0 + DS * cell + 4} 125 L ${px - 6} 125`, stroke: PAL.act, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch4b-arr3)' });
  const errChip = chip(168, 160, PAL.loss, 'rgba(240,120,80,0.08)', 'error  e = vₜ − v̂', PAL.loss);
  const errArrow = svg('path', { d: `M ${px + 80} 140 L ${px + 80} 162`, stroke: PAL.loss, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch4b-arrR)' });
  const writeChip = chip(226, 160, PAL.train, 'rgba(125,216,127,0.08)', 'write  S += β e kₜᵀ', PAL.train);
  const writeArrow = svg('path', { d: `M ${px - 6} 241 C ${sx0 + DS * cell + 40} 241, ${sx0 + DS * cell + 30} 200, ${sx0 + DS * cell + 4} 190`, stroke: PAL.train, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch4b-arrT)' });
  const pipeNote = txt(px, 282, 'only what the state got wrong is written', { size: 10, fill: PAL.tx });

  /* equations + notes (bottom right region) */
  const eqY = 316;
  const eq0 = txt(330, eqY, 'Sₜ = Sₜ₋₁ + vₜ kₜᵀ', { size: 13, fill: PAL.ink, mono: true });
  const eq1 = txt(330, eqY, 'Sₜ = Diag(αₜ) Sₜ₋₁ + vₜ kₜᵀ', { size: 13, fill: PAL.ink, mono: true, opacity: 0 });
  const eq2 = txt(330, eqY, 'Sₜ = Sₜ₋₁(I − βₜkₜkₜᵀ) + βₜvₜkₜᵀ', { size: 13, fill: PAL.ink, mono: true, opacity: 0 });
  const eqNote = txt(330, eqY + 22, '', { size: 10.5, fill: PAL.mut });
  const chunkTag = txt(330, eqY + 50, 'chunked form: dense matmuls inside a chunk; carry S across chunks', { size: 10, fill: PAL.moe, opacity: 0 });
  const k3Tag = txt(330, eqY + 70, `K3: KDA in most layers · constant state · O(T) total`, { size: 10.5, fill: PAL.ink, opacity: 0 });

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

/* ===========================================================================
   Fig 4B.5 — the hybrid layer stack
   =========================================================================== */

function hybridFigure() {
  const W = 760, H = 232;
  const n = L, bw = 9, gap = 2, x0 = (W - n * (bw + gap)) / 2, yBase = 150;
  const isMla = (i) => (i + 1) % 4 === 0;
  const nMla = Array.from({ length: n }, (_, i) => isMla(i)).filter(Boolean).length;
  const bars = Array.from({ length: n }, (_, i) => {
    const mla = isMla(i);
    return svg('rect', {
      x: x0 + i * (bw + gap), y: mla ? yBase - 74 : yBase - 58,
      width: bw, height: mla ? 74 : 58, rx: 2,
      fill: mla ? PAL.attn : PAL.moe, 'fill-opacity': mla ? 0.9 : 0.55,
    });
  });
  const head = txt(24, 30, `the layer stack as an attention budget — ${n} layers, interleaved (illustrative; K3’s exact layout is undisclosed)`, { size: 11.5, fill: PAL.ink });
  const legend = svg('g', {},
    svg('rect', { x: x0, y: 46, width: 12, height: 12, rx: 2, fill: PAL.moe, 'fill-opacity': 0.55 }),
    txt(x0 + 18, 56, `KDA ×${n - nMla} — constant state, O(T)`, { size: 10.5, fill: PAL.tx }),
    svg('rect', { x: x0 + 250, y: 46, width: 12, height: 12, rx: 2, fill: PAL.attn }),
    txt(x0 + 268, 56, `full (gated MLA) ×${nMla} — exact recall, O(T) cache`, { size: 10.5, fill: PAL.tx }));
  const axis = svg('g', {},
    txt(x0, yBase + 18, 'layer 1', { size: 10, mono: true }),
    txt(x0 + n * (bw + gap) - gap, yBase + 18, `layer ${n}`, { size: 10, anchor: 'end', mono: true }));
  const note = txt(W / 2, yBase + 48, `every token still passes through full attention every ~4 layers — enough retrieval to stay exact, cheap enough to reach ${si(T1M)}`, { size: 10.5, fill: PAL.tx, anchor: 'middle' });
  const note2 = txt(W / 2, yBase + 68, 'the same pattern industry-wide: sliding-window + full interleaves in Gemma/GPT-OSS, Mamba + attention in Jamba', { size: 10, anchor: 'middle' });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `The ${n}-layer stack drawn as a row of bars colored by attention type: three of every four layers run constant-state KDA (teal), and every fourth layer keeps full gated MLA attention (violet) for exact long-range recall.`,
  }, head, legend, bars, axis, note, note2);

  const node = figure('4B.5', `K3&rsquo;s ~3:1 KDA:MLA interleave (the ratio Moonshot published for Kimi Linear, K3&rsquo;s direct ancestor), drawn on the illustrative ${n}-layer blueprint. Pure linear stacks fail needle-in-a-haystack recall; a thin lattice of full-attention layers restores it at a quarter of the cache.`, root, { wide: true });
  track(node, (p) => {
    head.setAttribute('opacity', seg(p, 0.1, 0.18));
    legend.setAttribute('opacity', seg(p, 0.14, 0.22));
    bars.forEach((b2, i) => b2.setAttribute('opacity', seg(p, 0.16 + i * 0.006, 0.24 + i * 0.006, ease.out)));
    axis.setAttribute('opacity', seg(p, 0.5, 0.58));
    note.setAttribute('opacity', seg(p, 0.52, 0.62));
    note2.setAttribute('opacity', seg(p, 0.58, 0.68));
  });
  return node;
}

/* ===========================================================================
   Fig 4B.6 — attention sinks + lost in the middle
   =========================================================================== */

function contextFigure() {
  const W = 760, H = 288;

  /* panel A — StreamingLLM: sinks + sliding window */
  const ax0 = 34, cw = 12.5, nTok = 25, cy = 206;
  const rA = rng(19);
  const massOf = (i) => (i === 0 ? 78 : i === 1 ? 50 : i === 2 ? 36 : i === 3 ? 26 : i >= nTok - 6 ? 14 + (i - (nTok - 6)) * 2.5 : 5 + rA() * 6);
  const aTitle = txt(ax0, 40, 'STREAMING — keep the sinks + a window', { size: 10.5, fill: PAL.ink });
  const aCells = [], aBars = [];
  for (let i = 0; i < nTok; i++) {
    const x = ax0 + i * (cw + 1);
    const sink = i < 4, win = i >= nTok - 6;
    aCells.push(svg('rect', {
      x, y: cy, width: cw, height: 16, rx: 2,
      fill: sink ? 'rgba(224,168,76,0.3)' : win ? 'rgba(90,200,220,0.25)' : 'rgba(107,118,131,0.12)',
      stroke: sink ? PAL.weight : win ? PAL.act : 'none', 'stroke-width': 1,
    }));
    aBars.push({ el: svg('rect', { x: x + 2, y: cy - 8, width: cw - 4, height: 0, rx: 1.5, fill: PAL.attn, 'fill-opacity': sink ? 0.9 : 0.55 }), h: massOf(i) });
  }
  const aMassLabel = txt(ax0, 100, 'attention mass received', { size: 9.5, fill: PAL.attn });
  const aSinkTag = txt(ax0, cy + 34, 'attention sinks — first tokens hoard mass; evict them and the model breaks', { size: 9.5, fill: PAL.weight });
  const aEvictTag = txt(ax0 + 12 * (cw + 1), cy - 62, 'evicted', { size: 9.5, anchor: 'middle' });
  const aWinTag = txt(ax0 + nTok * (cw + 1), cy + 52, 'sliding window — the recent past', { size: 9.5, fill: PAL.act, anchor: 'end' });

  /* panel B — lost in the middle */
  const bx0 = 424, bx1 = 726, by0 = 76, by1 = 206;
  const bTitle = txt(bx0, 40, 'CAPACITY ≠ COMPREHENSION', { size: 10.5, fill: PAL.ink });
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const acc = 1 - 0.52 * Math.pow(Math.abs(Math.sin(Math.PI * t)), 1.4);
    pts.push(`${bx0 + t * (bx1 - bx0)},${by1 - acc * (by1 - by0)}`);
  }
  const uCurve = svg('polyline', { points: pts.join(' '), fill: 'none', stroke: PAL.act, 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
  const needle = svg('line', { x1: bx0, y1: by1 - 0.97 * (by1 - by0), x2: bx1, y2: by1 - 0.97 * (by1 - by0), stroke: PAL.moe, 'stroke-width': 1.5, 'stroke-dasharray': '6 5' });
  const needleTag = txt(bx1, by1 - 0.97 * (by1 - by0) - 8, 'needle-in-a-haystack — saturated', { size: 9.5, fill: PAL.moe, anchor: 'end' });
  const uTag = txt((bx0 + bx1) / 2, by1 - 0.42 * (by1 - by0) + 20, 'multi-fact use — lost in the middle', { size: 9.5, fill: PAL.act, anchor: 'middle' });
  const bAxis = svg('g', {},
    svg('line', { x1: bx0, y1: by1, x2: bx1, y2: by1, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: bx0, y1: by0 - 8, x2: bx0, y2: by1, stroke: PAL.mut, 'stroke-width': 1 }),
    txt(bx0, by1 + 16, 'fact at start', { size: 9.5, mono: true }),
    txt((bx0 + bx1) / 2, by1 + 16, 'middle', { size: 9.5, anchor: 'middle', mono: true }),
    txt(bx1, by1 + 16, 'at end', { size: 9.5, anchor: 'end', mono: true }),
    svg('text', { x: bx0 - 10, y: (by0 + by1) / 2, fill: PAL.mut, 'font-size': 9.5, 'font-family': 'sans-serif', 'text-anchor': 'middle', transform: `rotate(-90, ${bx0 - 10}, ${(by0 + by1) / 2})` }, 'answer quality'));
  const bNote = txt(bx0, by1 + 46, `a ${si(T1M)}-token window is a capacity claim, not a comprehension claim`, { size: 10, fill: PAL.tx });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Left: a strip of context tokens under streaming attention — the first four tokens (attention sinks) receive tall bars of attention mass and are kept, the middle is evicted, and a sliding window keeps the recent past. Right: answer quality versus the position of a fact in context forms a U-shape — high at the start and end, sagging in the middle — while the needle-in-a-haystack score sits flat and saturated near the top.',
  }, aTitle, aCells, aBars.map((b2) => b2.el), aMassLabel, aSinkTag, aEvictTag, aWinTag,
    bTitle, bAxis, needle, needleTag, uCurve, uTag, bNote);

  const node = figure('4B.6', `two honest footnotes to &ldquo;1M context&rdquo;. Left: softmax must sum to 1, so surplus mass parks on the first tokens (<em>sinks</em>) — StreamingLLM keeps them plus a window and streams forever in constant memory. Right: needle tests saturate long before real multi-fact comprehension does; position of information still matters.`, root, { wide: true });
  track(node, (p) => {
    aTitle.setAttribute('opacity', seg(p, 0.08, 0.16));
    aCells.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.1 + i * 0.005, 0.18 + i * 0.005)));
    aBars.forEach((b2, i) => {
      const t = seg(p, 0.18 + i * 0.006, 0.3 + i * 0.006, ease.out);
      b2.el.setAttribute('height', b2.h * t);
      b2.el.setAttribute('y', cy - 8 - b2.h * t);
    });
    aMassLabel.setAttribute('opacity', seg(p, 0.22, 0.3));
    aSinkTag.setAttribute('opacity', seg(p, 0.3, 0.38));
    aEvictTag.setAttribute('opacity', seg(p, 0.32, 0.4));
    aWinTag.setAttribute('opacity', seg(p, 0.34, 0.42));
    bTitle.setAttribute('opacity', seg(p, 0.2, 0.28));
    bAxis.setAttribute('opacity', seg(p, 0.22, 0.3));
    needle.setAttribute('opacity', seg(p, 0.3, 0.38));
    needleTag.setAttribute('opacity', seg(p, 0.32, 0.4));
    uCurve.setAttribute('stroke-dashoffset', 1 - seg(p, 0.34, 0.52));
    uTag.setAttribute('opacity', seg(p, 0.48, 0.56));
    bNote.setAttribute('opacity', seg(p, 0.52, 0.62));
  });
  return node;
}

/* ---- chapter assembly ----------------------------------------------------- */

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'The memory wall', title),
    prose(
      `Chapter 04 ended with a variant zoo and a promise; chapter 09 will show serving splitting into a compute-bound prefill and a bandwidth-bound decode. This chapter is the war between them. Everything about long context — every kernel, every cache trick, every &ldquo;linear attention&rdquo; paper — is a campaign against exactly two quantities. The first is the <strong>T×T score matrix</strong>: training and prefill must, in principle, compare every token with every earlier token, and at T&nbsp;=&nbsp;${si(T1M)} that is 10¹² scores <em>per head, per layer</em>. The second is the <strong>KV cache</strong>: decode must hold something in memory for every past token, and whatever that something costs per token gets multiplied by a million.`,
      `Put both on one axis against the only resource that exists — a GPU&rsquo;s high-bandwidth memory — and the shape of the problem is obvious: nothing fits. The rest of the chapter is the three ways out, in escalating radicalism: <em>never materialize</em> the quadratic object (FlashAttention), <em>shrink</em> what each token leaves behind (GQA&nbsp;→&nbsp;MLA), and <em>delete the per-token cache entirely</em> (linear attention&nbsp;→&nbsp;the delta rule&nbsp;→&nbsp;KDA, which runs in most of K3&rsquo;s layers).`),
    wallFigure(),

    subhead('FlashAttention: the matrix that is never built'),
    prose(
      `The crucial observation is that the T×T matrix is a <em>phantom</em>. Nothing downstream ever needs S itself — only the final weighted sum of values, one d_head-wide row per query. Naive implementations nonetheless write all of S to GPU main memory (HBM), read it back to softmax it, and write the result again. The arithmetic is nearly free on modern hardware; the <em>round-trips</em> are the cost. Attention is IO-bound, and FlashAttention (Dao et al., 2022) is the kernel that restructures it around the memory hierarchy: compute the matrix one small tile at a time in on-chip SRAM — kilobytes, but ~20× the bandwidth — and throw each tile away the moment it has contributed to the running output.`,
      `The obstacle is softmax: each row&rsquo;s normalization needs the row&rsquo;s max and sum, which you don&rsquo;t have until the sweep is over. The fix — the <strong>online softmax</strong> — is to carry running statistics and retroactively rescale. Scroll: the numbers in the panel are the real recursion, computed live.`),
    createScene({
      id: 'flash-tiling',
      figure: flashFigure,
      steps: [
        { n: 'STEP 1 / 4 — THE NAIVE COST', html: `<p>Materialize S = QKᵀ, write it to HBM, read it back for softmax, read it again for A·V — three round-trips through the slowest memory on the board, for an object with T² entries. At ${si(T1M)} tokens that is 10¹² scores per head per layer, ~${fmtBig(scoresOne)} each in bf16. The FLOPs were never the problem; the traffic is.</p>` },
        { n: 'STEP 2 / 4 — TILE IT', html: `<p>Split Q into row-blocks and K, V into column-blocks. Load <em>one</em> pair of K/V tiles into SRAM (a 128×${DH} bf16 tile is 32&nbsp;KB — it fits with room to spare), compute the corresponding tile of scores <em>where it lands</em>, use it, discard it. The strike-through in HBM is the whole point: S is never written anywhere.</p>` },
        { n: 'STEP 3 / 4 — ONLINE SOFTMAX', html: `<p>Softmax needs the full row&rsquo;s max m and denominator ℓ — unavailable mid-sweep. So carry them as running statistics: when a new tile raises the max, multiply the old ℓ <em>and the partial output O</em> by e^(m_old − m_new), then accumulate the new tile. Every prefix of the sweep is algebraically consistent; watch m, ℓ, and the rescale factor update per tile.</p>` },
        { n: 'STEP 4 / 4 — EXACT, IO-OPTIMAL', html: `<p>The output equals naive attention <em>exactly</em> — this is a reordering of sums, not an approximation. HBM traffic falls from O(T²) to O(T²d²/M) for SRAM size M — roughly the tile-count savings in the bars. FlashAttention-2 re-partitions work across warps and parallelizes over the sequence axis; FlashAttention-3 adds Hopper warp specialization, softmax/matmul overlap, and FP8. Every serious stack ships one of them.</p>` },
      ],
    }),
    prose(`<em>Fig. 4B.2 — the tiling dance: the T×T matrix exists only one SRAM-sized tile at a time; running (m, ℓ) statistics make the softmax exact anyway.</em>`),
    term('online softmax', 'n.', 'computing softmax in one streaming pass by carrying a running max m and denominator ℓ, rescaling previous partial results by e^(m_old−m_new) whenever the max rises'),
    mathAside('the FlashAttention update', `
      <p>Sweeping row-block i across column tiles j = 1…n, with per-tile scores Sⱼ:</p>
      <div class="eq">m⁽ʲ⁾ = max(m⁽ʲ⁻¹⁾, rowmax(Sⱼ))<br>ℓ⁽ʲ⁾ = e^(m⁽ʲ⁻¹⁾−m⁽ʲ⁾) ℓ⁽ʲ⁻¹⁾ + rowsum(e^(Sⱼ−m⁽ʲ⁾))<br>O⁽ʲ⁾ = e^(m⁽ʲ⁻¹⁾−m⁽ʲ⁾) O⁽ʲ⁻¹⁾ + e^(Sⱼ−m⁽ʲ⁾) Vⱼ</div>
      <p>and finally O = O⁽ⁿ⁾ / ℓ⁽ⁿ⁾. Expand the recursion and every score sᵢⱼ ends up weighted by exactly e^(sᵢⱼ−m)/ℓ — the softmax — so the result is exact, not approximate. The same trick makes the backward pass recomputable from (m, ℓ) alone, which is why training never stores S either.</p>`),

    subhead('Shrinking what every token leaves behind'),
    prose(
      `FlashAttention rescues prefill and training; decode&rsquo;s enemy is the other quantity. Chapter 09 shows why: generation is bandwidth-bound, and every step must re-read the entire KV cache. So the per-token cache size is not one cost among many — it is <em>the</em> decode cost, and ten years of attention variants (sketched as bars in Fig&nbsp;4.5) are attempts to shrink it. The lineage has real math worth seeing once.`,
      `<strong>GQA</strong> is arithmetic: keep all ${NH} query heads but let groups of 8 share one K/V pair. Queries stay diverse — they&rsquo;re not cached — while cached tensors shrink 8×, from ${mhaLayerB.toLocaleString('en-US')} to ${gqaLayerB.toLocaleString('en-US')} bytes per token per layer. The quality cost is small precisely because keys and values were the redundant part.`,
      `<strong>MLA</strong> (DeepSeek-V2; used by K2 and, gated, by K3) is a change of representation. Instead of caching any per-head tensors, project each token&rsquo;s stream vector down to one shared latent c<sub>t</sub>&nbsp;=&nbsp;W<sub>DKV</sub>&thinsp;x<sub>t</sub> of ${MLA_C} dims, and cache <em>that</em>. Per-head keys and values are re-derived from the latent by learned up-projections at attend time — except they never actually are: at decode the up-projections fold into the query and output paths (the <em>absorption</em> trick), so attention runs directly against the latents. The one thing that can&rsquo;t fold through is RoPE&rsquo;s position-dependent rotation — hence a small decoupled ${MLA_R}-dim rotary key, cached alongside. Total: ${(MLA_C + MLA_R).toLocaleString('en-US')} values per token per layer, versus ${(2 * NH * DH).toLocaleString('en-US')} — a ${Math.round((2 * NH * DH) / (MLA_C + MLA_R))}× compression that benchmarks as <em>stronger</em> than MHA, because the latent bottleneck acts as a regularizer.`),
    mlaFigure(),
    mathAside('MLA cache arithmetic', `
      <p>Cache per token per layer, bf16:</p>
      <div class="eq">MHA:  2 · h · d_head = 2·${NH}·${DH} = ${(2 * NH * DH).toLocaleString('en-US')} values  (${mhaLayerB.toLocaleString('en-US')} B)<br>MLA:  d_c + d_rope = ${MLA_C} + ${MLA_R} = ${MLA_C + MLA_R} values  (${mlaLayerB.toLocaleString('en-US')} B)</div>
      <p>Attend-time reconstruction: kₜ⁽ʰ⁾ = W_UK⁽ʰ⁾cₜ, vₜ⁽ʰ⁾ = W_UV⁽ʰ⁾cₜ. The score is qᵀk = (W_UQ x)ᵀ W_UK c = xᵀ(W_UQᵀW_UK)c — so W_UQᵀW_UK is precomputed once and per-head keys never exist at decode; likewise W_UV is absorbed into W_O. RoPE breaks this because R_m depends on position m and sits between the two matrices — the decoupled kᴿ (rotated, cached raw, shared across heads) carries position instead. Across ${L} layers: ${fmtBig(mlaPerTok * T1M)} at ${si(T1M)} tokens, vs ${fmtBig(mhaAt1M)} for MHA.</p>`),

    subhead('Deleting the cache: linear attention and the delta rule'),
    prose(
      `The radical option: stop caching per-token data altogether. Softmax is the obstacle — remove it and attention&rsquo;s output Σⱼ&thinsp;vⱼ(kⱼᵀq) factors as (Σⱼ&thinsp;vⱼkⱼᵀ)&thinsp;q. That parenthesized sum is a single d×d matrix — a <strong>state</strong> — updatable in O(1) per token: S&nbsp;+=&nbsp;v&thinsp;kᵀ. Memory constant in T; total time O(T) instead of O(T²). Attention becomes a recurrence again — but one made of matmuls, not the sequential bottleneck chapter 04 said transformers escaped.`,
      `The catch is that S is a <em>lossy sum</em>. Writes are never removed; similar keys overwrite each other; d² floats cannot faithfully store a million associations. Early linear attention blurred — fine at perplexity, poor at recall. The fixes arrived in two stages, and both are visible in the state matrix as you scroll: <strong>gating</strong> (decay the past), and the <strong>delta rule</strong> — before writing, ask the state what it <em>already predicts</em> for this key, and write only the error.`),
    createScene({
      id: 'delta-state',
      figure: deltaFigure,
      steps: [
        { n: 'STEP 1 / 5 — DROP THE SOFTMAX', html: `<p>Left: softmax attention appends (k, v) per token, forever — the strip <em>is</em> the O(T) cache. Right: without softmax the same information folds into one d×d state, S += v&thinsp;kᵀ, and a query just reads Sq. Constant memory. The frame never grows.</p>` },
        { n: 'STEP 2 / 5 — WHY IT BLURS', html: `<p>Keep feeding tokens and the state saturates: every cell is a superposition of everything ever written. When two keys point the same way (red flash), their values interfere — retrieval returns a mixture. This is the classic fast-weight/associative-memory capacity problem, and why naive linear attention lost to softmax for a decade.</p>` },
        { n: 'STEP 3 / 5 — GATE IT', html: `<p>First fix: forget. A decay α&thinsp;&lt;&thinsp;1 per step (Mamba-2, gated linear attention lineages) fades old associations so recent ones stay crisp — recency built into the dynamics. But forgetting is indiscriminate: it erases what you still need along with what you don&rsquo;t, and it still never <em>corrects</em> anything.</p>` },
        { n: 'STEP 4 / 5 — THE DELTA RULE', html: `<p>The sharper fix (DeltaNet lineage): treat S as a memory under supervision. <em>Read</em> the state&rsquo;s current prediction v̂ = Skₜ for the incoming key; compute the <em>error</em> vₜ − v̂; <em>write</em> β× the error. If the state already knows this association, nothing is written; if it holds a stale value, it is actively overwritten — S(I − βkkᵀ) erases before + βvkᵀ replaces. An error-correcting memory, not a heap.</p>` },
        { n: 'STEP 5 / 5 — KDA', html: `<p><strong>Kimi Delta Attention</strong> = the gated delta rule made fine-grained: a decay <em>per channel</em> (the teal gates), not one scalar per head — some coordinates hold information for thousands of tokens, others refresh constantly. A chunked formulation keeps it matmul-shaped for tensor cores. This runs in roughly three of every four K3 layers; Moonshot credits the hybrid with up to 6.3× faster decode at ${si(T1M)} tokens.</p>` },
      ],
    }),
    prose(`<em>Fig. 4B.4 — the growing cache vs the constant state, with the delta-rule write as read&nbsp;→&nbsp;error&nbsp;→&nbsp;correction. Cell intensities are a real simulation of all three update rules on the same seeded token stream.</em>`),
    term('delta rule', 'n.', 'update a fast-weight memory by the <em>prediction error</em>: S ← S(I − βkkᵀ) + βvkᵀ — erase the state&rsquo;s current answer for key k, write the corrected one; Widrow &amp; Hoff (1960), reborn in DeltaNet'),
    mathAside('the delta rule as gradient descent', `
      <p>One step of SGD on the associative loss L(S) = ½‖Sk − v‖² with step size β:</p>
      <div class="eq">S ← S − β ∇L = S − β(Sk − v)kᵀ = S(I − βkkᵀ) + βvkᵀ</div>
      <p>— identical to the delta rule. Linear-attention layers are literally training a tiny memory by gradient descent, one step per token, <em>inside</em> the forward pass. KDA refines the gated variant Sₜ = Sₜ₋₁(Diag(αₜ))(I − βₜkₜkₜᵀ) + βₜvₜkₜᵀ with αₜ ∈ (0,1)^d learned per channel, and evaluates it in chunks: within a chunk of ~64 tokens, the products unroll into dense matmuls (a WY-style representation); only the chunk-boundary state is carried recurrently. That is what &ldquo;hardware-efficient&rdquo; means here: the recurrence exists mathematically but the GPU mostly sees GEMMs.</p>`),

    subhead('Hybrids: why K3 keeps some full attention'),
    prose(
      `A constant-size state has a hard information-theoretic ceiling: d² numbers cannot support <em>exact</em> retrieval from an arbitrary million-token past, and it shows — pure linear-attention stacks degrade on needle-in-a-haystack and long-range verbatim tasks precisely where softmax attention, which keeps everything, is trivially perfect. The field&rsquo;s convergent answer is not to choose but to <em>interleave</em>: mostly-cheap layers for throughput, a lattice of full-attention layers for recall.`),
    hybridFigure(),

    subhead('Train short, serve long'),
    prose(
      `One wall remains, and it is not memory: no one pretrains at ${si(T1M)} tokens. Models train mostly at 4–32k and are <em>extended</em> — which works because RoPE (chapter 04&rsquo;s clock hands) encodes only relative offsets that can be rescaled after the fact. <strong>Position interpolation</strong> compresses unseen positions into the trained range (spin every dial slower); <strong>NTK-aware</strong> scaling noticed that slowing the fast dials destroys local detail, so it rescales frequency-dependently; <strong>YaRN</strong> refines this per frequency band and adds a softmax temperature tweak, giving 10–100× extensions after a brief fine-tune. This family, plus long-context mid-training, is how every &ldquo;1M-token&rdquo; number on a spec sheet — K3&rsquo;s included — actually happens.`,
      `Two honest footnotes. Softmax rows must sum to 1, so heads with nothing to say park their attention mass somewhere — overwhelmingly on the first few tokens. These <strong>attention sinks</strong> are load-bearing: evict them from a sliding-window cache and generation collapses; keep just them plus a recent window (StreamingLLM) and a model streams indefinitely in constant memory. And capacity is not comprehension: retrieval quality sags for facts buried mid-context (&ldquo;lost in the middle&rdquo;), so a saturated needle-in-a-haystack score is a floor, not a ceiling, on what long context means.`),
    term('attention sink', 'n.', 'early tokens (often position 0) that absorb surplus attention mass because softmax must put it somewhere; keeping them is what makes sliding-window streaming stable'),
    contextFigure(),

    takeaway(
      `The memory wall never moved — ${fmtBig(mhaAt1M)} of naive cache and 10¹² scores per head were never going to fit in ${fmtBig(192e9)} of HBM. What moved is what attention <em>stores</em>: tiles instead of matrices, ${MLA_C + MLA_R} latent dims instead of ${(2 * NH * DH).toLocaleString('en-US')}, a fixed error-correcting state instead of a cache at all — and a 3:1 hybrid to keep recall exact. Compound those and you get K3&rsquo;s claim: up to 6.3× faster decode at ${si(T1M)} tokens. Not one breakthrough — three compressions deep, multiplied.`));
}
