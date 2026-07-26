/* Scene step 1 — an n-gram slides a fixed window over two sentences that
   differ by one ordinary noun, and the count table for the second is zero. */

import { svg } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { seg, clamp, lerp, ease, rng } from '../../core/anim.js';
import { TOK, ODD, ODD_TOK, NGRAM, WINDOWS, stageTag, stageFormula } from './shared.js';

export function stageCount() {
  const g = svg('g', {});
  const x0 = 60, pitch = 108, cw = 96, ch = 32;
  const rowY = [96, 150];
  const rand = rng(19);
  const countsA = Array.from({ length: WINDOWS }, () => Math.round(400 + rand() * 24000));
  const sentences = [TOK, TOK.map((t, i) => (i === ODD ? ODD_TOK : t))];

  const chips = [];
  sentences.forEach((sent, r) => sent.forEach((t, j) => {
    chips.push(svg('g', {},
      svg('rect', {
        x: x0 + j * pitch, y: rowY[r], width: cw, height: ch, rx: 7,
        fill: 'rgba(90,200,220,0.1)', stroke: PAL.act, 'stroke-width': 1.1,
        'stroke-opacity': r === 1 && j === ODD ? 1 : 0.55,
      }),
      txt(x0 + j * pitch + cw / 2, rowY[r] + 21, t, { size: 12.5, fill: PAL.ink, anchor: 'middle', mono: true })));
  }));
  const rowKeys = rowY.map((y, r) => txt(24, y + 21, r === 0 ? 'A' : 'B', { size: 12, fill: PAL.mut, mono: true }));

  const win = svg('rect', {
    x: x0 - 6, y: rowY[0] - 8, width: NGRAM * pitch - (pitch - cw) + 12,
    height: rowY[1] + ch + 8 - (rowY[0] - 8), rx: 10,
    fill: 'rgba(224,168,76,0.06)', stroke: PAL.weight, 'stroke-width': 1.4, 'stroke-dasharray': '5 4',
  });
  const winLab = txt(x0, rowY[0] - 16, `window of ${NGRAM} — everything older is discarded`, { size: 10.5, fill: PAL.weight });

  const head = svg('g', {},
    txt(60, 250, 'window', { size: 10, fill: PAL.mut }),
    txt(500, 250, 'count in A', { size: 10, fill: PAL.mut, anchor: 'end' }),
    txt(660, 250, 'count in B', { size: 10, fill: PAL.mut, anchor: 'end' }));

  const rows = countsA.map((cA, i) => {
    const y = 276 + i * 26;
    const touchesOdd = i <= ODD && i + NGRAM > ODD;      // windows containing the swapped token
    const cB = touchesOdd ? 0 : cA;
    return svg('g', {},
      txt(60, y, sentences[0].slice(i, i + NGRAM).join(' '), { size: 11.5, fill: PAL.tx, mono: true }),
      txt(500, y, cA.toLocaleString('en-US'), { size: 11.5, fill: PAL.tx, anchor: 'end', mono: true }),
      txt(660, y, cB.toLocaleString('en-US'), { size: 11.5, fill: cB === 0 ? PAL.ink : PAL.tx, anchor: 'end', mono: true }));
  });

  const notes = [
    txt(60, 400, 'B is ordinary English, and every count it needs is zero.', { size: 11.5, fill: PAL.ink }),
    txt(60, 422, 'The table cannot tell “never seen” from “impossible” — and nothing it learned about', { size: 11 }),
    txt(60, 440, '“the cat sat” transfers to “the wombat sat”. To a count table these are unrelated symbols.', { size: 11 }),
  ];

  g.append(stageTag('STEP 1 / 4 · COUNT', PAL.weight),
    stageFormula('p(xₜ | xₜ₋₂ xₜ₋₁) ≈ count(xₜ₋₂ xₜ₋₁ xₜ) / count(xₜ₋₂ xₜ₋₁)'),
    ...rowKeys, ...chips, win, winLab, head, ...rows, ...notes);

  const u = (q) => {
    chips.forEach((c, i) => c.setAttribute('opacity', seg(q, 0.02 + i * 0.012, 0.1 + i * 0.012)));
    rowKeys.forEach((k) => k.setAttribute('opacity', seg(q, 0.06, 0.16)));
    const pos = lerp(0, WINDOWS - 1, seg(q, 0.2, 0.84, ease.linear));
    win.setAttribute('x', x0 - 6 + pos * pitch);
    win.setAttribute('opacity', seg(q, 0.16, 0.24));
    winLab.setAttribute('opacity', seg(q, 0.16, 0.24));
    head.setAttribute('opacity', seg(q, 0.22, 0.3));
    rows.forEach((r, i) => r.setAttribute('opacity', clamp((pos - i + 0.35) / 0.35)));
    notes.forEach((n, i) => n.setAttribute('opacity', seg(q, 0.84 + i * 0.03, 0.92 + i * 0.03)));
  };
  return { g, u };
}
