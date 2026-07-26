/* Widget — your own distribution, and what it costs.

   Five logits and a temperature dial on one side; on the other, the quantities
   this chapter is about: the entropy of the distribution you built, the
   surprise of the token that actually occurred, the cross-entropy loss that
   surprise *is*, and its perplexity. Nothing is sampled here — no token is
   drawn, no tail is truncated. This is a measuring instrument for the loss. */

import { el, svg, svgRoot } from '../../core/dom.js';
import { widget, txt, PAL } from '../../core/components.js';
import { softmax } from '../../core/mathtools.js';
import { pct } from '../../core/anim.js';

const TOKENS = ['mat', 'floor', 'couch', 'table', 'roof'];
const DEFAULT_Z = [3.6, 2.4, 1.9, 1.2, 0.5];
const HMAX_BITS = Math.log2(TOKENS.length);

const PRESETS = [
  ['confident · right', [8, 1, 0.5, 0, -1], 1, 0],
  ['confident · wrong', [8, 1, 0.5, 0, -1], 1, 4],
  ['hedging', [0, 0, 0, 0, 0], 1, 1],
  ['as learned', DEFAULT_Z, 1, 1],
];

const fmtPpl = (v) => (v >= 1e4 ? v.toExponential(1) : v < 100 ? v.toFixed(2) : v.toFixed(0));

export function lossWidget() {
  const z = DEFAULT_Z.slice();
  let T = 1, truth = 1;

  const W = 720, H = 312;
  const N = TOKENS.length;
  const X0 = 70, SLOT = 110, BW = 58, BASE = 212, MAXH = 140;
  const bx = (i) => X0 + i * SLOT + (SLOT - BW) / 2;
  const cx = (i) => bx(i) + BW / 2;
  const RIGHT = X0 + N * SLOT;

  const title = txt(X0, 24, '“The cat sat on the …”', { size: 12.5, mono: true, fill: PAL.ink });
  const oneLine = svg('line', { x1: X0 - 12, y1: BASE - MAXH, x2: RIGHT, y2: BASE - MAXH, stroke: PAL.act, 'stroke-width': 1, 'stroke-dasharray': '5 4', opacity: 0.6 });
  const oneTag = txt(X0 - 16, BASE - MAXH + 4, 'p = 1', { size: 10, anchor: 'end', mono: true, fill: PAL.act });
  const baseLine = svg('line', { x1: X0 - 12, y1: BASE, x2: RIGHT, y2: BASE, stroke: PAL.grid.replace('0.06', '0.34'), 'stroke-width': 1 });

  const bars = TOKENS.map((_, i) => svg('rect', { x: bx(i), y: BASE, width: BW, height: 0, rx: 3, fill: PAL.act, opacity: 0.9 }));
  const ring = svg('rect', { x: 0, y: 0, width: BW + 8, height: 0, rx: 5, fill: 'none', stroke: PAL.loss, 'stroke-width': 1.8 });
  const vals = TOKENS.map((_, i) => txt(cx(i), BASE - 8, '', { size: 11, anchor: 'middle', mono: true, fill: PAL.tx }));
  const names = TOKENS.map((w, i) => txt(cx(i), BASE + 22, w, { size: 12, anchor: 'middle', mono: true, fill: PAL.tx }));
  const marks = TOKENS.map((_, i) => txt(cx(i), BASE + 38, 'occurred', { size: 9.5, anchor: 'middle', fill: PAL.loss, opacity: 0 }));
  const lossTag = txt(0, 0, '', { size: 11, anchor: 'middle', mono: true, fill: PAL.loss });

  const meterKey = txt(X0, 268, 'entropy H(p) — the average surprise of a draw from this distribution', { size: 10.5 });
  const meterVal = txt(RIGHT, 268, '', { size: 10.5, anchor: 'end', mono: true, fill: PAL.act });
  const meterTrack = svg('rect', { x: X0, y: 278, width: RIGHT - X0, height: 14, rx: 7, fill: 'none', stroke: PAL.grid.replace('0.06', '0.3'), 'stroke-width': 1 });
  const meterFill = svg('rect', { x: X0, y: 278, width: 0, height: 14, rx: 7, fill: PAL.act, opacity: 0.75 });
  const meterMax = txt(RIGHT, 304, `uniform over these ${N} tokens = ${HMAX_BITS.toFixed(2)} bits`, { size: 9.5, anchor: 'end' });

  const chart = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Five candidate next tokens with adjustable logits. Bars show the softmax probabilities at the current temperature, the token marked as having actually occurred is outlined and annotated with its surprise in nats, and a meter below shows the entropy of the distribution against the ${HMAX_BITS.toFixed(2)}-bit maximum for five outcomes.`,
  }, title, oneLine, oneTag, baseLine, bars, ring, vals, names, marks, lossTag,
     meterKey, meterVal, meterTrack, meterFill, meterMax);

  /* ---- controls --------------------------------------------------------- */

  const zVals = TOKENS.map((_, i) => el('span', { class: 'sl-v' }, z[i].toFixed(1)));
  const zSliders = TOKENS.map((w, i) => {
    const s = el('input', { type: 'range', min: '-6', max: '10', step: '0.1', value: String(z[i]), 'aria-label': `logit for the token ${w}` });
    s.addEventListener('input', () => { z[i] = +s.value; update(); });
    return s;
  });
  const tVal = el('span', { class: 'sl-v' }, T.toFixed(2));
  const tSlider = el('input', { type: 'range', min: '0.1', max: '3', step: '0.05', value: String(T), 'aria-label': 'temperature T' });
  tSlider.addEventListener('input', () => { T = +tSlider.value; update(); });

  const truthBtns = TOKENS.map((w, i) => el('button', {
    class: 'tok', type: 'button', onclick: () => { truth = i; update(); },
  }, w));
  const presetBtns = PRESETS.map(([label, zs, t, k]) => el('button', {
    class: 'tok', type: 'button',
    onclick: () => {
      zs.forEach((v, i) => { z[i] = v; zSliders[i].value = String(v); });
      T = t; tSlider.value = String(t); truth = k; update();
    },
  }, label));

  const CELLS = [
    ['p(occurred)', ''], ['loss −ln p, nats', 'hi'], ['surprise, bits', ''],
    ['perplexity e^L', ''], ['entropy, bits', ''], ['entropy, nats', ''],
  ];
  const outs = CELLS.map(([, cls]) => el('div', { class: `sg-v${cls ? ' ' + cls : ''}` }, ''));
  const statGrid = el('div', { class: 'stat-grid' },
    CELLS.map(([k], i) => el('div', { class: 'sg-cell' }, outs[i], el('div', { class: 'sg-k' }, k))));

  /* ---- the one computation everything reads from ------------------------ */

  function update() {
    const p = softmax(z, T);
    const pT = p[truth];
    const loss = -Math.log(Math.max(pT, Number.MIN_VALUE));
    let hNats = 0;
    for (const q of p) if (q > 0) hNats -= q * Math.log(q);

    bars.forEach((b, i) => {
      const h = Math.max(p[i] > 1e-4 ? 1.5 : 0, p[i] * MAXH);
      b.setAttribute('y', BASE - h);
      b.setAttribute('height', h);
      b.setAttribute('opacity', i === truth ? 0.95 : 0.7);
      vals[i].setAttribute('y', BASE - h - 8);
      vals[i].textContent = p[i] >= 0.001 ? pct(p[i], 1) : '<0.1%';
      names[i].setAttribute('fill', i === truth ? PAL.loss : PAL.tx);
      marks[i].setAttribute('opacity', i === truth ? 1 : 0);
    });
    const hT = Math.max(1.5, pT * MAXH);
    ring.setAttribute('x', bx(truth) - 4);
    ring.setAttribute('y', BASE - hT - 4);
    ring.setAttribute('height', hT + 8);
    lossTag.setAttribute('x', cx(truth));
    lossTag.setAttribute('y', BASE - hT - 24);
    lossTag.textContent = `−log p = ${loss.toFixed(3)} nats`;

    const frac = Math.min(1, hNats / Math.LN2 / HMAX_BITS);
    meterFill.setAttribute('width', Math.max(2, frac * (RIGHT - X0)));
    meterVal.textContent = `${(hNats / Math.LN2).toFixed(3)} bits · ${hNats.toFixed(3)} nats`;

    outs[0].textContent = pT >= 1e-4 ? pct(pT, 2) : pT.toExponential(1);
    outs[1].textContent = loss.toFixed(3);
    outs[2].textContent = (loss / Math.LN2).toFixed(3);
    outs[3].textContent = fmtPpl(Math.exp(loss));
    outs[4].textContent = (hNats / Math.LN2).toFixed(3);
    outs[5].textContent = hNats.toFixed(3);

    truthBtns.forEach((b, i) => b.classList.toggle('sel', i === truth));
    zVals.forEach((v, i) => { v.textContent = z[i].toFixed(1); });
    tVal.textContent = T.toFixed(2);
  }

  const body = el('div', {},
    el('div', { class: 'tokens', style: { marginBottom: '0.7rem' } }, presetBtns),
    el('div', { style: { fontSize: '0.78rem', color: 'var(--fig-mut)', margin: '0 0 0.35rem' } },
      'which token actually came next:'),
    el('div', { class: 'tokens', style: { marginBottom: '0.9rem' } }, truthBtns),
    TOKENS.map((w, i) => el('label', { class: 'slider-row' },
      el('span', { class: 'sl-k' }, `logit z(${w})`), zSliders[i], zVals[i])),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'temperature T'), tSlider, tVal),
    chart, statGrid,
    el('div', {
      class: 'w-note',
      html: 'Nothing is sampled here and no tail is truncated — this is the training-time view. Push one logit far above the others and select a different token as the one that occurred to watch the loss explode: −log p has no ceiling. Nats and bits are the same quantity in different units (1 nat = 1/ln 2 ≈ 1.4427 bits).',
    }));

  update();
  return widget('Your own distribution — and what it costs',
    'drag the logits and T; pick the token that actually came next; every number is recomputed from softmax(z/T)',
    body);
}
