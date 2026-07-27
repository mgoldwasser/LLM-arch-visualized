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
    /* A taller figure than most scenes here, which on a phone leaves the
       opening card starting level with the artwork rather than below it.
       The stacked layout scales this down (see css/components.css); its
       effect here is to give step one enough room to clear the figure. */
    stepVh: 104,
  });
}

function averagingFigure(canvas) {
  const gx = 140, gy = 112, cw = 52, ch = 38, gap = 5;
  const cellsW = [], cellsB = [], cellsC = [];
  /* `data-cell` is for the checks at the bottom of this file: it lets the test
     read the three matrices back off the screen and verify that what is drawn
     really is w @ B, whatever step the reader is on. */
  const mk = (bank, name, x, rows, cols, fill) => {
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const cx = x + j * (cw + gap), cy = gy + i * (ch + gap);
      const label = txt(cx + cw / 2, cy + ch / 2 + 4.3, '', { size: 11.5, fill: PAL.ink, anchor: 'middle', mono: true });
      label.setAttribute('data-cell', `${name}-${i}-${j}`);
      bank.push({
        i, j, cx, cy,
        rect: svg('rect', { x: cx, y: cy, width: cw, height: ch, rx: 4, fill, 'fill-opacity': 0, stroke: PAL.grid }),
        label,
      });
    }
  };
  mk(cellsW, 'w', gx, 3, 3, PAL.attn);
  mk(cellsB, 'b', 334, 3, 2, PAL.act);
  mk(cellsC, 'out', 471, 3, 2, PAL.act);

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

/* ---- per-figure checks (see test/figure-checks.js for the contract) --------

   The claim this figure makes is that the arithmetic on screen is true — that
   a reader can check any cell on paper and it will hold. So the assertion
   reads all three matrices back out of the DOM and verifies out = w @ B using
   matmul() from core/mathtools.js, the same function the figure draws with.

   Deliberately NOT asserted against the step's expected matrix: transcribing
   [[14,16],[14,16],[14,16]] here would keep passing after someone broke
   matmul(). Reading w and B off the screen means the test fails exactly when
   the drawing and the arithmetic disagree, which is the only failure that
   matters — and it keeps passing if the example's numbers are ever changed,
   which is correct, because the figure's job is to be true, not to display
   one particular matrix forever.                                            */

/* The weights are typeset for a reader: '0', '1', exact fractions like '1/3'
   while they are uniform, three decimals once they are softmax outputs. */
function readCell(text) {
  const t = text.replace(/−/g, '-').trim();
  if (t === '') return null;
  const frac = /^(-?\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const v = Number(t);
  if (!Number.isFinite(v)) throw new Error(`cannot read a number from ${JSON.stringify(text)}`);
  return v;
}

function readMatrix(root, name, rows, cols) {
  const M = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      const el = root.querySelector(`[data-cell="${name}-${i}-${j}"]`);
      if (!el) throw new Error(`no cell ${name}-${i}-${j} in the figure`);
      const v = readCell(el.textContent);
      if (v === null) throw new Error(`cell ${name}-${i}-${j} is blank`);
      row.push(v);
    }
    M.push(row);
  }
  return M;
}

const atStep = (i) => (i + 0.5) / 4;    // mid-window of step i, of four

export const checks = [0, 1, 2, 3].flatMap((step) => [
  {
    fig: '#attn-averaging',
    p: atStep(step),
    name: `step ${step + 1}: the output on screen equals w @ B computed from the w and B on screen`,
    assert(root) {
      const W = readMatrix(root, 'w', 3, 3);
      const B = readMatrix(root, 'b', 3, 2);
      const shown = readMatrix(root, 'out', 3, 2);
      const want = matmul(W, B);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          /* Tolerance covers the printed precision of w — a weight shown as
             0.123 carries the rounding into the product. */
          if (Math.abs(shown[i][j] - want[i][j]) > 0.02) {
            throw new Error(`out[${i}][${j}] displays ${shown[i][j]} but w @ B gives ${want[i][j].toFixed(3)}`);
          }
        }
      }
    },
  },
  {
    fig: '#attn-averaging',
    p: atStep(step),
    name: `step ${step + 1}: the weight matrix never lets a token see its future`,
    assert(root) {
      const W = readMatrix(root, 'w', 3, 3);
      /* Step 1 is the deliberate exception — the all-ones matrix is shown
         precisely so that the reader sees what a missing mask looks like. */
      if (step === 0) {
        if (W.some((row) => row.some((v) => v !== 1))) throw new Error('step 1 should be all ones');
        return;
      }
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          if (W[i][j] !== 0) throw new Error(`w[${i}][${j}] is ${W[i][j]}; token ${i} must not see token ${j}`);
        }
      }
    },
  },
  {
    fig: '#attn-averaging',
    p: atStep(step),
    name: `step ${step + 1}: rows sum to 1 once the weights are normalized`,
    assert(root) {
      if (step < 2) return;            // sums are 3 and then 1,2,3 by design
      const W = readMatrix(root, 'w', 3, 3);
      W.forEach((row, i) => {
        const sum = row.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1) > 0.01) {
          throw new Error(`row ${i} of w sums to ${sum.toFixed(3)}, not 1 — it is no longer an average`);
        }
      });
    },
  },
]);
