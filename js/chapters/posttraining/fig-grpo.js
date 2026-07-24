/* GRPO on one prompt — a group of 16 sampled attempts, a binary verifier, the
   group mean as the baseline, and each attempt's advantage relative to its own
   group. Figure number is claimed by figure(); key 'grpo'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, rng } from '../../core/anim.js';
import { track } from '../../core/scroll.js';

export function grpoFigure() {
  const W = 720, H = 484;
  const G = 16;
  const rand = rng(16);
  const wins = new Set([1, 4, 6, 9, 12, 14]);       // 6/16 → r̄ = 0.375, σ ≈ 0.48
  const advWin = '+1.29', advLose = '−0.77';

  const rowY = (i) => 96 + i * 23;
  const rows = Array.from({ length: G }, (_, i) => {
    const y = rowY(i);
    const win = wins.has(i);
    const w = 120 + rand() * 210;                    // chain-of-thought length
    const bar = svg('rect', { x: 86, y, width: 0, height: 14, rx: 3, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 0.9 });
    const idx = txt(78, y + 11, String(i + 1), { size: 9.5, anchor: 'end', mono: true, opacity: 0 });
    const mark = win
      ? svg('g', { opacity: 0 },
          svg('circle', { cx: 445, cy: y + 7, r: 8, fill: 'rgba(125,216,127,0.15)', stroke: PAL.train, 'stroke-width': 1.2 }),
          svg('path', { d: `M 441 ${y + 7} L 444 ${y + 10} L 450 ${y + 3}`, stroke: PAL.train, 'stroke-width': 1.6, fill: 'none' }))
      : svg('g', { opacity: 0 },
          svg('circle', { cx: 445, cy: y + 7, r: 8, fill: 'rgba(240,120,80,0.12)', stroke: PAL.loss, 'stroke-width': 1.2 }),
          svg('path', { d: `M 441 ${y + 3} L 449 ${y + 11} M 449 ${y + 3} L 441 ${y + 11}`, stroke: PAL.loss, 'stroke-width': 1.6, fill: 'none' }));
    const rBar = svg('rect', { x: 470, y: y + 3, width: 0, height: 8, rx: 2, fill: win ? PAL.train : PAL.mut, opacity: win ? 0.9 : 0.5 });
    const rTxt = txt(536, y + 11, win ? '1' : '0', { size: 10, fill: win ? PAL.train : PAL.loss, mono: true, opacity: 0 });
    const adv = svg('g', { opacity: 0 },
      svg('line', { x1: 596, y1: win ? y + 12 : y + 2, x2: 596, y2: win ? y + 2 : y + 12, stroke: win ? PAL.train : PAL.loss, 'stroke-width': 1.6, 'marker-end': win ? 'url(#grpo-up)' : 'url(#grpo-dn)' }),
      txt(610, y + 11, win ? advWin : advLose, { size: 10, fill: win ? PAL.train : PAL.loss, mono: true }));
    return { bar, idx, mark, rBar, rTxt, adv, w, win, y };
  });

  const prompt = svg('g', { opacity: 0 },
    svg('rect', { x: 30, y: 14, width: 260, height: 42, rx: 8, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.2 }),
    txt(42, 31, 'prompt', { size: 9.5 }),
    txt(42, 47, 'prove: 6 divides n³ − n', { size: 12, fill: PAL.ink, mono: true }));
  const fan = svg('g', { opacity: 0 },
    svg('path', { d: 'M 290 35 L 312 35', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#grpo-arr)' }),
    txt(322, 39, `sample a group of ${G} attempts (temperature > 0)`, { size: 10.5, fill: PAL.tx }));

  const headers = svg('g', { opacity: 0 },
    txt(86, 84, 'attempt (chain of thought)', { size: 10 }),
    txt(445, 84, 'verifier', { size: 10, anchor: 'middle' }),
    txt(498, 84, 'reward r', { size: 10, anchor: 'middle' }),
    txt(620, 84, '(rᵢ − r̄)/σ', { size: 10, anchor: 'middle' }));

  const meanX = 470 + 0.375 * 56;
  const meanLine = svg('line', { x1: meanX, y1: 90, x2: meanX, y2: rowY(G - 1) + 16, stroke: PAL.weight, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0 });
  const meanTag = txt(meanX, rowY(G - 1) + 32, 'group mean r̄ = 6/16', { size: 10, fill: PAL.weight, anchor: 'middle', mono: true, opacity: 0 });
  const reinforceTag = txt(694, 30, 'above-average attempts: every token reinforced', { size: 10.5, fill: PAL.train, anchor: 'end', opacity: 0 });

  const defs = svg('defs', {},
    svg('marker', { id: 'grpo-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'grpo-up', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.train })),
    svg('marker', { id: 'grpo-dn', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.loss })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'GRPO on one math prompt: sixteen sampled attempts, each scored one or zero by a verifier, a dashed group-mean line at 0.375, and up or down advantage arrows reinforcing attempts that beat their own group.',
  }, defs, prompt, fan, headers,
    rows.map((r) => [r.bar, r.idx, r.mark, r.rBar, r.rTxt, r.adv]),
    meanLine, meanTag, reinforceTag);

  const fig = figure(
    `GRPO on one prompt: a group of 16 attempts, a binary verifier (it cannot be flattered), and each attempt's standing <em>relative to its own group</em> as the learning signal — no value network needed. Attempt lengths illustrative, seeded.`,
    root, { wide: true, key: 'grpo' });

  track(fig, (p) => {
    prompt.setAttribute('opacity', seg(p, 0.06, 0.11));
    fan.setAttribute('opacity', seg(p, 0.09, 0.14));
    headers.setAttribute('opacity', seg(p, 0.10, 0.15));
    rows.forEach((r, i) => {
      const tRow = seg(p, 0.12 + i * 0.011, 0.19 + i * 0.011, ease.out);
      r.bar.setAttribute('width', r.w * tRow);
      r.idx.setAttribute('opacity', tRow);
      const tScore = seg(p, 0.36 + i * 0.008, 0.42 + i * 0.008, ease.out);
      r.mark.setAttribute('opacity', tScore);
      r.rBar.setAttribute('width', (r.win ? 56 : 4) * tScore);
      r.rTxt.setAttribute('opacity', tScore);
      const tAdv = seg(p, 0.60 + i * 0.007, 0.66 + i * 0.007, ease.out);
      r.adv.setAttribute('opacity', tAdv);
      // final beat: winning chains tint green — those tokens get reinforced
      const tRe = seg(p, 0.78, 0.86);
      if (r.win) {
        r.bar.setAttribute('fill', tRe > 0.5 ? 'rgba(125,216,127,0.18)' : 'rgba(90,200,220,0.12)');
        r.bar.setAttribute('stroke', tRe > 0.5 ? PAL.train : PAL.act);
      }
    });
    const tMean = seg(p, 0.52, 0.60);
    meanLine.setAttribute('opacity', tMean);
    meanTag.setAttribute('opacity', tMean);
    reinforceTag.setAttribute('opacity', seg(p, 0.80, 0.88));
  });
  return fig;
}
