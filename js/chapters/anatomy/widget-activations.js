/* Widget — activation explorer: the three curves, and gating as a soft switch.
   Panel 1 plots ReLU / GELU / SiLU; panel 2 is a live gated product, so the
   reader can drag the gate shut and watch the up-path value die. Both panels
   compute real values — no illustrative numbers anywhere. */

import { el, svg, svgRoot } from '../../core/dom.js';
import { widget, txt, claimFig, PAL } from '../../core/components.js';
import { clamp } from '../../core/anim.js';

function activationBody() {
  const relu = (x) => Math.max(0, x);
  const silu = (x) => x / (1 + Math.exp(-x));
  const gelu = (x) => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
  const ACTS = [
    { name: 'ReLU', fn: relu, eq: 'ReLU(x) = max(0, x)', note: 'hard switch — gradient exactly 0 below zero' },
    { name: 'GELU', fn: gelu, eq: 'GELU(x) ≈ 0.5x·(1+tanh(√(2/π)(x+0.0447x³)))', note: 'smooth ReLU — the GPT-era default' },
    { name: 'SiLU', fn: silu, eq: 'SiLU(x) = x·σ(x)', note: 'sigmoid-weighted input — what modern gates use' },
  ];
  let sel = 2;

  /* -- panel 1: the curves -- */
  const PW = 352, PH = 264;
  const X0 = 36, X1 = 336, Y0 = 232, Y1 = 22;      // plot box in px
  const xmin = -4, xmax = 4, ymin = -1.5, ymax = 4;
  const px = (x) => X0 + (x - xmin) / (xmax - xmin) * (X1 - X0);
  const py = (y) => Y0 - (y - ymin) / (ymax - ymin) * (Y0 - Y1);
  const pts = (fn) => {
    const out = [];
    for (let x = xmin; x <= xmax + 1e-9; x += 0.08) out.push(`${px(x).toFixed(1)},${py(clamp(fn(x), ymin, ymax)).toFixed(1)}`);
    return out.join(' ');
  };
  const grid = [
    svg('line', { x1: X0, y1: py(0), x2: X1, y2: py(0), stroke: 'rgba(230,237,243,0.18)', 'stroke-width': 1 }),
    svg('line', { x1: px(0), y1: Y1, x2: px(0), y2: Y0, stroke: 'rgba(230,237,243,0.18)', 'stroke-width': 1 }),
    [1, 2, 3].map((v) => svg('line', { x1: X0, y1: py(v), x2: X1, y2: py(v), stroke: PAL.grid })),
    [-4, -2, 2, 4].map((v) => txt(px(v), py(0) + 14, String(v), { size: 10, anchor: 'middle', mono: true })),
    [1, 2, 3].map((v) => txt(px(0) - 6, py(v) + 4, String(v), { size: 10, anchor: 'end', mono: true })),
  ];
  const curves = ACTS.map((a) => svg('polyline', { points: pts(a.fn), fill: 'none', stroke: PAL.mut, 'stroke-width': 1.2, opacity: 0.4 }));
  const eqText = txt(PW / 2, 248, '', { size: 10, fill: PAL.tx, anchor: 'middle', mono: true });
  const noteText = txt(PW / 2, 261, '', { size: 9.5, anchor: 'middle' });
  const curvePanel = svgRoot(PW, PH, {
    role: 'img', style: 'max-width:100%',
    'aria-label': 'Plot of the ReLU, GELU, and SiLU activation curves over the range minus four to four; the selected curve is highlighted in cyan.',
  }, grid, curves, eqText, noteText);

  /* -- panel 2: the gated product -- */
  let g = 1.5, u = 2.0;
  const GX0 = 40, GX1 = 320;
  const gaugeX = (v, lo, hi) => GX0 + (v - lo) / (hi - lo) * (GX1 - GX0);
  const mkGauge = (y, lo, hi, color, title) => {
    const zero = gaugeX(0, lo, hi);
    return {
      lo, hi, zero,
      title: txt(GX0, y - 12, title, { size: 10.5, fill: PAL.tx }),
      trackLine: svg('line', { x1: GX0, y1: y + 6, x2: GX1, y2: y + 6, stroke: 'rgba(230,237,243,0.14)', 'stroke-width': 1 }),
      zeroTick: svg('line', { x1: zero, y1: y - 2, x2: zero, y2: y + 14, stroke: 'rgba(230,237,243,0.3)', 'stroke-width': 1 }),
      bar: svg('rect', { x: zero, y, width: 0, height: 12, rx: 3, fill: color, opacity: 0.9 }),
      val: txt(GX1 + 24, y + 10, '', { size: 11, fill: color, anchor: 'end', mono: true }),
    };
  };
  const gGate = mkGauge(64, -0.5, 4, PAL.moe, 'SiLU(g) — how open the gate is');
  const gUp = mkGauge(128, -3, 3, PAL.act, 'u — the up-path candidate value');
  const gOut = mkGauge(192, -12, 12, PAL.ink, 'out = SiLU(g) · u');
  const gauges = [gGate, gUp, gOut];
  const dotG = svg('text', { x: PW / 2, y: 166, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 13 }, '⊙');
  const gateNote = txt(PW / 2, 240, '', { size: 10.5, anchor: 'middle' });
  const gatePanel = svgRoot(PW, PH, {
    role: 'img', style: 'max-width:100%',
    'aria-label': 'Three live gauges showing the gate openness SiLU of g, the up-path value u, and their elementwise product, updating as the two sliders move.',
  }, gauges.map((G) => [G.title, G.trackLine, G.zeroTick, G.bar, G.val]), dotG, gateNote);

  /* -- controls + readouts -- */
  const btns = ACTS.map((a, i) => el('button', {
    class: 'tok' + (i === sel ? ' sel' : ''),
    onclick: () => { sel = i; update(); },
  }, a.name));
  const gVal = el('span', { class: 'sl-v' }, '');
  const uVal = el('span', { class: 'sl-v' }, '');
  const gSlider = el('input', { type: 'range', min: '-4', max: '4', step: '0.1', value: String(g), 'aria-label': 'gate-path pre-activation g' });
  const uSlider = el('input', { type: 'range', min: '-3', max: '3', step: '0.1', value: String(u), 'aria-label': 'up-path pre-activation u' });
  const cells = {
    gate: el('div', { class: 'sg-v' }, ''), up: el('div', { class: 'sg-v' }, ''),
    out: el('div', { class: 'sg-v hi' }, ''), state: el('div', { class: 'sg-v' }, ''),
  };
  const statGrid = el('div', { class: 'stat-grid' },
    el('div', { class: 'sg-cell' }, cells.gate, el('div', { class: 'sg-k' }, 'SiLU(g)')),
    el('div', { class: 'sg-cell' }, cells.up, el('div', { class: 'sg-k' }, 'u')),
    el('div', { class: 'sg-cell' }, cells.out, el('div', { class: 'sg-k' }, 'SiLU(g) · u')),
    el('div', { class: 'sg-cell' }, cells.state, el('div', { class: 'sg-k' }, 'gate state')));
  const note = el('div', { class: 'w-note' },
    'Drag g below −2: the output dies no matter how large u is. Drag g above +2: u passes through, scaled ≈ g. In a SwiGLU block this switch exists independently for every one of the hidden dimensions — the gate path computes d_ff of these g values per token.');

  function update() {
    btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
    curves.forEach((c, i) => {
      c.setAttribute('stroke', i === sel ? PAL.act : PAL.mut);
      c.setAttribute('stroke-width', i === sel ? 2.4 : 1.2);
      c.setAttribute('opacity', i === sel ? 1 : 0.4);
    });
    eqText.textContent = ACTS[sel].eq;
    noteText.textContent = ACTS[sel].note;
    const sg = silu(g), out = sg * u;
    [[gGate, sg], [gUp, u], [gOut, out]].forEach(([G, v]) => {
      const vx = gaugeX(clamp(v, G.lo, G.hi), G.lo, G.hi);
      G.bar.setAttribute('x', Math.min(G.zero, vx));
      G.bar.setAttribute('width', Math.abs(vx - G.zero));
      G.val.textContent = v.toFixed(2);
    });
    gateNote.textContent = g < -2 ? 'gate ≈ closed — u is muted' : g > 2 ? 'gate ≈ open — u passes, scaled by ≈ g' : 'soft region — partial pass-through';
    cells.gate.textContent = sg.toFixed(3);
    cells.up.textContent = u.toFixed(2);
    cells.out.textContent = out.toFixed(3);
    cells.state.textContent = g < -2 ? 'closed' : g > 2 ? 'open' : 'soft';
    gVal.textContent = g.toFixed(1);
    uVal.textContent = u.toFixed(1);
  }
  gSlider.addEventListener('input', () => { g = +gSlider.value; update(); });
  uSlider.addEventListener('input', () => { u = +uSlider.value; update(); });
  update();

  return el('div', {},
    el('div', { class: 'tokens', style: { marginBottom: '0.8rem' } }, btns),
    el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' } },
      el('div', { style: { flex: '1 1 300px', minWidth: '0' } }, curvePanel),
      el('div', { style: { flex: '1 1 300px', minWidth: '0' } }, gatePanel)),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'gate-path pre-activation g'), gSlider, gVal),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'up-path pre-activation u'), uSlider, uVal),
    statGrid, note);
}

export function activationWidget() {
  claimFig('activations');
  return widget('activation explorer', 'switch curves · drag the gate', activationBody());
}
