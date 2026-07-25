/* Figure — attention with actual numbers, small enough to check by hand.
   S, A and z are computed live by the same code path the rest of the site
   uses (core/mathtools.js); nothing here is a typed-in result. */

import { el } from '../../core/dom.js';
import { figure } from '../../core/components.js';
import { seg, lerp, ease } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { attention, softmax, round } from '../../core/mathtools.js';

export function workedExample() {
  const TOKS = ['the', 'cat', 'sat', 'down'];
  const Q = [[1.2, 0.4], [0.2, 1.0], [1.0, 0.8], [0.6, -0.4]];
  const Km = [[1.0, 0.2], [0.4, 1.2], [0.8, 0.6], [0.2, -0.8]];
  const V = [[0.5, 1.0], [-0.3, 0.7], [0.9, 0.1], [0.4, -0.2]];

  const { S } = attention(Q, Km, V, 2);                    // live: scores + causal mask
  const Sr = S.map((r) => r.map((v) => (Number.isFinite(v) ? round(v, 2) : v)));
  const A = Sr.map((r) => softmax(r).map((v) => round(v, 2))); // softmax of the displayed scores
  const zSat = [0, 1].map((c) => round(A[2].reduce((s, a, j) => s + a * V[j][c], 0), 2));

  const f1 = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
  const f2 = (v) => (Number.isFinite(v) ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(2) : '−∞');

  const card = (titleHtml, gridEl, annotation) => el('div', {
    style: { background: 'rgba(230,237,243,0.03)', border: '1px solid rgba(230,237,243,0.1)', borderRadius: '10px', padding: '0.7rem 0.9rem 0.8rem', fontFamily: 'var(--mono)', fontSize: '0.76rem', color: 'var(--fig-tx)' },
  },
    el('div', { style: { marginBottom: '0.55rem', fontSize: '0.8rem' }, html: titleHtml }),
    gridEl,
    annotation ? el('div', { style: { marginTop: '0.55rem', fontSize: '0.68rem', color: 'var(--fig-mut)', maxWidth: '21rem', lineHeight: 1.6 }, html: annotation }) : null);

  const grid = (colHeads, data, { hlRow = -1, fmt, heat = false } = {}) => {
    const cols = data[0].length;
    const cell = (content, style) => el('div', { style: { padding: '0.18rem 0.15rem', textAlign: 'center', borderRadius: '4px', ...style } }, content);
    const kids = [];
    if (colHeads) {
      kids.push(cell('', {}));
      colHeads.forEach((h) => kids.push(cell(h, { color: 'var(--fig-mut)' })));
    }
    data.forEach((row, i) => {
      const hl = i === hlRow;
      kids.push(cell(TOKS[i], { color: hl ? 'var(--fig-attn)' : 'var(--fig-mut)', textAlign: 'right', paddingRight: '0.4rem', fontWeight: hl ? '700' : '400' }));
      row.forEach((v) => {
        const masked = !Number.isFinite(v);
        kids.push(cell(fmt(v), {
          background: masked ? '#0B0F14'
            : heat ? `rgba(180,140,224,${(0.08 + v * 0.75).toFixed(2)})`
            : hl ? 'rgba(180,140,224,0.22)' : 'rgba(90,200,220,0.07)',
          color: masked ? 'var(--fig-mut)' : hl ? 'var(--fig-ink)' : 'var(--fig-tx)',
          outline: hl ? '1px solid rgba(180,140,224,0.55)' : 'none',
        }));
      });
    });
    return el('div', { style: { display: 'grid', gridTemplateColumns: `2.9em repeat(${cols}, 3.1em)`, gap: '2px' } }, kids);
  };

  const stage1 = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.9rem' } },
    card('<span style="color:var(--fig-act)">Q</span> = X·<span style="color:var(--fig-weight)">W_Q</span>', grid(null, Q, { hlRow: 2, fmt: f1 })),
    card('<span style="color:var(--fig-act)">K</span> = X·<span style="color:var(--fig-weight)">W_K</span>', grid(null, Km, { fmt: f1 })),
    card('<span style="color:var(--fig-act)">V</span> = X·<span style="color:var(--fig-weight)">W_V</span>', grid(null, V, { fmt: f1 })));

  const stage23 = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.9rem' } },
    card('<span style="color:var(--fig-attn)">S</span> = QKᵀ/√2, masked', grid(TOKS, Sr, { hlRow: 2, fmt: f2 }),
      'e.g. row sat: q_sat·k_cat = (1.0)(0.4)+(0.8)(1.2) = 1.36; ÷√2 = 0.96'),
    card('<span style="color:var(--fig-attn)">A</span> = softmax per row', grid(TOKS, A.map((r, i) => r.map((v, j) => (j <= i ? v : -Infinity))), { hlRow: 2, fmt: f2, heat: true }),
      `row sat: e^${f2(Sr[2][0])}, e^${f2(Sr[2][1])}, e^${f2(Sr[2][2])} → normalize → ${f2(A[2][0])}, ${f2(A[2][1])}, ${f2(A[2][2])}`));

  const stage4 = el('div', {
    style: { fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--fig-ink)', background: 'rgba(180,140,224,0.1)', border: '1px solid rgba(180,140,224,0.35)', borderRadius: '10px', padding: '0.7rem 0.9rem', lineHeight: 1.7 },
    html: `z_sat = ${f2(A[2][0])}·v_the + ${f2(A[2][1])}·v_cat + ${f2(A[2][2])}·v_sat = [${f2(zSat[0])}, ${f2(zSat[1])}] → ×<span style="color:var(--fig-weight)">W_O</span> → added to sat&rsquo;s residual stream`,
  });

  const stages = [stage1, stage23, stage4];
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.4rem', overflowX: 'auto' } }, stages);
  stages.forEach((s) => { s.style.opacity = 0; s.style.transform = 'translateY(14px)'; });

  const node = figure(
    'the whole mechanism, checkable by hand. The learned part is W_Q, W_K, W_V (which produced these Q, K, V); everything after is fixed arithmetic — S, A, and z here are computed live by the same code path as the figures.',
    wrap, { key: 'worked' });
  const wins = [[0.1, 0.2], [0.22, 0.34], [0.36, 0.48]];
  return pin(node, (p) => {
    stages.forEach((s, i) => {
      const t = seg(p, wins[i][0], wins[i][1], ease.out);
      s.style.opacity = t;
      s.style.transform = `translateY(${lerp(14, 0, t)}px)`;
    });
  });
}
