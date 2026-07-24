/* What got deleted from the block, 2017 → 2026. Five rows, five strike-throughs
   drawn as the figure transits the viewport. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, ease } from '../../core/anim.js';

export function deletionsFigure() {
  const W = 720, H = 268;
  const ROWS = [
    ['learned absolute position table', 'replaced by RoPE, applied inside attention', '→ 2021'],
    ['LayerNorm mean-centering + bias β', 'RMSNorm keeps only the gain g', '→ 2019'],
    ['biases on every linear layer', 'no measurable gain; training more stable without', '→ 2022'],
    ['dropout', 'one epoch over trillions of tokens barely overfits', '→ 2022'],
    ['embedding–unembedding tying', 'untied once vocab params became a rounding error', '→ 2020'],
  ];
  const RY = (i) => 66 + i * 38;
  const title = txt(24, 30, 'deleted from the block, 2017 → 2026', { size: 12, fill: PAL.ink });
  const parts = [], strikes = [], notes = [];
  ROWS.forEach(([name, note, yr], i) => {
    const y = RY(i);
    parts.push(
      txt(24, y, name, { size: 13, fill: PAL.tx, mono: true }),
      txt(696, y, yr, { size: 11, fill: PAL.mut, anchor: 'end', mono: true }));
    const noteT = txt(24, y + 15, note, { size: 10.5, fill: PAL.mut, opacity: 0 });
    notes.push(noteT); parts.push(noteT);
    const strike = svg('line', { x1: 22, y1: y - 4, x2: 22, y2: y - 4, stroke: PAL.loss, 'stroke-width': 1.6, opacity: 0.9 });
    strikes.push({ strike, len: 12 + name.length * 7.6 });
    parts.push(strike);
  });
  const footer = txt(W / 2, H - 12, 'each deletion: equal or better loss, fewer FLOPs, one less interaction to debug', { size: 11, anchor: 'middle', opacity: 0 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A list of five components deleted from the transformer block between 2017 and 2026 — the learned position table, LayerNorm mean and bias, linear-layer biases, dropout, and embedding tying — each crossed out by a red strike line with a one-line reason.',
  }, title, parts, footer);

  const node = figure(
    'the modern block is the 2017 block edited mostly by deletion. Every removal was validated the same way: take it out, watch the loss curve not move.',
    root, { key: 'deletions' });

  track(node, (p) => {
    strikes.forEach(({ strike, len }, i) => {
      const t = seg(p, 0.14 + i * 0.07, 0.30 + i * 0.07, ease.out);
      strike.setAttribute('x2', 22 + len * t);
      notes[i].setAttribute('opacity', seg(p, 0.20 + i * 0.07, 0.34 + i * 0.07));
    });
    footer.setAttribute('opacity', seg(p, 0.55, 0.66));
  });
  return node;
}
