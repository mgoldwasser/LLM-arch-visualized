/* Figure — the 6·N·D compute formula, and the dense-vs-MoE bar it implies. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, PAL } from '../../core/components.js';
import { seg, ease, si } from '../../core/anim.js';
import { track } from '../../core/scroll.js';
import { K3 } from '../../../data/k3.js';

export function computeFigure() {
  const W = 720, H = 420;
  const denseH = 300, moeH = denseH / 56;   // dense 2.8T pays ~56× per token
  const baseY = 380;

  const formula = svg('g', { opacity: 0 },
    svg('text', { x: 40, y: 110, fill: PAL.ink, 'font-family': 'monospace', 'font-size': 26 }, 'compute ≈ 6 · N · D'),
    svg('text', { x: 40, y: 148, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, '2 FLOPs per parameter per token forward, ~4 backward'));
  const termN = svg('g', { opacity: 0 },
    svg('text', { x: 40, y: 196, fill: PAL.act, 'font-family': 'monospace', 'font-size': 14 }, `N ≈ ${si(K3.activeParams)} active parameters`));
  const termD = svg('g', { opacity: 0 },
    svg('text', { x: 40, y: 224, fill: PAL.tx, 'font-family': 'monospace', 'font-size': 14 }, 'D ≈ 15T tokens'));
  const result = svg('g', { opacity: 0 },
    svg('text', { x: 40, y: 268, fill: PAL.loss, 'font-family': 'monospace', 'font-size': 17 }, '→ ≈ 4.5×10²⁴ FLOPs'),
    svg('text', { x: 40, y: 292, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'months on tens of thousands of accelerators'));

  const moeBar = svg('rect', { x: 430, y: baseY, width: 70, height: 0, fill: PAL.moe });
  const moeLab = svg('g', { opacity: 0 },
    svg('text', { x: 465, y: baseY - moeH - 26, 'text-anchor': 'middle', fill: PAL.moe, 'font-family': 'sans-serif', 'font-size': 11 }, `K3 (MoE, ${si(K3.activeParams)} active)`),
    svg('text', { x: 465, y: baseY - moeH - 12, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 10 }, '≈ 4.5×10²⁴'));
  const denseBar = svg('rect', { x: 560, y: baseY, width: 70, height: 0, fill: 'rgba(107,118,131,0.55)', stroke: PAL.mut, 'stroke-width': 1 });
  const denseLab = svg('g', { opacity: 0 },
    svg('text', { x: 595, y: baseY - denseH - 26, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11 }, `dense ${si(K3.totalParams)}, same tokens`),
    svg('text', { x: 595, y: baseY - denseH - 12, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, '≈ 2.5×10²⁶'));
  const brace = svg('g', { opacity: 0 },
    svg('line', { x1: 516, y1: baseY - denseH, x2: 516, y2: baseY - moeH, stroke: PAL.loss, 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
    svg('text', { x: 522, y: baseY - denseH / 2, fill: PAL.loss, 'font-family': 'monospace', 'font-size': 13 }, '~56×'));
  const axis = svg('line', { x1: 410, y1: baseY, x2: 660, y2: baseY, stroke: PAL.mut, 'stroke-width': 1 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Training compute is roughly 6 times N times D. With 50 billion active parameters and 15 trillion tokens that is about 4.5 times 10 to the 24 FLOPs; a dense 2.8-trillion-parameter model would cost about 56 times more, shown as a much taller bar.',
  }, formula, termN, termD, result, axis, moeBar, moeLab, denseBar, denseLab, brace);

  const fig = figure(
    `the folk formula for training cost, and the entire economic case for MoE: sparsity buys trillion-scale capacity at ${si(K3.activeParams)}-scale compute. Bars to scale — the dense bar is ~56× taller.`,
    root, { wide: true, key: 'compute' });

  track(fig, (p) => {
    formula.setAttribute('opacity', seg(p, 0.10, 0.18));
    termN.setAttribute('opacity', seg(p, 0.16, 0.24));
    termD.setAttribute('opacity', seg(p, 0.20, 0.28));
    result.setAttribute('opacity', seg(p, 0.26, 0.34));
    const tMoe = seg(p, 0.30, 0.38, ease.out);
    moeBar.setAttribute('height', Math.max(1.5, moeH * tMoe));
    moeBar.setAttribute('y', baseY - Math.max(1.5, moeH * tMoe));
    moeLab.setAttribute('opacity', seg(p, 0.34, 0.40));
    const tDense = seg(p, 0.38, 0.56, ease.inOut);
    denseBar.setAttribute('height', denseH * tDense);
    denseBar.setAttribute('y', baseY - denseH * tDense);
    denseLab.setAttribute('opacity', seg(p, 0.52, 0.60));
    brace.setAttribute('opacity', seg(p, 0.56, 0.64));
  });
  return fig;
}
