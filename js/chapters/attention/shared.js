/* Chapter-local helpers — everything more than one of this chapter's part
   files needs. Nothing here knows the chapter's number: figure numbers come
   from claimFig()/figure(), chapter numbers from chRef(). */

import { el } from '../../core/dom.js';
import { txt, claimFig, PAL } from '../../core/components.js';
import { reveal } from '../../core/scroll.js';
import { K3 } from '../../../data/k3.js';

export const BP = K3.blueprint;   // illustrative K2 dims: d 7168, dHead 128, 64 heads

/* Scene canvas, shared by the five stage builders and their composer. */
export const SCENE_W = 720;
export const SCENE_H = 460;

/* Subscript digits for token indices (k₁, v₂, …). */
export const SUB = ['₁', '₂', '₃', '₄', '₅', '₆'];

/* Section subhead (the source's inner headings). */
export const subhead = (s) => reveal(el('h3', { class: 'measure', style: { margin: '3.2rem auto 1rem', fontSize: '1.32rem' } }, s));

/* A standalone equation line (styled like .math-aside .eq, outside an aside). */
export const eqLine = (s) => reveal(el('div', {
  class: 'measure',
  style: {
    fontFamily: 'var(--mono)', fontSize: '0.86em', color: 'var(--ink)',
    background: 'var(--code-bg)', borderRadius: '8px', padding: '0.7rem 0.9rem',
    margin: '1.6rem auto', overflowX: 'auto', lineHeight: 1.7,
  },
}, s));

/* A scene or a widget is a numbered figure whose caption lives in the prose
   paragraph that follows it. Wrap it here so the number is claimed at exactly
   the point the thing appears on the page, keeping figure order = page order. */
export function claimed(key, node) {
  claimFig(key);
  return node;
}

/* Heading pair at the top of each stage of the five-stage scene. */
export const stageTitle = (tag, formula) => [
  txt(24, 32, tag, { size: 11, fill: PAL.attn }),
  txt(24, 54, formula, { size: 12.5, fill: PAL.tx, mono: true }),
];
