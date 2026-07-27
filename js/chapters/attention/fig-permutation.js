/* Figure — attention has no notion of space. Permute the input rows and the
   output rows permute with them, to the last bit: attention is a function of a
   *set*. Switch positional embeddings on — which attach to the slot, not to the
   token — and the same permutation now changes the answer.

   Both cases are computed here with real projections and a real softmax; the
   badges report the largest elementwise difference, so the property is
   measured rather than asserted. The mask is off throughout, because a causal
   mask is itself positional information and would settle the question by
   fiat. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, clamp } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { dot, softmax, matmul } from '../../core/mathtools.js';
import { matGrid, maxAbsDiff, num, SUB } from './shared.js';

const X = [[0.8, -0.4, 1.1], [-0.5, 1.2, 0.3], [1.0, 0.6, -0.9], [0.2, -1.0, 0.7]];
const POS = [[0.3, 0.1, -0.2], [-0.1, 0.35, 0.15], [0.25, -0.3, 0.05], [-0.35, 0.2, 0.3]];
const WQ = [[0.9, -0.3], [0.2, 0.8], [-0.5, 0.4]];
const WK = [[0.7, 0.5], [-0.4, 0.9], [0.6, -0.2]];
const WV = [[1.0, 0.2], [0.1, -0.8], [-0.6, 0.5]];

const PI = [2, 0, 3, 1];                       // slot s holds token PI[s]
const SLOT = X.map((_, i) => PI.indexOf(i));   // token i sits at slot SLOT[i]
const perm = (M) => PI.map((i) => M[i]);
const add = (M, N) => M.map((r, i) => r.map((v, j) => v + N[i][j]));

/* Unmasked scaled dot-product attention — the mechanism under test. */
function attend(Xin) {
  const Q = matmul(Xin, WQ), K = matmul(Xin, WK), V = matmul(Xin, WV);
  const S = Q.map((q) => K.map((k) => dot(q, k) / Math.sqrt(WQ[0].length)));
  return matmul(S.map((r) => softmax(r)), V);
}

const CASES = [
  { key: 'off', label: 'positional embeddings off', hx: ['X', 'πX'], base: X, permed: perm(X) },
  { key: 'on', label: 'positional embeddings on — the position rides with the slot, not the token', hx: ['X + P', 'πX + P'], base: add(X, POS), permed: add(perm(X), POS) },
].map((c) => {
  const Zbase = attend(c.base), Zperm = attend(c.permed);
  const Zexp = perm(Zbase);
  return { ...c, Zbase, Zperm, Zexp, D: Zperm.map((r, i) => r.map((v, j) => Math.abs(v - Zexp[i][j]))), d: maxAbsDiff(Zperm, Zexp) };
});
const expo = (v) => v.toExponential(1).replace('e+', 'e').replace('e-', 'e−');

export function permutationFigure() {
  const W = 760, H = 452, CW = 38, CH = 24, GAP = 3, PITCH = CH + GAP;
  const marker = svg('marker', { id: 'attn2-perm-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
    svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut }));

  const block = (c, yb, win) => {
    /* The input grid is four row-groups so a row can physically move. */
    const rows = X.map((_, i) => {
      const cells = X[0].map((_, j) => ({
        rect: svg('rect', { x: 92 + j * (CW + GAP), y: yb + i * PITCH, width: CW, height: CH, rx: 3, fill: PAL.act, 'fill-opacity': 0.12, stroke: c.key === 'on' ? PAL.weight : PAL.grid, 'stroke-width': 1 }),
        label: txt(92 + j * (CW + GAP) + CW / 2, yb + i * PITCH + 16, '', { size: 10, fill: PAL.ink, anchor: 'middle', mono: true }),
      }));
      const tag = txt(84, yb + i * PITCH + 16, `t${SUB[i]}`, { size: 10, anchor: 'end', mono: true });
      return { cells, tag, g: svg('g', {}, tag, cells.map((q) => [q.rect, q.label])) };
    });
    const gz = matGrid(306, yb, 4, 2, { cw: CW, ch: CH, gap: GAP, size: 10, fill: PAL.act });
    const ge = matGrid(404, yb, 4, 2, { cw: CW, ch: CH, gap: GAP, size: 10, fill: PAL.act });
    const gd = matGrid(508, yb, 4, 2, { cw: CW, ch: CH, gap: GAP, size: 10, fill: PAL.loss });
    const hIn = txt(92, yb - 8, '', { size: 10, fill: c.key === 'on' ? PAL.weight : PAL.act, mono: true });
    const heads = [txt(306, yb - 8, 'Z(πX)', { size: 10, fill: PAL.act, mono: true }),
      txt(404, yb - 8, 'π Z(X)', { size: 10, fill: PAL.act, mono: true }),
      txt(508, yb - 8, '|Δ|', { size: 10, fill: PAL.loss, mono: true })];
    const mid = svg('g', {},
      svg('path', { d: `M 218 ${yb + 52} L 296 ${yb + 52}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#attn2-perm-arr)' }),
      txt(255, yb + 42, 'attention', { size: 9.5, anchor: 'middle', mono: true }),
      txt(255, yb + 68, 'no mask', { size: 9.5, anchor: 'middle', mono: true }),
      txt(394, yb + 56, 'vs', { size: 11, anchor: 'middle' }),
      txt(494, yb + 56, '→', { size: 11, anchor: 'middle' }));
    const bRect = svg('rect', { x: 600, y: yb + 28, width: 152, height: 48, rx: 8, fill: PAL.train, 'fill-opacity': 0.12, stroke: PAL.train, 'stroke-width': 1.2 });
    const bV = txt(676, yb + 50, '', { size: 11.5, fill: PAL.train, anchor: 'middle', mono: true });
    const bD = txt(676, yb + 66, '', { size: 9.5, fill: PAL.mut, anchor: 'middle', mono: true });
    const cap = txt(24, yb - 24, c.label, { size: 11, fill: PAL.ink });
    const g = svg('g', {}, cap, hIn, heads, rows.map((r) => r.g), mid, gz.g, ge.g, gd.g, bRect, bV, bD);

    const update = (p) => {
      const inT = seg(p, win.in[0], win.in[1]);
      const pT = seg(p, win.perm[0], win.perm[1]);
      const eT = seg(p, win.third[0], win.third[1]);
      const dT = seg(p, win.delta[0], win.delta[1]);
      g.setAttribute('opacity', inT);
      hIn.textContent = c.hx[pT > 0.5 ? 1 : 0];

      rows.forEach((r, i) => {
        r.g.setAttribute('transform', `translate(0, ${(SLOT[i] - i) * PITCH * pT})`);
        const vals = pT > 0.5 ? c.permed[SLOT[i]] : c.base[i];
        r.cells.forEach((q, j) => { q.label.textContent = num(vals[j]); });
      });
      gz.cells.forEach((q) => {
        q.label.textContent = num(pT > 0.5 ? c.Zperm[q.i][q.j] : c.Zbase[q.i][q.j]);
        q.rect.setAttribute('fill-opacity', 0.12);
      });
      ge.cells.forEach((q) => {
        q.label.textContent = num(c.Zexp[q.i][q.j]);
        q.rect.setAttribute('fill-opacity', 0.12 * eT);
        q.label.setAttribute('opacity', eT);
      });
      gd.cells.forEach((q) => {
        q.label.textContent = num(c.D[q.i][q.j]);
        q.rect.setAttribute('fill-opacity', 0.1 + 0.5 * Math.min(1, c.D[q.i][q.j]) * dT);
        q.label.setAttribute('opacity', dT);
      });
      heads[1].setAttribute('opacity', eT);
      heads[2].setAttribute('opacity', dT);

      heads[0].textContent = pT > 0.5 ? 'Z(πX)' : 'Z(X)';
      const same = c.d < 1e-9;
      const col = same ? PAL.train : PAL.loss;
      bRect.setAttribute('fill', col); bRect.setAttribute('stroke', col);
      bV.setAttribute('fill', col);
      bV.textContent = same ? 'same set, reordered' : 'a different answer';
      bD.textContent = `max |Δ| = ${expo(c.d)}`;
      [bRect, bV, bD].forEach((n) => n.setAttribute('opacity', dT));
    };
    return { g, update };
  };

  const blocks = [
    block(CASES[0], 92, { in: [0.03, 0.11], perm: [0.16, 0.28], third: [0.30, 0.37], delta: [0.38, 0.45] }),
    block(CASES[1], 272, { in: [0.50, 0.58], perm: [0.62, 0.74], third: [0.76, 0.83], delta: [0.84, 0.91] }),
  ];
  const head = txt(24, 28, 'four tokens, one unmasked head — the same rows, fed in a different order', { size: 11.5, fill: PAL.tx });
  const sub = txt(24, 46, `π = (${PI.map((i) => 't' + SUB[i]).join(', ')}); Z is compared against the original output reordered by the same π`, { size: 10.5 });
  const foot = txt(24, 438, '', { size: 11, fill: PAL.tx });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Two worked cases. With positional embeddings off, permuting the four input rows produces an output that is exactly the original output under the same permutation — the largest elementwise difference is at the level of floating-point rounding. With positional embeddings on, the position vector stays with the slot rather than the token, and the same permutation produces a genuinely different output.',
  }, svg('defs', {}, marker), head, sub, blocks.map((b) => b.g), foot);

  const node = figure(
    'attention operates over a set. Reorder the inputs with positions switched off and the outputs come back in the same order you asked for them — not approximately, but to floating-point rounding, because the mechanism never consulted an index. Word order is not something attention has; it is something added to the input, and everything that reads order downstream reads it from there.',
    root, { wide: true, key: 'permute' });

  const update = (p) => {
    head.setAttribute('opacity', seg(p, 0, 0.05));
    sub.setAttribute('opacity', seg(p, 0.02, 0.08));
    blocks.forEach((b) => b.update(p));
    foot.textContent = `set-like to ${expo(CASES[0].d)} without positions  ·  ${num(CASES[1].d)} apart with them`;
    foot.setAttribute('opacity', clamp(seg(p, 0.93, 0.98)));
  };
  update(0);
  return pin(node, update, { extent: 300 });
}

/* ---- per-figure checks (see test/figure-checks.js for the contract) --------

   This figure asserts a property, not a picture: attention over a set is
   permutation-EQUIVARIANT — permute the input and the output permutes
   identically — until positional information is added, at which point it
   stops being. That is the claim, so that is what the test verifies, by
   re-running the same attend() the figure draws with.

   It would be cheaper to assert that the footer reads "1.1e−16". It would
   also be worthless: that string would survive attention() being replaced
   with something that ignores its input entirely. Checking the property
   means this fails if softmax(), matmul() or dot() break, and it keeps
   passing if the example vectors change.                                    */

export const checks = [
  {
    fig: '#fig-permute',
    p: 0.5,
    name: 'without positions, permuting the input permutes the output identically',
    assert() {
      const off = CASES.find((c) => c.key === 'off');
      if (off.d > 1e-9) {
        throw new Error(
          `attention is supposed to be a set function here, but permuting the input moved the output by ${off.d.toExponential(2)} — it should be zero to floating-point noise`);
      }
    },
  },
  {
    fig: '#fig-permute',
    p: 0.5,
    name: 'with positions, the same permutation genuinely changes the answer',
    assert() {
      const on = CASES.find((c) => c.key === 'on');
      if (!(on.d > 1e-3)) {
        throw new Error(
          `positional embeddings are supposed to break the symmetry, but the permuted output is within ${on.d.toExponential(2)} of the permuted baseline — the figure's whole point does not hold`);
      }
    },
  },
  {
    fig: '#fig-permute',
    p: 1,
    name: 'the numbers on screen are the ones the property test just computed',
    assert(root) {
      const shown = root.textContent.replace(/−/g, '-');
      const want = CASES[1].d.toFixed(2);
      if (!shown.includes(want)) {
        throw new Error(`the figure should report ${want} as the with-positions gap; its text does not contain it`);
      }
    },
  },
];
