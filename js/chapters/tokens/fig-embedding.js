/* The embedding lookup and its unembedding mirror: one row of a learned
   matrix becomes the token's vector, and at the far end the same shape maps
   back to one score per vocabulary entry. Scroll-tracked. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, lerp, ease, si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

export function figEmbedding() {
  const W = 720, H = 400;
  const d = K3.blueprint.dModel;

  // E — the embedding matrix, tall and thin
  const eLines = Array.from({ length: 17 }, (_, i) => svg('line', {
    x1: 41, y1: 56 + (i + 1) * (290 / 18), x2: 139, y2: 56 + (i + 1) * (290 / 18),
    stroke: PAL.weight, opacity: 0.12,
  }));
  const gE = svg('g', { opacity: 0 },
    svg('rect', { x: 40, y: 56, width: 100, height: 290, rx: 4, fill: 'rgba(224,168,76,0.07)', stroke: PAL.weight, 'stroke-width': 1.4 }),
    eLines,
    txt(40, 40, `E ∈ ℝ^(${si(K3.vocab)} × d)`, { size: 12.5, fill: PAL.weight, mono: true }),
    txt(40, 366, 'one row per vocab entry'));

  const hlRow = svg('rect', { x: 42, y: 190, width: 96, height: 10, rx: 2, fill: PAL.weight, opacity: 0 });
  const rowLabel = txt(170, 178, '← row 517 (“un”)', { size: 12, fill: PAL.weight, mono: true, opacity: 0 });

  // the extracted vector — activation-cyan cells expanding out of the row
  const vecVals = ['0.11', '−1.72', '0.03', '…'];
  const VX = [170, 225, 280, 335], VY = 181;
  const gVec = svg('g', { opacity: 0 },
    vecVals.map((v, i) => svg('g', { transform: `translate(${VX[i]}, ${VY})` },
      svg('rect', { width: 52, height: 28, rx: 5, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
      txt(26, 19, v, { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }))));
  const dLabel = txt(170, 228, '· d numbers', { opacity: 0 });

  const arrow1 = svg('path', { d: 'M 394 195 L 436 195', stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', opacity: 0, 'marker-end': 'url(#arr22)' });

  // the stack of layers (next chapter)
  const slabs = Array.from({ length: 4 }, (_, i) => svg('rect', {
    x: 456, y: 152 + i * 13, width: 100, height: 7, rx: 2, fill: PAL.act, opacity: 0.35,
  }));
  const gStack = svg('g', { opacity: 0 },
    svg('rect', { x: 444, y: 140, width: 124, height: 110, rx: 10, fill: 'rgba(90,200,220,0.06)', stroke: PAL.act, 'stroke-width': 1.3 }),
    slabs,
    txt(506, 218, 'the stack', { size: 11.5, fill: PAL.tx, anchor: 'middle' }),
    txt(506, 232, 'of layers', { size: 11.5, fill: PAL.tx, anchor: 'middle' }),
    txt(506, 245, '(next chapter)', { anchor: 'middle' }));

  const arrow2 = svg('path', { d: 'M 572 195 L 604 195', stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', opacity: 0, 'marker-end': 'url(#arr22)' });

  // the unembedding mirror
  const wuLines = Array.from({ length: 13 }, (_, i) => svg('line', {
    x1: 611, y1: 80 + (i + 1) * (230 / 14), x2: 693, y2: 80 + (i + 1) * (230 / 14),
    stroke: PAL.weight, opacity: 0.12,
  }));
  const gWu = svg('g', { opacity: 0 },
    svg('rect', { x: 610, y: 80, width: 84, height: 230, rx: 4, fill: 'rgba(224,168,76,0.07)', stroke: PAL.weight, 'stroke-width': 1.4 }),
    wuLines,
    txt(706, 64, 'Wᵁ — unembedding (V × d)', { size: 11.5, fill: PAL.weight, anchor: 'end', mono: true }));
  const gLogits = svg('g', { opacity: 0 },
    svg('path', { d: 'M 652 314 L 652 334', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#arr22)' }),
    txt(652, 352, 'logits → softmax', { fill: PAL.tx, anchor: 'middle', mono: true }));

  const bottomNote = txt(300, 388, 'one vector per input token — the model’s working representation',
    { anchor: 'middle', opacity: 0 });

  const defs = svg('defs', {},
    svg('marker', { id: 'arr22', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Embedding lookup: the tall embedding matrix E with one highlighted row extracted as a dense vector that flows into the stack of layers; at the other end the unembedding matrix maps the final vector back to logits over the vocabulary.',
  }, defs, gE, hlRow, rowLabel, gVec, dLabel, arrow1, gStack, arrow2, gWu, gLogits, bottomNote);

  const node = figure(
    `embedding lookup: a token ID selects one row of a learned matrix. With a ${si(K3.vocab)} vocabulary and d = ${d.toLocaleString('en-US')} (K2 blueprint, illustrative), E alone is ≈ ${si(K3.vocab * d)} parameters.`,
    root,
    { key: 'embedding' });

  return pin(node, (p) => {
    gE.setAttribute('opacity', seg(p, 0.12, 0.28));
    const tRow = seg(p, 0.28, 0.38);
    hlRow.setAttribute('opacity', tRow);
    rowLabel.setAttribute('opacity', tRow);
    // the row (96×10, at x=42 y=190) grows into the vector (217×28, at x=170 y=181)
    const tV = seg(p, 0.36, 0.52, ease.out);
    const sx = lerp(0.44, 1, tV), sy = lerp(0.36, 1, tV);
    gVec.setAttribute('opacity', tV);
    gVec.setAttribute('transform',
      `translate(${lerp(42, 170, tV) - 170 * sx} ${lerp(190, VY, tV) - VY * sy}) scale(${sx} ${sy})`);
    dLabel.setAttribute('opacity', seg(p, 0.5, 0.56));
    arrow1.setAttribute('opacity', seg(p, 0.5, 0.58));
    gStack.setAttribute('opacity', seg(p, 0.54, 0.64));
    arrow2.setAttribute('opacity', seg(p, 0.62, 0.68));
    gWu.setAttribute('opacity', seg(p, 0.64, 0.76));
    gLogits.setAttribute('opacity', seg(p, 0.72, 0.8));
    bottomNote.setAttribute('opacity', seg(p, 0.55, 0.65));
  });
}
