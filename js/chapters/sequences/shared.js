/* Small helpers shared by this chapter's figures, scene, and widget.
   Everything here is pure formatting or shared constants — no state. */

import { el } from '../../core/dom.js';
import { reveal } from '../../core/scroll.js';
import { txt, PAL } from '../../core/components.js';

/* ---- the specimen sentence, shared by every part of the sticky scene ------ */

export const TOK = ['the', 'cat', 'sat', 'on', 'the', 'mat'];
export const T = TOK.length;
export const ODD = 1;                    // the token sentence B swaps out
export const ODD_TOK = 'wombat';
export const NGRAM = 3;
export const WINDOWS = T - NGRAM + 1;
export const GAMMA = 0.7;                // illustrative per-step Jacobian norm
export const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆'];

/* Stage heading + formula line, at fixed positions on the scene canvas. */
export const stageTag = (s, fill) => txt(24, 30, s, { size: 11, fill });
export const stageFormula = (s) => txt(24, 52, s, { size: 12.5, fill: PAL.tx, mono: true });

const SUPCH = { '-': '⁻', '−': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/* 26 → '²⁶' */
export const sup = (n) => String(n).split('').map((c) => SUPCH[c] ?? c).join('');

/* 1.05e26 → '1.0 × 10²⁶'; small values stay decimal. */
export function sci(v, d = 1) {
  if (!Number.isFinite(v)) return '∞';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e4 || a < 1e-3) return sciFromLog10(Math.log10(a), d, v < 0);
  if (a >= 1000) return Math.round(v).toLocaleString('en-US');
  return String(parseFloat(v.toPrecision(a >= 1 ? 3 : 2)));
}

/* For quantities that overflow a double — pass log₁₀ directly. */
export function sciFromLog10(L, d = 1, neg = false) {
  const e = Math.floor(L);
  const m = 10 ** (L - e);
  return `${neg ? '−' : ''}${m.toFixed(d)} × 10${sup(e)}`;
}

/* The corpus the counting argument is measured against. Matches the scale
   quoted in the pretraining chapter (Kimi K2.5: ~15 trillion tokens). */
export const CORPUS = 15e12;
export const CORPUS_LABEL = 'a 15-trillion-token pretraining corpus';

/* Order-of-magnitude reference quantities, for "more entries than …" lines.
   All are rounded physical estimates, used only for scale intuition. */
export const REFS = [
  { v: 7.5e18, label: 'grains of sand on Earth' },
  { v: 1e24, label: 'stars in the observable universe' },
  { v: 7e27, label: 'atoms in a human body' },
  { v: 1.3e50, label: 'atoms in the Earth' },
  { v: 1e80, label: 'atoms in the observable universe' },
];

/* Largest reference strictly smaller than v (so the ratio reads > 1). */
export const refBelow = (v) => REFS.filter((r) => r.v < v).pop() ?? REFS[0];

/* '6.1 × 10¹³ times more entries than a human body has atoms' */
export function moreThan(v) {
  const r = refBelow(v);
  return `${sci(v / r.v)}× more entries than there are ${r.label}`;
}

/* Section subhead, matching the other chapters. */
export const subhead = (s) => reveal(el('h3', {
  class: 'measure', style: { margin: '3.2rem auto 1rem', fontSize: '1.32rem' },
}, s));

/* A standalone equation line outside a math aside. */
export const eqLine = (s) => reveal(el('div', {
  class: 'measure',
  style: {
    fontFamily: 'var(--mono)', fontSize: '0.86em', color: 'var(--ink)',
    background: 'var(--code-bg)', borderRadius: '8px', padding: '0.7rem 0.9rem',
    margin: '1.6rem auto', overflowX: 'auto', lineHeight: 1.7,
  },
}, s));
