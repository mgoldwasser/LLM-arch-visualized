/* Scroll scene — FlashAttention: tiles, SRAM, online softmax. The panel's
   running (m, ℓ, rescale) statistics are the real recursion, computed at build
   time and indexed by scroll progress, so scrubbing back rewinds exactly. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, lerp, ease, clamp, rng, si } from '../../core/anim.js';
import { T1M, fmtBig, scoresOne } from './shared.js';

export function flashScene(canvas) {
  const W = 720, H = 460;
  const NC = 12, cs = 23, x0 = 44, y0 = 84;   // 12×12 minicells = 6×6 tiles of 2×2
  const tile = cs * 2, NB = 6;
  const mSize = NC * cs;                      // 276

  const defs = svg('defs', {},
    svg('marker', { id: 'flash-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'flash-arrG', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
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

  const naiveArrow = svg('path', { d: `M ${x0 + mSize + 6} 150 C 360 140, 370 125, ${hx - 6} 118`, stroke: PAL.loss, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#flash-arr)' });
  const naiveArrowTag = txt(352, 108, '3 round-trips', { size: 9.5, fill: PAL.loss });

  /* -- SRAM ------------------------------------------------------------------ */
  const sx = 460, sy = 210, sw = 228, sh = 74;
  const sram = svg('g', {},
    svg('rect', { x: sx, y: sy, width: sw, height: sh, rx: 10, fill: 'rgba(76,201,168,0.06)', stroke: PAL.moe, 'stroke-width': 1.3 }),
    txt(sx + 12, sy + 17, 'SRAM — on-chip · ~20× faster · KB-scale', { size: 10, fill: PAL.moe }),
    svg('path', { d: `M ${hx + 146} ${hy + hh + 2} L ${sx + 110} ${sy - 4}`, stroke: PAL.moe, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#flash-arrG)' }));
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
