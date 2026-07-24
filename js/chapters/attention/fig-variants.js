/* Figure — the variant zoo as shrinking KV-cache bars: ten years of attention
   research, all aimed at the same per-token memory. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { track } from '../../core/scroll.js';
import { K3 } from '../../../data/k3.js';
import { BP } from './shared.js';

export function variantsFigure() {
  const W = 760, H = 330;
  const mha = BP.heads * BP.dHead * 2;   // 16,384 values per token per layer
  const gqa = 8 * BP.dHead * 2;          // 2,048 (8 KV groups)
  const mla = 576;                       // DeepSeek-style latent (512 + 64 RoPE)
  const rows = [
    { name: 'MHA', sub: '2017 · every head owns K,V', val: mha, label: `${BP.heads} heads × K,V = ${mha.toLocaleString('en-US')} values/token`, inside: true },
    { name: 'MQA / GQA', sub: 'heads share K,V sets', val: gqa, label: `8 groups → ${gqa.toLocaleString('en-US')}  (8× smaller)` },
    { name: 'MLA', sub: 'DeepSeek, K2 · one latent', val: mla, label: '~576 — decompressed on the fly' },
    { name: 'Gated MLA + KDA', sub: 'K3 · linear-attention state', val: 0, label: 'constant-size state — cost O(T), not O(T²)' },
  ];
  const x0 = 190, maxW = 420, y0 = 78, dy = 62;
  const els = rows.map((row, i) => {
    const y = y0 + i * dy;
    const w = (row.val / mha) * maxW;
    const bar = row.val > 0
      ? svg('rect', { x: x0, y: y - 12, width: 0, height: 26, rx: 4, fill: PAL.attn, 'fill-opacity': i === 0 ? 0.9 : 0.75 })
      : svg('rect', { x: x0, y: y - 12, width: 26, height: 26, rx: 4, fill: 'rgba(90,200,220,0.14)', stroke: PAL.act, 'stroke-dasharray': '3 3' });
    const label = row.inside
      ? txt(x0 + 8, y + 5, row.label, { size: 11, fill: '#10141A', mono: true })
      : txt(0, y + 5, row.label, { size: 11, fill: PAL.tx, mono: true });
    const g = svg('g', {},
      txt(24, y, row.name, { size: 12.5, fill: i === 3 ? PAL.act : PAL.ink, mono: true }),
      txt(24, y + 17, row.sub, { size: 10 }),
      bar, label);
    return { g, bar, label, w, row, y };
  });
  const head = txt(24, 30, 'per-token KV cache, one layer — what inference must hold for every past token (K2-scale dims, illustrative)', { size: 11 });
  const axis = svg('g', {},
    svg('line', { x1: x0, y1: y0 - 34, x2: x0, y2: y0 + 3 * dy + 18, stroke: PAL.grid, 'stroke-width': 1 }),
    txt(x0, y0 + 3 * dy + 36, '0', { size: 10, anchor: 'middle', mono: true }),
    txt(x0 + maxW, y0 + 3 * dy + 36, mha.toLocaleString('en-US') + ' values', { size: 10, anchor: 'end', mono: true }));
  const kdaNote = txt(24, 318, `Moonshot: up to 6.3× faster decoding at ${(K3.contextWindow / 1e6)}M-token context`, { size: 10, fill: PAL.moe });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Four attention variants as bars of per-token KV-cache size: MHA largest at 16,384 values, grouped-query attention 2,048, multi-head latent attention about 576, and K3’s KDA hybrid a constant-size state with no per-token growth.',
  }, head, axis, els.map((e) => e.g), kdaNote);

  const node = figure(
    'ten years of attention variants, one motive: shrink the per-token memory inference must hold.',
    root, { wide: true, key: 'variants' });
  track(node, (p) => {
    head.setAttribute('opacity', seg(p, 0.1, 0.18));
    axis.setAttribute('opacity', seg(p, 0.12, 0.2));
    els.forEach((e, i) => {
      const t = seg(p, 0.14 + i * 0.08, 0.34 + i * 0.08, ease.out);
      e.g.setAttribute('opacity', t);
      if (e.row.val > 0) {
        const wNow = e.w * t;
        e.bar.setAttribute('width', wNow);
        if (!e.row.inside) e.label.setAttribute('x', x0 + Math.max(wNow, 26) + 10);
      } else {
        e.label.setAttribute('x', x0 + 36);
      }
    });
    kdaNote.setAttribute('opacity', seg(p, 0.5, 0.6));
  });
  return node;
}
