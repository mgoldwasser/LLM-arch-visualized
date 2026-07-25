/* Figure — one token's cache drawn to byte scale, and MLA's decompression
   path: the cached latent expanded into per-head K,V only at attend time. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, chRef, figRef, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { NH, DH, MLA_C, MLA_R, mhaLayerB, gqaLayerB, mlaLayerB } from './shared.js';

export function mlaFigure() {
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
    svg('path', { d: `M 140 ${py + 44} C 180 ${py + 44}, 184 ${y}, 216 ${y}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mla-arr)' }));
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
    svg('marker', { id: 'mla-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Top: bars drawn to byte scale comparing one token’s per-layer cache under MHA (32,768 bytes), GQA with eight groups (4,096 bytes), and MLA (1,152 bytes). Bottom: MLA’s decompression path — the cached 512-dimensional latent is expanded through learned up-projection matrices into 64 per-head keys and values only at attend time, a decoupled 64-dimensional RoPE key bypasses the compression to carry position, and an absorption note explains why the per-head keys and values are never materialized at decode.',
  }, defs, head, barEls.map((b2) => [b2.name, b2.bar, b2.note]), latent, ropeChip, upArrows, upBoxes, fans, absorb);

  const node = figure(
    `what one token leaves behind, to scale — and MLA&rsquo;s trick in full. ${chRef('attention', { cap: true })}&rsquo;s ${figRef('attention', 'variants')} counted the values; here is the byte anatomy and the decompression path. Latent/RoPE dims are DeepSeek-V3/K2-style (${MLA_C}+${MLA_R}); K3&rsquo;s exact MLA dims are undisclosed.`,
    root, { wide: true, key: 'mla' });
  return pin(node, (p) => {
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
}
