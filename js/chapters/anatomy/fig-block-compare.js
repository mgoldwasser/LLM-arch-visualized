/* The block, nine years apart — 2017 vs 2026, with each changed component pair
   lighting up in amber, one at a time, and its reason printed below. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, chNum, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

export function blockCompareFigure() {
  const W = 720, H = 486;
  const LX = 62, RX = 420, BW = 238, BH = 40;
  const RYy = (i) => 398 - i * 60;                  // row i = 0 (bottom) … 5 (top)
  const AMBER = PAL.weight;

  // [leftLabel, rightLabel, diffIndex] — diffIndex −1 = unchanged
  const ROWS = [
    ['tokens + learned position table', 'tokens — RoPE lives in attention', 1],
    ['LayerNorm → multi-head attention', 'RMSNorm → gated MLA + KDA', 2],
    ['add, then LayerNorm on the path', 'add — identity path untouched', 0],
    ['LayerNorm → MLP: 4·d, GELU, biases', `RMSNorm → MoE: ${K3.experts.routed} gated experts`, 3],
    ['add, then LayerNorm on the path', 'add — identity path untouched', 0],
    ['tied unembedding, biases throughout', 'untied unembedding, zero biases', 4],
  ];
  const DIFFS = [
    'post-norm → pre-RMSNorm: the identity path stays clean, so 60-layer stacks train without warmup fragility',
    `learned positions → RoPE: relative offsets, injected where they are used — inside attention (ch. ${chNum('attention')})`,
    `MHA → gated MLA + KDA: compress the KV cache, go O(T) in most layers — the 1M-context enablers (ch. ${chNum('attention-scale')})`,
    `one 4·d MLP → ${K3.experts.routed} small experts, SwiGLU-family (K3: SiTU): capacity without FLOPs (ch. ${chNum('moe')})`,
    'biases, tying, dropout → deleted: fewer knobs, same loss, more stable training',
  ];

  const boxes = [];   // per row: { lBox, rBox, lHi, rHi, diff }
  const parts = [];
  ROWS.forEach(([lt, rt, diff], i) => {
    const y = RYy(i);
    const lBox = svg('rect', { x: LX, y, width: BW, height: BH, rx: 9, fill: 'rgba(230,237,243,0.04)', stroke: PAL.mut, 'stroke-width': 1 });
    const rBox = svg('rect', { x: RX, y, width: BW, height: BH, rx: 9, fill: 'rgba(90,200,220,0.05)', stroke: PAL.mut, 'stroke-width': 1 });
    const lHi = svg('rect', { x: LX - 3, y: y - 3, width: BW + 6, height: BH + 6, rx: 11, fill: 'none', stroke: AMBER, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0 });
    const rHi = svg('rect', { x: RX - 3, y: y - 3, width: BW + 6, height: BH + 6, rx: 11, fill: 'none', stroke: AMBER, 'stroke-width': 1.8, opacity: 0 });
    parts.push(lBox, rBox, lHi, rHi,
      txt(LX + BW / 2, y + 25, lt, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }),
      txt(RX + BW / 2, y + 25, rt, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }));
    if (i < 5) {
      parts.push(
        svg('line', { x1: LX + BW / 2, y1: y, x2: LX + BW / 2, y2: y - 20, stroke: PAL.mut, 'stroke-width': 1, opacity: 0.5 }),
        svg('line', { x1: RX + BW / 2, y1: y, x2: RX + BW / 2, y2: y - 20, stroke: PAL.act, 'stroke-width': 1, opacity: 0.5 }));
    }
    boxes.push({ lHi, rHi, diff });
  });
  const titles = [
    txt(LX + BW / 2, 30, '2017 — the GPT-lineage block', { size: 12, fill: PAL.ink, anchor: 'middle' }),
    txt(LX + BW / 2, 46, 'post-norm LN · GELU · learned pos · tied · biases', { size: 10, anchor: 'middle' }),
    txt(RX + BW / 2, 30, `2026 — the ${K3.name}-style block`, { size: 12, fill: PAL.ink, anchor: 'middle' }),
    txt(RX + BW / 2, 46, 'pre-RMSNorm · MoE · RoPE · untied · no biases', { size: 10, anchor: 'middle' }),
  ];
  const reasonBg = svg('rect', { x: 24, y: 452, width: W - 48, height: 26, rx: 7, fill: 'rgba(224,168,76,0.07)', stroke: AMBER, 'stroke-width': 0.8, opacity: 0 });
  const reason = svg('text', { x: W / 2, y: 469, 'text-anchor': 'middle', fill: AMBER, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, '');

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Two labeled block diagrams side by side: a 2017 GPT-lineage transformer block and a 2026 ${K3.name}-style block, drawn as vertical stacks of components. As the figure scrolls, each changed component pair lights up in amber with a one-line reason for the change shown beneath.`,
  }, parts, titles, reasonBg, reason);

  const node = figure(
    `the same block, nine years apart (right side illustrative where ${K3.name} is undisclosed). Amber = what changed. Everything not highlighted — residual adds, the two-sublayer rhythm, the stack itself — survived untouched.`,
    root, { wide: true, key: 'block-compare' });

  return pin(node, (p) => {
    let current = -1;
    boxes.forEach(({ lHi, rHi, diff }) => {
      if (diff < 0) return;
      const t = seg(p, 0.16 + diff * 0.11, 0.24 + diff * 0.11);
      lHi.setAttribute('opacity', t * 0.7);
      rHi.setAttribute('opacity', t);
      if (t > 0.5) current = Math.max(current, diff);
    });
    const on = current >= 0 ? 1 : 0;
    reasonBg.setAttribute('opacity', on * 0.9);
    reason.setAttribute('opacity', on);
    if (current >= 0) reason.textContent = DIFFS[current];
  });
}
