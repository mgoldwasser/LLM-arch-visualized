/* One complete training step through a 2 → 2 → 1 network, with every number
   computed live in net.js: forward and cache, loss, backward, update, repeat. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease, clamp, norm } from '../../core/anim.js';
import { trajectory, ETA, TARGET, f2, f3, fLoss, vec2 } from './net.js';

const K = 10;                       // steps in the little training run
const XN = [[74, 130], [74, 230]];  // input nodes
const HN = [[286, 130], [286, 230]];// hidden nodes
const ON = [474, 180];              // output node
const R = 24;

/* trimmed centre-to-centre segment, plus its midpoint x */
function link(p, q, r1, r2) {
  const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
  return {
    line: svg('line', {
      x1: p[0] + (dx / L) * r1, y1: p[1] + (dy / L) * r1,
      x2: q[0] - (dx / L) * r2, y2: q[1] - (dy / L) * r2,
      stroke: PAL.mut, 'stroke-width': 1, 'stroke-opacity': 0.3,
    }),
    mx: (p[0] + q[0]) / 2,
  };
}

function node(c, r, sym) {
  const g = svg('g', {});
  g.append(
    svg('circle', { cx: c[0], cy: c[1], r, fill: PAL.bg, stroke: PAL.mut, 'stroke-width': 1.2 }),
    txt(c[0], c[1] - 3, sym, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }));
  const val = txt(c[0], c[1] + 14, '', { size: 12, fill: PAL.act, anchor: 'middle', mono: true, opacity: 0 });
  g.append(val);
  return { g, val, ring: g.firstChild };
}

function stepFigure(canvas) {
  const W = 720, H = 470;
  const traj = trajectory(K);
  const maxLoss = traj[0].F.loss;

  const xNodes = XN.map((c, j) => node(c, R, `x${'₁₂'[j]}`));
  const hNodes = HN.map((c, i) => node(c, R, `a${'₁₂'[i]}`));
  const oNode = node(ON, 26, 'ŷ');

  const e1 = [];                       // e1[i][j]: x_j → h_i, weight W1[i][j]
  for (let i = 0; i < 2; i++) e1.push(XN.map((c) => link(c, HN[i], R, R)));
  const e2 = HN.map((c) => link(c, ON, R, 26));
  const wLab1 = [
    [txt(172, 122, '', { size: 11, anchor: 'middle', mono: true }), txt(158, 216, '', { size: 11, anchor: 'middle', mono: true })],
    [txt(158, 148, '', { size: 11, anchor: 'middle', mono: true }), txt(172, 244, '', { size: 11, anchor: 'middle', mono: true })],
  ];
  const wLab2 = [txt(380, 146, '', { size: 11, anchor: 'middle', mono: true }), txt(380, 216, '', { size: 11, anchor: 'middle', mono: true })];

  const zLab = [txt(286, 92, '', { size: 10.5, anchor: 'middle', mono: true, opacity: 0 }),
                txt(286, 272, '', { size: 10.5, anchor: 'middle', mono: true, opacity: 0 })];
  const gLab = [
    txt(74, 180, '', { size: 10.5, fill: PAL.loss, anchor: 'middle', mono: true, opacity: 0 }),
    txt(74, 280, '', { size: 10.5, fill: PAL.loss, anchor: 'middle', mono: true, opacity: 0 }),
    txt(286, 74, '', { size: 10.5, fill: PAL.loss, anchor: 'middle', mono: true, opacity: 0 }),
    txt(286, 290, '', { size: 10.5, fill: PAL.loss, anchor: 'middle', mono: true, opacity: 0 }),
    txt(474, 226, '', { size: 11, fill: PAL.loss, anchor: 'middle', mono: true, opacity: 0 }),
  ];

  const target = svg('g', { opacity: 0 },
    svg('rect', { x: 592, y: 90, width: 72, height: 26, rx: 6, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 }),
    txt(628, 107, `y = ${f2(TARGET)}`, { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }),
    svg('line', { x1: 628, y1: 116, x2: 628, y2: 150, stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
  const lossArrow = svg('line', { x1: 502, y1: 180, x2: 550, y2: 180, stroke: PAL.mut, 'stroke-width': 1.4, 'marker-end': 'url(#arrL4)', opacity: 0 });
  const lossVal = txt(628, 196, '', { size: 16, fill: PAL.loss, anchor: 'middle', mono: true });
  const lossBox = svg('g', { opacity: 0 },
    svg('rect', { x: 556, y: 150, width: 144, height: 60, rx: 10, fill: 'rgba(240,120,80,0.10)', stroke: PAL.loss, 'stroke-width': 1.3 }),
    txt(628, 172, 'L = ½(ŷ − y)²', { size: 11, anchor: 'middle', mono: true }), lossVal);

  const cache = txt(36, 318, '', { size: 10.5, anchor: 'start', mono: true, opacity: 0 });
  const divider = svg('line', { x1: 36, y1: 332, x2: 684, y2: 332, stroke: PAL.grid, 'stroke-width': 1 });

  /* ---- bottom band: three panels, crossfaded ---- */
  const mkRows = (n, y0, xs, color) => Array.from({ length: n }, (_, i) =>
    xs.map((x, c) => txt(x, y0 + i * 20, '', { size: 11, fill: c === xs.length - 1 ? color : PAL.tx, anchor: 'start', mono: true })));

  const gTitle = txt(36, 344, 'backward — each node multiplies the incoming gradient by its own local derivative', { size: 11, fill: PAL.loss });
  const gRows = mkRows(5, 366, [36, 300], PAL.loss);
  const gradPanel = svg('g', { opacity: 0 }, gTitle, gRows);

  const uTitle = txt(36, 344, '', { size: 11, fill: PAL.train });
  const uRows = mkRows(5, 366, [36, 116, 380], PAL.train);
  const updPanel = svg('g', { opacity: 0 }, uTitle, uRows);

  const CX0 = 74, CX1 = 430, CY0 = 356, CY1 = 448;
  const curveLine = svg('polyline', { points: '', fill: 'none', stroke: PAL.loss, 'stroke-width': 2, 'stroke-linejoin': 'round' });
  const curveDot = svg('circle', { cx: CX0, cy: CY0, r: 4, fill: PAL.loss });
  const curveRead = [0, 1, 2].map((i) => txt(470, 380 + i * 22, '', { size: 12, anchor: 'start', mono: true, fill: i === 2 ? PAL.loss : PAL.tx }));
  const curvePanel = svg('g', { opacity: 0 },
    svg('line', { x1: CX0, y1: CY1, x2: CX1, y2: CY1, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: CX0, y1: CY0 - 8, x2: CX0, y2: CY1, stroke: PAL.mut, 'stroke-width': 1 }),
    txt(CX0 - 8, CY0 - 2, f3(maxLoss), { size: 9.5, anchor: 'end', mono: true }),
    txt(CX0 - 8, CY1, '0', { size: 9.5, anchor: 'end', mono: true }),
    txt((CX0 + CX1) / 2, CY1 + 16, 'update number →', { size: 10, anchor: 'middle' }),
    txt(36, 344, 'the same four beats, repeated', { size: 11, fill: PAL.loss }),
    curveLine, curveDot, curveRead);

  const defs = svg('defs', {},
    svg('marker', { id: 'arrL4', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A two-input, two-hidden-unit, one-output network. Values flow forward in cyan and are cached, a squared-error loss is computed against the target, gradients flow backward in red-orange multiplying local derivatives, every weight is nudged against its gradient in green, and a loss curve falls as the step repeats.',
  },
    defs,
    txt(36, 24, `one training step · 2 → 2 → 1 · ReLU hidden units · η = ${f2(ETA)}`, { size: 11 }),
    e1.flat().map((e) => e.line), e2.map((e) => e.line),
    wLab1.flat(), wLab2, zLab,
    xNodes.map((n) => n.g), hNodes.map((n) => n.g), oNode.g,
    target, lossArrow, lossBox, gLab, cache, divider,
    gradPanel, updPanel, curvePanel));

  return (p) => {
    /* which entry of the run is on screen — pure function of p, so scrolling
       backwards rewinds exactly */
    const kStep = 1 + Math.min(K - 2, Math.floor(clamp(norm(p, 0.82, 0.995)) * (K - 1)));
    const vIdx = p >= 0.80 ? kStep : 0;
    const wIdx = p >= 0.80 ? kStep : (p >= 0.66 ? 1 : 0);
    const F = traj[vIdx].F;
    const P = traj[wIdx].P, P0 = traj[0].P, G0 = traj[0].G;
    const fresh = seg(p, 0.62, 0.72) * (1 - seg(p, 0.78, 0.84));   // green while updating

    /* forward sweep (cyan) and backward sweep (red-orange) fronts */
    const fwdX = lerp(XN[0][0] - 10, ON[0] + 30, seg(p, 0.02, 0.18, ease.inOut));
    const inBwd = p >= 0.40 && p < 0.60;
    const bwdX = lerp(ON[0] + 30, XN[0][0] - 10, seg(p, 0.42, 0.57, ease.inOut));
    const paint = (e) => {
      const back = inBwd && bwdX <= e.mx;
      const fwd = fwdX >= e.mx;
      e.line.setAttribute('stroke', back ? PAL.loss : (fwd ? PAL.act : PAL.mut));
      e.line.setAttribute('stroke-opacity', back || fwd ? 0.95 : 0.3);
      e.line.setAttribute('stroke-width', back ? 2.2 : (fwd ? 1.8 : 1));
    };
    e1.flat().forEach(paint); e2.forEach(paint);

    /* node values, from the forward pass currently on screen */
    xNodes.forEach((n, j) => {
      n.val.textContent = f2(F.x[j]);
      n.val.setAttribute('opacity', seg(p, 0.01, 0.05));
      n.ring.setAttribute('stroke', fwdX >= XN[j][0] ? PAL.act : PAL.mut);
    });
    hNodes.forEach((n, i) => {
      n.val.textContent = f2(F.a1[i]);
      n.val.setAttribute('opacity', seg(p, 0.07, 0.12));
      n.ring.setAttribute('stroke', fwdX >= HN[i][0] ? PAL.act : PAL.mut);
      zLab[i].textContent = `z${'₁₂'[i]} = ${f2(F.z1[i])} → ReLU`;
      zLab[i].setAttribute('opacity', seg(p, 0.07, 0.12) * 0.9);
    });
    oNode.val.textContent = f2(F.yhat);
    oNode.val.setAttribute('opacity', seg(p, 0.14, 0.19));
    oNode.ring.setAttribute('stroke', fwdX >= ON[0] ? PAL.act : PAL.mut);

    /* weight labels — amber, flashing green on the step they change */
    const wCol = fresh > 0.05 ? PAL.train : PAL.weight;
    wLab1.forEach((row, i) => row.forEach((t, j) => {
      t.textContent = `w⁽¹⁾${'₁₂'[i]}${'₁₂'[j]} = ${f2(P.W1[i][j])}`;
      t.setAttribute('fill', wCol);
    }));
    wLab2.forEach((t, i) => {
      t.textContent = `w⁽²⁾${'₁₂'[i]} = ${f2(P.W2[i])}`;
      t.setAttribute('fill', wCol);
    });

    cache.textContent = `cached for the backward pass:  x = ${vec2(F.x, f2)}   z⁽¹⁾ = ${vec2(F.z1, f2)}   a = ${vec2(F.a1, f2)}`;
    cache.setAttribute('opacity', seg(p, 0.15, 0.20));
    cache.setAttribute('fill', inBwd ? PAL.loss : PAL.act);

    /* BEAT 2 — the loss */
    target.setAttribute('opacity', seg(p, 0.21, 0.26));
    lossArrow.setAttribute('opacity', seg(p, 0.24, 0.28));
    lossBox.setAttribute('opacity', seg(p, 0.25, 0.31));
    lossVal.textContent = fLoss(F.loss);

    /* BEAT 3 — gradients at the nodes, and the five chain-rule lines */
    const gv = [G0.dx[0], G0.dx[1], G0.da1[0], G0.da1[1], G0.dz2];
    const gn = ['∂L/∂x₁', '∂L/∂x₂', '∂L/∂a₁', '∂L/∂a₂', '∂L/∂ŷ'];
    const gw = [[0.53, 0.58], [0.53, 0.58], [0.47, 0.52], [0.47, 0.52], [0.41, 0.46]];
    gLab.forEach((t, i) => {
      t.textContent = `${gn[i]} = ${f3(gv[i])}`;
      t.setAttribute('opacity', seg(p, gw[i][0], gw[i][1]) * (1 - seg(p, 0.76, 0.80)));
    });
    gradPanel.setAttribute('opacity', seg(p, 0.43, 0.48) * (1 - seg(p, 0.60, 0.64)));
    const gText = [
      ['∂L/∂ŷ = ŷ − y', f3(G0.dz2)],
      ['∂L/∂W⁽²⁾ = (∂L/∂z₂)·aᵀ', vec2(G0.dW2)],
      ['∂L/∂a = W⁽²⁾ᵀ(∂L/∂z₂)', vec2(G0.da1)],
      ['∂L/∂z⁽¹⁾ = ∂L/∂a ⊙ 1[z⁽¹⁾ > 0]', vec2(G0.dz1)],
      ['∂L/∂W⁽¹⁾ = (∂L/∂z⁽¹⁾)·xᵀ', `[${vec2(G0.dW1[0])}, ${vec2(G0.dW1[1])}]`],
    ];
    gRows.forEach(([lab, val], i) => {
      lab.textContent = gText[i][0]; val.textContent = `= ${gText[i][1]}`;
      const t = seg(p, 0.44 + i * 0.022, 0.49 + i * 0.022);
      lab.setAttribute('opacity', t); val.setAttribute('opacity', t);
    });

    /* BEAT 4 — the update, one line per parameter */
    updPanel.setAttribute('opacity', seg(p, 0.61, 0.66) * (1 - seg(p, 0.78, 0.82)));
    uTitle.textContent = `update — θ ← θ − η·∂L/∂θ, with η = ${f2(ETA)}`;
    const uText = [
      ['w⁽¹⁾₁₁', P0.W1[0][0], G0.dW1[0][0], traj[1].P.W1[0][0]],
      ['w⁽¹⁾₁₂', P0.W1[0][1], G0.dW1[0][1], traj[1].P.W1[0][1]],
      ['w⁽¹⁾₂₂', P0.W1[1][1], G0.dW1[1][1], traj[1].P.W1[1][1]],
      ['w⁽²⁾₁', P0.W2[0], G0.dW2[0], traj[1].P.W2[0]],
      ['b⁽²⁾', P0.b2, G0.db2, traj[1].P.b2],
    ];
    uRows.forEach(([lab, expr, res], i) => {
      const [n, old, g, nw] = uText[i];
      lab.textContent = n;
      expr.textContent = `${f3(old)} − ${f2(ETA)} × (${f3(g)})`;
      res.textContent = `= ${f3(nw)}`;
      const t = seg(p, 0.62 + i * 0.022, 0.67 + i * 0.022);
      lab.setAttribute('opacity', t); expr.setAttribute('opacity', t); res.setAttribute('opacity', t);
    });

    /* BEAT 5 — repeat; the loss curve fills in */
    curvePanel.setAttribute('opacity', seg(p, 0.80, 0.84));
    const px = (k) => lerp(CX0, CX1, k / (K - 1));
    const py = (l) => lerp(CY1, CY0, l / maxLoss);
    curveLine.setAttribute('points', traj.slice(0, vIdx + 1).map((e) => `${px(e.k)},${py(e.F.loss)}`).join(' '));
    curveDot.setAttribute('cx', px(vIdx)); curveDot.setAttribute('cy', py(F.loss));
    curveRead[0].textContent = `after ${vIdx} update${vIdx === 1 ? '' : 's'}`;
    curveRead[1].textContent = `ŷ = ${f3(F.yhat)}   (target ${f2(TARGET)})`;
    curveRead[2].textContent = `L = ${fLoss(F.loss)}`;
  };
}

export function sceneStep() {
  return createScene({
    id: 'learning-step',
    figure: stepFigure,
    steps: [
      { n: 'STEP 1 / 5 — FORWARD, AND CACHE', html: `<p>Two inputs, two ReLU hidden units, one linear output — eleven weights and biases in total. Push x = [1.00, 0.50] through: each hidden unit takes a dot product with its weight row, adds a bias, and clips negatives to zero. The output unit does the same and stops. The model predicts ŷ = 0.31.</p><p>Every intermediate value is <em>kept</em>: x, the pre-activations z⁽¹⁾, the activations a. The backward pass is about to need all of them.</p>` },
      { n: 'STEP 2 / 5 — THE LOSS', html: `<p>The label says the answer should have been 1.00. Squared error turns that disagreement into a single number, L = ½(ŷ − y)² = 0.238. One scalar — the entire training signal.</p><p>From here on, stop reading the diagram as a function of x. Freeze the data and read it as a function of the eleven weights. That function is what we are about to descend.</p>` },
      { n: 'STEP 3 / 5 — BACKWARD', html: `<p>Now walk backwards. Each node receives the gradient of L with respect to its own output and multiplies by its local derivative to produce the gradient with respect to its input. Nothing else happens — no search, no trial and error, five lines of arithmetic.</p><p>Notice ∂L/∂a = W⁽²⁾ᵀ(∂L/∂z₂). The small raised ᵀ means the same weight matrix with its rows and columns swapped — the same numbers, read the other way round. Those weights carried values forward; transposed, they carry the error signal one layer back. And ∂L/∂W⁽¹⁾ = (∂L/∂z⁽¹⁾)xᵀ uses the cached x. That is why the forward pass had to save it.</p>` },
      { n: 'STEP 4 / 5 — UPDATE', html: `<p>Every weight now has a partial derivative attached. Subtract η times it. w⁽¹⁾₁₁ had gradient −0.483 — negative, meaning L falls as that weight rises — so it increases, from 0.500 to 0.597. The green flash is every parameter moving at once, each by its own amount.</p>` },
      { n: 'STEP 5 / 5 — REPEAT', html: `<p>Run the same four beats again with the new weights. The prediction climbs 0.31 → 0.74 → 0.91 → 0.97, and the loss falls 0.238 → 0.034 → 0.004 → 0.0003. Nothing in the loop knew about the target except through that one scalar and its derivatives.</p><p>Scale this from eleven parameters to a trillion and the arithmetic does not change. Only the bookkeeping does.</p>` },
    ],
  });
}
