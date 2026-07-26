/* Chapter 02 — figure: one vector, three views.
   An arrow in the plane, the list of its coordinates, and the shape the
   object actually takes inside a model: thousands of numbers, no picture. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, lerp, ease, rng } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

const SUB = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈'];

export function spaceFigure() {
  const W = 720, H = 344;
  const OX = 116, OY = 262, U = 33;
  const A = [4, 3];
  const d = K3.blueprint.dModel;

  /* ---- panel A: the arrow ------------------------------------------------ */

  const gridLines = [];
  for (let i = 1; i <= 5; i++) gridLines.push(svg('line', { x1: OX + i * U, y1: OY, x2: OX + i * U, y2: OY - 4.1 * U, stroke: PAL.grid, 'stroke-width': 1 }));
  for (let j = 1; j <= 4; j++) gridLines.push(svg('line', { x1: OX, y1: OY - j * U, x2: OX + 5.2 * U, y2: OY - j * U, stroke: PAL.grid, 'stroke-width': 1 }));

  const axes = svg('g', {},
    svg('line', { x1: OX - 14, y1: OY, x2: OX + 5.5 * U, y2: OY, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: OX, y1: OY + 14, x2: OX, y2: OY - 4.5 * U, stroke: PAL.mut, 'stroke-width': 1 }),
    txt(OX + 5.5 * U + 4, OY + 4, 'x₁', { size: 10 }),
    txt(OX - 6, OY - 4.5 * U - 4, 'x₂', { size: 10, anchor: 'middle' }));

  const tipX = OX + A[0] * U, tipY = OY - A[1] * U;
  const arrow = svg('line', {
    x1: OX, y1: OY, x2: OX, y2: OY, stroke: PAL.act, 'stroke-width': 2.4, 'marker-end': 'url(#arrAct02)',
  });
  const drops = svg('g', { opacity: 0 },
    svg('line', { x1: tipX, y1: tipY, x2: tipX, y2: OY, stroke: PAL.act, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0.6 }),
    svg('line', { x1: tipX, y1: tipY, x2: OX, y2: tipY, stroke: PAL.act, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0.6 }),
    txt(tipX, OY + 16, String(A[0]), { size: 11, fill: PAL.act, anchor: 'middle', mono: true }),
    txt(OX - 8, tipY + 4, String(A[1]), { size: 11, fill: PAL.act, anchor: 'end', mono: true }));
  const tipDot = svg('circle', { cx: tipX, cy: tipY, r: 3.2, fill: PAL.act, opacity: 0 });
  const aTag = svg('g', { opacity: 0 },
    txt(tipX + 10, tipY - 10, 'a', { size: 14, fill: PAL.act, mono: true }),
    txt(tipX + 10, tipY + 6, '(4, 3)', { size: 11, fill: PAL.tx, mono: true }));

  const capA = txt(OX - 14, 60, 'as an arrow', { size: 11.5, fill: PAL.ink });
  const capA2 = txt(OX - 14, 78, 'an arrow from the origin', { size: 11 });

  /* ---- panel B: the list ------------------------------------------------- */

  const BX = 336, BY = 140, BW = 68, BH = 34;
  const cells = A.map((v, i) => svg('g', { opacity: 0 },
    svg('rect', { x: BX, y: BY + i * (BH + 8), width: BW, height: BH, rx: 5, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
    txt(BX + BW / 2, BY + i * (BH + 8) + 23, String(v), { size: 14, fill: PAL.ink, anchor: 'middle', mono: true }),
    txt(BX - 8, BY + i * (BH + 8) + 23, `a${SUB[i]}`, { size: 11, anchor: 'end', mono: true })));
  const capB = svg('g', { opacity: 0 },
    txt(BX - 30, 60, 'as a list', { size: 11.5, fill: PAL.ink }),
    txt(BX - 30, 78, 'the same object, written down', { size: 11 }),
    txt(BX - 30, BY + 2 * (BH + 8) + 20, 'd = 2 coordinates', { size: 11, fill: PAL.tx, mono: true }));

  /* ---- panel C: what it really looks like -------------------------------- */

  const CX = 470, CY = 140, PITCH = 10, COLS = 23, ROWS = 8;
  const r = rng(4);
  const shades = Array.from({ length: COLS * ROWS }, () => 0.12 + 0.72 * r());
  const bits = shades.map((s, i) => svg('rect', {
    x: CX + (i % COLS) * PITCH, y: CY + Math.floor(i / COLS) * PITCH,
    width: PITCH - 2, height: PITCH - 2, rx: 1.5, fill: PAL.act, 'fill-opacity': 0,
  }));
  const capC = svg('g', { opacity: 0 },
    txt(CX, 60, 'as it actually is', { size: 11.5, fill: PAL.ink }),
    txt(CX, 78, 'one token’s vector inside the model', { size: 11 }),
    txt(CX, CY + ROWS * PITCH + 22, `d = ${d.toLocaleString('en-US')} coordinates`, { size: 11, fill: PAL.act, mono: true }),
    txt(CX, CY + ROWS * PITCH + 40, 'no picture exists — and none is needed', { size: 11 }));

  const footer = txt(360, H - 14, 'every operation in this chapter is defined coordinate by coordinate, so d changes nothing but the count',
    { size: 11, anchor: 'middle' });

  const defs = svg('defs', {},
    svg('marker', { id: 'arrAct02', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `One vector shown three ways: as a cyan arrow from the origin to the point (4, 3) on a plane, as a written list of its two coordinates, and as a dense block of ${d.toLocaleString('en-US')} shaded cells representing the real width of a token vector inside the model.`,
  }, defs, gridLines, axes, arrow, drops, tipDot, aTag, capA, capA2, cells, capB, bits, capC, footer);

  const node = figure(
    'the same object three ways. The arrow is a mnemonic for the algebra; the list is the algebra; the block is the size the algebra actually runs at.',
    root, { wide: true, key: 'space' });

  return pin(node, (p) => {
    const tA = seg(p, 0.06, 0.20, ease.out);
    arrow.setAttribute('x2', lerp(OX, tipX, tA));
    arrow.setAttribute('y2', lerp(OY, tipY, tA));
    arrow.setAttribute('opacity', tA > 0.02 ? 1 : 0);
    tipDot.setAttribute('opacity', seg(p, 0.18, 0.24));
    drops.setAttribute('opacity', seg(p, 0.20, 0.30));
    aTag.setAttribute('opacity', seg(p, 0.22, 0.32));

    const tB = seg(p, 0.32, 0.46);
    cells.forEach((c, i) => c.setAttribute('opacity', seg(tB, i * 0.3, 0.7 + i * 0.3, ease.out)));
    capB.setAttribute('opacity', seg(p, 0.34, 0.44));

    const tC = seg(p, 0.48, 0.86, ease.linear);
    const shown = Math.round(tC * bits.length);
    bits.forEach((b, i) => b.setAttribute('fill-opacity', i < shown ? shades[i] : 0));
    capC.setAttribute('opacity', seg(p, 0.52, 0.62));
  });
}
