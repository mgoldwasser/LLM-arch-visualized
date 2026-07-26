/* Sampling widget — one fixed set of logits, live softmax(z/T) and a live
   top-p nucleus. Every bar, the entropy and the nucleus size are recomputed
   from the real numerics on every input; nothing is tabulated.

   The widget's caption lives in the prose that follows it, so its figure
   number is reserved here with claimFig('sampling') — this function is called
   at the point in render() where the widget appears. */

import { el, svg, svgRoot } from '../../core/dom.js';
import { widget, txt, claimFig, PAL } from '../../core/components.js';
import { pct } from '../../core/anim.js';
import { softmax } from '../../core/mathtools.js';

function samplingBody() {
  // A fixed set of plausible next-token logits after "The capital of France is".
  const TOKS = [
    ['Paris', 8.9], ['the', 5.8], ['a', 5.3], ['located', 5.0], ['known', 4.4], ['in', 4.1],
    ['one', 3.8], ['Lyon', 3.6], ['also', 3.3], ['not', 3.0], ['called', 2.8], ['home', 2.5],
  ];
  const logits = TOKS.map((t) => t[1]);
  let T = 1.0, topP = 0.95;

  const W = 720, H = 296, BASE = 226, MAXH = 160, SLOT = (W - 76) / TOKS.length, X0 = 44, BARW = 34;
  const bx = (i) => X0 + i * SLOT + (SLOT - BARW) / 2;

  const ctxLine = txt(W / 2, 26, '“The capital of France is …”', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true });
  const bars = TOKS.map((_, i) => svg('rect', { x: bx(i), y: BASE, width: BARW, height: 0, rx: 3, fill: PAL.act }));
  const vals = TOKS.map((_, i) => txt(bx(i) + BARW / 2, BASE - 6, '', { size: 10, fill: PAL.tx, anchor: 'middle', mono: true }));
  const labels = TOKS.map(([w], i) => txt(bx(i) + BARW / 2, BASE + 18, w, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }));
  const baseLine = svg('line', { x1: X0 - 8, y1: BASE, x2: W - 32, y2: BASE, stroke: PAL.grid.replace('0.06', '0.3'), 'stroke-width': 1 });
  const bound = svg('line', { x1: 0, y1: 42, x2: 0, y2: BASE + 24, stroke: PAL.attn, 'stroke-width': 1.4, 'stroke-dasharray': '5 4', opacity: 0 });
  const boundTag = txt(0, 54, 'top-p cutoff — nucleus | trimmed tail', { size: 10, fill: PAL.attn, opacity: 0 });
  const cutNote = txt(W - 32, BASE + 40, 'grayed tokens: outside the nucleus, probability set to 0, rest renormalized',
    { size: 10, anchor: 'end' });

  const svgNode = svgRoot(W, H, { role: 'img', 'aria-label': 'Histogram of next-token probabilities after the prompt “The capital of France is”, recomputed live as temperature and top-p change; tokens cut by top-p are grayed out beyond a nucleus boundary line.' },
    ctxLine, baseLine, bars, vals, labels, bound, boundTag, cutNote);

  /* controls */
  const tVal = el('span', { class: 'sl-v' }, T.toFixed(2));
  const pVal = el('span', { class: 'sl-v' }, topP.toFixed(2));
  const tSlider = el('input', { type: 'range', min: '0.1', max: '2', step: '0.05', value: String(T), 'aria-label': 'temperature T' });
  const pSlider = el('input', { type: 'range', min: '0.1', max: '1', step: '0.01', value: String(topP), 'aria-label': 'top-p' });

  const PRESETS = [
    ['T = 0.2 · nearly greedy', 0.2, 'precise, can loop'],
    ['T = 1.0 · as learned', 1.0, 'calibrated diversity'],
    ['T = 1.5 · flattened', 1.5, 'creative, error-prone — top-p trims the tail'],
  ];
  const desc = el('div', { class: 'w-note' }, 'calibrated diversity');
  const presetBtns = PRESETS.map(([lab, val, d]) =>
    el('button', { class: 'tok', onclick: () => { T = val; tSlider.value = String(val); desc.textContent = d; update(); } }, lab));

  const cells = {
    pRaw: el('div', { class: 'sg-v' }, ''), pPol: el('div', { class: 'sg-v hi' }, ''),
    kept: el('div', { class: 'sg-v' }, ''), ent: el('div', { class: 'sg-v' }, ''),
  };
  const statGrid = el('div', { class: 'stat-grid' },
    el('div', { class: 'sg-cell' }, cells.pRaw, el('div', { class: 'sg-k' }, 'p(Paris) · softmax(z/T)')),
    el('div', { class: 'sg-cell' }, cells.pPol, el('div', { class: 'sg-k' }, 'p(Paris) · after top-p')),
    el('div', { class: 'sg-cell' }, cells.kept, el('div', { class: 'sg-k' }, 'tokens in nucleus')),
    el('div', { class: 'sg-cell' }, cells.ent, el('div', { class: 'sg-k' }, 'entropy of policy (bits)')));

  function update() {
    const ps = softmax(logits, T);
    let cum = 0, k = TOKS.length;
    for (let i = 0; i < ps.length; i++) { cum += ps[i]; if (cum >= topP - 1e-9) { k = i + 1; break; } }
    const keptSum = ps.slice(0, k).reduce((a, b) => a + b, 0);
    bars.forEach((b, i) => {
      const h = Math.max(ps[i] > 1e-4 ? 1.5 : 0, ps[i] * MAXH);
      b.setAttribute('height', h);
      b.setAttribute('y', BASE - h);
      b.setAttribute('fill', i < k ? PAL.act : '#4A5560');
      b.setAttribute('opacity', i < k ? 0.95 : 0.35);
      vals[i].textContent = ps[i] >= 0.01 ? (ps[i] * 100).toFixed(0) + '%' : '';
      vals[i].setAttribute('y', BASE - h - 6);
      vals[i].setAttribute('fill', i < k ? PAL.tx : PAL.mut);
      labels[i].setAttribute('fill', i < k ? PAL.tx : PAL.mut);
      labels[i].setAttribute('opacity', i < k ? 1 : 0.55);
    });
    const showB = k < TOKS.length;
    const xb = X0 + k * SLOT;
    bound.setAttribute('x1', xb); bound.setAttribute('x2', xb);
    bound.setAttribute('opacity', showB ? 0.9 : 0);
    // keep the tag clear of bar-value labels: sit on whichever side has room
    boundTag.setAttribute('text-anchor', xb > 420 ? 'end' : 'start');
    boundTag.setAttribute('x', xb > 420 ? xb - 8 : xb + 8);
    boundTag.setAttribute('opacity', showB ? 0.9 : 0);
    let ent = 0;
    for (let i = 0; i < k; i++) { const q = ps[i] / keptSum; if (q > 0) ent -= q * Math.log2(q); }
    cells.pRaw.textContent = pct(ps[0], 1);
    cells.pPol.textContent = pct(ps[0] / keptSum, 1);
    cells.kept.textContent = `${k} / ${TOKS.length}`;
    cells.ent.textContent = ent.toFixed(2);
    tVal.textContent = T.toFixed(2);
    pVal.textContent = topP.toFixed(2);
  }
  tSlider.addEventListener('input', () => { T = +tSlider.value; desc.textContent = 'custom'; update(); });
  pSlider.addEventListener('input', () => { topP = +pSlider.value; update(); });
  update();

  return el('div', {},
    el('div', { class: 'tokens', style: { marginBottom: '0.8rem' } }, presetBtns),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'temperature T'), tSlider, tVal),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'top-p (nucleus)'), pSlider, pVal),
    svgNode, statGrid, desc);
}

export function samplingWidget() {
  claimFig('sampling');
  return widget('One distribution, three temperatures',
    'drag T and top-p — every bar is recomputed live from softmax(z/T)',
    samplingBody());
}
