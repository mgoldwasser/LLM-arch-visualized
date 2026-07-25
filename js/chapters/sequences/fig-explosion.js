/* The combinatorial explosion: how many cells an n-gram count table needs,
   plotted on a log axis against n. Every number is computed from K3's real
   vocabulary size — nothing here is typed in by hand. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, ease } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { sci, sup, moreThan, CORPUS } from './shared.js';

const V = K3.vocab;
const NMAX = 8;
const LV = Math.log10(V);
const LCORP = Math.log10(CORPUS);

export function explosionFigure() {
  const W = 760, H = 384;
  const x0 = 96, x1 = 716, yTop = 62, yBot = 300;
  const LMIN = 0, LMAX = 44;
  const pitch = (x1 - x0) / NMAX;
  const barW = pitch * 0.56;
  const yFor = (L) => yBot - ((L - LMIN) / (LMAX - LMIN)) * (yBot - yTop);
  const xFor = (n) => x0 + (n - 0.5) * pitch;

  /* ---- axes -------------------------------------------------------------- */
  const grid = svg('g', {});
  for (let L = LMIN; L <= LMAX; L += 10) {
    grid.append(
      svg('line', { x1: x0, y1: yFor(L), x2: x1, y2: yFor(L), stroke: PAL.grid, 'stroke-width': 1 }),
      txt(x0 - 10, yFor(L) + 4, `10${sup(L)}`, { size: 10, anchor: 'end', mono: true }));
  }
  grid.append(
    svg('line', { x1: x0, y1: yBot, x2: x1, y2: yBot, stroke: 'rgba(230,237,243,0.22)', 'stroke-width': 1.2 }),
    txt((x0 + x1) / 2, yBot + 42, 'n  —  tokens of context the table conditions on', { size: 11, anchor: 'middle' }));

  /* ---- one bar per n ----------------------------------------------------- */
  const yC = yFor(LCORP);
  const bars = [];
  for (let n = 1; n <= NMAX; n++) {
    const L = n * LV;                    // log₁₀(Vⁿ) — exact, no overflow
    const cells = V ** n;
    const yT = yFor(L);
    const bx = xFor(n) - barW / 2;
    const seen = Math.max(yT, yC);       // the part of the table the corpus could ever fill
    const g = svg('g', {},
      // cells that could never have been observed, even once
      yT < yC ? svg('rect', {
        x: bx, y: yT, width: barW, height: yC - yT, rx: 3,
        fill: PAL.weight, 'fill-opacity': 0.1, stroke: PAL.weight,
        'stroke-opacity': 0.45, 'stroke-width': 1, 'stroke-dasharray': '3 4',
      }) : null,
      svg('rect', { x: bx, y: seen, width: barW, height: yBot - seen, rx: 3, fill: PAL.weight, 'fill-opacity': 0.5 }));
    const lab = svg('g', {},
      txt(xFor(n), yT - 8, sci(cells), { size: 10, fill: PAL.tx, anchor: 'middle', mono: true }),
      txt(xFor(n), yBot + 20, String(n), { size: 11.5, fill: PAL.ink, anchor: 'middle', mono: true }));
    bars.push({ g, lab });
  }

  /* ---- corpus line ------------------------------------------------------- */
  const corpus = svg('g', {},
    svg('line', { x1: x0, y1: yC, x2: x1, y2: yC, stroke: PAL.act, 'stroke-width': 1.4, 'stroke-dasharray': '6 5' }),
    txt(x1, yC - 8, `${sci(CORPUS)} tokens — the whole corpus`, { size: 10.5, fill: PAL.act, anchor: 'end', mono: true }));

  /* ---- annotations, all computed ---------------------------------------- */
  const nCross = Math.ceil(LCORP / LV);          // first n whose table outsizes the corpus
  const crossCells = V ** nCross;
  const lines = [
    `n = 2  ·  V² = ${sci(V ** 2)} cells — still countable`,
    `n = ${nCross}  ·  ${sci(crossCells)} cells — ${sci(crossCells / CORPUS)}× the tokens in the whole corpus`,
    `n = 5  ·  ${moreThan(V ** 5)}`,
    `n = ${NMAX}  ·  ${moreThan(V ** NMAX)}`,
  ].map((s, i) => txt(112, 86 + i * 26, s, { size: 11, fill: i === 1 ? PAL.ink : PAL.tx, mono: true }));

  const head = txt(24, 30, `Vⁿ cells for V = ${V.toLocaleString('en-US')} — ${K3.name}'s vocabulary`, { size: 11 });
  const foot = txt(24, 366, 'solid = cells the corpus could conceivably fill · dashed = cells that must hold a count of exactly zero', { size: 10 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `A logarithmic bar chart of the number of cells in an n-gram count table, from n equals 1 to ${NMAX}, over a vocabulary of ${V.toLocaleString('en-US')} tokens. Each extra token of context multiplies the table by the vocabulary size, so the bars climb by five orders of magnitude apiece and pass the total size of the training corpus at n equals ${nCross}.`,
  }, head, grid, bars.map((b) => b.g), bars.map((b) => b.lab), corpus, lines, foot);

  const node = figure(
    `every extra token of context multiplies the table by V = ${V.toLocaleString('en-US')}. Past n = ${nCross} the table has more cells than the corpus has tokens, so the overwhelming majority of counts are not small — they are exactly zero, and the model has no way to tell &ldquo;never seen&rdquo; from &ldquo;impossible&rdquo;.`,
    root, { wide: true, key: 'explosion' });

  return pin(node, (p) => {
    head.setAttribute('opacity', seg(p, 0.06, 0.14));
    grid.setAttribute('opacity', seg(p, 0.08, 0.18));
    bars.forEach(({ g, lab }, i) => {
      const t = seg(p, 0.14 + i * 0.045, 0.32 + i * 0.045, ease.out);
      g.setAttribute('opacity', t);
      g.setAttribute('transform', `translate(0, ${yBot}) scale(1, ${Math.max(t, 0.001)}) translate(0, ${-yBot})`);
      lab.setAttribute('opacity', seg(p, 0.2 + i * 0.045, 0.34 + i * 0.045));
    });
    corpus.setAttribute('opacity', seg(p, 0.42, 0.52));
    lines.forEach((l, i) => l.setAttribute('opacity', seg(p, 0.5 + i * 0.06, 0.6 + i * 0.06)));
    foot.setAttribute('opacity', seg(p, 0.78, 0.88));
  });
}
