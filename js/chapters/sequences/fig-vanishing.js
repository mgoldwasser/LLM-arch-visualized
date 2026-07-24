/* Backprop through time: the size of the gradient signal that survives k steps
   of recurrence, for several Jacobian norms. Curves are computed from γ^k;
   the readouts under the plot follow a guide line driven by scroll. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, clamp, lerp, ease } from '../../core/anim.js';
import { sci, sup } from './shared.js';

const GAMMAS = [0.5, 0.7, 0.9, 1.1];
const KMAX = 80;

export function vanishingFigure() {
  const W = 760, H = 414;
  const x0 = 96, x1 = 686, yTop = 56, yBot = 286;
  const LMIN = -24, LMAX = 4;
  const xFor = (k) => x0 + (k / KMAX) * (x1 - x0);
  const yFor = (L) => yBot - ((clamp(L, LMIN, LMAX) - LMIN) / (LMAX - LMIN)) * (yBot - yTop);
  const magAt = (g, k) => g ** k;                       // ‖∂hₜ/∂hₜ₋ₖ‖ ≈ γᵏ

  /* ---- axes -------------------------------------------------------------- */
  const grid = svg('g', {});
  for (let L = LMIN; L <= LMAX; L += 6) {
    const unity = L === 0;
    grid.append(
      svg('line', {
        x1: x0, y1: yFor(L), x2: x1, y2: yFor(L),
        stroke: unity ? 'rgba(230,237,243,0.24)' : PAL.grid, 'stroke-width': unity ? 1.2 : 1,
      }),
      txt(x0 - 10, yFor(L) + 4, `10${sup(L)}`, { size: 10, anchor: 'end', mono: true }));
  }
  grid.append(txt(x1, yFor(0) - 8, 'gradient arrives at full strength', { size: 10, anchor: 'end' }));
  for (let k = 0; k <= KMAX; k += 20) {
    grid.append(
      svg('line', { x1: xFor(k), y1: yBot, x2: xFor(k), y2: yBot + 5, stroke: 'rgba(230,237,243,0.22)' }),
      txt(xFor(k), yBot + 20, String(k), { size: 10.5, fill: PAL.tx, anchor: 'middle', mono: true }));
  }
  grid.append(
    svg('line', { x1: x0, y1: yBot, x2: x1, y2: yBot, stroke: 'rgba(230,237,243,0.22)', 'stroke-width': 1.2 }),
    txt((x0 + x1) / 2, yBot + 40, 'k  —  recurrent steps between the loss and the weight it should correct', { size: 11, anchor: 'middle' }));

  /* ---- one curve per Jacobian norm --------------------------------------- */
  const curves = GAMMAS.map((g, i) => {
    const pts = [];
    for (let k = 0; k <= KMAX; k++) pts.push(`${xFor(k).toFixed(1)},${yFor(Math.log10(magAt(g, k))).toFixed(1)}`);
    const exploding = g > 1;
    const path = svg('path', {
      d: `M ${pts.join(' L ')}`, fill: 'none', stroke: PAL.loss,
      'stroke-width': exploding ? 2.4 : 1.8, 'stroke-opacity': exploding ? 1 : 0.9 - i * 0.16,
      pathLength: 1,
    });
    const endL = Math.log10(magAt(g, KMAX));
    const label = txt(x1 + 6, yFor(endL) + 4, `γ = ${g.toFixed(2)}`, {
      size: 10.5, fill: PAL.loss, mono: true, opacity: exploding ? 1 : 0.95 - i * 0.12,
    });
    const dot = svg('circle', { r: 3.4, fill: PAL.loss, cx: xFor(0), cy: yFor(0) });
    return { g, path, label, dot, exploding };
  });
  const explodeNote = txt(x1 + 6, yFor(Math.log10(magAt(1.1, KMAX))) - 14, '‖J‖ > 1', { size: 10, fill: PAL.loss });

  /* ---- guide line + live readouts ---------------------------------------- */
  const guide = svg('line', { x1: x0, y1: yTop - 4, x2: x0, y2: yBot, stroke: 'rgba(230,237,243,0.3)', 'stroke-width': 1, 'stroke-dasharray': '3 4' });
  const guideLab = txt(x0, yTop - 12, '', { size: 11, fill: PAL.ink, anchor: 'middle', mono: true });
  const roHead = txt(x0, 352, 'gradient magnitude arriving from k steps back, relative to the local one', { size: 10 });
  const readouts = GAMMAS.map((g, i) => {
    const rx = x0 + i * 150;
    return {
      key: txt(rx, 374, `γ = ${g.toFixed(2)}`, { size: 10, fill: PAL.mut, mono: true }),
      val: txt(rx, 394, '', { size: 12.5, fill: PAL.loss, mono: true }),
    };
  });

  const head = txt(24, 30, 'how much of the training signal survives k steps of backprop through time', { size: 11 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A logarithmic plot of gradient magnitude against the number of recurrent steps travelled backwards. Jacobian norms below one give straight lines sloping steeply downwards — a norm of 0.7 falls below one part in a million after about forty steps — while a norm of 1.1 climbs off the top of the plot, the exploding case.',
  }, head, grid, curves.map((c) => c.path), curves.map((c) => c.label), explodeNote, guide, guideLab, curves.map((c) => c.dot), roHead, readouts.map((r) => [r.key, r.val]));

  const node = figure(
    'the chain rule, iterated. Each recurrent step multiplies the gradient by roughly the same Jacobian norm γ, so the signal reaching k steps back scales as γᵏ — a straight line on a log axis. Anything below 1 vanishes into numerical noise within a few dozen steps; anything above 1 explodes. Only γ = 1 exactly would carry the signal intact, and that is a knife edge no learned matrix stays on.',
    root, { wide: true, key: 'vanishing' });

  track(node, (p) => {
    head.setAttribute('opacity', seg(p, 0.06, 0.14));
    grid.setAttribute('opacity', seg(p, 0.08, 0.18));
    curves.forEach((c, i) => {
      const t = seg(p, 0.14 + i * 0.05, 0.42 + i * 0.05);
      c.path.setAttribute('stroke-dasharray', `${t.toFixed(4)} 1`);
      c.label.setAttribute('opacity', seg(p, 0.36 + i * 0.05, 0.46 + i * 0.05));
    });
    explodeNote.setAttribute('opacity', seg(p, 0.5, 0.58));

    const show = seg(p, 0.52, 0.6);
    const k = Math.round(lerp(0, KMAX, seg(p, 0.5, 0.95, ease.linear)));
    guide.setAttribute('x1', xFor(k));
    guide.setAttribute('x2', xFor(k));
    guide.setAttribute('opacity', show);
    guideLab.setAttribute('x', xFor(k));
    guideLab.setAttribute('opacity', show);
    guideLab.textContent = `k = ${k} steps back`;
    roHead.setAttribute('opacity', show);
    curves.forEach((c, i) => {
      c.dot.setAttribute('cx', xFor(k));
      c.dot.setAttribute('cy', yFor(Math.log10(magAt(c.g, k))));
      c.dot.setAttribute('opacity', show);
      const r = readouts[i];
      r.key.setAttribute('opacity', show);
      r.val.setAttribute('opacity', show);
      r.val.textContent = sci(magAt(c.g, k), 1);
    });
  });
  return node;
}
