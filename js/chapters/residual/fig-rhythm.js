/* The block's rhythm: communication, then computation, up a short stack.
   Even rungs are attention — arrows run BETWEEN the token columns. Odd rungs
   are the feed-forward — the arrows are gone, dividers close between the
   columns, and every column processes straight upward on its own. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, lerp, clamp, ease } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

const SUB = ['₁', '₂', '₃', '₄', '₅'];
const CX = [148, 250, 352, 454, 556];          // the five token columns
const WALL = [199, 301, 403, 505];             // midlines between them
const NB = 6;                                  // rungs: 3 blocks × 2 sublayers
const YC = (i) => 376 - i * 58;                // rung i, bottom to top
const S0 = 0.10, SPAN = 0.13;                  // rung i lights at S0 + i·SPAN

/* Which columns talk to which, per communication rung. Structure, not data. */
const MIX = [
  [[0, 2], [3, 1], [4, 3], [1, 0]],
  [[2, 4], [0, 3], [3, 2], [4, 1]],
  [[1, 4], [2, 0], [0, 1], [3, 4]],
];

const PHASE = [
  ['COMMUNICATION — attention mixes across the columns',
    'the only step in the block where one token can affect another', PAL.attn],
  ['COMPUTATION — the feed-forward works inside one column',
    'one token’s vector in, one out; the other positions are not an input', PAL.moe],
];

export function figRhythm() {
  const W = 720, H = 500, L = K3.blueprint.layers;

  const defs = svg('defs', {},
    svg('marker', { id: 'res2-mix-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5.5, markerHeight: 5.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.attn })),
    svg('marker', { id: 'res2-up-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.moe })));

  const streams = CX.map((x) => svg('line', {
    x1: x, y1: 408, x2: x, y2: 408, stroke: PAL.act, 'stroke-width': 1.8, opacity: 0,
  }));
  const chips = CX.map((x, i) => svg('g', { opacity: 0 },
    svg('rect', { x: x - 26, y: 408, width: 52, height: 26, rx: 6, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
    txt(x, 426, `x${SUB[i]}`, { size: 12, fill: PAL.ink, anchor: 'middle', mono: true })));
  const dots = CX.map((x) => txt(x, 46, '⋮', { size: 14, fill: PAL.act, anchor: 'middle', opacity: 0 }));
  const more = txt(612, 46, `× ${L} blocks`, { size: 11, fill: PAL.act, opacity: 0 });

  /* One rung per sublayer. Every rung owns its artwork; nothing is shared. */
  const rungs = [];
  for (let i = 0; i < NB; i++) {
    const yc = YC(i), comm = i % 2 === 0;
    const parts = [], arcs = [], walls = [];
    if (comm) {
      parts.push(svg('rect', { x: 104, y: yc - 21, width: 496, height: 42, rx: 10, fill: 'rgba(180,140,224,0.08)', stroke: PAL.attn, 'stroke-width': 1.3 }));
      for (const [a, b] of MIX[(i / 2) | 0]) {
        const arc = svg('path', {
          d: `M ${CX[a]} ${yc + 10} Q ${(CX[a] + CX[b]) / 2} ${yc - 16} ${CX[b]} ${yc + 10}`,
          fill: 'none', stroke: PAL.attn, 'stroke-width': 1.3, 'marker-end': 'url(#res2-mix-arr)',
        });
        arcs.push(arc);
      }
    } else {
      for (const x of CX) {
        parts.push(
          svg('rect', { x: x - 37, y: yc - 21, width: 74, height: 42, rx: 9, fill: 'rgba(76,201,168,0.08)', stroke: PAL.moe, 'stroke-width': 1.3 }),
          svg('line', { x1: x - 12, y1: yc + 15, x2: x - 12, y2: yc - 13, stroke: PAL.moe, 'stroke-width': 1.2, 'marker-end': 'url(#res2-up-arr)' }),
          txt(x + 6, yc + 4, 'MLP', { size: 10, fill: PAL.moe, mono: true }));
      }
      for (const x of WALL) {
        walls.push(svg('line', { x1: x, y1: yc - 25, x2: x, y2: yc + 25, stroke: PAL.mut, 'stroke-width': 1.3, 'stroke-dasharray': '3 4' }));
      }
    }
    const l1 = txt(614, yc - 3, comm ? 'attention' : 'feed-forward', { size: 11, fill: comm ? PAL.attn : PAL.moe, mono: true });
    const l2 = txt(614, yc + 12, comm ? 'communication' : 'computation', { size: 10 });
    rungs.push({ i, comm, g: svg('g', { opacity: 0 }, parts, l1, l2), arcs, walls });
  }

  /* Left-hand brackets: each pair of rungs is one block. */
  const brackets = [0, 1, 2].map((k) => {
    const top = YC(2 * k + 1) - 21, bot = YC(2 * k) + 21;
    return svg('g', { opacity: 0 },
      svg('path', { d: `M 70 ${top} L 62 ${top} L 62 ${bot} L 70 ${bot}`, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 }),
      txt(54, (top + bot) / 2 + 4, k === 0 ? 'block ℓ' : `ℓ+${k}`, { size: 10.5, anchor: 'end' }));
  });

  const title = txt(24, 28, 'one block, twice: communicate, then compute', { size: 12.5, fill: PAL.ink });
  const phase = txt(360, 462, '', { size: 12.5, anchor: 'middle' });
  const detail = txt(360, 484, '', { size: 11, fill: PAL.tx, anchor: 'middle' });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Five token columns run bottom to top as cyan residual streams. Six rungs alternate up the diagram. On a communication rung a violet band spans all five columns and curved arrows run between them, so tokens read each other. On a computation rung the arrows are gone: each column has its own teal feed-forward box with an arrow pointing straight up, and dashed dividers close between the columns. Three pairs of rungs are bracketed as three blocks, and the pattern repeats about ${L} times.`,
  }, defs, brackets, streams, chips,
    rungs.map((r) => [r.g, r.arcs, r.walls]), dots, more, title, phase, detail);

  const node = figure(
    `the rhythm of the stack. Attention is the communication step — the band spans every column, and the arrows cross between them. The feed-forward is the computation step — the arrows are gone, the dividers are closed, and each column is processed by the same weights without ever seeing its neighbours. Schematic: the widths and the mixing pattern are illustrative, the alternation is not.`,
    root, { wide: true, key: 'rhythm' });

  return pin(node, (p) => {
    const rise = seg(p, 0, 0.09, ease.out);
    streams.forEach((s) => s.setAttribute('y2', lerp(408, 58, rise)));
    streams.forEach((s) => s.setAttribute('opacity', rise > 0 ? 0.9 : 0));
    chips.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.00 + i * 0.012, 0.05 + i * 0.012)));

    rungs.forEach(({ i, g, arcs, walls }) => {
      const s = S0 + i * SPAN;
      const on = seg(p, s, s + 0.05);
      const glow = on * (1 - seg(p, s + 0.09, s + 0.13));
      g.setAttribute('opacity', on * (0.30 + 0.70 * glow));
      arcs.forEach((a) => a.setAttribute('opacity', on * (0.14 + 0.86 * glow)));
      walls.forEach((w) => w.setAttribute('opacity', on * (0.20 + 0.80 * glow)));
    });
    brackets.forEach((b, k) => b.setAttribute('opacity', seg(p, S0 + (2 * k + 1) * SPAN, S0 + (2 * k + 1) * SPAN + 0.06) * 0.85));

    const idx = clamp(Math.floor((p - S0) / SPAN), 0, NB - 1);
    const [head, sub, color] = PHASE[idx % 2];
    const vis = seg(p, 0.12, 0.17);
    phase.textContent = head;
    phase.setAttribute('fill', color);
    phase.setAttribute('opacity', vis);
    detail.textContent = sub;
    detail.setAttribute('opacity', vis);

    const tail = seg(p, 0.88, 0.95);
    dots.forEach((d) => d.setAttribute('opacity', tail * 0.8));
    more.setAttribute('opacity', tail);
  }, { extent: 260 });
}
