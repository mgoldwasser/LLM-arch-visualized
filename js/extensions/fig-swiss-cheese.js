/* G3 — Jagged intelligence. A capability surface with voids in it: a probe
   walks left to right, holds on PhD-level physics, holds on Olympiad geometry,
   and drops through on a comparison of two decimal numbers. The remaining
   voids appear only at the end — from outside, the surface looks unbroken.

   Void positions come from a seeded rng, so the surface is identical on every
   load; the lane the probe walks is kept clear of all of them but one, so the
   sweep enters exactly one void. Every SVG id here is prefixed `cqe-`. */

import { svg, svgRoot } from '../core/dom.js';
import { txt, PAL, figure } from '../core/components.js';
import { seg, ease, rng, lerp } from '../core/anim.js';
import { pin } from '../core/scroll.js';

const W = 720, H = 408;
const TOPY = 148, BOTY = 300, THICK = 26;
const LANE_V = 0.5, HOLE_U = 0.795;

/* Parallel projection of the slab: u across, v back-to-front. */
const px = (u, v) => lerp(lerp(62, 22, v), lerp(658, 698, v), u);
const py = (v) => lerp(TOPY, BOTY, v);
const sc = (v) => lerp(0.80, 1.08, v);

const STATIONS = [
  { u: 0.16, label: 'PhD-level physics', verdict: 'solid', ok: true, at: 0.24 },
  { u: 0.46, label: 'Olympiad geometry', verdict: 'solid', ok: true, at: 0.44 },
  { u: HOLE_U, label: 'is 9.11 bigger than 9.9?', verdict: 'no floor', ok: false, at: 0.66 },
];

/* Seeded voids, none of them touching the probe's lane. */
function voids() {
  const rand = rng(911);
  const out = [];
  for (let guard = 0; guard < 500 && out.length < 10; guard += 1) {
    const u = 0.06 + rand() * 0.86;
    const v = 0.08 + rand() * 0.84;
    if (Math.abs(py(v) - py(LANE_V)) < 32) continue;
    if (out.some((h) => Math.abs(px(h.u, h.v) - px(u, v)) < 68 && Math.abs(py(h.v) - py(v)) < 30)) continue;
    out.push({ u, v });
  }
  return out;
}

function voidNode(h, target) {
  const cx = px(h.u, h.v), cy = py(h.v), rx = 27 * sc(h.v), ry = rx * 0.42;
  const rim = svg('ellipse', {
    cx, cy, rx, ry, fill: '#080A0E',
    stroke: target ? PAL.loss : 'rgba(240,120,80,0.40)', 'stroke-width': target ? 1.6 : 1.1,
  });
  const lip = svg('path', {
    d: `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`,
    fill: 'none', stroke: 'rgba(240,120,80,0.22)', 'stroke-width': 2.4,
  });
  return { g: svg('g', { opacity: 0 }, rim, lip), rim, cx, cy, rx, ry };
}

export function swissCheeseFigure() {
  const holes = voids().map((h) => voidNode(h, false));
  const target = voidNode({ u: HOLE_U, v: LANE_V }, true);
  const LANEY = py(LANE_V);

  /* ---- the slab ----------------------------------------------------------- */
  const face = svg('polygon', {
    points: `${px(0, 0)},${py(0)} ${px(1, 0)},${py(0)} ${px(1, 1)},${py(1)} ${px(0, 1)},${py(1)}`,
    fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.2,
  });
  const edge = svg('polygon', {
    points: `${px(0, 1)},${py(1)} ${px(1, 1)},${py(1)} ${px(1, 1)},${py(1) + THICK} ${px(0, 1)},${py(1) + THICK}`,
    fill: 'rgba(90,200,220,0.14)', stroke: PAL.act, 'stroke-width': 1.2,
  });
  const mesh = svg('g', { opacity: 0.5 },
    Array.from({ length: 11 }, (_, i) => svg('line', {
      x1: px(i / 10, 0), y1: py(0), x2: px(i / 10, 1), y2: py(1), stroke: PAL.act, 'stroke-width': 0.5, opacity: 0.22,
    })),
    Array.from({ length: 5 }, (_, j) => svg('line', {
      x1: px(0, j / 4), y1: py(j / 4), x2: px(1, j / 4), y2: py(j / 4), stroke: PAL.act, 'stroke-width': 0.5, opacity: 0.22,
    })));
  const slab = svg('g', { opacity: 0 }, face, edge, mesh);

  const lane = svg('line', {
    x1: px(0, LANE_V), y1: LANEY, x2: px(1, LANE_V), y2: LANEY,
    stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '4 5', opacity: 0,
  });

  /* ---- the probe: on the surface, then receding into the void ------------- */
  const probe = svg('g', { opacity: 0 },
    svg('line', { x1: 0, y1: -28, x2: 0, y2: -9, stroke: PAL.act, 'stroke-width': 1.2 }),
    svg('circle', { cx: 0, cy: 0, r: 7, fill: 'rgba(90,200,220,0.18)', stroke: PAL.act, 'stroke-width': 1.6 }));
  const clip = svg('clipPath', { id: 'cqe-void-clip' },
    svg('ellipse', { cx: target.cx, cy: target.cy, rx: target.rx, ry: target.ry }));
  const falling = svg('g', {},
    svg('circle', { cx: 0, cy: 0, r: 7, fill: 'rgba(240,120,80,0.38)', stroke: PAL.loss, 'stroke-width': 1.6 }));
  const fallWrap = svg('g', { 'clip-path': 'url(#cqe-void-clip)', opacity: 0 }, falling);

  /* ---- station callouts --------------------------------------------------- */
  const stations = STATIONS.map((s) => {
    const x = px(s.u, LANE_V);
    const color = s.ok ? PAL.act : PAL.loss;
    const g = svg('g', { opacity: 0 },
      svg('line', { x1: x, y1: 124, x2: x, y2: LANEY - 16, stroke: color, 'stroke-width': 0.9, 'stroke-dasharray': '3 4', opacity: 0.55 }),
      txt(x, 102, s.label, { size: 11.5, fill: PAL.ink, anchor: 'middle' }),
      txt(x, 118, s.verdict, { size: 10, fill: color, anchor: 'middle' }));
    const tick = s.ok
      ? svg('circle', { cx: x, cy: LANEY, r: 3, fill: PAL.act, opacity: 0 })
      : null;
    return { g, tick, at: s.at };
  });

  const title = txt(26, 40, 'one capability surface, probed left to right', { size: 12, fill: PAL.ink, opacity: 0 });
  const verdict = txt(26, 364, 'no floor here — and nothing on the surface said so beforehand',
    { size: 12, fill: PAL.loss, opacity: 0 });
  const honest = txt(26, 390, 'the same surface, drawn honestly: the other voids were there the whole time',
    { size: 12, fill: PAL.tx, opacity: 0 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A slab labelled as a capability surface. A probe walks across it from left to right: it holds firm at PhD-level physics, holds firm at Olympiad geometry, and then, at the question “is 9.11 bigger than 9.9?”, drops into a void in the surface. At the end, further voids fade in across the whole slab — they were invisible from outside until something fell into one.',
  }, svg('defs', {}, clip), slab, lane,
    holes.map((h) => h.g), target.g, fallWrap, probe,
    stations.map((s) => [s.g, s.tick]), title, verdict, honest);

  /* The epilogue is back matter and carries no chapter number, so figure()
     omits the "Fig. N — " prefix here and the caption stands on its own. */
  const fig = figure(
    'Extraordinary competence with arbitrary voids in it. Void positions are seeded — the surface is the same on every load — and illustrative, which is the point: there is no principle here that would tell you where the next one is. The leading account of the 9.11 case, features associated with chapter-and-verse strings firing on version-like numbers, is a finding, not an explanation.',
    root, { wide: true });

  return pin(fig, (p) => {
    slab.setAttribute('opacity', seg(p, 0.02, 0.10));
    title.setAttribute('opacity', seg(p, 0.04, 0.10));
    lane.setAttribute('opacity', seg(p, 0.10, 0.16) * 0.8);

    /* walk: three eased legs with a pause at each station — pure in p */
    const u = 0.03
      + 0.13 * seg(p, 0.14, 0.26, ease.inOut)
      + 0.30 * seg(p, 0.34, 0.46, ease.inOut)
      + 0.335 * seg(p, 0.54, 0.68, ease.inOut);
    const drop = seg(p, 0.70, 0.82, ease.in);
    probe.setAttribute('transform', `translate(${px(u, LANE_V).toFixed(2)}, ${LANEY})`);
    probe.setAttribute('opacity', seg(p, 0.12, 0.17) * (1 - drop));

    stations.forEach((s) => {
      s.g.setAttribute('opacity', seg(p, s.at, s.at + 0.06));
      if (s.tick) s.tick.setAttribute('opacity', seg(p, s.at + 0.02, s.at + 0.07));
    });

    target.g.setAttribute('opacity', seg(p, 0.62, 0.68));
    target.rim.setAttribute('stroke-width', 1.6 + 1.4 * seg(p, 0.72, 0.80));
    falling.setAttribute('transform', `translate(${target.cx}, ${target.cy + 3 + 9 * drop}) scale(${(1 - 0.62 * drop).toFixed(3)})`);
    fallWrap.setAttribute('opacity', seg(p, 0.70, 0.74) * (1 - seg(p, 0.80, 0.88)));
    verdict.setAttribute('opacity', seg(p, 0.78, 0.84));

    holes.forEach((h, i) => h.g.setAttribute('opacity', seg(p, 0.86 + i * 0.006, 0.92 + i * 0.006)));
    honest.setAttribute('opacity', seg(p, 0.94, 0.99));
  });
}
