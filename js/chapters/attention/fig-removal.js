/* Figure — progressive disclosure by removal. The finished attention matrix,
   then the softmax peeled off to expose the raw affinities, then the causal
   mask peeled off to expose the future leaking in — and then both put back.

   The three states are three readings of one live computation: A is the
   softmax of the masked scores, the raw scores are the same scores before
   either step, and the row totals are summed from whatever is on screen. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, lerp, clamp } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { dot, softmax } from '../../core/mathtools.js';
import { matGrid, num } from './shared.js';

const TOKS = ['the', 'cat', 'sat', 'on', 'mat'];
const Q = [[1.1, 0.3], [0.2, 1.2], [0.9, -0.8], [-0.6, 1.0], [1.3, 0.5]];
const K = [[1.0, 0.4], [-0.7, 1.1], [0.8, -1.0], [0.3, 1.2], [-1.1, 0.2]];

const S = Q.map((q) => K.map((k) => dot(q, k) / Math.SQRT2));          // raw, unmasked
const A = S.map((row, i) => softmax(row.map((v, j) => (j <= i ? v : -Infinity))));
const SMAX = Math.max(...S.flat().map(Math.abs));

const PHASES = [
  ['softmax + causal mask — the finished thing',
    'every row is non-negative and sums to exactly 1, so each output is a weighted average',
    'and every weight above the diagonal is exactly 0, because −∞ went into the exponential'],
  ['softmax removed — the raw affinities qᵢ·kⱼ / √d_head',
    'these run negative as well as positive (dashed cells), so they cannot be mixing weights',
    'the row totals are now whatever they happen to be: nothing here is an average of anything'],
  ['causal mask removed — the future is visible',
    'every cell above the diagonal is a token reading a token that has not been written yet',
    'train on this and the next-token objective is free to cheat: the answer is one cell away'],
];

export function removalFigure() {
  const W = 760, H = 448;
  const gx = 176, gy = 96, cw = 64, ch = 42, gap = 5;
  const grid = matGrid(gx, gy, 5, 5, { cw, ch, gap, size: 12 });

  const colHeads = TOKS.map((t, j) => txt(gx + j * (cw + gap) + cw / 2, gy - 10, t, { size: 10.5, anchor: 'middle', mono: true }));
  const rowHeads = TOKS.map((t, i) => txt(gx - 10, gy + i * (ch + gap) + ch / 2 + 4.4, t, { size: 10.5, anchor: 'end', mono: true }));
  const sumHead = txt(gx + grid.w + 14, gy - 10, 'row Σ', { size: 10.5, mono: true });
  const sums = TOKS.map((_, i) => txt(gx + grid.w + 14, gy + i * (ch + gap) + ch / 2 + 4.4, '', { size: 11.5, fill: PAL.tx, mono: true }));

  const head = txt(24, 28, 'one head, five tokens — the finished attention weights, then taken apart', { size: 11.5, fill: PAL.tx });
  const sub = txt(24, 48, 'scores are qᵢ·kⱼ / √d_head at d_head = 2, computed live; A is their masked softmax', { size: 10.5 });
  const phase = PHASES.map((_, k) => ({
    t: txt(24, 372, '', { size: 12.5, fill: PAL.ink }),
    a: txt(24, 396, '', { size: 11, fill: PAL.tx }),
    b: txt(24, 418, '', { size: 11 }),
    k,
  }));
  phase.forEach((ph, k) => { ph.t.textContent = PHASES[k][0]; ph.a.textContent = PHASES[k][1]; ph.b.textContent = PHASES[k][2]; });
  const legend = svg('g', {},
    svg('rect', { x: 24, y: 340, width: 18, height: 12, rx: 3, fill: 'none', stroke: PAL.attn, 'stroke-dasharray': '3 2' }),
    txt(48, 350, 'negative affinity', { size: 10 }),
    svg('rect', { x: 176, y: 340, width: 18, height: 12, rx: 3, fill: PAL.loss, 'fill-opacity': 0.45, stroke: PAL.loss }),
    txt(200, 350, 'a cell reading its own future', { size: 10 }));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A five by five attention matrix for the tokens the, cat, sat, on, mat. Scrubbing removes the softmax, so the cells show raw dot-product affinities that run negative as well as positive and no longer sum to one per row; then removes the causal mask, so the cells above the diagonal fill in and flash in the loss color because each is a token reading its own future; then puts both back.',
  }, head, sub, colHeads, rowHeads, sumHead, sums, grid.g, legend, phase.map((ph) => [ph.t, ph.a, ph.b]));

  const node = figure(
    'what each component is for, shown by taking it away. The softmax is what makes the row a set of mixing weights at all; the mask is what stops a token reading its own answer. Every number is the same live computation read three ways — remove the softmax and the row totals stop being 1 on their own.',
    root, { wide: true, key: 'removal' });

  const update = (p) => {
    const build = (i, j) => seg(p, 0.02 + (i * 5 + j) * 0.003, 0.13 + (i * 5 + j) * 0.003);
    const offSoft = clamp(seg(p, 0.20, 0.34) - seg(p, 0.84, 0.95));
    const offMask = clamp(seg(p, 0.50, 0.62) - seg(p, 0.72, 0.82));
    const flash = 0.45 + 0.55 * Math.abs(Math.sin(p * 130));

    head.setAttribute('opacity', seg(p, 0, 0.06));
    sub.setAttribute('opacity', seg(p, 0.02, 0.09));
    legend.setAttribute('opacity', seg(p, 0.24, 0.34));
    colHeads.forEach((t, j) => t.setAttribute('opacity', build(0, j)));
    rowHeads.forEach((t, i) => t.setAttribute('opacity', build(i, 0)));
    sumHead.setAttribute('opacity', seg(p, 0.1, 0.18));

    grid.cells.forEach((c) => {
      const { i, j } = c;
      const raw = S[i][j], w = A[i][j];
      const future = j > i;
      const mag = Math.abs(raw) / SMAX;
      if (future) {
        c.rect.setAttribute('fill', PAL.loss);
        c.rect.setAttribute('fill-opacity', mag * 0.5 * offMask);
        c.rect.setAttribute('stroke', offMask > 0.02 ? PAL.loss : PAL.grid);
        c.rect.setAttribute('stroke-opacity', offMask * flash);
        c.rect.setAttribute('stroke-dasharray', 'none');
        c.rect.setAttribute('opacity', build(i, j));
        c.label.textContent = num(raw);
        c.label.setAttribute('fill', PAL.loss);
        c.label.setAttribute('opacity', build(i, j) * offMask);
      } else {
        const neg = raw < 0 && offSoft > 0.5;
        c.rect.setAttribute('fill', PAL.attn);
        c.rect.setAttribute('fill-opacity', lerp(w * 0.85, mag * 0.55, offSoft));
        c.rect.setAttribute('stroke', neg ? PAL.attn : PAL.grid);
        c.rect.setAttribute('stroke-opacity', 1);
        c.rect.setAttribute('stroke-dasharray', neg ? '3 2' : 'none');
        c.rect.setAttribute('opacity', build(i, j));
        c.label.textContent = offSoft > 0.5 ? num(raw) : num(w);
        c.label.setAttribute('fill', PAL.ink);
        c.label.setAttribute('opacity', build(i, j));
      }
    });

    /* The row total is summed from whatever the row currently shows. */
    sums.forEach((t, i) => {
      const shown = S[i].map((raw, j) => (j > i
        ? (offMask > 0.5 ? raw : 0)
        : (offSoft > 0.5 ? raw : A[i][j])));
      const total = shown.reduce((a, b) => a + b, 0);
      t.textContent = num(total, 3);
      t.setAttribute('fill', Math.abs(total - 1) < 1e-9 ? PAL.attn : PAL.tx);
      t.setAttribute('opacity', seg(p, 0.1, 0.18));
    });

    const wt = [1 - offSoft, offSoft * (1 - offMask), offMask];
    phase.forEach((ph, k) => {
      const o = wt[k] * seg(p, 0.06, 0.14);
      ph.t.setAttribute('opacity', o);
      ph.a.setAttribute('opacity', o);
      ph.b.setAttribute('opacity', o);
    });
  };
  update(0);
  return pin(node, update, { extent: 280 });
}
