/* Steerable two-neuron network. Six sliders set the hidden layer; the forward
   pass runs live on a 40 × 40 grid and the resulting score field is painted,
   with the zero contour drawn on top. The σ toggle removes the nonlinearity
   and nothing else — the field flattens into a straight ramp because the
   composition of two affine maps is affine, not because anything was faked. */

import { el, svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { sigmoid, xorData, frame, zeroContour, clipLine, tally, hexMix, CLS, DOM } from './net.js';

const PTS = xorData();
const OUT = { v1: 8, v2: -8, c: -3.6 };   // the output unit, held fixed

const PRESETS = {
  solved:  { w1x: 5, w1y: 6, b1: 3.3, w2x: 6, w2y: 5, b2: -3.3 },
  oneLine: { w1x: -4, w1y: -4, b1: 2.8, w2x: 0, w2y: 0, b2: -8 },
  random:  { w1x: 2.6, w1y: -7.4, b1: 1.2, w2x: -5.8, w2y: 1.4, b2: -2.6 },
};

export function boundaryWidget() {
  const S = { ...PRESETS.solved, on: true };
  const P = 300, N = 40;
  const fr = frame(12, 12, P);
  const cw = P / N;

  const act = (u) => (S.on ? sigmoid(u) : u);
  const score = (x, y) => OUT.v1 * act(S.w1x * x + S.w1y * y + S.b1)
                        + OUT.v2 * act(S.w2x * x + S.w2y * y + S.b2) + OUT.c;

  /* ---- the painted field ------------------------------------------------ */
  const cells = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      cells.push({
        x: -DOM + ((i + 0.5) / N) * 2 * DOM,
        y: DOM - ((j + 0.5) / N) * 2 * DOM,
        r: svg('rect', { x: 12 + i * cw, y: 12 + j * cw, width: cw + 0.6, height: cw + 0.6, fill: PAL.bg }),
      });
    }
  }

  const planes = [0, 1].map(() => svg('line', {
    x1: 0, y1: 0, x2: 0, y2: 0, stroke: PAL.weight, 'stroke-width': 1.5,
    'stroke-dasharray': '5 4', opacity: 0,
  }));
  const bound = svg('path', { d: '', stroke: PAL.ink, 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round' });
  const dots = PTS.map((p) => svg('circle', {
    cx: fr.sx(p.x), cy: fr.sy(p.y), r: 4.2, fill: CLS[p.c], stroke: PAL.bg, 'stroke-width': 1,
  }));
  const rings = PTS.map((p) => svg('circle', {
    cx: fr.sx(p.x), cy: fr.sy(p.y), r: 7.5, fill: 'none', stroke: PAL.loss, 'stroke-width': 1.4, opacity: 0,
  }));
  const caption = txt(12, P + 32, '', { size: 11, fill: PAL.tx });

  const plot = svgRoot(P + 24, P + 44, {
    role: 'img', style: 'max-width:100%',
    'aria-label': 'A live score field for a two-input, two-hidden-neuron network over the same four blobs of data, with each hidden neuron’s hyperplane drawn in amber and the decision boundary in white; the field is curved while the nonlinearity is on and becomes a straight ramp when it is switched off.',
  }, cells.map((c) => c.r), planes, bound, rings, dots,
    svg('rect', { x: 12, y: 12, width: P, height: P, fill: 'none', stroke: PAL.grid, 'stroke-width': 1 }),
    caption);

  /* ---- controls --------------------------------------------------------- */
  const SLIDERS = [
    ['w1x', 'neuron 1 · weight on x₁', -10, 10, 0.2],
    ['w1y', 'neuron 1 · weight on x₂', -10, 10, 0.2],
    ['b1', 'neuron 1 · bias b₁', -8, 8, 0.1],
    ['w2x', 'neuron 2 · weight on x₁', -10, 10, 0.2],
    ['w2y', 'neuron 2 · weight on x₂', -10, 10, 0.2],
    ['b2', 'neuron 2 · bias b₂', -8, 8, 0.1],
  ];
  const rows = SLIDERS.map(([k, label, lo, hi, st]) => {
    const val = el('span', { class: 'sl-v' }, '');
    const input = el('input', {
      type: 'range', min: String(lo), max: String(hi), step: String(st),
      value: String(S[k]), 'aria-label': label,
    });
    input.addEventListener('input', () => { S[k] = +input.value; update(); });
    return { k, input, val, node: el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, label), input, val) };
  });

  const toggle = el('button', { class: 'tok sel' }, 'nonlinearity σ: on');
  toggle.addEventListener('click', () => { S.on = !S.on; update(); });

  const presetBtns = [
    ['solved', 'solved · two lines'],
    ['oneLine', 'one neuron only'],
    ['random', 'arbitrary weights'],
  ].map(([key, label]) => {
    const b = el('button', { class: 'tok' }, label);
    b.addEventListener('click', () => {
      Object.assign(S, PRESETS[key]);
      rows.forEach((r) => { r.input.value = String(S[r.k]); });
      update();
    });
    return b;
  });

  const cells4 = {
    acc: el('div', { class: 'sg-v hi' }, ''),
    wrong: el('div', { class: 'sg-v' }, ''),
    sig: el('div', { class: 'sg-v' }, ''),
    shape: el('div', { class: 'sg-v' }, ''),
  };
  const stats = el('div', { class: 'stat-grid' },
    el('div', { class: 'sg-cell' }, cells4.acc, el('div', { class: 'sg-k' }, 'accuracy')),
    el('div', { class: 'sg-cell' }, cells4.wrong, el('div', { class: 'sg-k' }, 'points wrong')),
    el('div', { class: 'sg-cell' }, cells4.sig, el('div', { class: 'sg-k' }, 'hidden activation')),
    el('div', { class: 'sg-cell' }, cells4.shape, el('div', { class: 'sg-k' }, 'boundary')));

  const note = el('div', { class: 'w-note' },
    'The output unit is held fixed at z = 8·h₁ − 8·h₂ − 3.6, so the only thing you are steering is where the two amber lines sit. With σ on, the network can cut a band out of the plane and reach 100%. Switch σ off and the field becomes a straight ramp no matter what you do — for the solved weights the single remaining boundary is pushed clean out of the frame, so everything scores as one class; raise b₂ until it slides back into view and watch it stay stubbornly straight.');

  /* ---- redraw ----------------------------------------------------------- */
  function update() {
    // Hue carries the sign of the score (which class), brightness carries its
    // magnitude, rescaled to whatever range the frame happens to contain — so
    // the shape of the level sets is legible even when the boundary is not.
    const zs = cells.map((c) => score(c.x, c.y));
    const mags = zs.map(Math.abs);
    const aLo = Math.min(...mags), aHi = Math.max(...mags), span = aHi - aLo || 1;
    cells.forEach((c, i) => {
      const hue = zs[i] > 0 ? CLS[1] : CLS[0];
      c.r.setAttribute('fill', hexMix(PAL.bg, hue, 0.12 + 0.4 * ((mags[i] - aLo) / span)));
    });

    [[S.w1x, S.w1y, S.b1], [S.w2x, S.w2y, S.b2]].forEach(([a, b, c], i) => {
      const L = clipLine(a, b, c, fr);
      planes[i].setAttribute('opacity', L ? 0.9 : 0);
      if (L) {
        planes[i].setAttribute('x1', L.x1); planes[i].setAttribute('y1', L.y1);
        planes[i].setAttribute('x2', L.x2); planes[i].setAttribute('y2', L.y2);
      }
    });

    const d = zeroContour(score, fr, 64);
    bound.setAttribute('d', d);

    const t = tally(PTS, score);
    rings.forEach((r, i) => r.setAttribute('opacity', t.wrong[i] ? 0.95 : 0));
    rows.forEach((r) => { r.val.textContent = S[r.k].toFixed(1); });

    cells4.acc.textContent = Math.round(t.acc * 100) + '%';
    cells4.wrong.textContent = `${PTS.length - t.ok} / ${PTS.length}`;
    cells4.sig.textContent = S.on ? 'σ' : 'identity';
    cells4.shape.textContent = S.on ? (d ? 'curved' : 'none in frame') : (d ? 'straight line' : 'none in frame');
    toggle.textContent = `nonlinearity σ: ${S.on ? 'on' : 'off'}`;
    toggle.classList.toggle('sel', S.on);
    caption.textContent = S.on
      ? 'score field — the contours of equal score bend around the data'
      : 'score field — the contours are parallel straight lines, always';
  }

  update();

  return el('div', {},
    el('div', { class: 'tokens', style: { marginBottom: '0.7rem' } }, toggle, presetBtns),
    el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '1.2rem', alignItems: 'flex-start' } },
      el('div', { style: { flex: '0 1 340px', minWidth: '0' } }, plot),
      el('div', { style: { flex: '1 1 300px', minWidth: '0' } }, rows.map((r) => r.node), stats)),
    note);
}
