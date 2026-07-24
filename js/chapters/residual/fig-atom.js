/* The atom of the whole machine: y = xW, one multiply-accumulate at a time.
   Scroll-tracked — the highlight walks down the column as the running sum
   builds up one output entry. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, chRef, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, ease, rng } from '../../core/anim.js';

const SUB = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈'];

export function figAtom() {
  const W = 720, H = 376;
  const d = 8, k = 6, J = 2;                       // shown dims; column j = 3rd
  const r = rng(11);
  const val = () => Math.round((0.1 + 0.8 * r()) * (r() < 0.5 ? -1 : 1) * 10) / 10;
  const xv = Array.from({ length: d }, val);
  const wv = Array.from({ length: d }, val);       // column j of W
  const prods = xv.map((x, i) => Math.round(x * wv[i] * 100) / 100);
  const cums = prods.reduce((acc, v) => (acc.push(Math.round(((acc[acc.length - 1] ?? 0) + v) * 100) / 100), acc), []);
  const f = (v) => (v < 0 ? '−' + Math.abs(v) : String(v));

  const XC0 = 56, XY = 150, XW = 38, XH = 28;      // x row
  const GX = 428, GY = 56, CS = 27;                // W grid
  const YY = 306;                                  // y row

  const gX = svg('g', { opacity: 0 },
    txt(56, 118, 'x — the token’s vector (1×d)', { size: 11.5, fill: PAL.act }),
    txt(56, 134, 'activation — new for every token'),
    xv.map((v, i) => svg('g', {},
      svg('rect', { x: XC0 + i * XW, y: XY, width: XW - 2, height: XH, rx: 4, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
      txt(XC0 + i * XW + (XW - 2) / 2, XY + 19, f(v), { size: 11, fill: PAL.ink, anchor: 'middle', mono: true }))),
    txt(XC0 + d * XW + 6, XY + 19, '…', { size: 12, mono: true }),
    txt(404, 168, '×', { size: 15, anchor: 'middle', mono: true }));

  const wCells = [];
  for (let i = 0; i < d; i++) for (let j = 0; j < k; j++) {
    wCells.push(svg('rect', {
      x: GX + j * CS, y: GY + i * CS, width: CS - 2, height: CS - 2, rx: 3,
      fill: PAL.weight, 'fill-opacity': j === J ? 0.30 : 0.10,
      stroke: PAL.weight, 'stroke-opacity': j === J ? 0.9 : 0.35, 'stroke-width': 1,
    }));
  }
  const gW = svg('g', { opacity: 0 },
    txt(GX, 40, 'W — d×k · learned, frozen', { size: 11.5, fill: PAL.weight }),
    wCells,
    wv.map((v, i) => txt(GX + J * CS + (CS - 2) / 2, GY + i * CS + 17, f(v),
      { size: 11, fill: PAL.ink, anchor: 'middle', mono: true })),
    svg('line', { x1: GX + J * CS + (CS - 2) / 2, y1: GY + d * CS - 2, x2: GX + J * CS + (CS - 2) / 2, y2: YY - 4, stroke: PAL.weight, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0.7 }));

  const yjText = txt(GX + J * CS + (CS - 2) / 2, YY + 17, '', { size: 11, fill: PAL.ink, anchor: 'middle', mono: true });
  const gY = svg('g', { opacity: 0 },
    txt(410, YY + 17, '=', { size: 15, anchor: 'middle', mono: true }),
    Array.from({ length: k }, (_, j) => svg('rect', {
      x: GX + j * CS, y: YY, width: CS - 2, height: CS - 2, rx: 3,
      fill: PAL.act, 'fill-opacity': j === J ? 0.25 : 0.08,
      stroke: PAL.act, 'stroke-opacity': j === J ? 0.9 : 0.4, 'stroke-width': 1,
    })),
    yjText,
    txt(GX + J * CS + (CS - 2) / 2, YY + 44, 'y_j', { size: 11, fill: PAL.act, anchor: 'middle', mono: true }),
    txt(GX + k * CS + 12, YY + 17, 'y (1×k)', { size: 11.5, fill: PAL.act }));

  const xHi = svg('rect', { y: XY - 3, width: XW + 2, height: XH + 6, rx: 6, fill: 'none', stroke: PAL.ink, 'stroke-width': 1.5, opacity: 0 });
  const wHi = svg('rect', { width: CS + 2, height: CS + 2, rx: 5, fill: 'none', stroke: PAL.ink, 'stroke-width': 1.5, opacity: 0 });
  const link = svg('line', { stroke: PAL.ink, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0 });
  const ro1 = txt(56, 236, '', { size: 12, fill: PAL.tx, mono: true });
  const ro2 = txt(56, 258, '', { size: 12, fill: PAL.act, mono: true });
  const footer = txt(360, 364,
    'y_j = Σᵢ xᵢ·Wᵢⱼ — one dot product per output dimension; k dot products per multiply',
    { anchor: 'middle' });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The vector–matrix product y equals x times W: a cyan row vector x multiplied against one amber column of the weight matrix W, with each multiply-accumulate pair highlighted in turn as the running sum builds up the output entry y sub j.',
  }, gX, gW, gY, link, xHi, wHi, ro1, ro2, footer);

  const node = figure(
    `the atom of the whole machine. “Training” (${chRef('pretraining', { word: 'ch.' })}) means nudging W’s entries; “inference” (${chRef('inference', { word: 'ch.' })}) means streaming them past the multiplier.`,
    root,
    { key: 'atom' });

  track(node, (p) => {
    gX.setAttribute('opacity', seg(p, 0.05, 0.16));
    gW.setAttribute('opacity', seg(p, 0.08, 0.18));
    gY.setAttribute('opacity', seg(p, 0.12, 0.2));

    const t = seg(p, 0.22, 0.75, ease.linear);
    const active = t > 0;
    const i = Math.min(d - 1, Math.floor(t * d));
    xHi.setAttribute('x', XC0 + i * XW - 2);
    xHi.setAttribute('opacity', active ? 1 : 0);
    wHi.setAttribute('x', GX + J * CS - 2);
    wHi.setAttribute('y', GY + i * CS - 2);
    wHi.setAttribute('opacity', active ? 1 : 0);
    link.setAttribute('x1', XC0 + i * XW + (XW - 2) / 2);
    link.setAttribute('y1', XY + XH + 4);
    link.setAttribute('x2', GX + J * CS - 5);
    link.setAttribute('y2', GY + i * CS + CS / 2 - 1);
    link.setAttribute('opacity', active ? 0.55 : 0);
    ro1.textContent = active ? `x${SUB[i]} · W${SUB[i]}ⱼ  =  ${f(xv[i])} × ${f(wv[i])}  =  ${f(prods[i])}` : '';
    ro2.textContent = active ? `y_j so far  =  ${f(cums[i])}${i === d - 1 ? '  ✓' : '  + …'}` : '';
    yjText.textContent = active ? f(cums[i]) : '';
  });

  return node;
}
