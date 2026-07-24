/* Figure — the hybrid layer stack: mostly constant-state KDA layers with a thin
   lattice of full-attention layers to keep exact recall. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, si } from '../../core/anim.js';
import { track } from '../../core/scroll.js';
import { L, T1M } from './shared.js';

export function hybridFigure() {
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

  const node = figure(
    `K3&rsquo;s ~3:1 KDA:MLA interleave (the ratio Moonshot published for Kimi Linear, K3&rsquo;s direct ancestor), drawn on the illustrative ${n}-layer blueprint. Pure linear stacks fail needle-in-a-haystack recall; a thin lattice of full-attention layers restores it at a quarter of the cache.`,
    root, { wide: true, key: 'hybrid' });
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
