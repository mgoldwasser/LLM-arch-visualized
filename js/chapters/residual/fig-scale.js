/* One layer's weight matrices, drawn with area proportional to parameter
   count: four small amber attention squares, a hairline embedding strip, and
   a teal field of expert MLPs that dominates everything. Scroll-tracked. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, ease, rng } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

export function figScale() {
  const bp = K3.blueprint;
  const d = bp.dModel, hh = bp.expertHidden, L = bp.layers, V = K3.vocab;
  const nExp = bp.routedExpertsK2 + 1;             // 384 routed + 1 shared
  const perExpert = 3 * d * hh;
  const attnParams = 4 * d * d;
  const moeB = (Math.floor(nExp * perExpert / 1e8) / 10).toFixed(1);   // "16.9"

  const COLS = 24, PITCH = 29, CELL = 26, X0 = 12, FY = 92;
  const scale = (CELL * CELL) / perExpert;         // px² per parameter
  const attnSide = d * Math.sqrt(scale);           // side of one d×d square ≈ 28.7px
  const stripH = 3, stripW = (V * d / L) * scale / stripH;
  const rows = Math.ceil(nExp / COLS);
  const W = 720, H = FY + rows * PITCH + 34;

  const attnSquares = ['W_Q', 'W_K', 'W_V', 'W_O'].map((name, i) => svg('g', { opacity: 0 },
    svg('rect', { x: X0 + i * (attnSide + 8), y: 30, width: attnSide, height: attnSide, rx: 3, fill: PAL.weight, 'fill-opacity': 0.55, stroke: PAL.weight, 'stroke-width': 1 }),
    txt(X0 + i * (attnSide + 8) + attnSide / 2, 24, name, { fill: PAL.weight, anchor: 'middle', mono: true })));
  const attnNote = txt(X0 + 4 * (attnSide + 8) + 8, 48,
    `all of attention: ~${(attnParams / 1e9).toFixed(2)} B`,
    { size: 11.5, fill: PAL.weight, opacity: 0 });
  const strip = svg('rect', { x: X0, y: 70, width: 0, height: stripH, fill: PAL.weight, opacity: 0.75 });
  const stripNote = txt(X0 + stripW + 10, 75,
    `this layer’s share of embedding + unembedding: ~${(V * d / 1e9).toFixed(2)} B ÷ ${L}`,
    { opacity: 0 });

  const rand = rng(33);
  const base = Array.from({ length: nExp }, () => 0.35 + 0.45 * rand());
  const cells = Array.from({ length: nExp }, (_, e) => svg('rect', {
    x: X0 + (e % COLS) * PITCH, y: FY + Math.floor(e / COLS) * PITCH,
    width: CELL, height: CELL, rx: 3, fill: PAL.moe, 'fill-opacity': 0.05,
    stroke: PAL.moe, 'stroke-opacity': e === nExp - 1 ? 0.9 : 0.2, 'stroke-width': e === nExp - 1 ? 1.4 : 0.6,
  }));
  const sharedLabel = txt(X0 + PITCH + 10, FY + (rows - 1) * PITCH + 17, '← the 1 shared expert',
    { size: 11.5, fill: PAL.moe, mono: true, opacity: 0 });
  const fieldNote = txt(360, FY + rows * PITCH + 22,
    `${bp.routedExpertsK2} routed experts + 1 shared ≈ ${moeB} B — each cell one expert (3 matrices of ${d.toLocaleString('en-US')}×${hh.toLocaleString('en-US')})`,
    { size: 11.5, fill: PAL.moe, anchor: 'middle', opacity: 0 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Every weight matrix in one transformer layer drawn with area proportional to parameter count: the four attention projection matrices are four small amber squares, the layer’s share of embedding and unembedding is a thin strip, and a large teal field of ${nExp} cells — one per expert MLP — dominates the picture.`,
  }, attnSquares, attnNote, strip, stripNote, cells, sharedLabel, fieldNote);

  const node = figure(
    `one layer, areas ∝ parameters (K2 blueprint, standard-attention approximation). Stack ${L} of these and add the embedding strip once: that’s the whole 1T model. K3 scales the teal field to ${K3.experts.routed} experts.`,
    root,
    { key: 'scale' });

  return pin(node, (p) => {
    attnSquares.forEach((sq, i) => sq.setAttribute('opacity', seg(p, 0.08 + i * 0.02, 0.16 + i * 0.02)));
    attnNote.setAttribute('opacity', seg(p, 0.14, 0.22));
    strip.setAttribute('width', stripW * seg(p, 0.18, 0.26, ease.out));
    stripNote.setAttribute('opacity', seg(p, 0.2, 0.28));
    const count = Math.ceil(seg(p, 0.18, 0.70, ease.linear) * nExp);
    cells.forEach((c, e) => c.setAttribute('fill-opacity', e < count ? base[e] : 0.05));
    sharedLabel.setAttribute('opacity', seg(p, 0.70, 0.80));
    fieldNote.setAttribute('opacity', seg(p, 0.66, 0.78));
  });
}
