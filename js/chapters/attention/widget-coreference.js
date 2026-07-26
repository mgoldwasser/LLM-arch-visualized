/* Widget — who is "it"? A hand-set coreference-style head: click any token to
   see one softmax row of attention weights leaving it. */

import { el } from '../../core/dom.js';
import { widget } from '../../core/components.js';
import { rng } from '../../core/anim.js';

export function coreferenceWidget() {
  const SENT = ['the', 'trophy', 'didn’t', 'fit', 'in', 'the', 'suitcase', 'because', 'it', 'was', 'too', 'big'];
  // Hand-set rows (sum to 1 over j ≤ i); everything after token i is masked.
  const HAND = {
    8:  { 1: 0.62, 6: 0.18, 7: 0.05, 8: 0.04, 3: 0.04, 2: 0.03, 0: 0.02, 4: 0.01, 5: 0.01 },              // "it"
    11: { 1: 0.44, 8: 0.26, 3: 0.10, 10: 0.06, 6: 0.05, 9: 0.03, 7: 0.02, 0: 0.01, 2: 0.01, 4: 0.01, 5: 0.01, 11: 0 }, // "big"
    3:  { 1: 0.58, 2: 0.20, 3: 0.12, 0: 0.10 },                                                            // "fit"
  };
  const weightsFor = (i) => {
    if (HAND[i]) return SENT.map((_, j) => (j <= i ? (HAND[i][j] || 0) : null));
    const r = rng(104 + i * 13);
    const raw = SENT.map((_, j) => {
      if (j > i) return null;
      let v = 0.15 + r() * 0.5;
      if (j === i) v += 0.9;               // self
      if (j === i - 1) v += 0.7;           // recency
      if (j === 1 || j === 6) v += 0.35;   // the nouns pull a little
      return v;
    });
    const tot = raw.reduce((s, v) => s + (v || 0), 0);
    return raw.map((v) => (v == null ? null : v / tot));
  };

  const buttons = SENT.map((t, i) => el('button', { class: 'tok', type: 'button', onclick: () => select(i) }, t));
  const title = el('div', { style: { fontSize: '0.78rem', color: 'var(--fig-mut)', margin: '1rem 0 0.6rem' } });
  const rows = SENT.map(() => {
    const label = el('span', { style: { fontFamily: 'var(--mono)', fontSize: '0.76rem', textAlign: 'right', color: 'var(--fig-tx)', overflow: 'hidden', textOverflow: 'ellipsis' } });
    const bar = el('div', { style: { height: '100%', width: '0%', background: 'var(--fig-attn)', borderRadius: '4px', transition: 'width 300ms var(--ease-out)' } });
    const barBox = el('div', { style: { height: '0.85rem', background: 'rgba(230,237,243,0.05)', borderRadius: '4px', overflow: 'hidden' } }, bar);
    const val = el('span', { style: { fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--fig-mut)' } });
    const row = el('div', { style: { display: 'grid', gridTemplateColumns: '5.2em 1fr 3.4em', gap: '0.6rem', alignItems: 'center', margin: '0.18rem 0' } }, label, barBox, val);
    return { row, label, bar, val };
  });

  function select(i) {
    buttons.forEach((b, j) => b.classList.toggle('sel', j === i));
    title.innerHTML = `attention weights from &ldquo;<strong style="color:var(--fig-ink)">${SENT[i]}</strong>&rdquo; (one softmax row — sums to 1; later tokens masked out)`;
    const w = weightsFor(i);
    rows.forEach((r, j) => {
      r.label.textContent = SENT[j];
      if (w[j] == null) {
        r.label.style.opacity = 0.35;
        r.bar.style.width = '0%';
        r.val.textContent = 'masked';
        r.val.style.opacity = 0.4;
      } else {
        r.label.style.opacity = 1;
        r.bar.style.width = (w[j] * 100).toFixed(1) + '%';
        r.val.textContent = '.' + String(Math.round(w[j] * 100)).padStart(2, '0');
        r.val.style.opacity = 1;
      }
    });
  }

  const body = el('div', {},
    el('div', { class: 'tokens' }, buttons),
    title,
    el('div', {}, rows.map((r) => r.row)));
  select(8);
  return widget('Who is “it”?', 'click a token — bars = attention weights from it', body, { wide: false });
}
