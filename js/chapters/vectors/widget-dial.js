/* Chapter 02 — the interactive dial: rotate and stretch b, watch the three
   quantities agree. a is fixed; θ and |b| are keyboard-accessible sliders.
   Every displayed number is computed from the coordinates, live.          */

import { el, svg, svgRoot } from '../../core/dom.js';
import { widget, txt, PAL } from '../../core/components.js';
import { clamp } from '../../core/anim.js';
import { dot } from '../../core/mathtools.js';

const A = [4, 1];
const aLen = Math.hypot(A[0], A[1]);
const aAng = Math.atan2(A[1], A[0]);
const fmt = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

export function dialWidget() {
  const W = 720, H = 286;
  const OX = 176, OY = 168, U = 26;
  let theta = 42, bLen = 3.61;                 // degrees, units

  /* ---- left: the plane --------------------------------------------------- */

  const grid = [];
  for (let i = -5; i <= 5; i++) grid.push(svg('line', { x1: OX + i * U, y1: OY - 4.6 * U, x2: OX + i * U, y2: OY + 4.6 * U, stroke: PAL.grid, 'stroke-width': 1 }));
  for (let j = -4; j <= 4; j++) grid.push(svg('line', { x1: OX - 5.2 * U, y1: OY - j * U, x2: OX + 5.2 * U, y2: OY - j * U, stroke: PAL.grid, 'stroke-width': 1 }));
  const axes = svg('g', {},
    svg('line', { x1: OX - 5.3 * U, y1: OY, x2: OX + 5.3 * U, y2: OY, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: OX, y1: OY + 4.7 * U, x2: OX, y2: OY - 4.7 * U, stroke: PAL.mut, 'stroke-width': 1 }));

  const aArrow = svg('line', {
    x1: OX, y1: OY, x2: OX + A[0] * U, y2: OY - A[1] * U,
    stroke: PAL.act, 'stroke-width': 2.4, 'marker-end': 'url(#arrA02d)',
  });
  const aTag = txt(OX + A[0] * U + 8, OY - A[1] * U - 6, 'a', { size: 14, fill: PAL.act, mono: true });
  const bArrow = svg('line', { x1: OX, y1: OY, x2: OX, y2: OY, stroke: PAL.weight, 'stroke-width': 2.4, 'marker-end': 'url(#arrW02d)' });
  const bTag = txt(0, 0, 'b', { size: 14, fill: PAL.weight, mono: true });
  const projSeg = svg('line', { stroke: PAL.ink, 'stroke-width': 4.5, opacity: 0.8, 'stroke-linecap': 'round' });
  const projDrop = svg('line', { stroke: PAL.mut, 'stroke-width': 1.1, 'stroke-dasharray': '4 4', opacity: 0.85 });
  const arc = svg('path', { d: '', fill: 'none', stroke: PAL.ink, 'stroke-width': 1.2, opacity: 0.8 });
  const zeroLine = svg('line', {
    x1: OX + (A[1] / aLen) * 3.4 * U, y1: OY + (A[0] / aLen) * 3.4 * U,
    x2: OX - (A[1] / aLen) * 3.4 * U, y2: OY - (A[0] / aLen) * 3.4 * U,
    stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '5 5', opacity: 0.45,
  });

  /* ---- right: two bars, one scaled, one normalized ----------------------- */

  const BL = 396, BR = W - 26, B0 = (BL + BR) / 2, BW = (BR - BL) / 2;
  const DOT_MAX = aLen * 5;                    // |b| never exceeds 5
  const bar = (y, label, sub) => {
    const track = svg('line', { x1: BL, y1: y, x2: BR, y2: y, stroke: 'rgba(230,237,243,0.14)', 'stroke-width': 9, 'stroke-linecap': 'round' });
    const fill = svg('rect', { x: B0, y: y - 4.5, width: 0, height: 9, rx: 2, fill: PAL.act, opacity: 0.92 });
    const zero = svg('line', { x1: B0, y1: y - 12, x2: B0, y2: y + 12, stroke: PAL.mut, 'stroke-width': 1 });
    const g = svg('g', {}, track, fill, zero,
      txt(BL, y - 16, label, { size: 11, fill: PAL.ink, mono: true }),
      txt(BR, y - 16, sub, { size: 10, anchor: 'end' }),
      txt(B0, y + 24, '0', { size: 9.5, anchor: 'middle', mono: true }));
    return { g, fill };
  };
  const barDot = bar(96, 'a · b', 'grows with |b|');
  const barCos = bar(206, 'cos θ', 'blind to |b| · always in [−1, +1]');
  const barCosEnds = svg('g', {},
    txt(BL, 222, '−1', { size: 9.5, mono: true }),
    txt(BR, 222, '+1', { size: 9.5, anchor: 'end', mono: true }));
  const dotEnds = svg('g', {},
    txt(BL, 112, '−' + DOT_MAX.toFixed(0), { size: 9.5, mono: true }),
    txt(BR, 112, '+' + DOT_MAX.toFixed(0), { size: 9.5, anchor: 'end', mono: true }));
  const verdict = txt((BL + BR) / 2, 262, '', { size: 12, anchor: 'middle', fill: PAL.tx });

  const defs = svg('defs', {},
    svg('marker', { id: 'arrA02d', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })),
    svg('marker', { id: 'arrW02d', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.weight })));

  const svgNode = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A plane with a fixed cyan vector a and an adjustable amber vector b, the angle between them, and the perpendicular projection of b onto a. To the right, two signed bars: the dot product, which grows with the length of b, and the cosine similarity, which does not.',
  }, defs, grid, axes, zeroLine, aArrow, bArrow, projSeg, projDrop, aTag, bTag, arc,
    barDot.g, dotEnds, barCos.g, barCosEnds, verdict);

  /* ---- controls ---------------------------------------------------------- */

  const thVal = el('span', { class: 'sl-v' }, '');
  const lenVal = el('span', { class: 'sl-v' }, '');
  const thSlider = el('input', { type: 'range', min: '-180', max: '180', step: '1', value: String(theta), 'aria-label': 'angle θ between a and b, in degrees' });
  const lenSlider = el('input', { type: 'range', min: '0.2', max: '5', step: '0.05', value: String(bLen), 'aria-label': 'length of vector b' });

  const cells = {
    sum: el('div', { class: 'sg-v hi' }, ''),
    geo: el('div', { class: 'sg-v' }, ''),
    cos: el('div', { class: 'sg-v' }, ''),
    ang: el('div', { class: 'sg-v' }, ''),
  };
  const statGrid = el('div', { class: 'stat-grid' },
    el('div', { class: 'sg-cell' }, cells.sum, el('div', { class: 'sg-k' }, 'Σ aᵢbᵢ · coordinate form')),
    el('div', { class: 'sg-cell' }, cells.geo, el('div', { class: 'sg-k' }, '|a| |b| cos θ · geometric form')),
    el('div', { class: 'sg-cell' }, cells.cos, el('div', { class: 'sg-k' }, 'cosine similarity')),
    el('div', { class: 'sg-cell' }, cells.ang, el('div', { class: 'sg-k' }, 'θ · angle between')));

  const note = el('div', { class: 'w-note', style: { fontFamily: 'var(--mono)' } }, '');

  const PRESETS = [
    ['θ = 0° · identical direction', 0],
    ['θ = 60°', 60],
    ['θ = 90° · orthogonal', 90],
    ['θ = 180° · opposed', 180],
  ];
  const buttons = PRESETS.map(([label, v]) => el('button', {
    class: 'tok', onclick: () => { theta = v; thSlider.value = String(v); update(); },
  }, label));

  function update() {
    const rad = aAng + (theta * Math.PI) / 180;
    const B = [bLen * Math.cos(rad), bLen * Math.sin(rad)];
    const d = dot(A, B);
    const cosT = clamp(d / (aLen * bLen), -1, 1);
    const s = d / (aLen * aLen);
    const bx = OX + B[0] * U, by = OY - B[1] * U;
    const fx = OX + A[0] * s * U, fy = OY - A[1] * s * U;

    bArrow.setAttribute('x2', bx); bArrow.setAttribute('y2', by);
    bTag.setAttribute('x', bx + (B[0] < 0 ? -18 : 8));
    bTag.setAttribute('y', by + (B[1] < 0 ? 16 : -6));
    projSeg.setAttribute('x1', OX); projSeg.setAttribute('y1', OY);
    projSeg.setAttribute('x2', fx); projSeg.setAttribute('y2', fy);
    projDrop.setAttribute('x1', bx); projDrop.setAttribute('y1', by);
    projDrop.setAttribute('x2', fx); projDrop.setAttribute('y2', fy);

    const R = 40, big = Math.abs(theta) > 180 ? 1 : 0, sweep = theta >= 0 ? 0 : 1;
    arc.setAttribute('d', `M ${OX + R * Math.cos(aAng)} ${OY - R * Math.sin(aAng)} A ${R} ${R} 0 ${big} ${sweep} ${OX + R * Math.cos(rad)} ${OY - R * Math.sin(rad)}`);
    arc.setAttribute('opacity', Math.abs(theta) < 2 ? 0 : 0.8);

    const wD = clamp(Math.abs(d) / DOT_MAX, 0, 1) * BW;
    barDot.fill.setAttribute('x', d >= 0 ? B0 : B0 - wD);
    barDot.fill.setAttribute('width', wD);
    const wC = Math.abs(cosT) * BW;
    barCos.fill.setAttribute('x', cosT >= 0 ? B0 : B0 - wC);
    barCos.fill.setAttribute('width', wC);
    verdict.textContent = Math.abs(cosT) < 0.02
      ? 'orthogonal — b contributes nothing along a'
      : cosT > 0 ? 'positive — b has a component along a'
        : 'negative — b runs against a';

    cells.sum.textContent = fmt(d);
    cells.geo.textContent = fmt(aLen * bLen * cosT);
    cells.cos.textContent = fmt(cosT, 3);
    cells.ang.textContent = `${theta.toFixed(0)}°`;
    thVal.textContent = `${theta.toFixed(0)}°`;
    lenVal.textContent = bLen.toFixed(2);
    note.textContent =
      `a = (${fmt(A[0])}, ${fmt(A[1])})   b = (${fmt(B[0])}, ${fmt(B[1])})   →   `
      + `${fmt(A[0])}×${fmt(B[0])} + ${fmt(A[1])}×${fmt(B[1])} = ${fmt(d)}   =   `
      + `${fmt(aLen)} × ${fmt(bLen)} × ${fmt(cosT, 3)}`;
  }

  thSlider.addEventListener('input', () => { theta = +thSlider.value; update(); });
  lenSlider.addEventListener('input', () => { bLen = +lenSlider.value; update(); });
  update();

  const body = el('div', {},
    el('div', { class: 'tokens', style: { marginBottom: '0.8rem' } }, buttons),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'angle θ between a and b'), thSlider, thVal),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'length |b|'), lenSlider, lenVal),
    svgNode, statGrid, note);

  return widget('The dial', 'drag or arrow-key the sliders — both forms stay equal', body);
}
