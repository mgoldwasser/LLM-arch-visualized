/* Figure — the shapes, end to end: what every tensor in one head looks like,
   and which of them grow with context. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, chNum, PAL } from '../../core/components.js';
import { seg, lerp, ease } from '../../core/anim.js';
import { track } from '../../core/scroll.js';
import { BP } from './shared.js';

/* Unicode subscript digits, so the concat label tracks BP.heads. */
const SUBD = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n) => String(n).split('').map((d) => SUBD[+d]).join('');

export function shapesFigure() {
  const W = 760, H = 296, midY = 130;
  const items = [];
  const box = (x, w, h, { fill, stroke, name, nameFill, dim, extra = [] }) => {
    const y = midY - h / 2;
    const g = svg('g', {},
      svg('rect', { x, y, width: w, height: h, rx: 5, fill, stroke, 'stroke-width': 1.3 }),
      name ? txt(x + w / 2, 58, name, { size: 10.5, fill: nameFill, anchor: 'middle', mono: true }) : null,
      dim ? txt(x + w / 2, 212, dim, { size: 10, anchor: 'middle', mono: true }) : null,
      ...extra);
    items.push(g);
    return g;
  };
  const op = (x, s, y = midY + 4) => { const t = txt(x, y, s, { size: 11.5, anchor: 'middle', mono: true }); items.push(t); return t; };

  const actFill = 'rgba(90,200,220,0.13)';
  const wFill = 'rgba(224,168,76,0.14)';

  box(28, 64, 124, { fill: actFill, stroke: PAL.act, name: 'X', nameFill: PAL.act, dim: `T×${BP.dModel}`, extra: [txt(60, midY + 4, 'X', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true })] });
  op(108, '×');
  box(122, 13, 96, { fill: wFill, stroke: PAL.weight, name: 'W_Q·K·V', nameFill: PAL.weight, dim: `${BP.dModel}×${BP.dHead}` });
  op(152, '→');
  box(166, 16, 124, { fill: actFill, stroke: PAL.act, name: 'Q K V', nameFill: PAL.act, dim: `T×${BP.dHead}` });
  op(218, 'QKᵀ→');
  box(248, 110, 110, {
    fill: 'rgba(180,140,224,0.12)', stroke: PAL.attn, name: 'S → A', nameFill: PAL.attn, dim: 'T×T · masked',
    extra: [
      svg('path', { d: `M 250 ${midY - 53} L 356 ${midY - 53} L 356 ${midY + 53} Z`, fill: '#0B0F14', 'fill-opacity': 0.85 }),
      txt(330, midY - 26, '−∞', { size: 10, anchor: 'middle', mono: true }),
      txt(282, midY + 26, 'A', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true }),
    ],
  });
  op(384, 'AV→');
  box(414, 16, 124, { fill: actFill, stroke: PAL.act, name: 'Z', nameFill: PAL.act, dim: `T×${BP.dHead}` });
  const concatTxt = svg('g', {},
    txt(472, midY - 4, 'concat', { size: 10, anchor: 'middle' }),
    txt(472, midY + 10, `${BP.heads} heads`, { size: 10, anchor: 'middle' }));
  items.push(concatTxt);
  box(508, 56, 124, { fill: actFill, stroke: PAL.act, name: `H₁‖…‖H${sub(BP.heads)}`, nameFill: PAL.act, dim: `T×${BP.heads * BP.dHead}` });
  op(578, '×');
  box(592, 44, 96, { fill: wFill, stroke: PAL.weight, name: 'W_O', nameFill: PAL.weight, dim: `${BP.heads * BP.dHead}×${BP.dModel}` });
  op(650, '→');
  box(666, 64, 124, { fill: actFill, stroke: PAL.act, name: '+ stream', nameFill: PAL.act, dim: `T×${BP.dModel}` });

  const head = txt(24, 28, `per head · K2 numbers: d = ${BP.dModel}, d_head = ${BP.dHead}, ${BP.heads} heads (illustrative)`, { size: 11 });
  const note1 = svg('text', { x: W / 2, y: 250, 'text-anchor': 'middle', 'font-family': 'sans-serif', 'font-size': 11, fill: PAL.mut },
    svg('tspan', { fill: PAL.weight }, 'amber = learned weights, fixed shapes'),
    svg('tspan', {}, '  ·  '),
    svg('tspan', { fill: PAL.act }, 'cyan/violet = activations — T grows with context'));
  const note2 = txt(W / 2, 272, `the only T×T object is A — the quadratic cost — and the only cached ones are K,V (ch. ${chNum('inference')})`, { size: 11, fill: PAL.tx, anchor: 'middle' });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Shape bookkeeping for one attention head: X of shape T by ${BP.dModel}, times weight matrices of ${BP.dModel} by ${BP.dHead}, gives Q, K, V of T by ${BP.dHead}; scores and attention weights are the only T by T objects; outputs concatenate across ${BP.heads} heads into T by ${BP.heads * BP.dHead}, and W O returns T by ${BP.dModel} to the stream.`,
  }, head, items, note1, note2);

  const node = figure(
    'shape bookkeeping for one head. GQA shrinks the K,V boxes; MLA replaces them with a thin latent; KDA deletes the T×T object entirely.',
    root, { wide: true, key: 'shapes' });
  track(node, (p) => {
    head.setAttribute('opacity', seg(p, 0.1, 0.16));
    items.forEach((g, i) => {
      const t = seg(p, 0.12 + i * 0.028, 0.2 + i * 0.028, ease.out);
      g.setAttribute('opacity', t);
      g.setAttribute('transform', `translate(0, ${lerp(10, 0, t)})`);
    });
    note1.setAttribute('opacity', seg(p, 0.62, 0.7));
    note2.setAttribute('opacity', seg(p, 0.66, 0.74));
  });
  return node;
}
