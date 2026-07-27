/* Gradient descent you can feel. A mildly ill-conditioned quadratic loss over
   two parameters; the trajectory is computed from the real gradient, so the
   crawl, the zigzag and the blow-up are all consequences of the arithmetic. */

import { el, svg, svgRoot, empty } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';

const KAPPA = 10;                       // curvature of the steep direction
const START = [-4.0, 1.5];
const DIVERGE = 2 / KAPPA;              // η at which this surface blows up
const RUN = 25;                         // steps a preset or the slider runs

const loss = (t) => 0.5 * (t[0] ** 2 + KAPPA * t[1] ** 2);
const grad = (t) => [t[0], KAPPA * t[1]];

/* plot frame */
const X0 = 360, Y0 = 165, SX = 60.4, SY = 60.9;
const px = (v) => X0 + v * SX;
const py = (v) => Y0 - v * SY;

export function descentWidget() {
  const W = 720, H = 340;
  let eta = 0.09;
  let path = [START];

  const clip = svg('clipPath', { id: 'gdclip' }, svg('rect', { x: 46, y: 34, width: 628, height: 262 }));
  const frame = svg('rect', { x: 46, y: 34, width: 628, height: 262, rx: 8, fill: 'none', stroke: PAL.grid, 'stroke-width': 1 });
  const contours = [0.25, 1, 2.5, 5, 9, 14, 20].map((c) => svg('ellipse', {
    cx: X0, cy: Y0, rx: Math.sqrt(2 * c) * SX, ry: Math.sqrt(2 * c / KAPPA) * SY,
    fill: 'none', stroke: PAL.loss, 'stroke-opacity': 0.34, 'stroke-width': 1,
  }));
  const axes = svg('g', {},
    svg('line', { x1: 46, y1: Y0, x2: 674, y2: Y0, stroke: PAL.grid, 'stroke-width': 1 }),
    svg('line', { x1: X0, y1: 34, x2: X0, y2: 296, stroke: PAL.grid, 'stroke-width': 1 }));
  const minimum = svg('g', {},
    svg('path', { d: `M ${X0 - 6} ${Y0} L ${X0 + 6} ${Y0} M ${X0} ${Y0 - 6} L ${X0} ${Y0 + 6}`, stroke: PAL.train, 'stroke-width': 1.6 }),
    txt(X0 + 10, Y0 + 16, 'θ* — the minimum', { size: 10, fill: PAL.train }));

  const trail = svg('polyline', { points: '', fill: 'none', stroke: PAL.train, 'stroke-width': 1.6, 'stroke-opacity': 0.85, 'stroke-linejoin': 'round' });
  const dots = svg('g', {});
  const head = svg('circle', { cx: px(START[0]), cy: py(START[1]), r: 5, fill: PAL.train });
  const arrow = svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: PAL.loss, 'stroke-width': 1.8, 'marker-end': 'url(#arrGD)', opacity: 0 });
  const arrowTag = txt(0, 0, '−η∇L', { size: 10.5, fill: PAL.loss, mono: true, opacity: 0 });
  const plot = svg('g', { 'clip-path': 'url(#gdclip)' }, contours, axes, minimum, trail, dots, arrow, arrowTag, head);

  const rule = txt(46, 318, '', { size: 11, anchor: 'start', mono: true, fill: PAL.tx });
  const status = txt(674, 318, '', { size: 11, anchor: 'end', fill: PAL.tx });

  const defs = svg('defs', {}, clip,
    svg('marker', { id: 'arrGD', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.loss })));

  const node = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Contour map of a loss surface over two parameters, stretched ten to one. A green trajectory descends from the upper left; at a small learning rate it crawls, at a moderate one it slides down the valley, at a large one it zigzags across the valley, and above the stability threshold it spirals outward off the plot.',
  }, defs, frame,
    txt(46, 24, `L(θ) = ½(θ₁² + ${KAPPA}θ₂²)   —   ten times steeper in θ₂ than in θ₁`, { size: 11, fill: PAL.tx }),
    txt(674, 24, '∇L = (θ₁, 10θ₂)', { size: 11, fill: PAL.loss, anchor: 'end', mono: true }),
    plot, rule, status);

  /* ---- controls ---- */
  const etaOut = el('span', { class: 'sl-v' }, eta.toFixed(3));
  const slider = el('input', {
    type: 'range', min: '0.005', max: '0.25', step: '0.005', value: String(eta),
    'aria-label': 'learning rate eta',
  });
  const cells = {
    eta: el('div', { class: 'sg-v hi' }, ''), n: el('div', { class: 'sg-v' }, ''),
    L: el('div', { class: 'sg-v' }, ''), g: el('div', { class: 'sg-v' }, ''),
  };
  const stats = el('div', { class: 'stat-grid' },
    el('div', { class: 'sg-cell' }, cells.eta, el('div', { class: 'sg-k' }, 'learning rate')),
    el('div', { class: 'sg-cell' }, cells.n, el('div', { class: 'sg-k' }, 'steps taken')),
    el('div', { class: 'sg-cell' }, cells.L, el('div', { class: 'sg-k' }, 'loss at the current point')),
    el('div', { class: 'sg-cell' }, cells.g, el('div', { class: 'sg-k' }, 'gradient magnitude')));

  function advance(n) {
    for (let i = 0; i < n; i++) {
      const t = path[path.length - 1];
      if (!Number.isFinite(t[0]) || Math.abs(t[0]) > 1e8 || Math.abs(t[1]) > 1e8) break;
      const g = grad(t);
      path.push([t[0] - eta * g[0], t[1] - eta * g[1]]);
    }
  }
  const restart = (n) => { path = [START]; advance(n); draw(); };

  function draw() {
    const cur = path[path.length - 1];
    const g = grad(cur);
    const gn = Math.hypot(g[0], g[1]);
    const blown = !Number.isFinite(cur[0]) || Math.abs(cur[1]) > 1e6;

    trail.setAttribute('points', path.map((t) => `${px(t[0])},${py(t[1])}`).join(' '));
    empty(dots);
    path.slice(0, -1).forEach((t) => dots.append(svg('circle', {
      cx: px(t[0]), cy: py(t[1]), r: 2.4, fill: PAL.train, 'fill-opacity': 0.55,
    })));
    head.setAttribute('cx', px(cur[0]));
    head.setAttribute('cy', py(cur[1]));

    const show = !blown && gn > 1e-3;
    arrow.setAttribute('opacity', show ? 1 : 0);
    arrowTag.setAttribute('opacity', show ? 1 : 0);
    if (show) {
      const nx = px(cur[0] - eta * g[0]), ny = py(cur[1] - eta * g[1]);
      arrow.setAttribute('x1', px(cur[0])); arrow.setAttribute('y1', py(cur[1]));
      arrow.setAttribute('x2', nx); arrow.setAttribute('y2', ny);
      arrowTag.setAttribute('x', (px(cur[0]) + nx) / 2 + 8);
      arrowTag.setAttribute('y', (py(cur[1]) + ny) / 2 - 6);
    }

    rule.textContent = `θ₁ ← θ₁ − ${eta.toFixed(3)}·θ₁    θ₂ ← θ₂ − ${eta.toFixed(3)}·${KAPPA}θ₂`;
    status.textContent = eta >= DIVERGE
      ? `η ≥ 2/${KAPPA} — every step overshoots further than the last`
      : eta > 1 / KAPPA ? 'overshoots θ₂ and crosses the valley — but the crossings shrink'
        : eta < 0.03 ? 'stable, and painfully slow along the shallow direction'
          : 'down the steep wall, then along the shallow floor';
    status.setAttribute('fill', eta >= DIVERGE ? PAL.loss : PAL.tx);

    cells.eta.textContent = eta.toFixed(3);
    cells.n.textContent = String(path.length - 1);
    cells.L.textContent = blown ? 'overflow' : loss(cur).toExponential(2);
    cells.g.textContent = blown ? 'overflow' : gn.toExponential(2);
    etaOut.textContent = eta.toFixed(3);
  }

  slider.addEventListener('input', () => { eta = +slider.value; restart(RUN); });

  const presets = [[0.02, 'crawling'], [0.09, 'brisk'], [0.17, 'zigzag'], [0.21, 'divergence']]
    .map(([v, lab]) => el('button', {
      class: 'tok',
      onclick: () => { eta = v; slider.value = String(v); restart(RUN); },
    }, `η = ${v.toFixed(2)} · ${lab}`));

  const controls = [
    el('button', { class: 'tok', onclick: () => { advance(1); draw(); } }, 'step ×1'),
    el('button', { class: 'tok', onclick: () => { advance(10); draw(); } }, 'step ×10'),
    el('button', { class: 'tok', onclick: () => restart(0) }, 'reset'),
  ];

  restart(RUN);

  return el('div', {},
    el('div', { class: 'tokens', style: { marginBottom: '0.6rem' } }, presets),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'learning rate η'), slider, etaOut),
    el('div', { class: 'tokens', style: { margin: '0.7rem 0' } }, controls),
    node, stats,
    el('div', { class: 'w-note' },
      `This surface bends ${KAPPA} times more sharply along θ₂ than along θ₁ — curvatures of ${KAPPA} and 1. Here is what that buys and costs. Along a direction bending at rate c, one step of size η leaves you 1 − ηc as far from the bottom as you were. If ηc is under 1 you land nearer on the same side. Between 1 and 2 you cross over and land on the far side, but nearer than you started — that is the zigzag. At exactly 2 you land as far out as you began on the other side, bouncing between the same two points forever without ever getting closer, and past 2 you land further out every step. So the sharpest direction sets the ceiling: η under 2/${KAPPA} = ${DIVERGE.toFixed(2)}, and the shallowest, left with the same η, then creeps in ${KAPPA} times slower. That gap is the whole difficulty of choosing η, and real loss surfaces have bending rates that differ by factors in the millions.`));
}
