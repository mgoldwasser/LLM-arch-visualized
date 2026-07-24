/* Chapter 02 — figure: y = xW as k independent dot products.
   x is drawn as a column so its entries line up with W's rows; a highlight
   sweeps column by column, accumulating one output entry at a time.      */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, ease, rng } from '../../core/anim.js';
import { dot } from '../../core/mathtools.js';

const SUB = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈'];
const fmt = (v, p = 1) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(p);

export function matvecFigure() {
  const W = 720, H = 428;
  const d = 6, k = 7;
  const r = rng(21);
  const val = () => Math.round((0.15 + 0.85 * r()) * (r() < 0.5 ? -1 : 1) * 10) / 10;
  const xv = Array.from({ length: d }, val);
  const Wm = Array.from({ length: d }, () => Array.from({ length: k }, val));   // d×k
  const col = (j) => Wm.map((row) => row[j]);
  const yv = Array.from({ length: k }, (_, j) => dot(xv, col(j)));

  const XC = 92, CW = 44, RH = 30, Y0 = 118;        // x column
  const GX = 176, GW = 38;                          // W grid
  const YY = Y0 + d * RH + 40;                      // y row
  const PX = 470;                                   // readout panel

  /* ---- x, drawn as a column ---------------------------------------------- */

  const xCells = xv.map((v, i) => svg('g', {},
    svg('rect', { x: XC, y: Y0 + i * RH, width: CW, height: RH - 3, rx: 4, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
    txt(XC + CW / 2, Y0 + i * RH + 19, fmt(v), { size: 11.5, fill: PAL.ink, anchor: 'middle', mono: true })));
  const gX = svg('g', { opacity: 0 },
    txt(XC - 4, 76, 'x  (1 × d)', { size: 11.5, fill: PAL.act }),
    txt(XC - 4, 92, 'activation', { size: 11 }),
    xCells,
    xv.map((_, i) => txt(XC - 8, Y0 + i * RH + 19, `x${SUB[i]}`, { size: 10, anchor: 'end', mono: true })));

  /* ---- W ------------------------------------------------------------------ */

  const wCells = [];
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < k; j++) {
      wCells.push(svg('rect', {
        x: GX + j * GW, y: Y0 + i * RH, width: GW - 3, height: RH - 3, rx: 3,
        fill: PAL.weight, 'fill-opacity': 0.10, stroke: PAL.weight, 'stroke-opacity': 0.35, 'stroke-width': 1,
      }));
    }
  }
  const wText = [];
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < k; j++) {
      wText.push(txt(GX + j * GW + (GW - 3) / 2, Y0 + i * RH + 19, fmt(Wm[i][j]), { size: 10.5, fill: PAL.tx, anchor: 'middle', mono: true }));
    }
  }
  const gW = svg('g', { opacity: 0 },
    txt(GX, 76, 'W  (d × k) — a learned matrix', { size: 11.5, fill: PAL.weight }),
    txt(GX, 92, 'weights · frozen at inference · d = 6, k = 7 shown', { size: 11 }),
    wCells, wText);
  const colHi = svg('rect', { y: Y0 - 4, width: GW + 5, height: d * RH + 5, rx: 5, fill: 'none', stroke: PAL.ink, 'stroke-width': 1.5, opacity: 0 });
  const rowHi = svg('rect', { x: XC - 4, width: GX - XC + k * GW + 4, height: RH - 1, rx: 5, fill: PAL.ink, 'fill-opacity': 0.06, opacity: 0 });

  /* ---- y ------------------------------------------------------------------ */

  const yCells = Array.from({ length: k }, (_, j) => svg('rect', {
    x: GX + j * GW, y: YY, width: GW - 3, height: RH - 3, rx: 3,
    fill: PAL.act, 'fill-opacity': 0.08, stroke: PAL.act, 'stroke-opacity': 0.4, 'stroke-width': 1,
  }));
  const yText = Array.from({ length: k }, (_, j) => txt(GX + j * GW + (GW - 3) / 2, YY + 19, '', { size: 10.5, fill: PAL.ink, anchor: 'middle', mono: true }));
  const gY = svg('g', { opacity: 0 },
    txt(GX - 10, YY + 19, 'y', { size: 13, fill: PAL.act, anchor: 'end', mono: true }),
    yCells, yText,
    txt(GX, YY + 44, 'y = xW — one entry per column of W, k dot products in all', { size: 11, fill: PAL.act }));
  const drop = svg('line', { y1: Y0 + d * RH + 2, y2: YY - 4, stroke: PAL.ink, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0 });

  /* ---- the working panel -------------------------------------------------- */

  const panelHead = txt(PX, 76, '', { size: 11.5, fill: PAL.weight });
  const panelSub = txt(PX, 92, 'one dot product, term by term', { size: 11 });
  const terms = Array.from({ length: d }, (_, i) => txt(PX, Y0 + i * RH + 19, '', { size: 11.5, fill: PAL.tx, mono: true }));
  const rule = svg('line', { x1: PX, y1: Y0 + d * RH + 6, x2: W - 24, y2: Y0 + d * RH + 6, stroke: PAL.grid, 'stroke-width': 1 });
  const total = txt(PX, YY + 19, '', { size: 13, fill: PAL.ink, mono: true });

  const readingA = txt(GX, 52, 'each column is one learned direction in ℝᵈ — a feature detector', { size: 11, fill: PAL.weight, opacity: 0 });
  const readingB = txt(GX, H - 16, 'yⱼ = how strongly x points along column j · y = x’s coordinates re-mixed into a new basis', { size: 11, opacity: 0 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The product y equals x times W. A cyan column of six numbers is x; an amber six-by-seven grid is W; below the grid a cyan row of seven cells is y. A highlight sweeps across W column by column, and for the active column a panel lists each product of an x entry with the matching column entry, summing to the value written into that entry of y.',
  }, gX, gW, rowHi, colHi, drop, gY, panelHead, panelSub, terms, rule, total, readingA, readingB);

  const node = figure(
    'one matrix–vector product, unrolled — x is drawn as a column so its entries line up with W’s rows. The k columns never interact: the product is k independent dot products, computed at once because the hardware would rather do them all together.',
    root, { wide: true, key: 'matvec' });

  track(node, (p) => {
    gX.setAttribute('opacity', seg(p, 0.04, 0.14));
    gW.setAttribute('opacity', seg(p, 0.08, 0.18));
    gY.setAttribute('opacity', seg(p, 0.14, 0.24));

    const t = seg(p, 0.24, 0.84, ease.linear);
    const active = t > 0 && t < 1;
    const scaled = Math.min(k - 1e-6, t * k);
    const j = Math.floor(scaled);
    const inCol = scaled - j;
    const i = Math.min(d - 1, Math.floor(inCol * d * 1.15));
    const cj = col(j);
    const running = cj.slice(0, i + 1).reduce((s, w, ii) => s + w * xv[ii], 0);

    colHi.setAttribute('x', GX + j * GW - 2.5);
    colHi.setAttribute('opacity', active ? 1 : 0);
    rowHi.setAttribute('y', Y0 + i * RH - 1);
    rowHi.setAttribute('opacity', active ? 1 : 0);
    drop.setAttribute('x1', GX + j * GW + (GW - 3) / 2);
    drop.setAttribute('x2', GX + j * GW + (GW - 3) / 2);
    drop.setAttribute('opacity', active ? 0.6 : 0);

    wCells.forEach((c, idx) => {
      const cjj = idx % k;
      c.setAttribute('fill-opacity', cjj === j && active ? 0.28 : 0.10);
      c.setAttribute('stroke-opacity', cjj === j && active ? 0.85 : 0.35);
    });
    yText.forEach((tx, jj) => {
      tx.textContent = jj < j || t >= 1 ? fmt(yv[jj], 2)
        : jj === j && active ? fmt(running, 2) : '';
    });
    yCells.forEach((c, jj) => c.setAttribute('fill-opacity', jj < j || t >= 1 ? 0.22 : jj === j && active ? 0.14 : 0.08));

    panelHead.textContent = active ? `column ${j + 1} of ${k}` : '';
    panelSub.setAttribute('opacity', active ? 1 : 0);
    terms.forEach((tx, ii) => {
      tx.textContent = active && ii <= i
        ? `x${SUB[ii]} × W${SUB[ii]},${SUB[j]}  =  ${fmt(xv[ii])} × ${fmt(cj[ii])}  =  ${fmt(xv[ii] * cj[ii], 2)}`
        : '';
    });
    rule.setAttribute('opacity', active ? 1 : 0);
    total.textContent = active
      ? `y${SUB[j]}  =  ${fmt(running, 2)}${i === d - 1 ? '' : '  + …'}`
      : (t >= 1 ? 'all k entries computed' : '');

    readingA.setAttribute('opacity', seg(p, 0.86, 0.93));
    readingB.setAttribute('opacity', seg(p, 0.89, 0.96));
  });

  return node;
}
