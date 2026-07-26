/* The sticky scene: build the network up, then take the nonlinearity out.

   The network is fixed and real — three hidden units sharing the normal
   direction (1, 1), one output unit — and every frame runs its forward pass
   on a grid to draw the decision boundary. The nonlinearity is dissolved by
   sweeping a single parameter α from 1 (ReLU) to 0 (identity), so the
   collapse to a straight line is watched happening, not asserted. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, clamp } from '../../core/anim.js';
import { xorData, frame, zeroContour, clipLine, leaky, tally, CLS } from './net.js';

const W = [[1, 1], [1, 1], [1, 1]];      // hidden weight rows (the normal direction)
const B = [1, 0, -1];                    // hidden biases — three offsets, one direction
const V = [1.28, -2.1, 0.72];            // output weights
const C = -0.5;                          // output bias

const PTS = xorData();

/* The whole network, as one scalar score. α = 1 → ReLU, α = 0 → no σ at all. */
const score = (x, y, a) => {
  let z = C;
  for (let i = 0; i < 3; i++) z += V[i] * leaky(W[i][0] * x + W[i][1] * y + B[i], a);
  return z;
};

function buildFigure(canvas) {
  const WD = 720, HT = 470;
  const fr = frame(384, 96, 306);

  /* ---- right: the data panel ------------------------------------------- */
  const panel = svg('rect', {
    x: fr.x0, y: fr.y0, width: fr.size, height: fr.size, rx: 6,
    fill: 'rgba(230,237,243,0.02)', stroke: PAL.grid, 'stroke-width': 1,
  });
  const axes = svg('g', {},
    svg('line', { x1: fr.sx(0), y1: fr.y0, x2: fr.sx(0), y2: fr.y0 + fr.size, stroke: PAL.grid }),
    svg('line', { x1: fr.x0, y1: fr.sy(0), x2: fr.x0 + fr.size, y2: fr.sy(0), stroke: PAL.grid }));

  const dots = PTS.map((p) => svg('circle', {
    cx: fr.sx(p.x), cy: fr.sy(p.y), r: 4.2, fill: CLS[p.c], stroke: PAL.bg, 'stroke-width': 1,
  }));
  const rings = PTS.map((p) => svg('circle', {
    cx: fr.sx(p.x), cy: fr.sy(p.y), r: 7.5, fill: 'none',
    stroke: PAL.loss, 'stroke-width': 1.4, opacity: 0,
  }));

  // one clipped line per hidden neuron — these never move, only appear
  const planes = B.map((b, i) => {
    const L = clipLine(W[i][0], W[i][1], b, fr);
    return svg('line', {
      x1: L.x1, y1: L.y1, x2: L.x2, y2: L.y2,
      stroke: PAL.weight, 'stroke-width': 1.6, 'stroke-dasharray': '5 4', opacity: 0,
    });
  });

  // the normal direction of neuron 1, drawn once at step 1
  const nrm = svg('path', {
    d: `M ${fr.sx(-0.5)} ${fr.sy(-0.5)} L ${fr.sx(-0.14)} ${fr.sy(-0.14)}`,
    stroke: PAL.weight, 'stroke-width': 1.8, fill: 'none', 'marker-end': 'url(#nw-arr)', opacity: 0,
  });
  const nrmTag = txt(fr.sx(-0.1), fr.sy(-0.06), 'w', { size: 12, fill: PAL.weight, mono: true, opacity: 0 });
  const sideP = txt(fr.sx(0.55), fr.sy(-0.86), 'w·x + b > 0', { size: 10.5, fill: PAL.weight, anchor: 'middle', opacity: 0 });
  const sideN = txt(fr.sx(-0.62), fr.sy(0.92), 'w·x + b < 0', { size: 10.5, fill: PAL.weight, anchor: 'middle', opacity: 0 });

  const bound = svg('path', { d: '', stroke: PAL.ink, 'stroke-width': 2.6, fill: 'none', opacity: 0, 'stroke-linecap': 'round' });
  const panelTitle = txt(fr.x0, fr.y0 - 14, 'two classes in the plane — no straight line separates them', { size: 11 });
  const acc = txt(fr.x0 + fr.size, fr.y0 + fr.size + 22, '', { size: 12, fill: PAL.tx, anchor: 'end', mono: true, opacity: 0 });

  /* ---- left: the network diagram --------------------------------------- */
  const IX = 62, HX = 186, OX = 300;
  const IY = [196, 262], HY = [140, 232, 324];

  const mkNode = (cx, cy, r, col) => svg('circle', { cx, cy, r, fill: '#161C24', stroke: col, 'stroke-width': 1.4 });
  const inputs = IY.map((y, i) => svg('g', {},
    mkNode(IX, y, 14, PAL.act),
    txt(IX, y + 4, i ? 'x₂' : 'x₁', { size: 12, fill: PAL.act, anchor: 'middle', mono: true })));

  const edges = [], hidden = [], rims = [], sigG = [], idG = [], biasT = [], outEdges = [];
  HY.forEach((hy, j) => {
    IY.forEach((iy) => edges.push({ j, line: svg('line', { x1: IX + 14, y1: iy, x2: HX - 17, y2: hy, stroke: PAL.weight, 'stroke-width': 1.2, opacity: 0 }) }));
    const rim = mkNode(HX, hy, 17, PAL.act);
    rims.push(rim);
    hidden.push(svg('g', { opacity: 0 }, rim));
    sigG.push(txt(HX, hy + 5, 'σ', { size: 14, fill: PAL.ink, anchor: 'middle', mono: true, opacity: 0 }));
    idG.push(txt(HX, hy + 5, 'id', { size: 12, fill: PAL.loss, anchor: 'middle', mono: true, opacity: 0 }));
    biasT.push(txt(HX, hy + 33, `b = ${B[j] > 0 ? '+' : ''}${B[j]}`, { size: 10, fill: PAL.weight, anchor: 'middle', mono: true, opacity: 0 }));
    outEdges.push(svg('line', { x1: HX + 17, y1: hy, x2: OX - 15, y2: 232, stroke: PAL.weight, 'stroke-width': 1.2, opacity: 0 }));
  });

  const outNode = svg('g', { opacity: 0 },
    mkNode(OX, 232, 15, PAL.act),
    txt(OX, 236, 'z', { size: 12, fill: PAL.act, anchor: 'middle', mono: true }));

  const wTag1 = txt(IX + 34, 168, 'w₁', { size: 10.5, fill: PAL.weight, mono: true, opacity: 0 });
  const wTag2 = txt(IX + 34, 288, 'w₂', { size: 10.5, fill: PAL.weight, mono: true, opacity: 0 });

  const eq1 = txt(24, 62, 'one neuron:  σ(w·x + b)', { size: 12.5, fill: PAL.ink, mono: true, opacity: 0 });
  const eq2 = txt(24, 62, 'one layer:  h = σ(xW + b),  W is 2 × 3', { size: 12.5, fill: PAL.ink, mono: true, opacity: 0 });
  const eq3 = txt(24, 62, 'no σ:  z = x(Wv) + c  —  one 1 × 2 matrix', { size: 12.5, fill: PAL.loss, mono: true, opacity: 0 });
  const eq4 = txt(24, 62, 'with σ:  z = σ(xW + b)·v + c', { size: 12.5, fill: PAL.ink, mono: true, opacity: 0 });
  const sub = txt(24, 408, '', { size: 11, fill: PAL.mut, opacity: 0 });

  const defs = svg('defs', {},
    svg('marker', { id: 'nw-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.weight })));

  canvas.append(svgRoot(WD, HT, {
    role: 'img',
    'aria-label': 'A network diagram on the left grows from one neuron to a layer of three plus an output unit, while a scatter plot on the right shows four blobs of two classes, the neurons’ hyperplanes, and a decision boundary that flattens into a single straight line when the nonlinearity is removed and bends back around the data when it is restored.',
  }, defs, panel, axes, panelTitle,
    planes, nrm, nrmTag, sideP, sideN, bound, rings, dots, acc,
    edges.map((e) => e.line), outEdges, inputs, hidden, sigG, idG, biasT, outNode,
    wTag1, wTag2, eq1, eq2, eq3, eq4, sub));

  /* ---- per-frame update, entirely a function of p ----------------------- */
  return (p) => {
    // nonlinearity strength: full through steps 1–2, dissolved in step 3,
    // restored in step 4.
    const a = clamp(1 - seg(p, 0.57, 0.67) + seg(p, 0.78, 0.9));

    inputs.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.01 + i * 0.02, 0.07 + i * 0.02)));
    edges.forEach((e) => e.line.setAttribute('opacity', e.j === 0 ? seg(p, 0.04, 0.1) : seg(p, 0.28, 0.36)));
    hidden.forEach((g, j) => g.setAttribute('opacity', j === 0 ? seg(p, 0.05, 0.11) : seg(p, 0.28, 0.38)));
    biasT.forEach((t, j) => t.setAttribute('opacity', (j === 0 ? seg(p, 0.08, 0.14) : seg(p, 0.3, 0.4)) * 0.9));
    [wTag1, wTag2].forEach((t) => t.setAttribute('opacity', seg(p, 0.06, 0.12) * (1 - seg(p, 0.3, 0.4))));

    const nodeOn = (j) => (j === 0 ? seg(p, 0.05, 0.11) : seg(p, 0.28, 0.38));
    sigG.forEach((t, j) => t.setAttribute('opacity', nodeOn(j) * a));
    idG.forEach((t, j) => t.setAttribute('opacity', nodeOn(j) * (1 - a)));
    rims.forEach((c) => c.setAttribute('stroke', a < 0.5 ? PAL.loss : PAL.act));

    outEdges.forEach((l, j) => l.setAttribute('opacity', seg(p, 0.47 + j * 0.01, 0.53 + j * 0.01)));
    outNode.setAttribute('opacity', seg(p, 0.47, 0.53));

    eq1.setAttribute('opacity', seg(p, 0.06, 0.12) * (1 - seg(p, 0.26, 0.32)));
    eq2.setAttribute('opacity', seg(p, 0.3, 0.36) * (1 - seg(p, 0.47, 0.52)));
    eq3.setAttribute('opacity', seg(p, 0.62, 0.68) * (1 - seg(p, 0.79, 0.84)));
    eq4.setAttribute('opacity', Math.max(seg(p, 0.49, 0.53) * (1 - seg(p, 0.55, 0.6)), seg(p, 0.85, 0.91)));

    planes.forEach((l, j) => l.setAttribute('opacity',
      (j === 0 ? seg(p, 0.1, 0.18) : seg(p, 0.3, 0.42)) * (1 - 0.55 * seg(p, 0.48, 0.56))));
    const nrmOn = seg(p, 0.14, 0.2) * (1 - seg(p, 0.28, 0.34));
    [nrm, nrmTag, sideP, sideN].forEach((n) => n.setAttribute('opacity', nrmOn));

    const bOn = seg(p, 0.48, 0.54);
    bound.setAttribute('opacity', bOn);
    bound.setAttribute('d', bOn > 0.01 ? zeroContour((x, y) => score(x, y, a), fr, 44) : '');

    const t = tally(PTS, (x, y) => score(x, y, a));
    rings.forEach((r, i) => r.setAttribute('opacity', bOn > 0.5 && t.wrong[i] ? 0.95 : 0));
    acc.setAttribute('opacity', bOn);
    acc.textContent = `${PTS.length - t.ok} of ${PTS.length} points on the wrong side`;

    sub.setAttribute('opacity', seg(p, 0.66, 0.71) * (1 - seg(p, 0.79, 0.84)));
    sub.textContent = 'every unit is now a pass-through — the stack is one affine map';
  };
}

export function sceneBuild() {
  return createScene({
    id: 'networks-build',
    figure: buildFigure,
    steps: [
      { n: 'STEP 1 / 4 — ONE NEURON', html: `<p>A neuron holds a weight vector <strong>w</strong> and a bias <em>b</em>. It takes the dot product of its weights with the input, adds the bias, and pushes the result through a fixed nonlinear function σ. Geometrically, <strong>w</strong>·<strong>x</strong>&nbsp;+&nbsp;<em>b</em>&nbsp;=&nbsp;0 is a line in the plane (a hyperplane in general); <strong>w</strong> points across it, and the value the neuron computes says which side you are on and how far.</p>` },
      { n: 'STEP 2 / 4 — A LAYER', html: `<p>Nothing new happens when you add neurons: stack their weight vectors as the columns of one matrix and the layer&rsquo;s output is <em>h</em>&nbsp;=&nbsp;σ(<em>xW</em>&nbsp;+&nbsp;<em>b</em>) — the same matrix product from the previous chapter, with one fixed function applied to each coordinate afterwards. Three neurons here, so three lines. They share a direction and differ only in offset, which is exactly what will let them cut a band out of the plane.</p>` },
      { n: 'STEP 3 / 4 — DELETE σ', html: `<p>Now an output unit reads the three hidden values and produces a score; the boundary is the curve where that score is zero. Watch what happens as σ dissolves into the identity. Two matrices multiply into one, two biases add into one, and the entire two-layer network becomes a single affine map — whose zero set is, and can only ever be, one straight line. Depth bought nothing.</p>` },
      { n: 'STEP 4 / 4 — PUT IT BACK', html: `<p>Restore σ and the same weights bend the boundary into a band that wraps the data. Nothing else changed: same matrices, same biases, same output unit. The only difference is a function with a kink in it, applied one coordinate at a time — and that kink is the entire reason a deep network is more than a wide one.</p>` },
    ],
  });
}
