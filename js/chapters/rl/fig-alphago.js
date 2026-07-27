/* F3 — imitation has a ceiling. AlphaGo's two training curves rebuilt: the
   supervised network flattens below the strongest human; the reinforcement
   learning curve goes through the line and keeps climbing. Then move 37.
   The crossing index is found by scanning the generated series, not placed.
   Figure number is claimed by figure(); key 'alphago'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, lerp, clamp } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

const N = 61;
const HUMAN = 3515;              // Lee Sedol's approximate Elo, 2016
const SL_ASYMPTOTE = 3150;
const RL_ASYMPTOTE = 4600;
const ELO_MAX = 5000;
const HUMAN_ODDS = 10000;        // AlphaGo's own estimate for move 37

const sl = (t) => SL_ASYMPTOTE * (1 - Math.exp(-4.2 * t));
const rlc = (t) => RL_ASYMPTOTE * (1 - Math.exp(-3.0 * t));

export function alphagoFigure() {
  const W = 720, H = 450;
  const X0 = 64, X1 = 408, Y0 = 348, Y1 = 60;
  const BX = 468, BY = 92, BS = 12.2, GRID = 19;   // the board

  const xAt = (i) => X0 + (i / (N - 1)) * (X1 - X0);
  const yAt = (e) => Y0 - (e / ELO_MAX) * (Y0 - Y1);
  const slPts = Array.from({ length: N }, (_, i) => [xAt(i), yAt(sl(i / (N - 1)))]);
  const rlPts = Array.from({ length: N }, (_, i) => [xAt(i), yAt(rlc(i / (N - 1)))]);

  /* Derived, not placed: the first sample at which self-play passes the human. */
  const crossIdx = Array.from({ length: N }, (_, i) => rlc(i / (N - 1))).findIndex((e) => e >= HUMAN);
  const crossX = xAt(crossIdx);

  const upTo = (pts, t) => {
    const f = clamp(t) * (N - 1);
    const last = Math.floor(f), s = f - last;
    const out = pts.slice(0, last + 1).map(([x, y], k) => `${k ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    if (last < N - 1) {
      const [ax, ay] = pts[last], [bx, by] = pts[last + 1];
      out.push(`L ${lerp(ax, bx, s).toFixed(1)} ${lerp(ay, by, s).toFixed(1)}`);
    }
    return out.join(' ');
  };

  const grid = svg('g', {},
    ...[0, 1000, 2000, 3000, 4000, 5000].map((e) => svg('line', { x1: X0, y1: yAt(e), x2: X1, y2: yAt(e), stroke: PAL.grid, 'stroke-width': 1 })),
    ...[0, 1000, 2000, 3000, 4000, 5000].map((e) => txt(X0 - 8, yAt(e) + 4, e ? (e / 1000) + 'k' : '0', { size: 9.5, anchor: 'end', mono: true })),
    txt((X0 + X1) / 2, Y0 + 34, 'training', { size: 10.5, fill: PAL.tx, anchor: 'middle' }),
    svg('text', { x: 22, y: (Y0 + Y1) / 2, fill: PAL.tx, 'font-size': 10.5, 'font-family': 'sans-serif', 'text-anchor': 'middle', transform: `rotate(-90, 22, ${(Y0 + Y1) / 2})` }, 'playing strength (Elo)'));

  const humanLine = svg('line', { x1: X0, y1: yAt(HUMAN), x2: X1, y2: yAt(HUMAN), stroke: PAL.weight, 'stroke-width': 1.4, 'stroke-dasharray': '6 4', opacity: 0 });
  const humanTag = txt(X0 + 6, yAt(HUMAN) - 8, `the strongest human · ≈${HUMAN.toLocaleString('en-US')} Elo`, { size: 10, fill: PAL.weight, opacity: 0 });

  const slLine = svg('path', { d: upTo(slPts, 0), fill: 'none', stroke: PAL.act, 'stroke-width': 2 });
  const rlLine = svg('path', { d: upTo(rlPts, 0), fill: 'none', stroke: PAL.train, 'stroke-width': 2 });
  const slTag = txt(X1 - 4, yAt(SL_ASYMPTOTE) + 22, 'imitating human games', { size: 10.5, fill: PAL.act, anchor: 'end', opacity: 0 });
  const rlTag = txt(X1 - 4, yAt(rlc(1)) - 12, 'self-play', { size: 10.5, fill: PAL.train, anchor: 'end', opacity: 0 });
  const ceiling = svg('g', { opacity: 0 },
    svg('line', { x1: X0, y1: yAt(SL_ASYMPTOTE), x2: X1, y2: yAt(SL_ASYMPTOTE), stroke: PAL.act, 'stroke-width': 1.1, 'stroke-dasharray': '3 5', opacity: 0.7 }),
    txt(X0 + 6, yAt(SL_ASYMPTOTE) + 16, 'the ceiling of imitation', { size: 10, fill: PAL.act }));

  const crossMark = svg('g', { opacity: 0 },
    svg('line', { x1: crossX, y1: yAt(HUMAN), x2: crossX, y2: Y0, stroke: PAL.train, 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
    svg('circle', { cx: crossX, cy: yAt(HUMAN), r: 5, fill: 'none', stroke: PAL.train, 'stroke-width': 1.6 }),
    txt(crossX + 8, Y0 - 12, 'walks past it', { size: 10, fill: PAL.train }));

  /* ---- the board, and move 37 ---- */
  const boardLines = [];
  for (let i = 0; i < GRID; i++) {
    boardLines.push(
      svg('line', { x1: BX, y1: BY + i * BS, x2: BX + (GRID - 1) * BS, y2: BY + i * BS, stroke: 'rgba(230,237,243,0.16)', 'stroke-width': 0.7 }),
      svg('line', { x1: BX + i * BS, y1: BY, x2: BX + i * BS, y2: BY + (GRID - 1) * BS, stroke: 'rgba(230,237,243,0.16)', 'stroke-width': 0.7 }));
  }
  const star = (c, r) => svg('circle', { cx: BX + c * BS, cy: BY + r * BS, r: 1.8, fill: 'rgba(230,237,243,0.3)' });
  const stars = [3, 9, 15].flatMap((c) => [3, 9, 15].map((r) => star(c, r)));
  const MC = 10, MR = 4;                                    // the fifth-line shoulder hit
  const stone = svg('g', { opacity: 0 },
    svg('circle', { cx: BX + MC * BS, cy: BY + MR * BS, r: 6.4, fill: 'rgba(180,140,224,0.45)', stroke: PAL.attn, 'stroke-width': 1.6 }),
    svg('circle', { cx: BX + MC * BS, cy: BY + MR * BS, r: 11, fill: 'none', stroke: PAL.attn, 'stroke-width': 1, opacity: 0.5 }));
  const board = svg('g', { opacity: 0 },
    svg('rect', { x: BX - 18, y: BY - 18, width: (GRID - 1) * BS + 36, height: (GRID - 1) * BS + 36, rx: 6, fill: 'rgba(230,237,243,0.03)', stroke: 'rgba(230,237,243,0.10)', 'stroke-width': 1 }),
    boardLines, stars, stone,
    txt(BX - 18, BY - 30, 'move 37 · game two · 2016', { size: 10.5, fill: PAL.attn }));
  const moveNote = svg('g', { opacity: 0 },
    txt(BX - 18, BY + (GRID - 1) * BS + 44, `AlphaGo's own policy network put the odds that a human`, { size: 10.5, fill: PAL.tx }),
    txt(BX - 18, BY + (GRID - 1) * BS + 60, `would play here at about 1 in ${HUMAN_ODDS.toLocaleString('en-US')}.`, { size: 10.5, fill: PAL.tx }),
    txt(BX - 18, BY + (GRID - 1) * BS + 80, 'It was, in retrospect, the move that won the game.', { size: 10.5, fill: PAL.ink }));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Two training curves against a dashed line marking the strongest human at about ${HUMAN} Elo. The curve for imitating human games flattens below the line; the self-play curve rises through it and keeps climbing. Beside them, a Go board with a single stone marking move 37, a point AlphaGo estimated a human would play about once in ten thousand times.`,
  }, grid, ceiling, humanLine, humanTag, slLine, rlLine, slTag, rlTag, crossMark, board, moveNote);

  const fig = figure(
    `Imitation cannot exceed the thing it imitates: the supervised curve flattens below the strongest human because that is the level of the games it was fed. Self-play has no such ceiling — and, unbound from human play, it produced move 37. What the equivalent looks like in open-ended reasoning nobody knows. Curves are the published result&rsquo;s shape on an illustrative Elo axis; the human line and the odds are AlphaGo&rsquo;s reported figures.`,
    root, { wide: true, key: 'alphago' });

  return pin(fig, (p) => {
    humanLine.setAttribute('opacity', seg(p, 0.05, 0.12));
    humanTag.setAttribute('opacity', seg(p, 0.07, 0.14));
    slLine.setAttribute('d', upTo(slPts, seg(p, 0.14, 0.34, ease.linear)));
    slTag.setAttribute('opacity', seg(p, 0.28, 0.34));
    ceiling.setAttribute('opacity', seg(p, 0.32, 0.40));
    rlLine.setAttribute('d', upTo(rlPts, seg(p, 0.42, 0.62, ease.linear)));
    rlTag.setAttribute('opacity', seg(p, 0.58, 0.64));
    crossMark.setAttribute('opacity', seg(p, 0.54, 0.62));
    board.setAttribute('opacity', seg(p, 0.68, 0.76));
    stone.setAttribute('opacity', seg(p, 0.78, 0.85, ease.out));
    moveNote.setAttribute('opacity', seg(p, 0.86, 0.94));
  }, { extent: 215 });
}
