/* Three worlds — one prompt, three draws from the same distribution.
   Sampling is drawn literally: the distribution is laid end to end as one bar
   and each draw is a dart thrown at it, at the uniform value rng(47) actually
   produced. Figure number claimed by figure(); key 'worlds'.               */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, rng } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { softmax } from '../../core/mathtools.js';

const PROMPT = 'Grace Hopper earned her Ph.D. in mathematics from';

/* Illustrative logits; the softmax, the cumulative bands and the draws are real. */
const CAND = [
  { t: ' Yale', logit: 2.9, ok: true,
    cont: ['Yale University in 1934, one', 'of very few women anywhere to', 'hold such a degree.'],
    verdict: ['matches the record.'] },
  { t: ' Vassar', logit: 2.4, ok: false,
    cont: ['Vassar College, where she had', 'been teaching mathematics', 'since 1931.'],
    verdict: ['she taught at Vassar — the', 'doctorate came from elsewhere.'] },
  { t: ' Harvard', logit: 2.2, ok: false,
    cont: ['Harvard University, where she', 'worked on the Mark I computer', 'during the war.'],
    verdict: ['she did work on the Mark I at', 'Harvard — the degree, no.'] },
  { t: ' Columbia', logit: 1.5, ok: false,
    cont: ['Columbia University in 1934.'], verdict: ['no.'] },
  { t: ' the', logit: 1.2, ok: false,
    cont: ['the University of Chicago.'], verdict: ['no.'] },
  { t: ' …others', logit: 1.9, ok: false,
    cont: ['(a token outside the shortlist)'], verdict: ['—'] },
];
const PROBS = softmax(CAND.map((c) => c.logit));
const CUM = PROBS.reduce((a, p) => [...a, (a[a.length - 1] ?? 0) + p], []);
const pick = (u) => { for (let i = 0; i < CUM.length; i++) if (u < CUM[i]) return i; return CUM.length - 1; };

const R = rng(47);
/* three consecutive draws, then ordered left-to-right by where the dart
   landed so the connectors do not cross */
const DRAWN = [R(), R(), R()]
  .map((u) => ({ u, di: pick(u) }))
  .sort((a, b) => a.u - b.u);

export function worldsFigure() {
  const W = 720, H = 400;
  const BX = 26, BW = 668, BY = 116, BH = 26;
  const HEAD_Y = 204;

  const promptG = svg('g', { opacity: 0 },
    txt(BX, 26, 'one prompt', { size: 10 }),
    svg('rect', { x: BX, y: 34, width: BW, height: 32, rx: 8, fill: 'rgba(230,237,243,0.03)', stroke: 'rgba(230,237,243,0.12)', 'stroke-width': 1 }),
    txt(BX + 14, 55, PROMPT, { size: 12.5, fill: PAL.tx, mono: true }));

  /* labels above the bar, darts below it: neither crosses the other */
  const barLab = txt(BX, 84, 'the next-token distribution, laid end to end — a draw is a dart thrown at this bar', { size: 10, opacity: 0 });
  const segs = CAND.map((c, i) => {
    const x0 = BX + (CUM[i] - PROBS[i]) * BW, w = PROBS[i] * BW;
    const rect = svg('rect', { x: x0, y: BY, width: w, height: BH, fill: 'rgba(107,118,131,0.30)', stroke: 'rgba(230,237,243,0.18)', 'stroke-width': 0.8, opacity: 0 });
    const lab = svg('g', { opacity: 0 },
      txt(x0 + w / 2, 100, c.t.trim(), { size: 9.5, fill: PAL.tx, anchor: 'middle', mono: true }),
      txt(x0 + w / 2, 111, `${(PROBS[i] * 100).toFixed(1)}%`, { size: 9, anchor: 'middle', mono: true }));
    return { rect, lab, wide: w > 40 };
  });

  const COLX = [32, 260, 488], COLW = 200;
  const worlds = DRAWN.map(({ u, di }, k) => {
    const c = CAND[di], x = COLX[k], dartX = BX + u * BW, cx = x + COLW / 2;
    const dart = svg('g', { opacity: 0 },
      svg('line', { x1: dartX, y1: BY + BH, x2: dartX, y2: BY + BH + 26, stroke: PAL.act, 'stroke-width': 1.6 }),
      svg('path', { d: `M ${dartX - 5} ${BY + BH + 7} L ${dartX + 5} ${BY + BH + 7} L ${dartX} ${BY + BH} z`, fill: PAL.act }));
    const link = svg('path', {
      d: `M ${dartX} ${BY + BH + 26} C ${dartX} ${BY + BH + 44}, ${cx} ${BY + BH + 44}, ${cx} ${HEAD_Y}`,
      stroke: PAL.act, 'stroke-width': 1, fill: 'none', opacity: 0, 'stroke-dasharray': '3 3',
    });
    const head = svg('g', { opacity: 0 },
      svg('rect', { x, y: HEAD_Y, width: COLW, height: 26, rx: 6, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1.1 }),
      txt(cx, HEAD_Y + 18, c.t.trim(), { size: 12, fill: PAL.act, anchor: 'middle', mono: true }),
      txt(cx, HEAD_Y + 42, `u = ${u.toFixed(3)}  →  p = ${(PROBS[di] * 100).toFixed(1)}%`, { size: 9, anchor: 'middle', mono: true }));
    const lines = c.cont.map((s, i) => txt(x + 4, 272 + i * 15, s, { size: 10.5, fill: PAL.act, mono: true, opacity: 0 }));
    const vcol = c.ok ? PAL.ink : PAL.loss;
    const verdict = svg('g', { opacity: 0 },
      txt(x + 4, 330, c.ok ? '✓' : '✗', { size: 12, fill: vcol }),
      c.verdict.map((s, i) => txt(x + 18, 330 + i * 12, s, { size: 9.5, fill: vcol })));
    return { dart, link, head, lines, verdict };
  });

  const note = svg('g', { opacity: 0 },
    txt(BX, 374, 'All three are fluent. All three are equally confident. Nothing in the output', { size: 11, fill: PAL.ink }),
    txt(BX, 390, 'distinguishes the recalled one from the two the model assembled on the spot.', { size: 11, fill: PAL.ink }));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'One prompt about where Grace Hopper earned her doctorate, its next-token distribution drawn as a single bar segmented by probability, and three sampling darts landing in three different segments. Each dart leads down to a fluent continuation: Yale, which matches the record, and Vassar and Harvard, which do not.',
  }, promptG, barLab, segs.map((s) => s.rect), segs.map((s) => s.lab),
     worlds.map((w) => [w.link, w.dart, w.head, w.lines, w.verdict]), note);

  const fig = figure(
    `one prompt, three draws. The bar is the distribution at the divergence point; each dart is the uniform value the sampler actually produced (seeded, so the page renders identically every load). The continuations are illustrative, but the failure they show is the real one: two of the three are assembled from the right neighbourhood and the wrong facts, and the model has no channel on which to say which is which.`,
    root, { wide: true, key: 'worlds' });

  return pin(fig, (p) => {
    promptG.setAttribute('opacity', seg(p, 0.02, 0.09));
    barLab.setAttribute('opacity', seg(p, 0.11, 0.16));
    segs.forEach((s, i) => {
      const t = seg(p, 0.13 + i * 0.015, 0.20 + i * 0.015, ease.out);
      s.rect.setAttribute('opacity', t);
      s.lab.setAttribute('opacity', s.wide ? t : t * 0.9);
    });
    worlds.forEach((w, k) => {
      const a = 0.28 + k * 0.16;
      w.dart.setAttribute('opacity', seg(p, a, a + 0.04));
      w.link.setAttribute('opacity', seg(p, a + 0.02, a + 0.06));
      w.head.setAttribute('opacity', seg(p, a + 0.04, a + 0.08));
      w.lines.forEach((l, i) => l.setAttribute('opacity', seg(p, a + 0.06 + i * 0.012, a + 0.10 + i * 0.012)));
    });
    worlds.forEach((w, k) => w.verdict.setAttribute('opacity', seg(p, 0.80 + k * 0.03, 0.85 + k * 0.03)));
    note.setAttribute('opacity', seg(p, 0.90, 0.96));
  }, { extent: 220 });
}

