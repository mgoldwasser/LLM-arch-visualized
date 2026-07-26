/* Figure — the wall, quantified: both enemies of long context on one log axis,
   against the only resource that actually exists (one GPU's HBM). */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, lerp, ease, si } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { L, D, NH, T1M, fmtBig, mhaAt1M, gqaAt1M, mlaAt1M, scoresOne, scoresAll } from './shared.js';

export function wallFigure() {
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

  const node = figure(
    `the two enemies on one axis. The <span style="color:var(--fig-attn)">violet</span> items are the O(T) cache (decode&rsquo;s problem); the <span style="color:var(--fig-loss)">red</span> items are the O(T²) score matrix (training/prefill&rsquo;s problem) — if it were ever materialized. All computed from the K2 blueprint in <code>data/k3.js</code>.`,
    root, { wide: true, key: 'wall' });
  return pin(node, (p) => {
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
}
