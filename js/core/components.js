/* Shared authoring components — every chapter builds its page from these,
   so all chapters stay visually and structurally consistent. */

import { el, svg } from './dom.js';
import { reveal } from './scroll.js';
import { claimFig } from './numbering.js';

/* Cross-reference helpers, re-exported so chapters have one import site.
   Never hard-code a chapter or figure number — see docs/AUTHORING.md. */
export { chRef, figRef, claimFig, chNum, chNumShort, chTitle } from './numbering.js';

/* SVG text on the dark figure canvas, with the palette's defaults.
   txt(24, 30, 'label', { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }) */
export function txt(x, y, s, { size = 11, fill = PAL.mut, anchor = 'start', mono = false, opacity } = {}) {
  return svg('text', {
    x, y, fill, 'text-anchor': anchor, 'font-size': size,
    'font-family': mono ? 'monospace' : 'sans-serif',
    ...(opacity != null ? { opacity } : {}),
  }, s);
}

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

/* Figure with dark canvas + caption. content is a node (usually <svg>).

   The figure NUMBER IS NOT PASSED IN — it is claimed automatically, in call
   order, from the chapter currently rendering. Pass `key` to make the figure
   referenceable from prose:  figure('caption…', svgNode, { key: 'variants' })
   then elsewhere:            figRef('attention', 'variants')  → 'Fig. 9.5'

   Legacy 4-argument form — figure('9.5', caption, content, opts) — is still
   accepted during migration; the number given is ignored and auto-assigned. */
export function figure(a, b, c, d) {
  const legacy = typeof b === 'string';
  const captionHtml = legacy ? b : a;
  const content = legacy ? c : b;
  const { wide = false, bare = false, key } = (legacy ? d : c) || {};
  const figNum = claimFig(key);
  return reveal(el('figure', {
    class: `fig ${wide ? 'wide' : 'measure'}`,
    id: key ? `fig-${key}` : null,
    style: { margin: '2.2rem auto' },
  },
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

/* ---- frontier section family ---------------------------------------------
   The standard end-of-chapter research section, mounted via js/extensions/.
   Structure every chapter the same way:

     frontier(num,
       bottleneck('…why this component is inefficient / knowledge-scarce…'),
       researchItem('FlashAttention-3', '2024', 'deployed', '…'),
       researchItem('…', '2025', 'research', '…'),
       novelIdea('…title…', '…clearly-speculative proposal…'),
     )
*/

/* Wrapper band. num is the chapter number, used in the header. */
export function frontier(num, ...children) {
  return el('div', { class: 'frontier wide' },
    reveal(el('header', { class: 'fr-head measure' },
      el('span', { class: 'fr-badge' }, 'frontier'),
      el('span', { class: 'fr-title' }, `${num} · Where this breaks — and what comes next`),
      el('span', { class: 'fr-sub' }, 'bottleneck · current research · speculative directions'))),
    ...children);
}

/* The inefficiency / knowledge-scarcity analysis. */
export function bottleneck(html) {
  return reveal(el('div', { class: 'fr-card fr-bottleneck measure' },
    el('div', { class: 'fr-card-k' }, 'The bottleneck'),
    el('div', { class: 'fr-card-b', html })));
}

/* One line of real research. status: 'deployed' | 'research' | 'contested' */
export function researchItem(name, year, status, html) {
  return reveal(el('div', { class: 'fr-card fr-research measure' },
    el('div', { class: 'fr-card-k' },
      el('span', { class: 'fr-name' }, name),
      el('span', { class: 'fr-year' }, year),
      el('span', { class: `fr-status fr-${status}` }, status)),
    el('div', { class: 'fr-card-b', html })));
}

/* A clearly-labeled speculative proposal (ours, not the literature's). */
export function novelIdea(title, html) {
  return reveal(el('div', { class: 'fr-card fr-novel measure' },
    el('div', { class: 'fr-card-k' },
      el('span', { class: 'fr-name' }, title),
      el('span', { class: 'fr-status fr-speculative' }, 'speculative · our proposal')),
    el('div', { class: 'fr-card-b', html })));
}

/* ---- consequence section family -------------------------------------------
   The other standing end-of-chapter section, also mounted via js/extensions/.
   Where frontier() asks "where is the FIELD stuck", consequence() asks "given
   this mechanism, what will bite the READER" — the failure the chapter's own
   machinery predicts. Chapters that have both carry consequence first: the
   reader-facing cost, then the research frontier.

     consequence(num,
       failureMode('It cannot spell', '<p>…the symptom, concretely…</p>'),
       because('<p>…the mechanism from THIS chapter that causes it…</p>'),
       workaround('<p>…what to do instead, and why that works…</p>'),
     )

   Rule: a consequence section may only invoke mechanisms the chapter has
   already taught. If explaining the failure needs machinery from elsewhere,
   it belongs in that other chapter instead.                                  */

export function consequence(num, ...children) {
  return el('div', { class: 'consequence wide' },
    reveal(el('header', { class: 'cq-head measure' },
      el('span', { class: 'cq-badge' }, 'in practice'),
      el('span', { class: 'cq-title' }, `${num} · What this costs you`),
      el('span', { class: 'cq-sub' }, 'the failure this mechanism predicts'))),
    ...children);
}

/* The symptom, stated as the reader would encounter it. */
export function failureMode(name, html) {
  return reveal(el('div', { class: 'fr-card cq-card cq-symptom measure' },
    el('div', { class: 'fr-card-k' },
      el('span', { class: 'fr-name' }, name),
      el('span', { class: 'cq-tag' }, 'symptom')),
    el('div', { class: 'fr-card-b', html })));
}

/* The mechanical cause — must come from this chapter. */
export function because(html) {
  return reveal(el('div', { class: 'fr-card cq-card measure' },
    el('div', { class: 'fr-card-k' }, el('span', { class: 'fr-name' }, 'Why')),
    el('div', { class: 'fr-card-b', html })));
}

/* What to do instead, and why that works. */
export function workaround(html) {
  return reveal(el('div', { class: 'fr-card cq-card cq-fix measure' },
    el('div', { class: 'fr-card-k' }, el('span', { class: 'fr-name' }, 'What to do instead')),
    el('div', { class: 'fr-card-b', html })));
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
