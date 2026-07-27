/* Chapter-local helpers — everything more than one of this chapter's part
   files needs. Nothing here knows the chapter's number: figure numbers come
   from claimFig()/figure(), chapter numbers from chRef(). */

import { el, svg } from '../../core/dom.js';
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

/* Signed number with a true minus sign — used wherever a figure prints a
   value the reader is meant to check against the arithmetic. */
export const num = (v, d = 2) => {
  const s = Math.abs(v).toFixed(d);
  return (v < 0 && +s !== 0 ? '−' : '') + s;   // never print a signed zero
};

/* A grid of numeric cells: the matrix widget the derivation figures share.
   Built once; the caller's update() sets text and fill idempotently from p,
   so nothing is ever created or destroyed mid-scrub. */
export function matGrid(x, y, rows, cols, { cw = 46, ch = 32, gap = 4, size = 12, fill = PAL.attn } = {}) {
  const cells = [];
  const g = svg('g', {});
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const cx = x + j * (cw + gap), cy = y + i * (ch + gap);
      const rect = svg('rect', { x: cx, y: cy, width: cw, height: ch, rx: 4, fill, 'fill-opacity': 0, stroke: PAL.grid, 'stroke-width': 1 });
      const label = txt(cx + cw / 2, cy + ch / 2 + size * 0.36, '', { size, fill: PAL.ink, anchor: 'middle', mono: true });
      g.append(rect, label);
      cells.push({ rect, label, i, j, cx, cy, cw, ch });
    }
  }
  return {
    g, cells, at: (i, j) => cells[i * cols + j],
    w: cols * (cw + gap) - gap, h: rows * (ch + gap) - gap,
  };
}

/* The three value vectors Karpathy multiplies into the triangular matrix, and
   the tiny q/k that make the last step data-dependent. Two figures derive
   their numbers from these, so both must move together if they ever change. */
export const TRICK_B = [[2, 7], [6, 4], [6, 5]];
export const TRICK_Q = [[1.2, -0.8], [0.4, 1.6], [1.6, -1.0]];
export const TRICK_K = [[1.4, 0.5], [-0.9, 1.7], [1.2, -0.9]];

/* Largest absolute elementwise difference — the whole basis for the
   "identical" badges, so it is computed, never asserted. */
export const maxAbsDiff = (X, Y) =>
  Math.max(...X.map((row, i) => row.map((v, j) => Math.abs(v - Y[i][j]))).flat());
