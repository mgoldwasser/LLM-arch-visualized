/* Scene — the provable ladder. Three ways of writing the same average, and a
   badge between them that reads "identical" only because the outputs were
   compared at runtime. Step 4 makes the affinities data-dependent and the
   badge breaks on its own. If the arithmetic here is ever wrong, the badge
   says so. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, clamp } from '../../core/anim.js';
import { dot, softmax, matmul } from '../../core/mathtools.js';
import { SCENE_W, SCENE_H, TRICK_B as B, TRICK_Q, TRICK_K, matGrid, maxAbsDiff, num } from './shared.js';

const T = B.length;

/* v1 — the explicit loop, written the long way on purpose. */
const V1 = [];
for (let i = 0; i < T; i++) {
  const acc = new Array(B[0].length).fill(0);
  for (let j = 0; j <= i; j++) for (let c = 0; c < acc.length; c++) acc[c] += B[j][c];
  V1.push(acc.map((v) => v / (i + 1)));
}
/* v2 — row-normalized lower-triangular weights, one matmul. */
const TRILN = Array.from({ length: T }, (_, i) => Array.from({ length: T }, (_, j) => (j <= i ? 1 / (i + 1) : 0)));
const V2 = matmul(TRILN, B);
/* v3 — softmax of a masked matrix of zeros. */
const W3 = Array.from({ length: T }, (_, i) => Array.from({ length: T }, (_, j) => (j <= i ? 0 : -Infinity))).map((r) => softmax(r));
const V3 = matmul(W3, B);
/* v4 — the same masked softmax, but the scores now come from q·k. */
const W4 = TRICK_Q.map((q, i) => TRICK_K.map((k, j) => (j <= i ? dot(q, k) / Math.SQRT2 : -Infinity))).map((r) => softmax(r));
const V4 = matmul(W4, B);

const D12 = maxAbsDiff(V1, V2);
const D23 = maxAbsDiff(V2, V3);
const D24 = maxAbsDiff(V2, V4);
const expo = (v) => v.toExponential(1).replace('e+', 'e').replace('e-', 'e−');

const PANELS = [
  { title: 'v1 — the explicit loop', code: ['for i in range(T):', '\u00a0\u00a0\u00a0\u00a0out[i] = B[:i+1].mean(0)'], out: V1 },
  { title: 'v2 — one matrix multiply', code: ['w = tril(ones(T,T))', 'w = w / w.sum(1, keepdim=True)', 'out = w @ B'], out: V2 },
  { title: 'v3 — softmax of a masked matrix of zeros', code: ['w = zeros(T,T)', 'w = w.masked_fill(tril(ones(T,T)) == 0, -inf)', 'out = softmax(w, dim=1) @ B'], out: V3 },
];
const V4PANEL = { title: 'v4 — the affinities become data-dependent', code: ['w = q @ k.T / sqrt(d_head)', 'w = w.masked_fill(tril(ones(T,T)) == 0, -inf)', 'out = softmax(w, dim=1) @ B'], out: V4 };

export function ladderScene() {
  return createScene({
    id: 'attn-ladder',
    steps: [
      { n: 'STEP 1 / 4 — WRITE IT OUT', html: `<p>The running average of ${T} value vectors as a loop: at each position, the mean of everything up to and including it. Slow, obviously correct, and the reference every later version has to match.</p>` },
      { n: 'STEP 2 / 4 — THE SAME THING, AS A MATMUL', html: `<p>Row-normalized lower-triangular weights, one multiply. The badge compares the two outputs element by element every time this figure redraws; it is showing you a number, not a claim.</p><p>The loop was O(T) sequential steps. The multiply is one GPU kernel. Nothing about the result changed — which is the point of the whole refactor.</p>` },
      { n: 'STEP 3 / 4 — THE SAME THING, AS A SOFTMAX', html: `<p>Now build the weights from a matrix of <em>zeros</em> with the future set to &minus;&infin;, and softmax each row. e&#8304;&nbsp;=&nbsp;1 everywhere it is allowed to look, e^&minus;&infin;&nbsp;=&nbsp;0 everywhere it is not, so the row normalizes to a uniform average over the past. Still identical.</p><p>Nothing has been gained yet. What has been gained is a <em>place to put a number</em>: those zeros are the affinities, and they no longer have to be zero.</p>` },
      { n: 'STEP 4 / 4 — AND NOW IT BREAKS', html: `<p>Replace the zeros with q&nbsp;@&nbsp;k&#7488;&nbsp;/&nbsp;&radic;d_head. The mask is unchanged, the softmax is unchanged, the multiply into B is unchanged. Only the affinities are new — and the outputs separate.</p><p>The badge is derived from the comparison, so it breaks by itself. That gap is the entire contribution of attention over a uniform average.</p>` },
    ],
    figure: ladderFigure,
  });
}

function ladderFigure(canvas) {
  const YB = [58, 186, 314];
  const blocks = PANELS.map((panel, k) => {
    const yb = YB[k];
    const box = svg('rect', { x: 24, y: yb, width: 446, height: 104, rx: 10, fill: 'rgba(230,237,243,0.03)', stroke: 'rgba(230,237,243,0.1)' });
    const hl = svg('rect', { x: 32, y: yb + 32, width: 300, height: 17, rx: 3, fill: PAL.attn, 'fill-opacity': 0, stroke: 'none' });
    const title = txt(38, yb + 20, panel.title, { size: 11.5, fill: PAL.ink, mono: true });
    const code = [0, 1, 2].map((m) => txt(38, yb + 46 + m * 20, '', { size: 11, fill: PAL.tx, mono: true }));
    const grid = matGrid(490, yb + 3, T, B[0].length, { cw: 44, ch: 30, gap: 4, size: 11.5, fill: PAL.act });
    return { g: svg('g', {}, box, hl, title, code, grid.g), title, code, grid, hl, yb };
  });

  const badge = (cy) => {
    const rect = svg('rect', { x: 592, y: cy - 21, width: 124, height: 42, rx: 8, fill: PAL.train, 'fill-opacity': 0.12, stroke: PAL.train, 'stroke-width': 1.2 });
    const verdict = txt(654, cy - 3, '', { size: 11.5, fill: PAL.train, anchor: 'middle', mono: true });
    const delta = txt(654, cy + 13, '', { size: 9.5, fill: PAL.mut, anchor: 'middle', mono: true });
    const link = svg('path', { d: `M 586 ${cy - 64} L 589 ${cy - 64} L 589 ${cy + 64} L 586 ${cy + 64} M 589 ${cy} L 592 ${cy}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none' });
    return { g: svg('g', {}, link, rect, verdict, delta), rect, verdict, delta };
  };
  const badges = [badge(174), badge(302)];

  const head = txt(24, 32, 'the same three value vectors, averaged four ways — outputs compared elementwise, live', { size: 11 });
  const foot = txt(24, 446, '', { size: 11, fill: PAL.tx, mono: true });

  canvas.append(svgRoot(SCENE_W, SCENE_H, {
    role: 'img',
    'aria-label': 'Three code panels — an explicit averaging loop, a lower-triangular matrix multiply, and a softmax over a masked matrix of zeros — each with its computed output beside it. Badges between the panels report the largest elementwise difference between neighboring outputs: identical for the first three, and not identical once the affinities become data-dependent.',
  }, head, blocks.map((b) => b.g), badges.map((b) => b.g), foot));

  const setBadge = (b, d, op) => {
    const same = d < 1e-9;
    const col = same ? PAL.train : PAL.loss;
    b.rect.setAttribute('stroke', col);
    b.rect.setAttribute('fill', col);
    b.verdict.setAttribute('fill', col);
    b.verdict.textContent = same ? 'identical' : 'not identical';
    b.delta.textContent = `max |Δ| = ${expo(d)}`;
    b.g.setAttribute('opacity', op);
  };

  const update = (p, stepIdx) => {
    const s = clamp(stepIdx, 0, 3);
    head.setAttribute('opacity', seg(p, 0, 0.05));

    blocks.forEach((blk, k) => {
      const spec = (k === 2 && s === 3) ? V4PANEL : PANELS[k];
      blk.title.textContent = spec.title;
      blk.title.setAttribute('fill', (k === 2 && s === 3) ? PAL.attn : PAL.ink);
      blk.code.forEach((line, m) => {
        line.textContent = spec.code[m] || '';
        line.setAttribute('fill', (k === 2 && s === 3 && m === 0) ? PAL.attn : PAL.tx);
      });
      blk.grid.cells.forEach((c) => {
        c.label.textContent = spec.out[c.i][c.j].toFixed(2);
        c.rect.setAttribute('fill-opacity', 0.12);
      });
      blk.hl.setAttribute('fill-opacity', (k === 2) ? seg(p, 0.76, 0.84) * 0.16 : 0);
      blk.g.setAttribute('opacity', seg(p, 0.01 + k * 0.25, 0.08 + k * 0.25));
    });

    setBadge(badges[0], D12, seg(p, 0.34, 0.4));
    setBadge(badges[1], s === 3 ? D24 : D23, seg(p, 0.59, 0.65));

    foot.textContent = `v1 = v2 = v3 to ${expo(Math.max(D12, D23))}   ·   v4 departs from v2 by ${num(D24)}`;
    foot.setAttribute('opacity', seg(p, 0.86, 0.94));
  };
  update(0, 0);             // paint the p=0 state now, so nothing flashes on entry
  return update;
}
