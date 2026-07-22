/* Shared authoring components — every chapter builds its page from these,
   so all chapters stay visually and structurally consistent. */

import { el } from './dom.js';
import { reveal } from './scroll.js';

/* Chapter section wrapper: <section class="chapter" id=…> */
export function chapter(id, ...children) {
  return el('section', { class: 'chapter', id }, ...children);
}

/* "04 — THE MECHANISM / Attention, step by step" */
export function chapterHead(num, kicker, title) {
  return reveal(el('header', { class: 'ch-head measure' },
    el('div', { class: 'ch-kicker' }, `${num} — ${kicker}`),
    el('h2', {}, title)));
}

/* One or more paragraphs of body prose. Accepts raw HTML strings. */
export function prose(...paragraphs) {
  return reveal(el('div', { class: 'prose measure' },
    paragraphs.map((p) => el('p', { html: p }))));
}

/* Definition card:  residual connection (n.) — output = input + f(input) */
export function term(word, pos, def) {
  return reveal(el('div', { class: 'term measure' },
    el('span', { class: 't-word' }, word),
    el('span', { class: 't-pos' }, `(${pos})`),
    ' — ',
    el('span', { html: def })));
}

/* Collapsible "▸ The math — … (optional)" aside.
   body: HTML string; equations go in <div class="eq">…</div> */
export function mathAside(title, bodyHtml) {
  return reveal(el('details', { class: 'math-aside measure' },
    el('summary', {},
      el('span', {}, `The math — ${title}`),
      el('span', { class: 'opt' }, 'optional')),
    el('div', { class: 'body', html: bodyHtml })));
}

/* Figure with dark canvas + caption. content is a node (usually <svg>). */
export function figure(figNum, captionHtml, content, { wide = false, bare = false } = {}) {
  return reveal(el('figure', { class: `fig ${wide ? 'wide' : 'measure'}`, style: { margin: '2.2rem auto' } },
    bare ? content : el('div', { class: 'fig-canvas' }, content),
    el('figcaption', {},
      el('span', { class: 'fig-n' }, `Fig. ${figNum} — `),
      el('span', { html: captionHtml }))));
}

/* Interactive widget frame with badge + hint. */
export function widget(title, hint, body, { wide = true } = {}) {
  return reveal(el('div', { class: `widget ${wide ? 'wide' : 'measure'}` },
    el('div', { class: 'w-head' },
      el('span', { class: 'w-badge' }, 'widget'),
      el('span', { class: 'w-title' }, title),
      el('span', { class: 'w-hint' }, hint)),
    el('div', { class: 'w-body' }, body)));
}

/* Emphasized takeaway band. */
export function takeaway(html) {
  return reveal(el('div', { class: 'takeaway measure', html }));
}

/* Spec table: rows = [ [key, value], … ] */
export function specTable(title, sub, rows) {
  return reveal(el('div', { class: 'spec measure' },
    el('div', { class: 'spec-head' },
      el('div', { class: 'spec-title' }, title),
      el('div', { class: 'spec-sub' }, sub)),
    el('div', { class: 'spec-rows' },
      rows.map(([k, v]) => el('div', { class: 'spec-row' },
        el('span', { class: 'k' }, k),
        el('span', { class: 'v', html: v }))))));
}

/* Read a figure-palette color from CSS custom properties. */
export function figColor(name) {
  return getComputedStyle(document.body).getPropertyValue(`--fig-${name}`).trim()
    || getComputedStyle(document.documentElement).getPropertyValue(`--fig-${name}`).trim();
}

/* Static palette for use inside SVG attributes (matches tokens.css --fig-*). */
export const PAL = {
  bg: '#10141A',
  grid: 'rgba(230,237,243,0.06)',
  ink: '#EDF2F7',
  tx: '#C4CCD5',
  mut: '#6B7683',
  weight: '#E0A84C',   // learned weights — amber
  act: '#5AC8DC',      // activations / residual stream — cyan
  attn: '#B48CE0',     // attention — violet
  moe: '#4CC9A8',      // experts — teal
  loss: '#F07850',     // loss / gradients — red-orange
  train: '#7DD87F',    // trainable in adaptation — green
};
