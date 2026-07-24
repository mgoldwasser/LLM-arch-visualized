/* Chapter 02 — the sticky scene: the dot product built up geometrically.
   Four steps: two arrows and the angle; the projection |b| cos θ; the
   coordinate sum Σ aᵢbᵢ computing the same number; the sign flip as b
   rotates past 90°. Every number on screen is computed live from a and b. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease, clamp } from '../../core/anim.js';
import { dot } from '../../core/mathtools.js';
import { DOT_STEPS } from './scene-dot-steps.js';

const OX = 258, OY = 288, U = 40;          // origin and pixels-per-unit
const A = [4, 1];                          // a — fixed
const B0 = [2, 3];                         // b — start pose, rotated in step 4
const B_END_DEG = 170;                     // b's absolute angle at the end

const px = (v) => [OX + v[0] * U, OY - v[1] * U];
const norm = (v) => Math.hypot(v[0], v[1]);
const fmt = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

function dotFigure(canvas) {
  const W = 720, H = 470;
  const aLen = norm(A), bLen = norm(B0);
  const aAng = Math.atan2(A[1], A[0]);
  const b0Ang = Math.atan2(B0[1], B0[0]);
  const PX = 486;                             // left edge of the readout panel

  /* ---- static plane ------------------------------------------------------ */

  const grid = [];
  for (let i = -4; i <= 5; i++) grid.push(svg('line', { x1: OX + i * U, y1: OY - 4.2 * U, x2: OX + i * U, y2: OY + 1.1 * U, stroke: PAL.grid, 'stroke-width': 1 }));
  for (let j = -1; j <= 4; j++) grid.push(svg('line', { x1: OX - 4.2 * U, y1: OY - j * U, x2: OX + 5.1 * U, y2: OY - j * U, stroke: PAL.grid, 'stroke-width': 1 }));
  const axes = svg('g', {},
    svg('line', { x1: OX - 4.3 * U, y1: OY, x2: OX + 5.2 * U, y2: OY, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: OX, y1: OY + 1.2 * U, x2: OX, y2: OY - 4.3 * U, stroke: PAL.mut, 'stroke-width': 1 }));
  const divider = svg('line', { x1: PX - 18, y1: 40, x2: PX - 18, y2: H - 30, stroke: PAL.grid, 'stroke-width': 1 });

  /* ---- the two arrows ---------------------------------------------------- */

  const aArrow = svg('line', { x1: OX, y1: OY, x2: OX, y2: OY, stroke: PAL.act, 'stroke-width': 2.6, 'marker-end': 'url(#arrA02)' });
  const bArrow = svg('line', { x1: OX, y1: OY, x2: OX, y2: OY, stroke: PAL.weight, 'stroke-width': 2.6, 'marker-end': 'url(#arrW02)' });
  const aTag = svg('g', { opacity: 0 },
    txt(10, -6, 'a', { size: 15, fill: PAL.act, mono: true }),
    txt(-4, 24, '', { size: 11, fill: PAL.tx, mono: true, anchor: 'end' }));
  const bTag = svg('g', { opacity: 0 },
    txt(0, 0, 'b', { size: 15, fill: PAL.weight, mono: true }),
    txt(0, 16, '', { size: 11, fill: PAL.tx, mono: true }));
  const place = (g, x, y) => g.setAttribute('transform', `translate(${x} ${y})`);

  const arc = svg('path', { d: '', fill: 'none', stroke: PAL.ink, 'stroke-width': 1.3, opacity: 0 });
  const arcTag = txt(0, 0, 'θ', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true });
  arcTag.setAttribute('opacity', 0);

  /* ---- step 2: the projection ------------------------------------------- */

  const projSeg = svg('line', { stroke: PAL.ink, 'stroke-width': 5, opacity: 0, 'stroke-linecap': 'round' });
  const projDrop = svg('line', { stroke: PAL.mut, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0 });
  const projSq = svg('path', { d: '', fill: 'none', stroke: PAL.mut, 'stroke-width': 1, opacity: 0 });
  const projTag = txt(0, 0, '', { size: 11, fill: PAL.ink, anchor: 'middle', mono: true });
  projTag.setAttribute('opacity', 0);

  /* ---- step 3: coordinates ---------------------------------------------- */

  const dropLine = (color) => svg('line', { stroke: color, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0 });
  const aDrops = [dropLine(PAL.act), dropLine(PAL.act)];
  const bDrops = [dropLine(PAL.weight), dropLine(PAL.weight)];

  /* ---- step 4: the zero line -------------------------------------------- */

  const zeroLine = svg('line', { stroke: PAL.mut, 'stroke-width': 1.2, 'stroke-dasharray': '6 5', opacity: 0 });
  const zeroTag = txt(0, 0, 'a · b = 0 on this line', { size: 10.5, anchor: 'middle' });
  zeroTag.setAttribute('opacity', 0);

  /* ---- the headline number, under the plane ------------------------------ */

  const bigVal = txt(OX, 392, '', { size: 22, fill: PAL.ink, anchor: 'middle', mono: true, opacity: 0 });
  const verdict = txt(OX, 418, '', { size: 12, fill: PAL.tx, anchor: 'middle', opacity: 0 });

  /* ---- readout panel ----------------------------------------------------- */

  const line = (y, s, o = {}) => txt(PX, y, s, { size: 12, mono: true, fill: PAL.tx, ...o });
  const pHead = txt(PX, 58, 'computed live', { size: 11 });
  const pMagA = line(84, '');
  const pMagB = line(104, '');
  const pTheta = line(124, '');
  const rule1 = svg('line', { x1: PX, y1: 144, x2: W - 22, y2: 144, stroke: PAL.grid, 'stroke-width': 1 });

  const pGeomA = line(186, '', { size: 12.5, fill: PAL.mut });
  const pGeomB = line(205, '', { size: 12.5 });
  const pGeomC = line(226, '', { size: 14, fill: PAL.ink });
  const gGeom = svg('g', { opacity: 0 }, txt(PX, 166, 'geometric form', { size: 10.5, fill: PAL.mut }), pGeomA, pGeomB, pGeomC);

  const pAlgA = line(276, '', { size: 12.5, fill: PAL.mut });
  const pAlgB = line(295, '', { size: 12.5 });
  const pAlgC = line(316, '', { size: 14, fill: PAL.ink });
  const gAlg = svg('g', { opacity: 0 }, txt(PX, 256, 'coordinate form', { size: 10.5, fill: PAL.mut }), pAlgA, pAlgB, pAlgC);

  const pCos = line(366, '', { size: 13, fill: PAL.ink });
  const gCos = svg('g', { opacity: 0 }, txt(PX, 346, 'cosine similarity  a·b / (|a||b|)', { size: 10.5, fill: PAL.mut }), pCos);

  /* signed bar for a·b */
  const BAR_Y = 408, BAR_L = PX, BAR_R = W - 22, BAR_MAX = 15;
  const BAR_0 = (BAR_L + BAR_R) / 2, BAR_W = (BAR_R - BAR_L) / 2;
  const barTrack = svg('line', { x1: BAR_L, y1: BAR_Y, x2: BAR_R, y2: BAR_Y, stroke: 'rgba(230,237,243,0.14)', 'stroke-width': 8, 'stroke-linecap': 'round' });
  const barFill = svg('rect', { x: BAR_0, y: BAR_Y - 4, width: 0, height: 8, rx: 2, fill: PAL.act });
  const barZero = svg('line', { x1: BAR_0, y1: BAR_Y - 11, x2: BAR_0, y2: BAR_Y + 11, stroke: PAL.mut, 'stroke-width': 1 });
  const gBar = svg('g', { opacity: 0 }, barTrack, barFill, barZero,
    txt(BAR_L, BAR_Y - 14, '−' + BAR_MAX, { size: 9.5, mono: true }),
    txt(BAR_R, BAR_Y - 14, '+' + BAR_MAX, { size: 9.5, anchor: 'end', mono: true }),
    txt(BAR_0, BAR_Y - 14, 'a · b', { size: 10, anchor: 'middle', fill: PAL.mut }));

  const defs = svg('defs', {},
    svg('marker', { id: 'arrA02', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })),
    svg('marker', { id: 'arrW02', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.weight })));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A cyan arrow a and an amber arrow b drawn from the origin of a plane, with the angle between them marked. A perpendicular dropped from b onto the line of a marks the projection of b along a; a panel of live numbers shows the length of each vector, the angle, the product of lengths times cosine, the coordinate-wise sum of products, the cosine similarity, and a signed bar for the dot product. In the final step b rotates past ninety degrees and the dot product falls through zero and turns negative.',
  }, defs, grid, axes, divider, zeroLine, zeroTag,
    aDrops, bDrops, aArrow, bArrow, projSeg, projDrop, projSq, projTag, arc, arcTag, aTag, bTag,
    bigVal, verdict, pHead, pMagA, pMagB, pTheta, rule1, gGeom, gAlg, gCos, gBar));

  /* ---- scroll-driven update, everything recomputed from p ---------------- */

  return (p) => {
    const rot = seg(p, 0.78, 0.99, ease.inOut);
    const bAng = lerp(b0Ang, (B_END_DEG * Math.PI) / 180, rot);
    const B = [bLen * Math.cos(bAng), bLen * Math.sin(bAng)];

    const d = dot(A, B);
    const cosT = clamp(d / (aLen * bLen), -1, 1);
    const theta = Math.acos(cosT);
    const s = d / (aLen * aLen);            // scalar projection factor
    const F = [A[0] * s, A[1] * s];         // foot of the perpendicular

    const [ax, ay] = px(A), [bx, by] = px(B), [fx, fy] = px(F);

    /* arrows */
    const tA = seg(p, 0.02, 0.10, ease.out);
    aArrow.setAttribute('x2', lerp(OX, ax, tA));
    aArrow.setAttribute('y2', lerp(OY, ay, tA));
    aArrow.setAttribute('opacity', tA > 0.02 ? 1 : 0);
    const tB = seg(p, 0.06, 0.14, ease.out);
    bArrow.setAttribute('x2', lerp(OX, bx, tB));
    bArrow.setAttribute('y2', lerp(OY, by, tB));
    bArrow.setAttribute('opacity', tB > 0.02 ? 1 : 0);

    aTag.setAttribute('opacity', seg(p, 0.08, 0.14));
    place(aTag, ax, ay);
    aTag.children[1].textContent = `(${fmt(A[0])}, ${fmt(A[1])})`;
    bTag.setAttribute('opacity', seg(p, 0.10, 0.16));
    place(bTag, bx, by - 8);
    for (const t of bTag.children) {
      t.setAttribute('text-anchor', B[0] < 0 ? 'end' : 'start');
      t.setAttribute('x', B[0] < 0 ? -10 : 10);
    }
    bTag.children[1].textContent = `(${fmt(B[0])}, ${fmt(B[1])})`;

    /* the angle arc */
    const R = 54;
    const a0 = [OX + R * Math.cos(aAng), OY - R * Math.sin(aAng)];
    const a1 = [OX + R * Math.cos(bAng), OY - R * Math.sin(bAng)];
    arc.setAttribute('d', `M ${a0[0]} ${a0[1]} A ${R} ${R} 0 0 0 ${a1[0]} ${a1[1]}`);
    const tArc = seg(p, 0.14, 0.22);
    arc.setAttribute('opacity', tArc);
    arcTag.setAttribute('opacity', tArc);
    const mid = (aAng + bAng) / 2;
    arcTag.setAttribute('x', OX + (R + 16) * Math.cos(mid));
    arcTag.setAttribute('y', OY - (R + 16) * Math.sin(mid) + 4);

    /* projection */
    const tProj = seg(p, 0.28, 0.40);
    projSeg.setAttribute('x1', OX); projSeg.setAttribute('y1', OY);
    projSeg.setAttribute('x2', lerp(OX, fx, tProj)); projSeg.setAttribute('y2', lerp(OY, fy, tProj));
    projSeg.setAttribute('opacity', tProj * 0.85);
    projDrop.setAttribute('x1', bx); projDrop.setAttribute('y1', by);
    projDrop.setAttribute('x2', fx); projDrop.setAttribute('y2', fy);
    projDrop.setAttribute('opacity', tProj * 0.9);
    const dropLen = Math.hypot(bx - fx, by - fy);
    if (dropLen > 14) {
      const sgn = s >= 0 ? -1 : 1;
      const ux = sgn * Math.cos(aAng) * 9, uy = -sgn * Math.sin(aAng) * 9;
      const nx = ((bx - fx) / dropLen) * 9, ny = ((by - fy) / dropLen) * 9;
      projSq.setAttribute('d', `M ${fx + ux} ${fy + uy} L ${fx + ux + nx} ${fy + uy + ny} L ${fx + nx} ${fy + ny}`);
      projSq.setAttribute('opacity', tProj * 0.8);
    } else {
      projSq.setAttribute('opacity', 0);
    }
    projTag.textContent = `|b| cos θ = ${fmt(bLen * cosT)}`;
    projTag.setAttribute('x', (OX + fx) / 2 + (s >= 0 ? 6 : -6));
    projTag.setAttribute('y', (OY + fy) / 2 + 26);
    projTag.setAttribute('opacity', seg(p, 0.32, 0.42));

    /* coordinates */
    const tCo = seg(p, 0.54, 0.62);
    const dropTo = [[aDrops[0], ax, ay, ax, OY], [aDrops[1], ax, ay, OX, ay],
      [bDrops[0], bx, by, bx, OY], [bDrops[1], bx, by, OX, by]];
    for (const [l, x1, y1, x2, y2] of dropTo) {
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('opacity', tCo * 0.75);
    }

    /* the zero line, perpendicular to a through the origin */
    const zx = (-A[1] / aLen) * 3.3 * U, zy = (A[0] / aLen) * 3.3 * U;
    zeroLine.setAttribute('x1', OX - zx); zeroLine.setAttribute('y1', OY + zy);
    zeroLine.setAttribute('x2', OX + zx); zeroLine.setAttribute('y2', OY - zy);
    const tZ = seg(p, 0.76, 0.84);
    zeroLine.setAttribute('opacity', tZ * 0.7);
    zeroTag.setAttribute('x', OX + zx); zeroTag.setAttribute('y', OY - zy - 10);
    zeroTag.setAttribute('opacity', tZ * 0.9);

    /* panel */
    pMagA.textContent = `|a| = ${fmt(aLen)}`;
    pMagB.textContent = `|b| = ${fmt(bLen)}`;
    pTheta.textContent = `θ   = ${((theta * 180) / Math.PI).toFixed(1)}°`;
    pGeomA.textContent = '|a| |b| cos θ';
    pGeomB.textContent = `= ${fmt(aLen)} × ${fmt(bLen)} × ${fmt(cosT, 3)}`;
    gGeom.setAttribute('opacity', seg(p, 0.30, 0.38));
    pAlgA.textContent = 'a₁b₁ + a₂b₂';
    pAlgB.textContent = `= ${fmt(A[0])}×${fmt(B[0])} + ${fmt(A[1])}×${fmt(B[1])}`;
    pAlgC.textContent = `= ${fmt(d)}`;
    gAlg.setAttribute('opacity', seg(p, 0.56, 0.64));
    pCos.textContent = `cos θ = ${fmt(cosT, 3)}`;
    gCos.setAttribute('opacity', seg(p, 0.62, 0.70));

    // the geometric form prints its value once the algebra has confirmed it
    pGeomC.textContent = seg(p, 0.56, 0.64) > 0.5 ? `= ${fmt(d)}` : '';

    gBar.setAttribute('opacity', seg(p, 0.40, 0.48));
    const w = (clamp(Math.abs(d) / BAR_MAX, 0, 1)) * BAR_W;
    barFill.setAttribute('x', d >= 0 ? BAR_0 : BAR_0 - w);
    barFill.setAttribute('width', w);
    barFill.setAttribute('opacity', 0.9);

    const tBig = seg(p, 0.34, 0.42);
    bigVal.setAttribute('opacity', tBig);
    bigVal.textContent = `a · b  =  ${fmt(d)}`;
    verdict.setAttribute('opacity', tBig);
    verdict.textContent = Math.abs(d) < 0.25
      ? 'zero — orthogonal, nothing in common'
      : d > 0 ? 'positive — the two share a direction'
        : 'negative — the two oppose';
  };
}

export function dotScene() {
  return createScene({ id: 'vectors-dot', figure: dotFigure, steps: DOT_STEPS });
}
