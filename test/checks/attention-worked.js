/* Worked example 1 of the per-figure mechanism (plan 5.2).

   Target: the attention chapter's hand-checkable figure — Q, K, V, the masked
   score matrix S, and the softmax rows A, all rendered as grids of numbers.

   Every input to this test is READ OFF THE FIGURE. Nothing is transcribed:
   Q, K and V come out of the DOM, the expected S and A are computed from them
   by js/core/mathtools.js — the same module the figure itself uses — and the
   rendered S and A are compared against that. If someone breaks attention(),
   softmax() or dot(), this fails. If someone changes the example's numbers,
   it keeps passing, which is correct: the figure's job is to be arithmetically
   true, not to display one particular matrix forever.

   This file lives under test/ only because the harness may not edit js/. In
   normal use these three entries would be `export const checks` at the bottom
   of js/chapters/attention/fig-worked-example.js.                            */

import { attention, softmax, round } from '../../js/core/mathtools.js';

const FIG = '#fig-worked';
const P = 0.6;                      // past the last stage's fade-in window

/* The figure prints negatives with U+2212 MINUS SIGN and masked cells as
   "−∞", because it is typeset for a reader, not for a parser. */
function num(s) {
  const t = s.replace(/−/g, '-').trim();
  if (/^-?∞$/.test(t)) return t.startsWith('-') ? -Infinity : Infinity;
  const v = Number(t);
  if (!Number.isFinite(v)) throw new Error(`cannot read a number from ${JSON.stringify(s)}`);
  return v;
}

/* Grids are CSS grid: "<row-label> 2.9em repeat(n, 3.1em)". Cells are in
   document order, optionally preceded by a header row. */
function grids(root) {
  return [...root.querySelectorAll('div')]
    .filter((d) => d.style.display === 'grid' && d.style.gridTemplateColumns);
}

/* Data columns, excluding the row-label column on the left. */
function colCount(gridEl) {
  const s = gridEl.style.gridTemplateColumns;
  const m = /repeat\(\s*(\d+)\s*,/.exec(s);
  if (m) return Number(m[1]);
  return s.trim().split(/\s+/).length - 1;
}

/* A grid carries column headers when its very first cell is the blank corner
   above the row labels. That is a structural fact, not a guess about shape. */
const isHeaded = (gridEl) => gridEl.children[0].textContent.trim() === '';

function readGrid(gridEl) {
  const cols = colCount(gridEl);
  let cells = [...gridEl.children];
  if (isHeaded(gridEl)) cells = cells.slice(cols + 1);
  const rows = [];
  for (let i = 0; i + cols < cells.length + 1; i += cols + 1) {
    rows.push(cells.slice(i + 1, i + 1 + cols).map((c) => num(c.textContent)));
  }
  return rows;
}

/* Q, K, V are the three unheaded grids; S and A the two headed ones. Read by
   structure rather than by position, so reordering the cards does not
   silently turn this into a check of the wrong matrix. */
function matrices(root) {
  const all = grids(root);
  const headed = all.filter(isHeaded);
  const plain = all.filter((g) => !isHeaded(g));
  if (plain.length !== 3 || headed.length !== 2) {
    throw new Error(`expected 3 vector grids and 2 matrix grids, found ${plain.length} and ${headed.length}`);
  }
  return {
    Q: readGrid(plain[0]),
    K: readGrid(plain[1]),
    V: readGrid(plain[2]),
    S: readGrid(headed[0]),
    A: readGrid(headed[1]),
  };
}

const eq2 = (a, b) => Math.abs(a - b) <= 0.005 || (a === b);

export const checks = [
  {
    fig: FIG,
    p: P,
    name: 'S equals attention(Q, K, V) computed from the figure’s own Q, K, V',
    assert(root) {
      const { Q, K, V, S } = matrices(root);
      const ref = attention(Q, K, V, 2).S;              // the reference computation
      for (let i = 0; i < S.length; i++) {
        for (let j = 0; j < S[i].length; j++) {
          const want = Number.isFinite(ref[i][j]) ? round(ref[i][j], 2) : ref[i][j];
          if (!eq2(S[i][j], want)) {
            throw new Error(`S[${i}][${j}] displays ${S[i][j]} but QKᵀ/√2 gives ${want}`);
          }
        }
      }
    },
  },
  {
    fig: FIG,
    p: P,
    name: 'the causal mask is exact — nothing above the diagonal',
    assert(root) {
      const { S, A } = matrices(root);
      for (const [label, M] of [['S', S], ['A', A]]) {
        for (let i = 0; i < M.length; i++) {
          for (let j = 0; j < M[i].length; j++) {
            const masked = M[i][j] === -Infinity;
            if (j > i && !masked) throw new Error(`${label}[${i}][${j}] is ${M[i][j]}, but token ${i} must not see token ${j}`);
            if (j <= i && masked) throw new Error(`${label}[${i}][${j}] is masked, but token ${i} must see token ${j}`);
          }
        }
      }
    },
  },
  {
    fig: FIG,
    p: P,
    name: 'A is softmax(S) row-wise, and every row sums to 1',
    assert(root) {
      const { S, A } = matrices(root);
      for (let i = 0; i < A.length; i++) {
        /* The figure softmaxes the scores it displays, so the reference is
           softmax of the displayed row — which is what makes this a check of
           softmax() rather than a check of rounding. */
        const ref = softmax(S[i]).map((v) => round(v, 2));
        for (let j = 0; j <= i; j++) {
          if (!eq2(A[i][j], ref[j])) {
            throw new Error(`A[${i}][${j}] displays ${A[i][j]} but softmax(S[${i}]) gives ${ref[j]}`);
          }
        }
        const sum = A[i].filter(Number.isFinite).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1) > 0.02) {
          throw new Error(`row ${i} of A sums to ${sum.toFixed(3)}, not 1 (attention weights must be a distribution)`);
        }
      }
    },
  },
];
