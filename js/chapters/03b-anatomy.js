/* Chapter 03B — inside the layer: the component catalog.
   Chapter 03 followed one token's vector through a layer; this chapter opens
   the hood on every small design decision inside that layer. Sticky scene:
   the pre/post-norm gradient-flow story. Widget: activation explorer with a
   live gated-product panel. Two tracked figures: what got deleted 2017→2026,
   and the block 2017 vs 2026 with the changed parts lighting up. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, figure, widget, takeaway, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { track } from '../core/scroll.js';
import { seg, lerp, ease, clamp } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

const BP = K3.blueprint; // illustrative K2 dims: 61 layers, d 7168, 64 heads × 128

const txt = (x, y, s, { size = 11, fill = PAL.mut, anchor = 'start', mono = false, opacity } = {}) =>
  svg('text', {
    x, y, fill, 'text-anchor': anchor, 'font-size': size,
    'font-family': mono ? 'monospace' : 'sans-serif',
    ...(opacity != null ? { opacity } : {}),
  }, s);

/* ===========================================================================
   Scene figure — where the norm goes: post-norm vs pre-norm gradient flow
   =========================================================================== */

function normSceneFigure(canvas) {
  const W = 720, H = 460;
  const CX1 = 148, CX2 = 392;            // post-norm stack, pre-norm stack
  const BY = (i) => 76 + i * 84;         // block tops, i = 0..3
  const SUBNAMES = ['attn', 'MLP', 'attn', 'MLP'];
  const TOPY = 54, BOTY = 408;
  const ATT = 0.75;                      // schematic attenuation per on-path norm

  const defs = svg('defs', {},
    svg('marker', { id: 'ch3b-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  /* ---- post-norm stack (left): norm sits ON the residual path ---- */

  const postParts = [];
  const postLine = svg('line', { x1: CX1, y1: TOPY, x2: CX1, y2: BOTY, stroke: PAL.act, 'stroke-width': 1.6, opacity: 0.85 });
  postParts.push(postLine);
  const postChipYs = [];
  for (let i = 0; i < 4; i++) {
    const y = BY(i);
    postChipYs.push(y + 17);
    postParts.push(
      // norm chip ON the main path
      svg('rect', { x: CX1 - 27, y: y + 8, width: 54, height: 18, rx: 5, fill: '#182029', stroke: PAL.mut, 'stroke-width': 1 }),
      txt(CX1, y + 21, 'LN', { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }),
      // "+" node
      svg('circle', { cx: CX1, cy: y + 42, r: 8, fill: '#182029', stroke: PAL.act, 'stroke-width': 1.3 }),
      txt(CX1, y + 46, '+', { size: 12, fill: PAL.act, anchor: 'middle', mono: true }),
      // sublayer branch
      svg('rect', { x: CX1 + 26, y: y + 30, width: 62, height: 24, rx: 7, fill: 'rgba(90,200,220,0.06)', stroke: PAL.mut, 'stroke-width': 1 }),
      txt(CX1 + 57, y + 46, SUBNAMES[i], { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }),
      svg('path', { d: `M ${CX1} ${y + 68} L ${CX1 + 52} ${y + 54}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none' }),
      svg('path', { d: `M ${CX1 + 26} ${y + 42} L ${CX1 + 11} ${y + 42}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none', 'marker-end': 'url(#ch3b-arr)' }));
  }
  const postTitle = txt(CX1, 20, 'post-norm · 2017', { size: 11.5, fill: PAL.tx, anchor: 'middle' });
  const postLoss = svg('g', {},
    svg('rect', { x: CX1 - 28, y: 28, width: 56, height: 22, rx: 6, fill: 'rgba(240,120,80,0.10)', stroke: PAL.loss, 'stroke-width': 1.2 }),
    txt(CX1, 43, 'loss', { size: 11, fill: PAL.loss, anchor: 'middle', mono: true }));
  const postNote = svg('text', {
    x: 20, y: 240, fill: PAL.loss, 'font-size': 10.5, 'font-family': 'sans-serif',
    'text-anchor': 'middle', transform: 'rotate(-90, 20, 240)', opacity: 0,
  }, 'gradient re-scaled by every on-path norm');
  const gPost = svg('g', {}, postParts, postLoss, postNote);

  /* ---- pre-norm stack (right): norm inside the branch, identity clean ---- */

  const preParts = [], preChipLN = [], preChipRMS = [], qkChips = [];
  const preLine = svg('line', { x1: CX2, y1: TOPY, x2: CX2, y2: BOTY, stroke: PAL.act, 'stroke-width': 1.6, opacity: 0.85 });
  const idHighlight = svg('line', { x1: CX2, y1: TOPY, x2: CX2, y2: BOTY, stroke: PAL.act, 'stroke-width': 4, opacity: 0, 'stroke-linecap': 'round' });
  preParts.push(idHighlight, preLine);
  for (let i = 0; i < 4; i++) {
    const y = BY(i);
    const ln = txt(CX2 + 44, y + 49, 'LN', { size: 11, fill: PAL.tx, anchor: 'middle', mono: true });
    const rms = txt(CX2 + 44, y + 49, 'RMS', { size: 10, fill: PAL.act, anchor: 'middle', mono: true, opacity: 0 });
    preChipLN.push(ln); preChipRMS.push(rms);
    preParts.push(
      svg('circle', { cx: CX2, cy: y + 16, r: 8, fill: '#182029', stroke: PAL.act, 'stroke-width': 1.3 }),
      txt(CX2, y + 20, '+', { size: 12, fill: PAL.act, anchor: 'middle', mono: true }),
      // norm chip on the BRANCH
      svg('rect', { x: CX2 + 20, y: y + 36, width: 48, height: 18, rx: 5, fill: '#182029', stroke: PAL.mut, 'stroke-width': 1 }),
      ln, rms,
      // sublayer box
      svg('rect', { x: CX2 + 76, y: y + 30, width: 58, height: 24, rx: 7, fill: 'rgba(90,200,220,0.06)', stroke: PAL.mut, 'stroke-width': 1 }),
      txt(CX2 + 105, y + 46, SUBNAMES[i], { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }),
      svg('path', { d: `M ${CX2} ${y + 62} L ${CX2 + 38} ${y + 54}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none' }),
      svg('path', { d: `M ${CX2 + 68} ${y + 45} L ${CX2 + 76} ${y + 43}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none' }),
      svg('path', { d: `M ${CX2 + 105} ${y + 30} C ${CX2 + 105} ${y + 16}, ${CX2 + 44} ${y + 16}, ${CX2 + 11} ${y + 16}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none', 'marker-end': 'url(#ch3b-arr)' }));
    if (SUBNAMES[i] === 'attn') {
      const qk = svg('g', { opacity: 0 },
        svg('rect', { x: CX2 + 108, y: y + 22, width: 30, height: 15, rx: 4, fill: 'rgba(180,140,224,0.16)', stroke: PAL.attn, 'stroke-width': 1 }),
        txt(CX2 + 123, y + 33, 'qk', { size: 9.5, fill: PAL.attn, anchor: 'middle', mono: true }));
      qkChips.push(qk); preParts.push(qk);
    }
  }
  const preTitle = txt(CX2, 20, 'pre-norm · 2019 →', { size: 11.5, fill: PAL.tx, anchor: 'middle', opacity: 0 });
  const preLoss = svg('g', {},
    svg('rect', { x: CX2 - 28, y: 28, width: 56, height: 22, rx: 6, fill: 'rgba(240,120,80,0.10)', stroke: PAL.loss, 'stroke-width': 1.2 }),
    txt(CX2, 43, 'loss', { size: 11, fill: PAL.loss, anchor: 'middle', mono: true }));
  const idLabel = txt(CX2 - 14, 398, 'identity path — untouched', { size: 10.5, fill: PAL.act, anchor: 'end', opacity: 0 });
  const gPre = svg('g', { opacity: 0 }, preParts, preLoss, preTitle, idLabel);

  /* ---- gradient pulses + magnitude bars ---- */

  const pulseL = svg('circle', { cx: CX1, cy: TOPY, r: 7, fill: PAL.loss, opacity: 0 });
  const pulseR = svg('circle', { cx: CX2, cy: TOPY, r: 7, fill: PAL.loss, opacity: 0 });
  const magFinal = Math.pow(ATT, 4);
  const mkBar = (cx) => ({
    track: svg('rect', { x: cx - 45, y: 424, width: 90, height: 7, rx: 3, fill: 'rgba(230,237,243,0.08)', opacity: 0 }),
    fill: svg('rect', { x: cx - 45, y: 424, width: 0, height: 7, rx: 3, fill: PAL.loss, opacity: 0 }),
    label: txt(cx, 446, '', { size: 10.5, anchor: 'middle', mono: true, opacity: 0 }),
  });
  const barL = mkBar(CX1), barR = mkBar(CX2);
  barL.label.textContent = `‖∇‖ at the bottom ≈ ${magFinal.toFixed(2)}×`;
  barR.label.textContent = '‖∇‖ at the bottom ≈ 1×';

  /* ---- right info column: RMSNorm card + refinements card ---- */

  const cardA = svg('g', { opacity: 0 },
    txt(546, 96, 'the simplification', { size: 10.5, fill: PAL.act }),
    txt(546, 118, 'RMSNorm(x) =', { size: 11.5, fill: PAL.ink, mono: true }),
    txt(546, 136, 'x/√(mean(x²)+ε) ⊙ g', { size: 11.5, fill: PAL.ink, mono: true }),
    txt(546, 162, 'mean-centering  μ', { size: 11, fill: PAL.mut, mono: true }),
    svg('line', { x1: 544, y1: 158, x2: 668, y2: 158, stroke: PAL.loss, 'stroke-width': 1.4 }),
    txt(546, 182, 'learned bias  β', { size: 11, fill: PAL.mut, mono: true }),
    svg('line', { x1: 544, y1: 178, x2: 648, y2: 178, stroke: PAL.loss, 'stroke-width': 1.4 }),
    txt(546, 204, 'one reduction, one gain —', { size: 10.5 }),
    txt(546, 219, 'same loss, less traffic', { size: 10.5 }));

  const cardB = svg('g', { opacity: 0 },
    txt(546, 262, 'later refinements', { size: 10.5, fill: PAL.attn }),
    txt(546, 284, 'QK-norm:', { size: 11.5, fill: PAL.ink, mono: true }),
    txt(546, 300, 'RMSNorm(q), RMSNorm(k)', { size: 11, fill: PAL.tx, mono: true }),
    txt(546, 316, '→ attention logits bounded,', { size: 10.5 }),
    txt(546, 330, 'no more loss spikes from q·k', { size: 10.5 }),
    txt(546, 356, 'sandwich / peri-norm:', { size: 11.5, fill: PAL.ink, mono: true }),
    txt(546, 372, 'norm into AND out of each', { size: 10.5 }),
    txt(546, 386, 'sublayer (Gemma-2 lineage)', { size: 10.5 }));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Two four-block transformer stacks side by side. In the post-norm stack, the norm sits on the residual path after every addition, and a red gradient pulse flowing down from the loss shrinks each time it crosses a norm. In the pre-norm stack, the norm sits inside each sublayer branch, the identity path is a clean straight line, and the gradient pulse reaches the bottom at full strength. Side cards show RMSNorm deleting mean-centering and bias, then QK-norm and sandwich-norm refinements.',
  }, defs, gPost, gPre, pulseL, pulseR,
    barL.track, barL.fill, barL.label, barR.track, barR.fill, barR.label,
    postTitle, cardA, cardB));

  const postMagAt = (y) => Math.pow(ATT, postChipYs.filter((cy) => cy < y).length);

  return (p) => {
    /* step 0 — post-norm era: pulse down the left stack, shrinking */
    postNote.setAttribute('opacity', seg(p, 0.05, 0.12) * 0.9);
    const tA = seg(p, 0.06, 0.21, ease.linear);
    const tB = seg(p, 0.36, 0.50, ease.linear);
    const tL = p < 0.30 ? tA : tB;                 // rerun for the comparison
    const runningL = tL > 0 && tL < 1;
    const yL = lerp(TOPY, BOTY, tL);
    const mL = postMagAt(yL);
    pulseL.setAttribute('cy', yL);
    pulseL.setAttribute('r', 3 + 4.5 * mL);
    pulseL.setAttribute('opacity', runningL ? 0.35 + 0.6 * mL : 0);
    const barLOn = (p >= 0.21 && p < 0.36) || p >= 0.50 ? 1 : 0;
    barL.track.setAttribute('opacity', barLOn);
    barL.fill.setAttribute('opacity', barLOn);
    barL.fill.setAttribute('width', 90 * magFinal * barLOn);
    barL.label.setAttribute('opacity', barLOn * 0.9);

    /* step 1 — pre-norm appears; identity highlight; both pulses race */
    const tShow = seg(p, 0.26, 0.32);
    gPre.setAttribute('opacity', tShow);
    preTitle.setAttribute('opacity', tShow);
    idHighlight.setAttribute('opacity', seg(p, 0.31, 0.37) * 0.35);
    idLabel.setAttribute('opacity', seg(p, 0.32, 0.38));
    const runningR = tB > 0 && tB < 1;
    pulseR.setAttribute('cy', lerp(TOPY, BOTY, tB));
    pulseR.setAttribute('r', 7.5);
    pulseR.setAttribute('opacity', runningR ? 0.95 : 0);
    const barROn = p >= 0.50 ? 1 : 0;
    barR.track.setAttribute('opacity', barROn);
    barR.fill.setAttribute('opacity', barROn);
    barR.fill.setAttribute('width', 90 * barROn);
    barR.label.setAttribute('opacity', barROn * 0.9);

    /* step 2 — LN → RMS relabel + card A; post stack recedes */
    const tRms = seg(p, 0.53, 0.61);
    preChipLN.forEach((n) => n.setAttribute('opacity', 1 - tRms));
    preChipRMS.forEach((n) => n.setAttribute('opacity', tRms));
    cardA.setAttribute('opacity', seg(p, 0.55, 0.64));
    gPost.setAttribute('opacity', lerp(1, 0.45, seg(p, 0.52, 0.62)));
    postTitle.setAttribute('opacity', lerp(1, 0.45, seg(p, 0.52, 0.62)));

    /* step 3 — QK-norm chips + refinements card */
    qkChips.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.79 + i * 0.03, 0.85 + i * 0.03)));
    cardB.setAttribute('opacity', seg(p, 0.78, 0.87));
  };
}

/* ===========================================================================
   Widget — activation explorer: the curves, and gating as a soft switch
   =========================================================================== */

function activationWidget() {
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

/* ===========================================================================
   Fig 3B.2 — what got deleted, 2017 → 2026
   =========================================================================== */

function deletionsFigure() {
  const W = 720, H = 268;
  const ROWS = [
    ['learned absolute position table', 'replaced by RoPE, applied inside attention', '→ 2021'],
    ['LayerNorm mean-centering + bias β', 'RMSNorm keeps only the gain g', '→ 2019'],
    ['biases on every linear layer', 'no measurable gain; training more stable without', '→ 2022'],
    ['dropout', 'one epoch over trillions of tokens barely overfits', '→ 2022'],
    ['embedding–unembedding tying', 'untied once vocab params became a rounding error', '→ 2020'],
  ];
  const RY = (i) => 66 + i * 38;
  const title = txt(24, 30, 'deleted from the block, 2017 → 2026', { size: 12, fill: PAL.ink });
  const parts = [], strikes = [], notes = [];
  ROWS.forEach(([name, note, yr], i) => {
    const y = RY(i);
    parts.push(
      txt(24, y, name, { size: 13, fill: PAL.tx, mono: true }),
      txt(696, y, yr, { size: 11, fill: PAL.mut, anchor: 'end', mono: true }));
    const noteT = txt(24, y + 15, note, { size: 10.5, fill: PAL.mut, opacity: 0 });
    notes.push(noteT); parts.push(noteT);
    const strike = svg('line', { x1: 22, y1: y - 4, x2: 22, y2: y - 4, stroke: PAL.loss, 'stroke-width': 1.6, opacity: 0.9 });
    strikes.push({ strike, len: 12 + name.length * 7.6 });
    parts.push(strike);
  });
  const footer = txt(W / 2, H - 12, 'each deletion: equal or better loss, fewer FLOPs, one less interaction to debug', { size: 11, anchor: 'middle', opacity: 0 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A list of five components deleted from the transformer block between 2017 and 2026 — the learned position table, LayerNorm mean and bias, linear-layer biases, dropout, and embedding tying — each crossed out by a red strike line with a one-line reason.',
  }, title, parts, footer);

  const node = figure('3B.2',
    'the modern block is the 2017 block edited mostly by deletion. Every removal was validated the same way: take it out, watch the loss curve not move.',
    root);

  track(node, (p) => {
    strikes.forEach(({ strike, len }, i) => {
      const t = seg(p, 0.14 + i * 0.07, 0.30 + i * 0.07, ease.out);
      strike.setAttribute('x2', 22 + len * t);
      notes[i].setAttribute('opacity', seg(p, 0.20 + i * 0.07, 0.34 + i * 0.07));
    });
    footer.setAttribute('opacity', seg(p, 0.55, 0.66));
  });
  return node;
}

/* ===========================================================================
   Fig 3B.3 — the block, 2017 vs 2026, differences lighting up one at a time
   =========================================================================== */

function blockCompareFigure() {
  const W = 720, H = 486;
  const LX = 62, RX = 420, BW = 238, BH = 40;
  const RYy = (i) => 398 - i * 60;                  // row i = 0 (bottom) … 5 (top)
  const AMBER = PAL.weight;

  // [leftLabel, rightLabel, diffIndex] — diffIndex −1 = unchanged
  const ROWS = [
    ['tokens + learned position table', 'tokens — RoPE lives in attention', 1],
    ['LayerNorm → multi-head attention', 'RMSNorm → gated MLA + KDA', 2],
    ['add, then LayerNorm on the path', 'add — identity path untouched', 0],
    ['LayerNorm → MLP: 4·d, GELU, biases', `RMSNorm → MoE: ${K3.experts.routed} gated experts`, 3],
    ['add, then LayerNorm on the path', 'add — identity path untouched', 0],
    ['tied unembedding, biases throughout', 'untied unembedding, zero biases', 4],
  ];
  const DIFFS = [
    'post-norm → pre-RMSNorm: the identity path stays clean, so 60-layer stacks train without warmup fragility',
    'learned positions → RoPE: relative offsets, injected where they are used — inside attention (ch. 04)',
    `MHA → gated MLA + KDA: compress the KV cache, go O(T) in most layers — the 1M-context enablers (ch. 04B)`,
    `one 4·d MLP → ${K3.experts.routed} small experts, SwiGLU-family (K3: SiTU): capacity without FLOPs (ch. 05)`,
    'biases, tying, dropout → deleted: fewer knobs, same loss, more stable training',
  ];

  const boxes = [];   // per row: { lBox, rBox, lHi, rHi, diff }
  const parts = [];
  ROWS.forEach(([lt, rt, diff], i) => {
    const y = RYy(i);
    const lBox = svg('rect', { x: LX, y, width: BW, height: BH, rx: 9, fill: 'rgba(230,237,243,0.04)', stroke: PAL.mut, 'stroke-width': 1 });
    const rBox = svg('rect', { x: RX, y, width: BW, height: BH, rx: 9, fill: 'rgba(90,200,220,0.05)', stroke: PAL.mut, 'stroke-width': 1 });
    const lHi = svg('rect', { x: LX - 3, y: y - 3, width: BW + 6, height: BH + 6, rx: 11, fill: 'none', stroke: AMBER, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0 });
    const rHi = svg('rect', { x: RX - 3, y: y - 3, width: BW + 6, height: BH + 6, rx: 11, fill: 'none', stroke: AMBER, 'stroke-width': 1.8, opacity: 0 });
    parts.push(lBox, rBox, lHi, rHi,
      txt(LX + BW / 2, y + 25, lt, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }),
      txt(RX + BW / 2, y + 25, rt, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }));
    if (i < 5) {
      parts.push(
        svg('line', { x1: LX + BW / 2, y1: y, x2: LX + BW / 2, y2: y - 20, stroke: PAL.mut, 'stroke-width': 1, opacity: 0.5 }),
        svg('line', { x1: RX + BW / 2, y1: y, x2: RX + BW / 2, y2: y - 20, stroke: PAL.act, 'stroke-width': 1, opacity: 0.5 }));
    }
    boxes.push({ lHi, rHi, diff });
  });
  const titles = [
    txt(LX + BW / 2, 30, '2017 — the GPT-lineage block', { size: 12, fill: PAL.ink, anchor: 'middle' }),
    txt(LX + BW / 2, 46, 'post-norm LN · GELU · learned pos · tied · biases', { size: 10, anchor: 'middle' }),
    txt(RX + BW / 2, 30, `2026 — the ${K3.name}-style block`, { size: 12, fill: PAL.ink, anchor: 'middle' }),
    txt(RX + BW / 2, 46, 'pre-RMSNorm · MoE · RoPE · untied · no biases', { size: 10, anchor: 'middle' }),
  ];
  const reasonBg = svg('rect', { x: 24, y: 452, width: W - 48, height: 26, rx: 7, fill: 'rgba(224,168,76,0.07)', stroke: AMBER, 'stroke-width': 0.8, opacity: 0 });
  const reason = svg('text', { x: W / 2, y: 469, 'text-anchor': 'middle', fill: AMBER, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, '');

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Two labeled block diagrams side by side: a 2017 GPT-lineage transformer block and a 2026 K3-style block, drawn as vertical stacks of components. As the figure scrolls, each changed component pair lights up in amber with a one-line reason for the change shown beneath.',
  }, parts, titles, reasonBg, reason);

  const node = figure('3B.3',
    `the same block, nine years apart (right side illustrative where K3 is undisclosed). Amber = what changed. Everything not highlighted — residual adds, the two-sublayer rhythm, the stack itself — survived untouched.`,
    root, { wide: true });

  track(node, (p) => {
    let current = -1;
    boxes.forEach(({ lHi, rHi, diff }) => {
      if (diff < 0) return;
      const t = seg(p, 0.16 + diff * 0.11, 0.24 + diff * 0.11);
      lHi.setAttribute('opacity', t * 0.7);
      rHi.setAttribute('opacity', t);
      if (t > 0.5) current = Math.max(current, diff);
    });
    const on = current >= 0 ? 1 : 0;
    reasonBg.setAttribute('opacity', on * 0.9);
    reason.setAttribute('opacity', on);
    if (current >= 0) reason.textContent = DIFFS[current];
  });
  return node;
}

/* ===========================================================================
   Chapter assembly
   =========================================================================== */

export function render({ id, num, title }) {
  const dff = 4 * BP.dModel;
  const activeWidth = (K3.experts.active + K3.experts.shared) * BP.expertHidden;

  return chapter(id,
    chapterHead(num, 'The component catalog', title),
    prose(
      `Chapter 03 followed one token&rsquo;s vector through a layer without stopping to ask why the layer looks the way it does. This chapter opens the hood. A modern block is a short parts list — a normalizer, an attention sublayer, an MLP, and a set of conventions about where everything sits — and every entry on that list is the survivor of a nine-year attrition. Nothing in the 2026 block is there by default; each part either displaced a predecessor or watched its neighbors get deleted. If you build deep models, this catalog is the difference between copying a config and understanding one.`,
      `The pattern to watch for: almost every change is a <em>simplification that scaled better</em>, not a clever addition. The block got emptier, not fuller.`),

    /* ---- 1 · normalization ---- */
    prose(
      `<strong>Normalization: what, and — more important — where.</strong> The original transformer used <strong>LayerNorm</strong>: subtract the vector&rsquo;s mean, divide by its standard deviation, then apply a learned per-dimension gain and bias. RMSNorm keeps only the division — by the root-mean-square — and the gain. Dropping mean-centering and the bias removes a reduction pass and a parameter vector, and across every published head-to-head the loss curves are indistinguishable. That settled the <em>what</em>. The <em>where</em> mattered far more. The 2017 block applied the norm <em>after</em> each residual addition — on the highway itself — which means every gradient flowing down from the loss is re-scaled by every norm&rsquo;s Jacobian on its way to the embedding. Deep post-norm stacks are trainable only with careful learning-rate warmup, and past a few dozen layers they diverge anyway. Moving the norm <em>inside</em> the sublayer branch — pre-norm — leaves the identity path untouched from loss to input. Scroll: the gradient tells the story.`),
    term('RMSNorm', 'n.', 'x / √(mean(x²) + ε) ⊙ g — LayerNorm minus mean-centering and bias; a rescale plus a learned per-dimension gain, nothing else'),

    createScene({
      id: 'norm-placement',
      figure: normSceneFigure,
      steps: [
        { n: 'STEP 1 / 4 — POST-NORM, 2017', html: `<p><strong>The original placement.</strong> Norm after every residual add — on the stream itself. Watch the gradient pulse descend: each on-path norm rescales it, and the rescalings compound with depth. Six layers train fine; sixty need warmup rituals and still walk a stability cliff. The 2017 recipe — post-norm plus warmup plus carefully tuned initialization — is a coupled system where touching any knob breaks the others.</p>` },
        { n: 'STEP 2 / 4 — PRE-NORM', html: `<p><strong>Move the norm into the branch.</strong> Now the residual path is a pure identity from loss to embedding: the pulse arrives at full strength no matter the depth. A fresh sublayer defaults to &ldquo;change nothing,&rdquo; so a 100-layer pre-norm stack trains from a cold start without warmup fragility. The one cost: the stream&rsquo;s magnitude grows layer by layer, which is why a final norm sits after the last block (you saw it in ch.&nbsp;03).</p>` },
        { n: 'STEP 3 / 4 — SIMPLIFY THE NORM ITSELF', html: `<p><strong>LayerNorm → RMSNorm.</strong> With placement solved, the formula shrank: delete mean-centering, delete the bias, keep the RMS rescale and the gain. Cheaper — one reduction instead of two, no bias parameters — and statistically indistinguishable in final loss. Every open frontier model since the Llama lineage ships RMSNorm, K3 included.</p>` },
        { n: 'STEP 4 / 4 — MODERN REFINEMENTS', html: `<p><strong>Stability at scale, not quality.</strong> Two residual failure modes got their own norms. Query and key vectors can drift large during training, blowing up attention logits into loss spikes — <strong>QK-norm</strong> normalizes q and k right before the dot product, bounding the logits by construction. And some recent models (the Gemma-2 lineage) sandwich each sublayer with norms on <em>both</em> sides — &ldquo;peri-norm&rdquo; — buying extra headroom at large scale. Refinements, not revolutions: the pre-norm identity path is the part nobody touches.</p>` },
      ],
    }),
    prose(
      `<em>Fig. 3B.1 — norm placement as a gradient-flow problem: post-norm rescales the gradient at every layer; pre-norm gives it an untouched identity path (schematic magnitudes).</em>`),

    /* ---- 2 · activations & gating ---- */
    prose(
      `<strong>Activations: from switch to gate.</strong> The nonlinearity is the only part of the MLP that is not a matrix, and it went through three generations. <strong>ReLU</strong> — max(0,&nbsp;x) — is a hard switch: cheap, but its gradient is exactly zero for half its domain, and a unit pushed there stops learning. <strong>GELU</strong> smooths the corner by weighting x with the Gaussian CDF; it was the GPT-era default. <strong>SiLU</strong> — x·σ(x) — is the same idea with a sigmoid, marginally cheaper and now standard. The real jump, though, was structural: modern blocks don&rsquo;t apply the activation to the hidden vector directly. They compute <em>two</em> parallel projections and let one multiplicatively gate the other — <strong>SwiGLU</strong>: down(SiLU(gate(x))&nbsp;⊙&nbsp;up(x)). The up path proposes a value for each hidden dimension; the gate path decides, per dimension, how much of it passes. K3 ships an in-house variant of this family called SiTU (ch.&nbsp;05 draws the full expert). Play with the widget until gating stops being a formula and starts being a switch.`),
    term('SwiGLU', 'n.', 'the gated MLP: down(SiLU(W_gate·x) ⊙ (W_up·x)) — three matrices where the classic MLP had two; the elementwise product is a learned per-dimension soft switch'),

    widget('activation explorer', 'switch curves · drag the gate', activationWidget()),

    mathAside('RMSNorm and SwiGLU, precisely', `
      <p>The two definitions this chapter turns on:</p>
      <div class="eq">RMSNorm(x) = x / √(mean(x²) + ε) ⊙ g          g ∈ ℝᵈ
SwiGLU(x)  = W_down( SiLU(W_gate x) ⊙ (W_up x) )</div>
      <p>with SiLU(x) = x·σ(x). Parameter bookkeeping: the classic two-matrix MLP costs 2·d·d_ff with d_ff = 4d. The gated block has <em>three</em> matrices — 3·d·d_ff — so to hold parameters constant, d_ff shrinks to ⅔·4d = <strong>8/3·d</strong>. That is why gated configs quote odd-looking hidden sizes: they are 4d budgets re-divided across three matrices. (In K3&rsquo;s MoE the convention breaks entirely — each expert&rsquo;s hidden width is ${BP.expertHidden.toLocaleString('en-US')} ≈ 0.29·d, and the pool makes up the difference.)</p>`),

    /* ---- 3 · the disappearing parts ---- */
    prose(
      `<strong>The disappearing parts.</strong> Several 2017 fixtures are simply gone. Biases on the linear layers: dropped — at billions of parameters per matrix, a d-length additive vector measurably changes nothing, and training runs are more stable without them. Dropout: dropped — pretraining makes roughly one pass over tens of trillions of tokens, so the memorization dropout guards against barely has a chance to start; regularizing an underfit model just slows it down. Embedding tying — sharing one matrix between the input embedding and the output unembedding — made sense when vocab×d was a large fraction of a small model; at frontier scale it is a rounding error of the parameter budget, and untying the two matrices (they do different jobs: one encodes, one classifies) buys quality for free.`),

    deletionsFigure(),

    /* ---- 4 · positional machinery placement ---- */
    prose(
      `<strong>Positional machinery: where it lives now.</strong> One deletion above deserves its footnote: the position table was not replaced <em>in place</em> — position information moved out of the embedding entirely and into attention, as the RoPE rotations of ch.&nbsp;04, applied to q and k right where relative offsets are actually consumed. The frontier keeps adjusting the dose rather than the location: NoPE experiments show attention can partly infer position with no encoding at all, and partial-RoPE designs rotate only a fraction of head dimensions — DeepSeek&rsquo;s MLA (inherited by K2) routes position through a small decoupled rotary slice per head and leaves the rest position-free. How that dial interacts with million-token context is ch.&nbsp;04B&rsquo;s subject.`),

    /* ---- 5 · width vs depth & the shape of a block ---- */
    prose(
      `<strong>The shape of a block.</strong> Two aspect-ratio conventions defined the 2017 recipe. The MLP hidden width was d_ff&nbsp;=&nbsp;4d (${(dff).toLocaleString('en-US')} for K2&rsquo;s d&nbsp;=&nbsp;${BP.dModel.toLocaleString('en-US')}); heads were d/d_head, so head count fell out of two other choices. Both survived a decade as folklore more than derivation, and MoE finally broke the first one: instead of a single 4d hidden layer, K3&rsquo;s block holds ${K3.experts.routed} experts of hidden width ${BP.expertHidden.toLocaleString('en-US')} (≈&nbsp;0.29·d each, illustrative) and activates ${K3.experts.active}&nbsp;+&nbsp;${K3.experts.shared}&nbsp;shared — about ${(activeWidth / BP.dModel).toFixed(1)}·d of <em>active</em> hidden width, a dense-sized compute budget drawn from a pool ~${Math.round(K3.experts.routed * BP.expertHidden / activeWidth)}× larger. The head convention bends too: K2 runs ${BP.heads}&nbsp;heads&nbsp;×&nbsp;${BP.dHead} = ${(BP.heads * BP.dHead).toLocaleString('en-US')} dims, deliberately wider than d.`,
      `What do the two axes actually buy? <em>Depth</em> buys iterative refinement: ch.&nbsp;03&rsquo;s logit-lens picture — early layers resolving syntax, middle layers assembling entities, late layers converging on the answer — is a computation that needs sequential steps, and more layers are more steps. <em>Width</em> buys capacity per step: more features detected in parallel, more room in the stream for sublayers to write without collisions. Frontier configs hold the ratio in a broad sweet band (d/L in the low hundreds) because both extremes fail — a wide-shallow model can&rsquo;t compose, a narrow-deep one starves each step. Here is the whole chapter in one picture: the block, nine years apart.`),

    blockCompareFigure(),

    prose(
      `Read the amber and you have the modern design brief: keep the residual highway sacred, normalize going into each branch (with the cheapest norm that works), gate the MLP, compress attention&rsquo;s memory traffic, spend the parameter budget on a routed expert pool, and delete every part that cannot prove it moves the loss. The unhighlighted parts are just as informative — the two-sublayer rhythm and the add-don&rsquo;t-replace contract of ch.&nbsp;03 have not moved since 2017.`),

    takeaway(
      `The 2026 block is the 2017 block edited by <strong>deletion and relocation</strong>, not addition: the norm moved off the highway and lost its mean and bias; the activation became a per-dimension gate; positions moved into attention; biases, dropout, and tying vanished; and the 4d MLP shattered into an expert pool. Every survivor earned its place the same way — equal or better loss at scale, with one less thing to break.`),
  );
}
