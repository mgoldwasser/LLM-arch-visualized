/* The computational graph: one path of the tiny network drawn as a chain of
   nodes, forward pass left to right in cyan, backward pass right to left in
   red-orange with the local derivative labelled on every edge. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, figure, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, lerp, ease } from '../../core/anim.js';
import { INIT, forward, backward, f2, f3 } from './net.js';

const CX = [66, 232, 386, 540, 690];      // node centres
const CW = [80, 92, 92, 96, 104];         // node widths
const CY = 122, CH = 44;

export function figGraph() {
  const W = 760, H = 300;
  const P = INIT, F = forward(P), G = backward(P, F);

  const spec = [
    ['w⁽¹⁾₁₁', f2(P.W1[0][0]), PAL.weight],
    ['z₁', f2(F.z1[0]), PAL.act],
    ['a₁ = ReLU(z₁)', f2(F.a1[0]), PAL.act],
    ['z₂ = ŷ', f2(F.yhat), PAL.act],
    ['L = ½(ŷ − y)²', f3(F.loss), PAL.loss],
  ];
  const nodes = spec.map(([name, val, col], i) => {
    const g = svg('g', { opacity: 0 });
    g.append(
      svg('rect', { x: CX[i] - CW[i] / 2, y: CY - CH / 2, width: CW[i], height: CH, rx: 9, fill: col, 'fill-opacity': 0.1, stroke: col, 'stroke-width': 1.3 }),
      txt(CX[i], CY - 4, name, { size: 10.5, fill: PAL.tx, anchor: 'middle', mono: true }),
      txt(CX[i], CY + 14, val, { size: 13, fill: col, anchor: 'middle', mono: true }));
    return g;
  });

  /* edges between consecutive nodes, with their local derivatives above */
  const local = [
    `∂z₁/∂w⁽¹⁾₁₁ = x₁ = ${f2(F.x[0])}`,
    `∂a₁/∂z₁ = 1   (z₁ > 0)`,
    `∂z₂/∂a₁ = w⁽²⁾₁ = ${f2(P.W2[0])}`,
    `∂L/∂z₂ = ŷ − y = ${f2(F.err)}`,
  ];
  const edges = local.map((s, i) => {
    const x1 = CX[i] + CW[i] / 2 + 4, x2 = CX[i + 1] - CW[i + 1] / 2 - 8;
    return {
      line: svg('line', { x1, y1: CY, x2, y2: CY, stroke: PAL.mut, 'stroke-width': 1, 'stroke-opacity': 0.3 }),
      lab: txt((x1 + x2) / 2, 92, s, { size: 10, fill: PAL.loss, anchor: 'middle', mono: true, opacity: 0 }),
      mid: (x1 + x2) / 2,
    };
  });

  /* the other terms feeding the two sums — same rule, different edges */
  const stubs = [[1, `w⁽¹⁾₁₂x₂ + b₁`], [3, `w⁽²⁾₂a₂ + b₂`]].map(([i, s]) => svg('g', { opacity: 0 },
    txt(CX[i], 66, s, { size: 9.5, anchor: 'middle', mono: true }),
    svg('line', { x1: CX[i], y1: 72, x2: CX[i], y2: CY - CH / 2 - 3, stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '2 3' })));

  /* accumulated gradient under each node, with the product that produced it */
  const acc = [
    [`∂L/∂w⁽¹⁾₁₁ = ${f3(G.dW1[0][0])}`, `= (${f3(G.dz1[0])}) × ${f2(F.x[0])}`],
    [`∂L/∂z₁ = ${f3(G.dz1[0])}`, `= (${f3(G.da1[0])}) × 1`],
    [`∂L/∂a₁ = ${f3(G.da1[0])}`, `= (${f3(G.dz2)}) × ${f2(P.W2[0])}`],
    [`∂L/∂z₂ = ${f3(G.dz2)}`, `= 1 × (${f3(G.dz2)})`],
    [`∂L/∂L = 1`, 'the seed'],
  ].map(([a, b], i) => svg('g', { opacity: 0 },
    txt(CX[i], 172, a, { size: 10.5, fill: PAL.loss, anchor: 'middle', mono: true }),
    txt(CX[i], 188, b, { size: 9.5, anchor: 'middle', mono: true })));

  const fwdBand = svg('g', { opacity: 0 },
    txt(196, 30, 'forward — compute and cache', { size: 11, fill: PAL.act, anchor: 'end' }),
    svg('line', { x1: 208, y1: 26, x2: 736, y2: 26, stroke: PAL.act, 'stroke-width': 1.2, 'stroke-opacity': 0.7, 'marker-end': 'url(#arrF4)' }));
  const bwdBand = svg('g', { opacity: 0 },
    txt(744, 250, 'backward — multiply by the local derivative', { size: 11, fill: PAL.loss, anchor: 'end' }),
    svg('line', { x1: 736, y1: 232, x2: 40, y2: 232, stroke: PAL.loss, 'stroke-width': 1.2, 'stroke-opacity': 0.7, 'marker-end': 'url(#arrB4)' }));
  const note = txt(40, 282, 'every node needs only its own local derivative and the gradient handed to it from the right — no node knows anything about the rest of the graph', { size: 10.5, opacity: 0 });

  const defs = svg('defs', {},
    svg('marker', { id: 'arrF4', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })),
    svg('marker', { id: 'arrB4', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.loss })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'One path of the tiny network drawn as a computational graph: a weight feeds a pre-activation, which feeds a ReLU activation, which feeds the output, which feeds the loss. The forward pass fills in values left to right; the backward pass labels each edge with its local derivative and each node with the running product, right to left.',
  }, defs, fwdBand, stubs, edges.map((e) => e.line), edges.map((e) => e.lab), nodes, acc, bwdBand, note);

  const fig = figure(
    `the chain rule made mechanical. Forward (cyan) computes and caches; backward (red-orange) starts from ∂L/∂L = 1 and multiplies by one local derivative per edge. The gradient reaching w⁽¹⁾₁₁ is the product along the path: ${f3(G.dz2)} × ${f2(P.W2[0])} × 1 × ${f2(F.x[0])} = ${f3(G.dW1[0][0])}. Every number computed live from the same network.`,
    root, { wide: true, key: 'graph' });

  return pin(fig, (p) => {
    fwdBand.setAttribute('opacity', seg(p, 0.04, 0.10));
    const fwdX = lerp(0, W, seg(p, 0.06, 0.40, ease.inOut));
    nodes.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.06 + i * 0.055, 0.13 + i * 0.055, ease.out)));
    stubs.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.16 + i * 0.10, 0.24 + i * 0.10) * 0.9));

    bwdBand.setAttribute('opacity', seg(p, 0.46, 0.53));
    const bwdX = lerp(W, 0, seg(p, 0.48, 0.88, ease.inOut));
    edges.forEach((e, i) => {
      const back = bwdX <= e.mid, fwd = fwdX >= e.mid;
      e.line.setAttribute('stroke', back ? PAL.loss : (fwd ? PAL.act : PAL.mut));
      e.line.setAttribute('stroke-opacity', back || fwd ? 0.95 : 0.3);
      e.line.setAttribute('stroke-width', back ? 2.2 : (fwd ? 1.8 : 1));
      e.lab.setAttribute('opacity', seg(p, 0.50 + (3 - i) * 0.07, 0.57 + (3 - i) * 0.07));
    });
    acc.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.50 + (4 - i) * 0.07, 0.58 + (4 - i) * 0.07)));
    note.setAttribute('opacity', seg(p, 0.86, 0.94));
  });
}
