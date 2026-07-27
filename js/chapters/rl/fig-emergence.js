/* F2 — what emerges. Two curves over one RL run: accuracy climbing, and the
   model's average response length climbing with it. At the crossover a real
   trace excerpt expands: the model has started re-checking its own work.
   Both series are generated from monotone functions, never plotted by hand.
   Figure number is claimed by figure(); key 'emergence'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, lerp, clamp } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

const N = 61;                    // samples along the run
const STEPS = 8000;              // RL steps on the x axis
const ACC0 = 15.6, ACC1 = 71.0;  // AIME 2024 pass@1, as reported for R1-Zero
const LEN0 = 480, LEN1 = 9000;   // average response length, tokens
const ACC_MAX = 100, LEN_MAX = 10000;
const AHA = 0.55;                // where the callout points

const K = 2.6;
const acc = (t) => ACC0 + (ACC1 - ACC0) * ((1 - Math.exp(-K * t)) / (1 - Math.exp(-K)));
const len = (t) => LEN0 + (LEN1 - LEN0) * Math.pow(t, 1.25);

const TRACE = [
  '…so x = 3, and the sum is 12.',
  'Wait, wait. Wait. That is an aha moment.',
  'Let us re-evaluate this step by step…',
];

export function emergenceFigure() {
  const W = 720, H = 440;
  const X0 = 84, X1 = 646, Y0 = 336, Y1 = 66;

  const xAt = (i) => X0 + (i / (N - 1)) * (X1 - X0);
  const yAcc = (a) => Y0 - (a / ACC_MAX) * (Y0 - Y1);
  const yLen = (l) => Y0 - (l / LEN_MAX) * (Y0 - Y1);
  const accPts = Array.from({ length: N }, (_, i) => [xAt(i), yAcc(acc(i / (N - 1)))]);
  const lenPts = Array.from({ length: N }, (_, i) => [xAt(i), yLen(len(i / (N - 1)))]);

  /* d-string for the first `t` of a point list, with the final segment
     interpolated so the head moves continuously. */
  const upTo = (pts, t) => {
    const f = clamp(t) * (N - 1);
    const last = Math.floor(f);
    const seg2 = f - last;
    const out = pts.slice(0, last + 1).map(([x, y], k) => `${k ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    if (last < N - 1) {
      const [ax, ay] = pts[last], [bx, by] = pts[last + 1];
      out.push(`L ${lerp(ax, bx, seg2).toFixed(1)} ${lerp(ay, by, seg2).toFixed(1)}`);
    }
    return out.join(' ');
  };
  const headAt = (pts, t) => {
    const f = clamp(t) * (N - 1);
    const last = Math.min(N - 2, Math.floor(f));
    const [ax, ay] = pts[last], [bx, by] = pts[last + 1];
    const s = f - last;
    return [lerp(ax, bx, s), lerp(ay, by, s)];
  };

  const grid = svg('g', {},
    ...[0, 25, 50, 75, 100].map((a) => svg('line', { x1: X0, y1: yAcc(a), x2: X1, y2: yAcc(a), stroke: PAL.grid, 'stroke-width': 1 })),
    ...[0, 25, 50, 75, 100].map((a) => txt(X0 - 10, yAcc(a) + 4, `${a}`, { size: 9.5, anchor: 'end', mono: true })),
    ...[0, 2500, 5000, 7500, 10000].map((l) => txt(X1 + 10, yLen(l) + 4, l.toLocaleString('en-US'), { size: 9.5, anchor: 'start', mono: true })),
    ...[0, 2000, 4000, 6000, 8000].map((s) => txt(X0 + (s / STEPS) * (X1 - X0), Y0 + 20, s.toLocaleString('en-US'), { size: 9.5, anchor: 'middle', mono: true })),
    txt((X0 + X1) / 2, Y0 + 40, 'RL steps', { size: 10.5, fill: PAL.tx, anchor: 'middle' }),
    svg('text', { x: 26, y: (Y0 + Y1) / 2, fill: PAL.train, 'font-size': 10.5, 'font-family': 'sans-serif', 'text-anchor': 'middle', transform: `rotate(-90, 26, ${(Y0 + Y1) / 2})` }, 'accuracy — AIME pass@1 (%)'),
    svg('text', { x: 700, y: (Y0 + Y1) / 2, fill: PAL.act, 'font-size': 10.5, 'font-family': 'sans-serif', 'text-anchor': 'middle', transform: `rotate(90, 700, ${(Y0 + Y1) / 2})` }, 'average response length (tokens)'));

  const accLabel = (t) => `${acc(t).toFixed(1)}%`;
  const lenLabel = (t) => `${Math.round(len(t) / 10) * 10} tok`;
  const [ax0, ay0] = headAt(accPts, 0), [lx0, ly0] = headAt(lenPts, 0);

  const accLine = svg('path', { d: upTo(accPts, 0), fill: 'none', stroke: PAL.train, 'stroke-width': 2 });
  const lenLine = svg('path', { d: upTo(lenPts, 0), fill: 'none', stroke: PAL.act, 'stroke-width': 2, 'stroke-dasharray': '5 3' });
  const accHead = svg('circle', { r: 3.5, fill: PAL.train, cx: ax0, cy: ay0, opacity: 0 });
  const lenHead = svg('circle', { r: 3.5, fill: PAL.act, cx: lx0, cy: ly0, opacity: 0 });
  const accRead = txt(ax0 - 9, ay0 - 9, accLabel(0), { size: 11, fill: PAL.train, mono: true, anchor: 'end', opacity: 0 });
  const lenRead = txt(lx0 - 9, ly0 + 19, lenLabel(0), { size: 11, fill: PAL.act, mono: true, anchor: 'end', opacity: 0 });

  const ahaX = xAt(Math.round(AHA * (N - 1))), ahaY = yLen(len(AHA));
  const callout = svg('g', { opacity: 0 },
    svg('line', { x1: 280, y1: 150, x2: ahaX, y2: ahaY, stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
    svg('circle', { cx: ahaX, cy: ahaY, r: 5, fill: 'none', stroke: PAL.attn, 'stroke-width': 1.5 }),
    svg('rect', { x: 96, y: 76, width: 252, height: 76, rx: 7, fill: 'rgba(180,140,224,0.08)', stroke: PAL.attn, 'stroke-width': 1.1 }),
    ...TRACE.map((line, i) => txt(108, 96 + i * 16, line, { size: 9.5, fill: i === 1 ? PAL.ink : PAL.tx, mono: true })),
    txt(108, 146, 'excerpt as reported for DeepSeek-R1-Zero, 2025', { size: 8.5, fill: PAL.mut }));

  const note = txt(X1, 402, 'no label taught this — it fell out of the optimization', { size: 11, fill: PAL.attn, anchor: 'end', opacity: 0 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Two rising curves over one reinforcement-learning run: accuracy on AIME climbing from ${ACC0} to ${ACC1} percent, and average response length climbing from roughly ${LEN0} to ${LEN1} tokens. A callout partway along expands a trace in which the model stops and re-evaluates its own step.`,
  }, grid, lenLine, accLine, lenHead, accHead, accRead, lenRead, callout, note);

  const fig = figure(
    `One run, two things happening at once: the model gets better, and its answers get longer. The length was never optimized — nothing in the reward mentions it. Given only <em>was the answer right</em>, the model discovers that going back over its own work pays, and spends tokens doing it. Curves generated from monotone fits to the shape reported for DeepSeek-R1-Zero (2025); endpoint accuracies are the paper&rsquo;s.`,
    root, { wide: true, key: 'emergence' });

  return pin(fig, (p) => {
    const t = seg(p, 0.08, 0.74, ease.linear);
    lenLine.setAttribute('d', upTo(lenPts, t));
    accLine.setAttribute('d', upTo(accPts, t));

    const vis = t > 0 ? 1 : 0;
    const [ax, ay] = headAt(accPts, t), [lx, ly] = headAt(lenPts, t);
    accHead.setAttribute('cx', ax); accHead.setAttribute('cy', ay); accHead.setAttribute('opacity', vis);
    lenHead.setAttribute('cx', lx); lenHead.setAttribute('cy', ly); lenHead.setAttribute('opacity', vis);
    accRead.setAttribute('x', ax - 9); accRead.setAttribute('y', ay - 9); accRead.setAttribute('opacity', vis);
    lenRead.setAttribute('x', lx - 9); lenRead.setAttribute('y', ly + 19); lenRead.setAttribute('opacity', vis);
    accRead.textContent = accLabel(t);
    lenRead.textContent = lenLabel(t);

    callout.setAttribute('opacity', seg(p, 0.56, 0.66));
    note.setAttribute('opacity', seg(p, 0.82, 0.90));
  }, { extent: 210 });
}
