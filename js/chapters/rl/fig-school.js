/* A1 — the schoolroom. A textbook page holds three kinds of content, and
   training has three matching stages. Scrubbing sweeps the highlight down the
   page: exposition (amber, a reservoir fills), worked solution (cyan, a second
   reservoir fills), practice problem (green — nothing fills; attempts fan out
   and most of them die). This is the chapter's organizing spine.
   Figure number is claimed by figure(); key 'school'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, rng, si } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

/* Every number on the page is computed, including the two worked answers. */
const SUM_N = 100;
const PAIRS = SUM_N / 2;
const PAIR_VAL = SUM_N + 1;
const SUM_TOTAL = PAIRS * PAIR_VAL;                     // 5050
const DIV7 = Math.floor(999 / 7) - Math.floor(99 / 7);  // 128
const FAN = 12, SURVIVORS = 3;

const STAGES = [
  { name: 'pretraining', sub: 'read the exposition',
    wall: 'months · thousands of GPUs', data: '≈15T tokens of prose',
    gpuHours: 3.0e7, color: PAL.weight },
  { name: 'supervised fine-tuning', sub: 'copy the worked solutions',
    wall: 'hours · a single node', data: '10⁵–10⁷ demonstrations',
    gpuHours: 3.0e2, color: PAL.act },
  { name: 'reinforcement learning', sub: 'attempt the practice problems',
    wall: 'ongoing', data: 'prompts with known answers',
    gpuHours: 3.0e5, color: PAL.train },
];
const MAXLOG = Math.max(...STAGES.map((s) => Math.log10(s.gpuHours)));
const frac = (s) => Math.log10(s.gpuHours) / MAXLOG;

/* Highlight bands: disjoint by construction, so exactly one region carries
   data-hi="1" at any p past the opening beat. */
const BANDS = [[0.08, 0.34], [0.34, 0.60], [0.60, 1.01]];
const RY = [54, 170, 300], RH = [104, 118, 144];
const TANK_H = 72;                                   // one scale for both tanks
const PROSE_LINES = 6;

export function schoolFigure() {
  const W = 720, H = 470;
  const rand = rng(11);

  const defs = svg('defs', {},
    svg('marker', { id: 'rl-school-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const page = svg('g', { opacity: 0 },
    svg('rect', { x: 24, y: 18, width: 372, height: 434, rx: 10, fill: '#151B23', stroke: 'rgba(230,237,243,0.10)', 'stroke-width': 1 }),
    txt(40, 40, 'ONE PAGE OF A TEXTBOOK', { size: 9, fill: PAL.mut }));

  /* ---- the three page regions ---- */
  const regions = STAGES.map((s, i) => {
    const glow = svg('rect', { x: 36, y: RY[i], width: 348, height: RH[i], rx: 7, fill: `${s.color}14`, stroke: s.color, 'stroke-width': 1.1, opacity: 0.06 });
    const body = svg('g', { opacity: 0 });
    const g = svg('g', { dataset: { hi: '0' } }, glow, body);
    return { glow, body, g, color: s.color };
  });

  regions[0].body.append(txt(48, RY[0] + 18, 'exposition — prose you read', { size: 10, fill: PAL.weight }));
  for (let i = 0; i < PROSE_LINES; i++) {
    regions[0].body.append(svg('rect', {
      x: 48, y: RY[0] + 34 + i * 11, width: 300 * (0.62 + 0.38 * rand()), height: 4, rx: 2,
      fill: PAL.tx, opacity: 0.3,
    }));
  }

  regions[1].body.append(
    txt(48, RY[1] + 18, 'worked solution — an expert’s method, start to finish', { size: 10, fill: PAL.act }),
    txt(48, RY[1] + 40, `1 + 2 + ⋯ + ${SUM_N} = ?`, { size: 11.5, fill: PAL.ink, mono: true }),
    txt(48, RY[1] + 58, `pair 1+${SUM_N}, 2+${SUM_N - 1}, …`, { size: 11.5, fill: PAL.tx, mono: true }),
    txt(48, RY[1] + 76, `${PAIRS} pairs, each worth ${PAIR_VAL}`, { size: 11.5, fill: PAL.tx, mono: true }),
    txt(48, RY[1] + 94, `${PAIRS} × ${PAIR_VAL} = ${SUM_TOTAL}`, { size: 11.5, fill: PAL.ink, mono: true }));

  regions[2].body.append(
    txt(48, RY[2] + 18, 'practice problem — the answer, not the method', { size: 10, fill: PAL.train }),
    txt(48, RY[2] + 40, 'how many 3-digit numbers are divisible by 7?', { size: 11.5, fill: PAL.ink, mono: true }),
    svg('rect', { x: 46, y: RY[2] + 52, width: 96, height: 22, rx: 5, fill: 'rgba(125,216,127,0.12)', stroke: PAL.train, 'stroke-width': 1 }),
    txt(58, RY[2] + 67, `answer: ${DIV7}`, { size: 11.5, fill: PAL.train, mono: true }),
    txt(158, RY[2] + 67, 'method:', { size: 11.5, fill: PAL.mut, mono: true }),
    svg('line', { x1: 214, y1: RY[2] + 68, x2: 372, y2: RY[2] + 68, stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '3 4' }),
    txt(48, RY[2] + 100, 'you are on your own', { size: 10, fill: PAL.mut }));

  /* ---- the three stage cards ---- */
  const cards = STAGES.map((s, i) => {
    const y = RY[i];
    const g = svg('g', { opacity: 0 },
      svg('rect', { x: 418, y, width: 282, height: RH[i], rx: 8, fill: `${s.color}0E`, stroke: s.color, 'stroke-width': 1.2 }),
      svg('text', { x: 434, y: y + 24, fill: PAL.ink, 'font-family': 'sans-serif', 'font-size': 13, 'font-weight': 650 }, s.name),
      txt(434, y + 42, s.sub, { size: 10.5, fill: PAL.tx }));
    const arrow = svg('path', { d: `M 392 ${y + RH[i] / 2} L 412 ${y + RH[i] / 2}`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#rl-school-arr)', opacity: 0 });
    return { g, arrow, y, stage: s };
  });

  /* reservoirs — pretraining and SFT deposit something and stop */
  const tanks = [0, 1].map((i) => {
    const s = STAGES[i], y = RY[i] + 22, h = TANK_H;
    const fill = svg('rect', { x: 638, y: y + h, width: 44, height: 0, rx: 2, fill: s.color, opacity: 0.5 });
    const g = svg('g', {},
      svg('rect', { x: 638, y, width: 44, height: h, rx: 3, fill: 'rgba(230,237,243,0.05)', stroke: 'rgba(230,237,243,0.14)', 'stroke-width': 1 }),
      fill);
    cards[i].g.append(g,
      txt(434, RY[i] + 62, STAGES[i].wall, { size: 9.5, fill: s.color }),
      txt(434, RY[i] + 78, STAGES[i].data, { size: 9.5, fill: PAL.mut, mono: true }),
      txt(434, RY[i] + 96, `≈ ${si(s.gpuHours)} GPU-hours`, { size: 10, fill: PAL.tx, mono: true }));
    return { fill, y, h, frac: frac(s) };
  });

  /* RL card: no reservoir — a fan of attempts, most of which die */
  const OX = 396, OY = RY[2] + 92, KX = 678;
  const paths = Array.from({ length: FAN }, (_, i) => {
    const surv = i % 4 === 1 && i < 4 * SURVIVORS;            // 3 of 12, by construction
    const spread = (i / (FAN - 1) - 0.5) * 2;                 // −1 … +1 across the fan
    const endX = surv ? KX - 12 : 480 + rand() * 150;
    const endY = surv ? OY + spread * 5 : OY + spread * 34 + (rand() * 2 - 1) * 6;
    const bow = surv ? spread * 26 : spread * 40 + (rand() * 2 - 1) * 10;
    const d = `M ${OX} ${OY} Q ${(OX + endX) / 2} ${OY + bow} ${endX} ${endY}`;
    const dead = svg('circle', { cx: endX, cy: endY, r: 2.2, fill: PAL.loss, opacity: 0 });
    return {
      surv, dead,
      node: svg('path', {
        d, fill: 'none', stroke: PAL.mut, 'stroke-width': surv ? 1.7 : 1.1,
        pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1, opacity: 0,
      }),
    };
  });
  const keep = svg('g', { opacity: 0 },
    svg('circle', { cx: KX, cy: OY, r: 8, fill: 'rgba(125,216,127,0.18)', stroke: PAL.train, 'stroke-width': 1.4 }),
    svg('path', { d: `M ${KX - 4} ${OY} L ${KX - 1} ${OY + 3} L ${KX + 5} ${OY - 4}`, stroke: PAL.train, 'stroke-width': 1.6, fill: 'none' }));
  cards[2].g.append(...paths.map((p) => p.node), ...paths.map((p) => p.dead), keep,
    txt(434, RY[2] + 134, `ongoing · ≈ ${si(STAGES[2].gpuHours)} GPU-hours · ${STAGES[2].data}`, { size: 9.5, fill: PAL.tx }));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A textbook page beside three training stages. Highlighting the page’s expository prose fills a pretraining reservoir; highlighting a worked solution fills a supervised fine-tuning reservoir; highlighting a practice problem fills nothing — instead twelve attempt paths fan out from it and only three reach a kept answer.',
  }, defs, page, regions.map((r) => r.g), cards.map((c) => [c.arrow, c.g]));

  const fig = figure(
    `The spine of this chapter. A textbook carries three kinds of content and training runs three matching stages: prose you read, a method you copy, and a problem whose answer is printed but whose method is not. Only the third leaves the model to find something. Compute bars are order-of-magnitude, log-scaled, illustrative.`,
    root, { wide: true, key: 'school' });

  return pin(fig, (p) => {
    page.setAttribute('opacity', seg(p, 0.01, 0.07));

    regions.forEach((r, i) => {
      const [lo, hi] = BANDS[i];
      const on = p >= lo && p < hi;
      r.g.setAttribute('data-hi', on ? '1' : '0');
      const up = seg(p, lo, lo + 0.05);
      const down = seg(p, hi - 0.03, hi + 0.02) * 0.72;
      const heat = Math.max(0, up - down);
      r.glow.setAttribute('opacity', 0.06 + 0.9 * heat);
      r.body.setAttribute('opacity', seg(p, lo + 0.01, lo + 0.07));
    });

    cards.forEach((c, i) => {
      const [lo] = BANDS[i];
      c.g.setAttribute('opacity', seg(p, lo + 0.03, lo + 0.10, ease.out));
      c.arrow.setAttribute('opacity', seg(p, lo + 0.02, lo + 0.08));
    });

    tanks.forEach((t, i) => {
      const [lo, hi] = BANDS[i];
      const h = t.h * t.frac * seg(p, lo + 0.08, hi - 0.06, ease.out);
      t.fill.setAttribute('height', h);
      t.fill.setAttribute('y', t.y + t.h - h);
    });

    const judge = seg(p, 0.86, 0.93);
    paths.forEach((q, i) => {
      const draw = seg(p, 0.66 + i * 0.010, 0.78 + i * 0.010, ease.out);
      q.node.setAttribute('stroke-dashoffset', 1 - draw);
      q.node.setAttribute('stroke', judge > 0.5 ? (q.surv ? PAL.train : PAL.loss) : PAL.mut);
      q.node.setAttribute('opacity', draw * (q.surv ? 0.95 : 0.7 - 0.35 * judge));
      q.dead.setAttribute('opacity', q.surv ? 0 : draw * judge * 0.8);
    });
    keep.setAttribute('opacity', seg(p, 0.90, 0.97));
  }, { extent: 220 });
}
