/* Widget — the sequential/parallel cost model, computed live.
   A recurrence's wall-clock is its dependency chain: T steps, whatever the
   hardware. Attention's is its work divided by the units you can throw at it,
   floored by the depth of the parallel reduction. Everything below comes from
   those two formulas and the two sliders. */

import { el, svg, svgRoot } from '../../core/dom.js';
import { widget, txt, PAL } from '../../core/components.js';
import { si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

const TE_MIN = 4, TE_MAX = Math.log2(K3.contextWindow);
const PE_MIN = 0, PE_MAX = 17;
const LMAX = 13;                                   // log₁₀ of the longest bar

const wallRNN = (T) => T;                          // T sequential steps, hardware-proof
const workAttn = (T) => T * T;                     // every pair of positions
const wallAttn = (T, P) => Math.max(workAttn(T) / P, Math.log2(T));  // ÷ units, floored by reduction depth

export function parallelWidget() {
  let te = 12, pe = 10;                            // T = 4096, units = 1024

  /* ---- bars -------------------------------------------------------------- */
  const W = 660, H = 152, x0 = 118, x1 = 628;
  const SUPD = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  const axis = svg('g', {});
  for (let L = 0; L <= LMAX; L += 3) {
    const x = x0 + (L / LMAX) * (x1 - x0);
    const label = String(L).split('').map((d) => SUPD[+d]).join('');
    axis.append(
      svg('line', { x1: x, y1: 30, x2: x, y2: 112, stroke: PAL.grid }),
      txt(x, 130, `10${label}`, { size: 9.5, anchor: 'middle', mono: true }));
  }

  const bar = (y, color, name) => {
    const rect = svg('rect', { x: x0, y, width: 2, height: 26, rx: 4, fill: color, 'fill-opacity': 0.75 });
    const val = txt(x0 + 8, y + 18, '', { size: 11.5, fill: PAL.ink, mono: true });
    return { g: svg('g', {}, txt(x0 - 10, y + 18, name, { size: 11, fill: color, anchor: 'end', mono: true }), rect, val), rect, val };
  };
  const bRNN = bar(38, PAL.act, 'recurrence');
  const bAttn = bar(78, PAL.attn, 'attention');
  const axisTitle = txt((x0 + x1) / 2, 20, 'wall-clock, in elementary steps (log scale)', { size: 10, anchor: 'middle' });
  const chart = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Two horizontal bars on a logarithmic axis comparing wall-clock time: the recurrence bar depends only on sequence length, while the attention bar shrinks as parallel compute units are added.',
  }, axisTitle, axis, bRNN.g, bAttn.g);

  /* ---- controls ---------------------------------------------------------- */
  const tVal = el('span', { class: 'sl-v' }, '');
  const pVal = el('span', { class: 'sl-v' }, '');
  const tSlider = el('input', {
    type: 'range', min: String(TE_MIN), max: TE_MAX.toFixed(3), step: '0.05', value: String(te),
    'aria-label': 'sequence length T, on a log2 scale',
  });
  const pSlider = el('input', {
    type: 'range', min: String(PE_MIN), max: String(PE_MAX), step: '0.05', value: String(pe),
    'aria-label': 'number of parallel compute units, on a log2 scale',
  });

  const PRESETS = [
    ['a sentence', 6, 10],
    ['a document', 13, 14],
    [`${K3.name}'s window`, TE_MAX, 17],
    ['no parallelism at all', TE_MAX, 0],
  ];
  const presetBtns = PRESETS.map(([name, t, p]) => el('button', {
    class: 'tok', type: 'button',
    onclick: () => { te = t; pe = p; tSlider.value = String(t); pSlider.value = String(p); update(); },
  }, `${name} · T = ${si(Math.round(2 ** t))} · ${si(Math.round(2 ** p))} unit${2 ** p === 1 ? '' : 's'}`));

  const cell = (label, hi = false) => {
    const v = el('div', { class: `sg-v${hi ? ' hi' : ''}` }, '—');
    return { root: el('div', { class: 'sg-cell' }, v, el('div', { class: 'sg-k' }, label)), v };
  };
  const cRNN = cell('recurrence — sequential steps');
  const cAttn = cell('attention — parallel steps', true);
  const cRatio = cell('attention vs recurrence');
  const cCross = cell('units needed to break even');
  const cWork = cell('extra arithmetic attention does');
  const stats = el('div', { class: 'stat-grid' }, cRNN.root, cAttn.root, cRatio.root, cCross.root, cWork.root);

  const verdict = el('div', { style: { fontSize: '0.82rem', color: 'var(--fig-ink)', margin: '0.4rem 0 0.2rem' } });
  const note = el('div', { class: 'w-note' },
    'The model: one elementary step is one matrix multiply on one unit. A recurrence must do T of them back to back, so adding hardware changes nothing — the chain is the clock. Attention does T² of them and none of them has to wait for another, so P units split the work and finish in T²/P. There is a floor under that. The results still have to be added together, and adding T numbers takes about log₂T rounds of pairing them off no matter how many units you own, so attention can never drop below log₂T steps. Break-even is therefore exactly one unit per token, P = T. Two things are left out: a language model only ever looks backwards, which halves attention’s work, and the time spent moving numbers to and from memory is ignored entirely. Both shift the numbers; neither changes the shape.');

  /* ---- live update ------------------------------------------------------- */
  function update() {
    const T = Math.round(2 ** te);
    const P = Math.round(2 ** pe);
    const wr = wallRNN(T), wa = wallAttn(T, P);
    const ratio = wr / wa;

    tVal.textContent = si(T);
    pVal.textContent = si(P);
    cRNN.v.textContent = si(wr);
    cAttn.v.textContent = wa < 1000 ? wa.toFixed(wa < 10 ? 1 : 0) : si(wa);
    cRatio.v.textContent = ratio >= 1 ? `${si(ratio)}× faster` : `${si(1 / ratio)}× slower`;
    cRatio.v.className = ratio >= 1 ? 'sg-v hi' : 'sg-v';
    cCross.v.textContent = si(T);
    cWork.v.textContent = `${si(workAttn(T) / T)}×`;

    const px = (v) => Math.max(2, (Math.log10(Math.max(v, 1)) / LMAX) * (x1 - x0));
    bRNN.rect.setAttribute('width', px(wr));
    bAttn.rect.setAttribute('width', px(wa));
    bRNN.val.setAttribute('x', x0 + px(wr) + 8);
    bAttn.val.setAttribute('x', x0 + px(wa) + 8);
    bRNN.val.textContent = `${si(wr)} steps`;
    bAttn.val.textContent = `${wa < 1000 ? wa.toFixed(0) : si(wa)} steps`;

    verdict.innerHTML = P >= T
      ? `You have at least one unit per token, so attention wins: <strong>${si(ratio)}×</strong> less wall-clock than the recurrence, while doing <strong>${si(T)}×</strong> more arithmetic to get there.`
      : `Only ${si(P)} units for ${si(T)} tokens — attention is still ${ratio >= 1 ? `${si(ratio)}× ahead` : `${si(1 / ratio)}× behind`}. It needs <strong>${si(T - P)}</strong> more units to break even; the recurrence would not use them.`;
  }
  tSlider.addEventListener('input', () => { te = +tSlider.value; update(); });
  pSlider.addEventListener('input', () => { pe = +pSlider.value; update(); });

  const body = el('div', {},
    el('div', { class: 'tokens', style: { marginBottom: '0.8rem' } }, presetBtns),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'sequence length T'), tSlider, tVal),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'parallel compute units'), pSlider, pVal),
    el('div', { style: { overflowX: 'auto' } }, chart),
    stats, verdict, note);
  update();

  return widget('The parallelism wall', 'drag T and the hardware — one cost model, two shapes', body);
}
