/* Widget — patchify: what one image costs. The token bill is real arithmetic,
   (resolution / patch)², recomputed on every slider move and priced against
   K3's real context window. Its caption lives in the prose paragraph that
   follows in index.js, so the number is claimed here. */

import { el, svg, svgRoot } from '../../core/dom.js';
import { widget, claimFig, PAL } from '../../core/components.js';
import { si, pct } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { photoArt } from './art-photo.js';

const PATCH_SIZES = [8, 14, 16, 32];
const RESOLUTIONS = [256, 512, 1024];
const PAGE_TOKENS = 500;          // ~a paperback page of English, tokenized
const WORDS_PER_TOKEN = 0.75;

function patchifyBody() {
  const state = { pi: 2, ri: 1 };  // patch 16 · resolution 512
  const S = 300;

  const gridPath = svg('path', { d: '', stroke: 'rgba(237,242,247,0.55)', 'stroke-width': 0.6, fill: 'none' });
  const art = photoArt(S);
  const svgNode = svgRoot(S, S, {
    role: 'img', 'aria-label': 'The photograph with a live patch-grid overlay; the grid density updates as the patch size and resolution sliders move.',
    style: { display: 'block', width: '100%', height: 'auto', maxWidth: '320px', borderRadius: '8px' },
  }, art, gridPath, svg('rect', { width: S, height: S, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 }));

  const patchVal = el('span', { class: 'sl-v' }, '');
  const resVal = el('span', { class: 'sl-v' }, '');
  const patchSlider = el('input', {
    type: 'range', min: 0, max: PATCH_SIZES.length - 1, step: 1, value: state.pi,
    'aria-label': 'patch size in pixels',
    oninput: () => { state.pi = +patchSlider.value; update(); },
  });
  const resSlider = el('input', {
    type: 'range', min: 0, max: RESOLUTIONS.length - 1, step: 1, value: state.ri,
    'aria-label': 'image resolution in pixels',
    oninput: () => { state.ri = +resSlider.value; update(); },
  });
  const sliders = el('div', {},
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'patch size (px)'), patchSlider, patchVal),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'image resolution (px)'), resSlider, resVal));

  const formula = el('div', {
    style: { fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--fig-act)', margin: '0.5rem 0 0.8rem' },
  }, '');

  const cell = (label, hi = false) => {
    const v = el('div', { class: `sg-v${hi ? ' hi' : ''}` }, '—');
    return { root: el('div', { class: 'sg-cell' }, v, el('div', { class: 'sg-k' }, label)), v };
  };
  const cTokens = cell('image tokens', true);
  const cWords = cell('≈ English words of context');
  const cPages = cell('≈ pages of prose');
  const cBudget = cell(`share of K3's ${si(K3.contextWindow)} window`);
  const stats = el('div', { class: 'stat-grid' }, cTokens.root, cWords.root, cPages.root, cBudget.root);

  const note = el('div', { style: { fontSize: '0.76rem', color: 'var(--fig-mut)', marginTop: '0.6rem' } },
    'Halve the patch size and the bill quadruples; double the resolution and it quadruples again. This is why pipelines tile large images, downsample, or pool patch tokens before the LLM ever sees them.');

  function update() {
    const patch = PATCH_SIZES[state.pi], res = RESOLUTIONS[state.ri];
    const n = Math.floor(res / patch);
    const tokens = n * n;
    patchVal.textContent = `${patch} px`;
    resVal.textContent = `${res} px`;

    // grid overlay — n×n cells over the S×S display
    const c = S / n;
    let d = '';
    for (let i = 1; i < n; i++) d += `M ${(i * c).toFixed(2)} 0 V ${S} M 0 ${(i * c).toFixed(2)} H ${S} `;
    gridPath.setAttribute('d', d);
    gridPath.setAttribute('stroke-width', n > 40 ? 0.4 : 0.7);

    formula.textContent = `tokens = (${res} / ${patch})² = ${n}² = ${tokens.toLocaleString('en-US')}`;
    cTokens.v.textContent = tokens.toLocaleString('en-US');
    cWords.v.textContent = Math.round(tokens * WORDS_PER_TOKEN).toLocaleString('en-US');
    cPages.v.textContent = (tokens / PAGE_TOKENS).toFixed(tokens / PAGE_TOKENS < 10 ? 1 : 0);
    cBudget.v.textContent = pct(tokens / K3.contextWindow, tokens / K3.contextWindow < 0.01 ? 2 : 1);
  }
  update();

  return el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '1.4rem', alignItems: 'flex-start' } },
    el('div', { style: { flex: '0 1 320px', minWidth: '220px' } }, svgNode),
    el('div', { style: { flex: '1 1 300px', minWidth: '260px' } }, sliders, formula, stats, note));
}

export function patchifyWidget() {
  claimFig('patchify');
  return widget('Patchify: what one image costs', 'drag the sliders — the grid and the token bill update live', patchifyBody());
}
