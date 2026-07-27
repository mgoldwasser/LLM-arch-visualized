/* Figure — attention as a directed graph. Eight nodes, and every edge derived
   from an adjacency rule rather than drawn by hand: j ≤ i for the causal
   (decoder) case, all j for the encoder case, and A×B for cross attention.
   The edge counts printed beside the graph are the lengths of those arrays. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, lerp, clamp } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { SUB } from './shared.js';

const N = 8, M = 4, R = 15;

/* The adjacency rules. Nothing below enumerates an edge. */
const EDGES = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) EDGES.push({ i, j, causal: j <= i });
const CROSS = [];
for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) CROSS.push({ i, j });
const N_CAUSAL = EDGES.filter((e) => e.causal).length;
const N_ALL = EDGES.length;

const ringAt = (i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
  return [300 + 132 * Math.cos(a), 220 + 132 * Math.sin(a), Math.cos(a), Math.sin(a)];
};
const colAt = (i) => [170, 70 + i * 44, -1, 0];
const memAt = (j) => [430, 120 + j * 62];

function edgePath(ax, ay, bx, by, bow) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const sx = ax + ux * R, sy = ay + uy * R;
  const ex = bx - ux * (R + 5), ey = by - uy * (R + 5);
  return `M ${sx} ${sy} Q ${(sx + ex) / 2 - uy * bow} ${(sy + ey) / 2 + ux * bow} ${ex} ${ey}`;
}
function loopPath(x, y, ox, oy) {
  const cx = x + ox * 17, cy = y + oy * 17, rl = 12;
  const a0 = Math.atan2(y - cy, x - cx);
  return `M ${cx + rl * Math.cos(a0 + 0.55)} ${cy + rl * Math.sin(a0 + 0.55)} `
    + `A ${rl} ${rl} 0 1 0 ${cx + rl * Math.cos(a0 - 0.55)} ${cy + rl * Math.sin(a0 - 0.55)}`;
}

const PANELS = [
  ['causal — a decoder block',
    ['node i may read node j only when j ≤ i',
      `edges drawn: ${N_CAUSAL}  ·  n(n+1)/2 with n = ${N}`,
      'node 1 reads only itself; node 8 reads all 8',
      'information flows one way along the sequence']],
  ['no mask — an encoder block',
    ['delete the line that erases the future:',
      'wei.masked_fill(tril == 0, -inf)',
      `edges drawn: ${N_ALL}  ·  n² with n = ${N}`,
      'that deleted line is the whole difference']],
  ['keys and values from somewhere else',
    ['queries from A; keys and values from B',
      `intra-set edges: 0  ·  cross edges: ${CROSS.length}`,
      'the two sets need not be the same kind:',
      'B can be an image, an audio window, a page']],
];

export function graphFigure() {
  const W = 760, H = 460;
  const marker = svg('marker', { id: 'attn2-graph-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5.5, markerHeight: 5.5, orient: 'auto-start-reverse' },
    svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.attn }));

  const nodes = Array.from({ length: N }, (_, i) => ({
    c: svg('circle', { r: R, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.4 }),
    t: txt(0, 0, String(i + 1), { size: 11, fill: PAL.ink, anchor: 'middle', mono: true }),
  }));
  const mems = Array.from({ length: M }, (_, j) => {
    const [x, y] = memAt(j);
    return svg('g', {},
      svg('circle', { cx: x, cy: y, r: R, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.4, 'stroke-dasharray': '4 2' }),
      txt(x, y + 4, `m${SUB[j]}`, { size: 10.5, fill: PAL.ink, anchor: 'middle', mono: true }));
  });

  /* Per-instance copies: the rule arrays above stay immutable, so rendering
     the figure twice gives two independent, identical graphs. */
  let oc = 0, on = 0;
  const edges = EDGES.map((e) => ({
    ...e, ord: e.causal ? oc++ : on++,
    p: svg('path', { fill: 'none', stroke: PAL.attn, 'stroke-width': e.causal ? 1.5 : 1.2, 'marker-end': 'url(#attn2-graph-arr)', opacity: 0, ...(e.causal ? {} : { 'stroke-dasharray': '4 3' }) }),
  }));
  const cross = CROSS.map((e, k) => ({
    ...e, ord: k,
    p: svg('path', { fill: 'none', stroke: PAL.attn, 'stroke-width': 1.3, 'marker-end': 'url(#attn2-graph-arr)', opacity: 0 }),
  }));

  const setA = txt(170, 42, 'sequence A — queries', { size: 10.5, fill: PAL.act, anchor: 'middle', mono: true });
  const setB = txt(420, 88, 'sequence B — keys, values', { size: 10.5, fill: PAL.act, anchor: 'middle', mono: true });
  const panels = PANELS.map(([title, lines], k) => {
    const strike = svg('line', { x1: 514, y1: 152, x2: 722, y2: 152, stroke: PAL.loss, 'stroke-width': 1.2, opacity: k === 1 ? 1 : 0 });
    return {
      g: svg('g', {},
        txt(516, 108, title, { size: 12.5, fill: PAL.ink }),
        lines.map((s, m) => txt(516, 134 + m * 22, s, { size: 10.5, fill: m === 1 ? PAL.tx : PAL.mut, mono: k === 1 && m === 1 })),
        strike),
    };
  });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Eight token nodes arranged in a ring. Directed edges appear following the causal rule — node one points only at itself, node eight at all eight — giving ${N_CAUSAL} edges. Deleting the mask adds the remaining edges for a fully connected encoder block of ${N_ALL}. Finally the nodes move into a column and draw ${CROSS.length} edges into a second, separate set of four nodes: cross attention.`,
  }, svg('defs', {}, marker),
    edges.map((e) => e.p), cross.map((e) => e.p),
    nodes.map((n) => [n.c, n.t]), mems, setA, setB, panels.map((q) => q.g));

  const node = figure(
    'attention is communication on a directed graph, and the graph is the only thing that changes between architectures. Keep the causal rule and you have a decoder; delete one line and every node talks to every other, which is an encoder; point the queries at a second set of nodes and it is cross attention. The edge counts beside the graph are the lengths of the generated edge lists, not captions.',
    root, { wide: true, key: 'graph' });

  const update = (p) => {
    const t3 = seg(p, 0.80, 0.90);
    const pos = nodes.map((_, i) => {
      const [rx, ry, rox, roy] = ringAt(i);
      const [cx, cy, cox, coy] = colAt(i);
      const ox = lerp(rox, cox, t3), oy = lerp(roy, coy, t3);
      const L = Math.hypot(ox, oy) || 1;
      return [lerp(rx, cx, t3), lerp(ry, cy, t3), ox / L, oy / L];
    });

    nodes.forEach((n, i) => {
      const [x, y] = pos[i];
      const o = seg(p, 0.02 + i * 0.008, 0.09 + i * 0.008);
      n.c.setAttribute('cx', x); n.c.setAttribute('cy', y); n.c.setAttribute('opacity', o);
      n.t.setAttribute('x', x); n.t.setAttribute('y', y + 4); n.t.setAttribute('opacity', o);
    });
    mems.forEach((g, j) => g.setAttribute('opacity', seg(p, 0.80 + j * 0.02, 0.88 + j * 0.02)));
    setA.setAttribute('opacity', t3);
    setB.setAttribute('opacity', t3);

    const fadeSelf = 1 - seg(p, 0.78, 0.86);
    edges.forEach((e) => {
      const [ax, ay, ox, oy] = pos[e.i];
      const [bx, by] = pos[e.j];
      e.p.setAttribute('d', e.i === e.j ? loopPath(ax, ay, ox, oy) : edgePath(ax, ay, bx, by, 14));
      const born = e.causal
        ? seg(p, 0.12 + e.ord * 0.0072, 0.16 + e.ord * 0.0072)
        : seg(p, 0.50 + e.ord * 0.005, 0.545 + e.ord * 0.005);
      e.p.setAttribute('opacity', born * fadeSelf * (e.causal ? 0.85 : 0.6));
    });
    cross.forEach((e) => {
      const [ax, ay] = pos[e.i];
      const [bx, by] = memAt(e.j);
      e.p.setAttribute('d', edgePath(ax, ay, bx, by, 6));
      e.p.setAttribute('opacity', seg(p, 0.85 + e.ord * 0.0035, 0.88 + e.ord * 0.0035) * 0.5);
    });

    const w = [
      clamp(seg(p, 0.28, 0.36) - seg(p, 0.46, 0.54)),
      clamp(seg(p, 0.60, 0.68) - seg(p, 0.74, 0.80)),
      seg(p, 0.90, 0.96),
    ];
    panels.forEach((q, k) => q.g.setAttribute('opacity', w[k]));
  };
  update(0);
  return pin(node, update, { extent: 300 });
}
