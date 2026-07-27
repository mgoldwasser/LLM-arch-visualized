/* The spelling widget for the chapter's consequence section. A word is shown
   twice, on the same grid: as the letters you read, and as the opaque blocks
   the transformer is handed. The blocks are aligned to the letters they
   swallowed, so the missing boundaries are visible rather than described.
   Segmentation comes from ./toy-bpe.js — the block count is measured. */

import { el, empty } from '../../core/dom.js';
import { widget } from '../../core/components.js';
import { toyTokenize, tokenId } from './toy-bpe.js';

const DEFAULT = 'strawberry';
const PRESETS = ['strawberry', 'raspberry', 'unbelievability', 'Mississippi'];
const MAX = 22;

const ROW = { display: 'grid', gap: '4px', margin: '0 auto', maxWidth: '30rem' };
const CELL = {
  height: '2.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--mono)', fontSize: '0.9rem', borderRadius: '5px',
  border: '1px solid rgba(230,237,243,0.16)', color: 'var(--fig-ink)',
};
const HEAD = {
  fontSize: '0.64rem', letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--fig-mut)', margin: '1rem auto 0.4rem', maxWidth: '30rem',
};

function body() {
  const input = el('input', {
    type: 'text', value: DEFAULT, maxlength: String(MAX), spellcheck: 'false',
    'aria-label': 'a word to tokenize',
    style: {
      fontFamily: 'var(--mono)', fontSize: '0.9rem', padding: '0.35rem 0.6rem',
      borderRadius: '6px', border: '1px solid rgba(230,237,243,0.2)',
      background: 'rgba(230,237,243,0.04)', color: 'var(--fig-ink)', width: '11rem',
    },
  });

  const presets = PRESETS.map((w) => el('button', {
    type: 'button',
    onclick: () => { input.value = w; update(); },
    style: {
      fontFamily: 'var(--mono)', fontSize: '0.72rem', padding: '0.3rem 0.55rem',
      borderRadius: '6px', border: '1px solid rgba(230,237,243,0.16)',
      background: 'transparent', color: 'var(--fig-tx)', cursor: 'pointer',
    },
  }, w));

  const controls = el('div', {
    style: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' },
  }, el('label', { style: { fontSize: '0.8rem', color: 'var(--fig-tx)' } }, 'word'), input, ...presets);

  const letterRow = el('div', { style: ROW });
  const indexRow = el('div', { style: ROW });
  const tokenRow = el('div', { style: ROW });
  const standFor = el('div', { style: { fontSize: '0.72rem', color: 'var(--fig-mut)', marginTop: '0.5rem', textAlign: 'center' } });
  const results = el('div', { 'aria-live': 'polite', style: { marginTop: '1.1rem', display: 'grid', gap: '0.5rem' } });

  function update() {
    const word = (input.value || '').slice(0, MAX);
    const letters = [...word];
    const n = letters.length;
    empty(letterRow); empty(indexRow); empty(tokenRow); empty(results);

    if (!n) {
      standFor.textContent = '';
      results.append(el('div', { style: { fontSize: '0.8rem', color: 'var(--fig-mut)' } }, 'Type a word.'));
      return;
    }

    const cols = `repeat(${n}, minmax(0, 1fr))`;
    letterRow.style.gridTemplateColumns = cols;
    indexRow.style.gridTemplateColumns = cols;
    tokenRow.style.gridTemplateColumns = cols;

    letters.forEach((c, i) => {
      const third = (i + 1) % 3 === 0;
      letterRow.append(el('div', {
        style: {
          ...CELL,
          background: third ? 'rgba(90,200,220,0.18)' : 'transparent',
          borderColor: third ? 'var(--fig-act)' : 'rgba(230,237,243,0.16)',
        },
      }, c));
      indexRow.append(el('div', {
        style: { fontFamily: 'var(--mono)', fontSize: '0.6rem', textAlign: 'center', color: third ? 'var(--fig-act)' : 'var(--fig-mut)' },
      }, String(i + 1)));
    });

    const pieces = toyTokenize(word);
    for (const piece of pieces) {
      const span = [...piece].length;
      tokenRow.append(el('div', {
        style: {
          ...CELL, gridColumn: `span ${span}`, background: 'rgba(90,200,220,0.10)',
          border: '1px solid var(--fig-act)', color: 'var(--fig-weight)', fontSize: '0.82rem',
        },
        title: 'one integer — the letters inside it are not addressable',
      }, String(tokenId(piece))));
    }
    standFor.innerHTML = `these ${pieces.length} integers stand for <span style="color:var(--fig-tx)">`
      + pieces.map((p) => p.replace(/ /g, '·')).join('</span> · <span style="color:var(--fig-tx)">')
      + '</span> — shown for your benefit; the model gets the integers';

    // both answers, computed from the same word
    const counts = new Map();
    for (const c of letters) {
      const k = c.toLowerCase();
      if (k >= 'a' && k <= 'z') counts.set(k, (counts.get(k) || 0) + 1);
    }
    const [top, hits] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || ['—', 0];
    const thirds = letters.filter((_, i) => (i + 1) % 3 === 0);

    const line = (q, you, model) => el('div', { style: { fontSize: '0.8rem', lineHeight: '1.55' } },
      el('span', { style: { color: 'var(--fig-mut)' } }, q + ' '),
      el('span', { html: `<strong style="color:var(--fig-act)">you:</strong> ${you} ` }),
      el('span', { html: `<strong style="color:var(--fig-weight)">the model:</strong> ${model}` }));

    results.append(
      line('every third character —',
        thirds.length ? `${thirds.join(', ')}, read straight off positions ${letters.map((_, i) => i + 1).filter((i) => i % 3 === 0).join(', ')}.` : 'the word is too short to have one.',
        `${pieces.length} block${pieces.length === 1 ? '' : 's'} and no third character to point at.`),
      line(`how many “${top}” —`,
        `${hits}, by looking.`,
        'must recall the spelling from text that discussed it, because the blocks do not contain letters.'),
    );
  }

  input.addEventListener('input', update);
  update();

  return el('div', {},
    controls,
    el('div', { style: HEAD }, 'what you see'),
    letterRow, indexRow,
    el('div', { style: HEAD }, 'what the model receives'),
    tokenRow, standFor,
    results,
    el('div', { class: 'w-note' }, 'Blocks are drawn over the letters they swallowed. Inside a block there is no position 1, no position 2 — there is one integer, and one row of the embedding matrix. Segmentation here uses a miniature illustrative merge list, so the block boundaries are indicative rather than any particular vendor’s.'));
}

export function spellingWidget() {
  return widget('What you see · what the model receives',
    'type a word — the blocks below are what the transformer is handed', body());
}
