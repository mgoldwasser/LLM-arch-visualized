/* Chapter 06 — assembling K3: where 2.8 trillion parameters live.
   Centerpiece: a live parameter calculator — sliders in, arithmetic out. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, widget, takeaway, PAL } from '../core/components.js';
import { si, pct, fmtBytes } from '../core/anim.js';
import { K3, PRESETS } from '../../data/k3.js';

/* ---- the accounting (simplified — see Fig. 6.1 caption) ------------------ */

function account({ L, d, E, k, dff, Vk }) {
  const V = Vk * 1000;
  const kEff = Math.min(k, E);
  const emb = 2 * V * d;                       // untied in/out embeddings
  const attn = 4 * d * d * L;                  // Q,K,V,O — 4d² per layer
  const moe = 3 * d * dff * (E + 1) * L;       // SwiGLU experts, +1 shared
  const total = emb + attn + moe;
  const active = emb + attn + 3 * d * dff * (kEff + 1) * L;
  return { emb, attn, moe, total, active, ratio: active / total };
}

/* ---- widget: build your own trillion-parameter model --------------------- */

const SLIDERS = [
  { key: 'L',   label: 'layers L',          min: 12,   max: 96,    step: 1,   fmt: (v) => String(v) },
  { key: 'd',   label: 'd_model',           min: 1024, max: 16384, step: 512, fmt: (v) => v.toLocaleString('en-US') },
  { key: 'E',   label: 'routed experts E',  min: 1,    max: 1024,  step: 1,   fmt: (v) => String(v) },
  { key: 'k',   label: 'active experts k',  min: 1,    max: 32,    step: 1,   fmt: (v) => String(v) },
  { key: 'dff', label: 'expert hidden dim', min: 512,  max: 32768, step: 512, fmt: (v) => v.toLocaleString('en-US') },
  { key: 'Vk',  label: 'vocab (thousands)', min: 32,   max: 256,   step: 1,   fmt: (v) => `${v}k` },
];

function calculatorBody() {
  const state = { ...PRESETS['K3 (defaults)'] };
  const inputs = {}, sliderVals = {};

  /* preset buttons */
  const presetBtns = Object.entries(PRESETS).map(([name, cfg]) =>
    el('button', {
      class: 'tok', type: 'button',
      onclick: () => {
        Object.assign(state, cfg);
        for (const s of SLIDERS) inputs[s.key].value = state[s.key];
        update();
      },
    }, name));
  const presetRow = el('div', { class: 'tokens', style: { marginBottom: '0.9rem' } },
    el('span', { style: { fontSize: '0.72rem', color: 'var(--fig-mut)', alignSelf: 'center', marginRight: '0.3rem' } }, 'presets'),
    presetBtns);

  /* sliders */
  const rows = SLIDERS.map((s) => {
    const input = el('input', {
      type: 'range', min: s.min, max: s.max, step: s.step, value: state[s.key],
      'aria-label': s.label,
      oninput: () => { state[s.key] = +input.value; update(); },
    });
    inputs[s.key] = input;
    sliderVals[s.key] = el('span', { class: 'sl-v' }, s.fmt(state[s.key]));
    return el('label', { class: 'slider-row' },
      el('span', { class: 'sl-k' }, s.label), input, sliderVals[s.key]);
  });

  /* live stats */
  const cell = (label, hi = false) => {
    const v = el('div', { class: `sg-v${hi ? ' hi' : ''}` }, '—');
    return { root: el('div', { class: 'sg-cell' }, v, el('div', { class: 'sg-k' }, label)), v };
  };
  const cTotal = cell('total parameters', true);
  const cActive = cell('active per token');
  const cRatio = cell('activation ratio');
  const cMem4 = cell('weights @ 4-bit (MXFP4)');
  const cMem16 = cell('weights @ bf16');
  const statGrid = el('div', { class: 'stat-grid' },
    cTotal.root, cActive.root, cRatio.root, cMem4.root, cMem16.root);

  /* stacked bar: where the parameters live */
  const BX = 12, BW = 696, BY = 10, BH = 26;
  const segAttn = svg('rect', { x: BX, y: BY, height: BH, width: 0, fill: PAL.weight });
  const segEmb = svg('rect', { x: BX, y: BY, height: BH, width: 0, fill: PAL.act });
  const segMoe = svg('rect', { x: BX, y: BY, height: BH, width: 0, fill: PAL.moe, rx: 0 });
  const moePctLabel = svg('text', {
    x: 0, y: BY + 18, 'text-anchor': 'middle', fill: '#0E1116',
    'font-family': 'monospace', 'font-size': 13, 'font-weight': 700,
  }, '');
  const barSvg = svgRoot(720, 46, {
    role: 'img',
    'aria-label': 'Stacked bar showing where the parameters live: attention in amber, embeddings in cyan, expert MLPs in teal — the expert MLPs dominate.',
  },
    svg('rect', { x: BX, y: BY, width: BW, height: BH, rx: 5, fill: 'rgba(230,237,243,0.05)' }),
    segAttn, segEmb, segMoe, moePctLabel);

  const swatch = (color) => el('span', {
    style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: color, marginRight: '0.4rem' },
  });
  const legEmb = el('span', {}, '');
  const legAttn = el('span', {}, '');
  const legMoe = el('span', {}, '');
  const legend = el('div', {
    style: { display: 'flex', flexWrap: 'wrap', gap: '1.4rem', fontSize: '0.76rem', color: 'var(--fig-tx)', marginTop: '0.4rem' },
  },
    el('span', {}, swatch(PAL.act), 'embeddings ', legEmb),
    el('span', {}, swatch(PAL.weight), 'attention ', legAttn),
    el('span', {}, swatch(PAL.moe), 'expert MLPs ', legMoe));

  const barBlock = el('div', { style: { marginTop: '0.4rem' } },
    el('div', {
      style: { fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fig-mut)', margin: '0.2rem 0 0.4rem' },
    }, 'where the parameters live'),
    barSvg, legend);

  function update() {
    for (const s of SLIDERS) sliderVals[s.key].textContent = s.fmt(state[s.key]);

    const a = account(state);
    cTotal.v.textContent = si(a.total);
    cActive.v.textContent = si(a.active);
    cRatio.v.textContent = pct(a.ratio, a.ratio < 0.1 ? 1 : 0);
    cMem4.v.textContent = fmtBytes(a.total * 0.5);
    cMem16.v.textContent = fmtBytes(a.total * 2);

    // stacked bar — tiny shares stay visible at a 3px minimum
    let wAttn = Math.max(3, BW * (a.attn / a.total));
    let wEmb = Math.max(3, BW * (a.emb / a.total));
    const wMoe = Math.max(0, BW - wAttn - wEmb);
    segAttn.setAttribute('width', wAttn);
    segEmb.setAttribute('x', BX + wAttn);
    segEmb.setAttribute('width', wEmb);
    segMoe.setAttribute('x', BX + wAttn + wEmb);
    segMoe.setAttribute('width', wMoe);
    const moeShare = pct(a.moe / a.total, 1);
    moePctLabel.textContent = wMoe > 64 ? moeShare : '';
    moePctLabel.setAttribute('x', BX + wAttn + wEmb + wMoe / 2);

    legEmb.textContent = si(a.emb);
    legAttn.textContent = si(a.attn);
    legMoe.textContent = `${si(a.moe)} (${moeShare})`;

    // highlight the matching preset, if any
    Object.entries(PRESETS).forEach(([name, cfg], i) => {
      const match = SLIDERS.every((s) => cfg[s.key] === state[s.key]);
      presetBtns[i].classList.toggle('sel', match);
    });
  }
  update();

  return el('div', {}, presetRow, rows, statGrid, barBlock);
}

/* ---- chapter assembly ---------------------------------------------------- */

export function render({ id, num, title }) {
  const bp = K3.blueprint;
  return chapter(id,
    chapterHead(num, 'The whole machine', title),
    prose(
      `You now have every part: an embedding matrix, a stack of layers each holding an attention sublayer and a MoE sublayer, a final norm, an unembedding. &ldquo;2.8 trillion&rdquo; stops being mystical the moment you multiply it out — it is just (matrix dimensions) × (layer count), dominated overwhelmingly by the expert MLPs. The calculator below builds a model from the same recipe; the defaults approximate ${K3.name} where disclosed (${K3.experts.routed} experts, ${K3.experts.active} active) and borrow K2's blueprint where not (${bp.layers} layers, d&nbsp;=&nbsp;${bp.dModel.toLocaleString('en-US')}).`),

    widget('Build your own trillion-parameter model', 'drag the sliders — arithmetic updates live', calculatorBody()),
    prose(
      `<em>Fig. 6.1 — simplified accounting: standard attention (4d² per layer, no MLA compression), SwiGLU-style experts (3·d·d_ff each, +1 shared), untied embeddings; norms and router weights are negligible. The presets switch to K2 or DeepSeek-V3 dimensions.</em>`),

    prose(
      `Three readings worth taking from the bar. <strong>The expert MLPs are effectively all of the model</strong> — which is why chapter 10's fine-tuning methods target these matrices, and why &ldquo;where does the knowledge live&rdquo; has a one-word answer. The <strong>activation ratio</strong> is the whole MoE bargain in one number: ${K3.name} runs each token through ~2% of itself. And the <strong>memory line</strong> explains deployment reality: at 4-bit, 2.8T parameters is ~1.4&nbsp;TB of weights — beyond any single accelerator, hence supernodes and the parallelism schemes of the next chapter.`),

    takeaway(
      `<strong>The expert MLPs are effectively all of the model.</strong> The bar is one teal block with two slivers: the knowledge lives in the experts, each token rents ~2% of them, and the terabyte they weigh at 4-bit is what the serving hardware has to carry.`));
}
