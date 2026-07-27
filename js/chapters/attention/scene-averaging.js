/* Scene — the averaging trick. A triangular matrix of weights multiplied into
   three value vectors, computed cell by cell so the reader can check every
   product on paper, and mutated in four steps until it is attention.

   Nothing here is transcribed: the weights come from tril / row-normalization /
   softmax, and every output cell comes from matmul() in core/mathtools.js. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, clamp } from '../../core/anim.js';
import { dot, softmax, matmul } from '../../core/mathtools.js';
import { SCENE_W, SCENE_H, TRICK_B as B, TRICK_Q, TRICK_K, num } from './shared.js';

const ONES = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
const TRIL = [[1, 0, 0], [1, 1, 0], [1, 1, 1]];
const TRILN = TRIL.map((r) => { const s = r.reduce((a, b) => a + b, 0); return r.map((v) => v / s); });
const SCORES = TRICK_Q.map((q, i) => TRICK_K.map((k, j) => (j <= i ? dot(q, k) / Math.SQRT2 : -Infinity)));
const AFF = SCORES.map((r) => softmax(r));

const WS = [ONES, TRIL, TRILN, AFF];          // the four weight matrices
const OUT = WS.map((W) => matmul(W, B));      // and their live products

const OPS = [
  'w = ones(3,3);          out = w @ B',
  'w = tril(ones(3,3));    out = w @ B',
  'w /= w.sum(1, keepdim); out = w @ B',
  'w = softmax(mask(q @ kᵀ / √d));  out = w @ B',
];
const TAGS = ['SUM EVERYTHING', 'DROP THE FUTURE', 'NORMALIZE', 'LET THE DATA CHOOSE'];
const CONCLUSION = [
  ['every row of w is identical, so every output row is identical', 'the column totals of B — one number per feature, no sense of position'],
  ['a zero weight deletes a term, so row i totals only B rows 0…i', 'running sums. That is the entire causal mask: zeros in the top-right triangle'],
  ['the weights of row i now sum to 1, so out row i is a mean', 'running averages — a token carrying a summary of its own past'],
  ['the weights still sum to 1 and still ignore the future — they are simply no longer equal', 'this is attention: a weighted average whose weights the data chooses'],
];

/* Weights are shown so that the working checks out exactly at the precision
   printed: exact fractions while they are 1/(i+1), three decimals once they
   are softmax outputs. */
const fmtW = (v, s) => {
  if (v === 0) return '0';
  if (v === 1) return '1';
  return s === 2 ? `1/${Math.round(1 / v)}` : v.toFixed(3);
};

export function averagingScene() {
  return createScene({
    id: 'attn-averaging',
    steps: [
      { n: 'STEP 1 / 4 — SUM EVERYTHING', html: `<p>Start with a 3&times;3 matrix of ones and multiply it into B, three tokens&rsquo; worth of two-dimensional values. Matrix multiplication says row <em>i</em> of the output is a weighted sum of B&rsquo;s rows, with row <em>i</em> of the weight matrix supplying the weights.</p><p>Every row of the weight matrix is the same, so every output row is the same: B&rsquo;s column totals. Nothing has been learned. But the shape of the machine — <em>each output is a weighted combination of every value vector</em> — is already the shape of attention.</p>` },
      { n: 'STEP 2 / 4 — DROP THE FUTURE', html: `<p>Zero the entries above the diagonal. A zero weight deletes its term from the sum, so row 1 totals only B&rsquo;s first row, row 2 the first two, row 3 all three. Watch the struck-out terms in the working: they are not skipped by an <code>if</code>, they are multiplied by zero.</p><p>Running sums, produced by nothing more than putting zeros in the right half of a matrix. This is the causal mask, and it is the whole of the causal mask.</p>` },
      { n: 'STEP 3 / 4 — NORMALIZE', html: `<p>Divide each row of the weight matrix by its own total, so every row sums to 1. The running sums become running averages: token 3&rsquo;s output is the mean of the three value vectors it is allowed to see.</p><p>A token now carries a summary of its own past. It is a crude summary — every earlier token counts exactly as much as every other — but it is a summary, and it is differentiable.</p>` },
      { n: 'STEP 4 / 4 — LET THE DATA CHOOSE', html: `<p>The uniform weights are the last arbitrary thing left. Replace them: give every token a query and every token a key, score each pair with q&middot;k&nbsp;/&nbsp;&radic;d, set the future to &minus;&infin;, and softmax each row.</p><p>The row sums are still 1. The future is still invisible. The only thing that changed is that the weights are now a function of the content — and the running average became a lookup.</p>` },
    ],
    figure: averagingFigure,
  });
}

function averagingFigure(canvas) {
  const gx = 140, gy = 112, cw = 52, ch = 38, gap = 5;
  const cellsW = [], cellsB = [], cellsC = [];
  const mk = (bank, x, rows, cols, fill) => {
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const cx = x + j * (cw + gap), cy = gy + i * (ch + gap);
      bank.push({
        i, j, cx, cy,
        rect: svg('rect', { x: cx, y: cy, width: cw, height: ch, rx: 4, fill, 'fill-opacity': 0, stroke: PAL.grid }),
        label: txt(cx + cw / 2, cy + ch / 2 + 4.3, '', { size: 11.5, fill: PAL.ink, anchor: 'middle', mono: true }),
      });
    }
  };
  mk(cellsW, gx, 3, 3, PAL.attn);
  mk(cellsB, 334, 3, 2, PAL.act);
  mk(cellsC, 471, 3, 2, PAL.act);

  const opTag = txt(24, 32, '', { size: 11, fill: PAL.attn });
  const opLine = txt(24, 54, '', { size: 12.5, fill: PAL.tx, mono: true });
  const heads = [
    txt(gx, 100, 'w — the weights', { size: 10.5, fill: PAL.attn, mono: true }),
    txt(334, 100, 'B — the values', { size: 10.5, fill: PAL.act, mono: true }),
    txt(471, 100, 'out = w @ B', { size: 10.5, fill: PAL.act, mono: true }),
  ];
  const rowTags = [0, 1, 2].map((i) => txt(gx - 12, gy + i * (ch + gap) + ch / 2 + 4.4, `t${i + 1}`, { size: 10.5, anchor: 'end', mono: true }));
  const at = txt(320, gy + 62 + 4, '@', { size: 15, fill: PAL.mut, anchor: 'middle', mono: true });
  const eq = txt(457, gy + 62 + 4, '=', { size: 15, fill: PAL.mut, anchor: 'middle', mono: true });

  /* The working: one output cell expanded into its three products. */
  const workLabel = txt(gx, 274, 'the cell being computed, term by term', { size: 10.5 });
  const lhs = txt(gx, 302, '', { size: 12.5, fill: PAL.tx, mono: true });
  const TX = [252, 336, 420];
  const terms = TX.map((x) => txt(x, 302, '', { size: 12, fill: PAL.attn, anchor: 'middle', mono: true }));
  const strikes = TX.map((x) => svg('line', { x1: x - 27, y1: 298, x2: x + 27, y2: 298, stroke: PAL.mut, 'stroke-width': 1.3, opacity: 0 }));
  const plus = [294, 378].map((x) => txt(x, 302, '+', { size: 12, fill: PAL.mut, anchor: 'middle', mono: true }));
  const eq2 = txt(452, 302, '=', { size: 12, fill: PAL.mut, anchor: 'middle', mono: true });
  const result = txt(470, 302, '', { size: 12, fill: PAL.act, mono: true });

  const sums = txt(gx, 346, '', { size: 11.5, fill: PAL.tx, mono: true });
  const say1 = txt(SCENE_W / 2, 386, '', { size: 12.5, fill: PAL.ink, anchor: 'middle' });
  const say2 = txt(SCENE_W / 2, 410, '', { size: 11, anchor: 'middle' });

  const root = svgRoot(SCENE_W, SCENE_H, {
    role: 'img',
    'aria-label': 'A three by three weight matrix multiplied into three two-dimensional value vectors, with each output cell expanded into its three products. Across four steps the weight matrix becomes a matrix of ones, then lower-triangular, then row-normalized, then a softmax over data-dependent affinities — and the output goes from column totals to running sums to running averages to attention.',
  },
    opTag, opLine, heads, rowTags, at, eq,
    cellsW.map((c) => [c.rect, c.label]), cellsB.map((c) => [c.rect, c.label]), cellsC.map((c) => [c.rect, c.label]),
    workLabel, lhs, terms, strikes, plus, eq2, result, sums, say1, say2);
  canvas.append(root);

  const update = (p, stepIdx, stepP) => {
    const s = clamp(stepIdx, 0, 3);
    const W = WS[s], C = OUT[s];
    const rise = seg(p, 0, 0.045);

    opTag.textContent = TAGS[s];
    opLine.textContent = OPS[s];
    opTag.setAttribute('opacity', rise);
    opLine.setAttribute('opacity', rise);
    heads.forEach((h) => h.setAttribute('opacity', rise));
    rowTags.forEach((t) => t.setAttribute('opacity', rise));
    at.setAttribute('opacity', rise);
    eq.setAttribute('opacity', rise);

    cellsW.forEach((c) => {
      const v = W[c.i][c.j];
      c.label.textContent = fmtW(v, s);
      c.label.setAttribute('fill', v === 0 ? PAL.mut : PAL.ink);
      c.rect.setAttribute('fill-opacity', 0.1 + v * 0.55);
      c.rect.setAttribute('opacity', rise);
      c.label.setAttribute('opacity', rise);
    });
    cellsB.forEach((c) => {
      c.label.textContent = String(B[c.i][c.j]);
      c.rect.setAttribute('fill-opacity', 0.14);
      c.rect.setAttribute('opacity', rise);
      c.label.setAttribute('opacity', rise);
    });

    /* Six output cells revealed one at a time; the working tracks the newest. */
    const shown = seg(stepP, 0.05, 0.62) * 6;
    cellsC.forEach((c, k) => {
      const t = clamp(shown - k);
      c.label.textContent = C[c.i][c.j].toFixed(2);
      c.rect.setAttribute('fill-opacity', 0.05 + t * 0.16);
      c.rect.setAttribute('opacity', 0.25 + 0.75 * t);
      c.label.setAttribute('opacity', t);
    });

    const k = clamp(Math.floor(shown), 0, 5);
    const i = Math.floor(k / 2), j = k % 2;
    const workOp = seg(stepP, 0.05, 0.14);
    lhs.textContent = `out[${i + 1}][${j + 1}] =`;
    result.textContent = C[i][j].toFixed(2);
    terms.forEach((t, m) => {
      const w = W[i][m];
      t.textContent = `${fmtW(w, s)}·${B[m][j]}`;
      t.setAttribute('fill', w === 0 ? PAL.mut : PAL.attn);
      t.setAttribute('opacity', workOp * (w === 0 ? 0.5 : 1));
      strikes[m].setAttribute('opacity', w === 0 ? workOp * 0.8 : 0);
    });
    [workLabel, lhs, ...plus, eq2, result].forEach((n) => n.setAttribute('opacity', workOp));

    const rs = W.map((r) => r.reduce((a, b) => a + b, 0));
    sums.textContent = `row sums of w:  ${rs.map((v) => num(v)).join('   ')}`;
    sums.setAttribute('opacity', seg(stepP, 0.6, 0.7));
    sums.setAttribute('fill', rs.every((v) => Math.abs(v - 1) < 1e-9) ? PAL.attn : PAL.tx);

    say1.textContent = CONCLUSION[s][0];
    say2.textContent = CONCLUSION[s][1];
    say1.setAttribute('opacity', seg(stepP, 0.66, 0.78));
    say2.setAttribute('opacity', seg(stepP, 0.72, 0.84));
  };
  update(0, 0, 0);          // paint the p=0 state now, so nothing flashes on entry
  return update;
}
