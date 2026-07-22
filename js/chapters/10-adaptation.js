/* Chapter 10 — adaptation. The finale: how much of the model do you
   actually have to touch? Full fine-tuning → LoRA → TinyLoRA's 13 numbers.
   Sticky scene: one weight matrix under three philosophies. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, takeaway, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { track } from '../core/scroll.js';
import { seg, lerp, ease, si } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

/* ---- the sticky figure: the same matrix, three philosophies --------------- */

function shrinkFigure(canvas) {
  const W = 720, H = 470;
  const MX = 60, MY = 80, MS = 210;   // the matrix W

  /* legend — the chapter's color grammar, stated once */
  const legend = svg('g', { 'font-family': 'sans-serif', 'font-size': 11 },
    svg('rect', { x: 470, y: 20, width: 11, height: 11, rx: 2, fill: PAL.train }),
    svg('text', { x: 487, y: 30, fill: PAL.tx }, 'trainable'),
    svg('rect', { x: 566, y: 20, width: 11, height: 11, rx: 2, fill: PAL.weight }),
    svg('text', { x: 583, y: 30, fill: PAL.tx }, 'frozen'));

  /* optimizer-state slabs stacked behind W (full fine-tuning only) */
  const slabs = [1, 2].map((i) => svg('g', { opacity: 0 },
    svg('rect', { x: MX + i * 16, y: MY - i * 16, width: MS, height: MS, rx: 8, fill: 'rgba(240,120,80,0.05)', stroke: PAL.loss, 'stroke-width': 1, 'stroke-dasharray': '4 4' })));
  const slabTag = svg('text', { x: MX + MS + 26, y: MY - 16, fill: PAL.loss, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, 'gradients + Adam m, v  ·  ≈16 bytes / param');

  /* W itself: green→amber crossfade */
  const wGreen = svg('rect', { x: MX, y: MY, width: MS, height: MS, rx: 8, fill: 'rgba(125,216,127,0.16)', stroke: PAL.train, 'stroke-width': 1.6, opacity: 0 });
  const wAmber = svg('rect', { x: MX, y: MY, width: MS, height: MS, rx: 8, fill: 'rgba(224,168,76,0.10)', stroke: PAL.weight, 'stroke-width': 1.4, opacity: 0 });
  const gridPath = (() => {
    let d = '';
    for (let i = 1; i < 10; i++) {
      d += `M ${MX + (MS / 10) * i} ${MY} V ${MY + MS} `;
      d += `M ${MX} ${MY + (MS / 10) * i} H ${MX + MS} `;
    }
    return svg('path', { d, stroke: PAL.grid.replace('0.06', '0.18'), 'stroke-width': 1, fill: 'none', opacity: 0 });
  })();
  const wLetter = svg('text', { x: MX + MS / 2, y: MY + MS / 2 + 2, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 26, opacity: 0 }, 'W');
  const wFrozen = svg('text', { x: MX + MS / 2, y: MY + MS / 2 + 26, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, 'frozen');
  const wSvd = svg('text', { x: MX + MS / 2, y: MY + MS / 2 + 44, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 }, '(SVD subspace)');
  const wDim = svg('text', { x: MX + MS / 2, y: MY + MS + 18, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 11, opacity: 0 }, 'd × k');
  const gW = svg('g', {}, slabs, wGreen, wAmber, gridPath, wLetter, wFrozen, wSvd, wDim, slabTag);

  const plus = svg('text', { x: 296, y: MY + MS / 2 + 8, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 22, opacity: 0 }, '+');

  /* LoRA: two thin trainable strips B (d×r) and A (r×k) */
  const gLora = svg('g', { opacity: 0 },
    svg('rect', { x: 322, y: MY, width: 24, height: MS, rx: 5, fill: 'rgba(125,216,127,0.22)', stroke: PAL.train, 'stroke-width': 1.4 }),
    svg('text', { x: 334, y: MY - 10, 'text-anchor': 'middle', fill: PAL.train, 'font-family': 'monospace', 'font-size': 13 }, 'B'),
    svg('text', { x: 334, y: MY + MS + 18, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, 'd×r'),
    svg('rect', { x: 364, y: MY, width: MS, height: 24, rx: 5, fill: 'rgba(125,216,127,0.22)', stroke: PAL.train, 'stroke-width': 1.4 }),
    svg('text', { x: 364 + MS / 2, y: MY - 10, 'text-anchor': 'middle', fill: PAL.train, 'font-family': 'monospace', 'font-size': 13 }, 'A'),
    svg('text', { x: 364 + MS + 26, y: MY + 17, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, 'r×k'),
    svg('text', { x: 364 + MS / 2, y: MY + 62, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'ΔW = BA · rank r ≈ 8–64'));

  /* TinyLoRA: frozen SVD factors + fixed random P + a 13-cell vector v */
  const VX = 640, VY = 66, VP = 14;
  const vCells = Array.from({ length: 13 }, (_, i) =>
    svg('rect', { x: VX, y: VY + i * VP, width: 13, height: 12, rx: 2, fill: PAL.train, opacity: 0 }));
  const vRing = svg('rect', { x: VX - 5, y: VY - 5, width: 23, height: 12 * VP + 20, rx: 5, fill: 'none', stroke: PAL.train, 'stroke-width': 1.6, opacity: 0 });
  const gTinyStatic = svg('g', {},
    svg('rect', { x: 322, y: MY, width: 20, height: MS, rx: 5, fill: 'rgba(224,168,76,0.16)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    svg('text', { x: 332, y: MY - 10, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 12 }, 'Uᵣ'),
    svg('text', { x: 332, y: MY + MS + 18, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 9 }, 'frozen SVD'),
    svg('rect', { x: 358, y: 168, width: 36, height: 36, rx: 5, fill: 'rgba(125,216,127,0.15)', stroke: PAL.train, 'stroke-width': 1.3 }),
    svg('text', { x: 376, y: 190, 'text-anchor': 'middle', fill: PAL.train, 'font-family': 'monospace', 'font-size': 10 }, 'r×r'),
    svg('text', { x: 376, y: 160, 'text-anchor': 'middle', fill: PAL.train, 'font-family': 'monospace', 'font-size': 10 }, 'mat(Pv)'),
    svg('rect', { x: 410, y: 176, width: 164, height: 20, rx: 5, fill: 'rgba(224,168,76,0.16)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    svg('text', { x: 492, y: 168, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 12 }, 'Vᵣᵀ'),
    svg('rect', { x: 428, y: 252, width: 64, height: 42, rx: 6, fill: 'rgba(107,118,131,0.14)', stroke: PAL.mut, 'stroke-width': 1.3 }),
    svg('text', { x: 460, y: 278, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 13 }, 'P'),
    svg('text', { x: 460, y: 310, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 9 }, 'fixed random ·'),
    svg('text', { x: 460, y: 322, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 9 }, 'never trained'),
    svg('path', { d: 'M 636 160 C 590 220, 540 258, 498 268', stroke: PAL.mut, 'stroke-width': 1.2, fill: 'none', 'stroke-dasharray': '4 4', 'marker-end': 'url(#arrT)' }),
    svg('path', { d: 'M 428 262 C 400 244, 386 226, 378 210', stroke: PAL.mut, 'stroke-width': 1.2, fill: 'none', 'stroke-dasharray': '4 4', 'marker-end': 'url(#arrT)' }));
  const vLabel = svg('text', { x: 646, y: 52, 'text-anchor': 'middle', fill: PAL.train, 'font-family': 'monospace', 'font-size': 13, opacity: 0 }, 'v');
  const vSub = svg('text', { x: 684, y: VY + 13 * VP + 22, 'text-anchor': 'end', fill: PAL.train, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 }, '13 numbers · tied across all layers');
  const gTiny = svg('g', { opacity: 0 }, gTinyStatic, vCells, vRing, vLabel, vSub);

  /* stat band at the bottom, crossfading per philosophy */
  const stat = (v, sub, col) => svg('g', { opacity: 0 },
    svg('text', { x: W / 2, y: 408, 'text-anchor': 'middle', fill: col, 'font-family': 'monospace', 'font-size': 21 }, v),
    svg('text', { x: W / 2, y: 432, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 12 }, sub));
  const s0 = stat('trainable: ~7,000,000,000', 'per-task copy: gigabytes — plus ≈16 B/param of optimizer state while training', PAL.train);
  const s1 = stat('trainable: ~10–50 million', 'per-task adapter: megabytes — W frozen, hot-swappable, mergeable at deploy', PAL.train);
  const s2 = stat('trainable: just v', 'P fixed random, never trained · one v shared — “tiled” — across all layers', PAL.train);
  const punch = svg('g', { opacity: 0 },
    svg('text', { x: W / 2, y: 412, 'text-anchor': 'middle', fill: PAL.train, 'font-family': 'monospace', 'font-size': 27 }, '13 numbers · 26 bytes'),
    svg('text', { x: W / 2, y: 438, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 12 }, 'nine orders of magnitude below full fine-tuning — an update that fits in a sentence'));

  const defs = svg('defs', {},
    svg('marker', { id: 'arrT', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  canvas.append(svgRoot(W, H, { role: 'img', 'aria-label': 'The same weight matrix under three philosophies: full fine-tuning trains all of W with 16 bytes per parameter of optimizer state; LoRA freezes W and trains two thin strips B and A; TinyLoRA freezes even the SVD factors, keeps a fixed random projection P, and trains only a 13-number vector v tied across all layers.' },
    defs, legend, gW, plus, gLora, gTiny, s0, s1, s2, punch));

  return (p) => {
    /* step 0 — full fine-tuning: everything green + optimizer slabs */
    const tW = seg(p, 0.02, 0.08, ease.out);
    gridPath.setAttribute('opacity', tW);
    wLetter.setAttribute('opacity', tW);
    wDim.setAttribute('opacity', tW);
    const tF = seg(p, 0.27, 0.33);          // the freeze: green → amber
    wGreen.setAttribute('opacity', tW * (1 - tF));
    wAmber.setAttribute('opacity', tF);
    wFrozen.setAttribute('opacity', tF);
    wSvd.setAttribute('opacity', seg(p, 0.54, 0.6));
    slabs.forEach((s, i) => s.setAttribute('opacity', seg(p, 0.09 + i * 0.03, 0.14 + i * 0.03) * (1 - tF)));
    slabTag.setAttribute('opacity', seg(p, 0.13, 0.18) * (1 - tF));
    s0.setAttribute('opacity', seg(p, 0.1, 0.16) * (1 - seg(p, 0.25, 0.29)));

    /* step 1 — LoRA: thin strips appear beside the frozen matrix */
    plus.setAttribute('opacity', seg(p, 0.29, 0.34) * lerp(1, 0.4, seg(p, 0.77, 0.82)));
    gLora.setAttribute('opacity', seg(p, 0.3, 0.36) * (1 - seg(p, 0.52, 0.57)));
    s1.setAttribute('opacity', seg(p, 0.33, 0.38) * (1 - seg(p, 0.5, 0.54)));

    /* step 2 — TinyLoRA: even the strips collapse */
    gTiny.setAttribute('opacity', seg(p, 0.55, 0.61));
    vCells.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.56 + i * 0.006, 0.6 + i * 0.006)));
    vLabel.setAttribute('opacity', seg(p, 0.58, 0.62));
    vSub.setAttribute('opacity', seg(p, 0.61, 0.66));
    s2.setAttribute('opacity', seg(p, 0.6, 0.65) * (1 - seg(p, 0.75, 0.79)));

    /* step 3 — the punchline: dim everything but v */
    const tP = seg(p, 0.78, 0.85);
    gW.setAttribute('opacity', lerp(1, 0.3, tP));
    gTinyStatic.setAttribute('opacity', lerp(1, 0.35, tP));
    vRing.setAttribute('opacity', tP);
    punch.setAttribute('opacity', seg(p, 0.8, 0.88));
  };
}

/* ---- Fig 10.2: GSM8K results — bars growing on scroll --------------------- */

function resultsFigure() {
  const W = 720, H = 292, Y0 = 70, Y1 = 100, TOP = 44, BOT = 232;
  const y = (v) => BOT - ((v - Y0) / (Y1 - Y0)) * (BOT - TOP);
  const BARS = [
    { v: 76.0, label: '76%', name: ['Qwen2.5-7B', 'Instruct · base'], fill: '#5A6470', op: 0.8 },
    { v: 80.0, label: '~80%', name: ['TinyLoRA', '1 parameter'], fill: PAL.train, op: 0.5 },
    { v: 91.8, label: '~91.8%', name: ['TinyLoRA', '13 parameters'], fill: PAL.train, op: 0.95 },
    { v: 93.5, label: '~93.5%', name: ['full fine-tuning', '(illustrative)'], fill: PAL.weight, op: 0.8 },
  ];
  const X = (i) => 116 + i * 148, BW = 92;

  const grid = [70, 80, 90, 100].map((v) => svg('g', {},
    svg('line', { x1: 60, y1: y(v), x2: 690, y2: y(v), stroke: PAL.grid.replace('0.06', '0.14'), 'stroke-width': 1 }),
    svg('text', { x: 52, y: y(v) + 4, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 10 }, v)));
  const axisTitle = svg('text', { x: 60, y: 24, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'GSM8K accuracy (%) · trained with GRPO on math problems');
  const els = BARS.map((b, i) => ({
    ...b,
    bar: svg('rect', { x: X(i), y: BOT, width: BW, height: 0, rx: 4, fill: b.fill, opacity: b.op }),
    val: svg('text', { x: X(i) + BW / 2, y: y(b.v) - 8, 'text-anchor': 'middle', fill: b.fill === '#5A6470' ? PAL.tx : b.fill, 'font-family': 'monospace', 'font-size': 13, opacity: 0 }, b.label),
    name: svg('text', { x: X(i) + BW / 2, y: BOT + 18, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11 },
      svg('tspan', { x: X(i) + BW / 2, dy: 0 }, b.name[0]),
      svg('tspan', { x: X(i) + BW / 2, dy: 14 }, b.name[1])),
  }));
  const gain = svg('g', { opacity: 0 },
    svg('path', { d: `M ${X(0) + BW / 2} ${y(76) - 26} C ${X(0) + BW / 2 + 100} ${y(96)}, ${X(2)} ${y(96)}, ${X(2) + BW / 2 - 6} ${y(91.8) - 24}`, stroke: PAL.train, 'stroke-width': 1.2, fill: 'none', 'stroke-dasharray': '5 4', 'marker-end': 'url(#arrR)' }),
    svg('text', { x: (X(0) + X(2) + BW) / 2, y: y(97), 'text-anchor': 'middle', fill: PAL.train, 'font-family': 'sans-serif', 'font-size': 11 }, '+15.8 points from 26 bytes'));
  const defs = svg('defs', {},
    svg('marker', { id: 'arrR', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.train })));

  const node = svgRoot(W, H, { role: 'img', 'aria-label': 'Bar chart: GSM8K accuracy rises from 76 percent for the Qwen2.5-7B-Instruct base model, to about 80 percent with one trained parameter, to about 91.8 percent with TinyLoRA’s 13 parameters, near an illustrative full fine-tuning bar.' },
    defs, grid, axisTitle, els.map((e) => [e.bar, e.val, e.name]), gain);

  const update = (p) => {
    els.forEach((e, i) => {
      const t = seg(p, 0.16 + i * 0.05, 0.38 + i * 0.05, ease.out);
      const h = (BOT - y(e.v)) * t;
      e.bar.setAttribute('height', h);
      e.bar.setAttribute('y', BOT - h);
      e.val.setAttribute('opacity', seg(t, 0.7, 1));
    });
    gain.setAttribute('opacity', seg(p, 0.42, 0.52));
  };
  return { node, update };
}

/* ---- Fig 10.3: the SFT-vs-RL asymmetry at tiny capacity ------------------- */

function asymmetryFigure() {
  const W = 720, H = 300, TOP = 40, BOT = 240, X0 = 84, X1 = 664;
  const TICKS = ['1', '10', '100', '1k', '10k', '100k', '1M'];
  const x = (i) => X0 + (i / 6) * (X1 - X0);
  const y = (v) => BOT - ((v - 70) / 25) * (BOT - TOP);
  const RL = [[0, 80], [1.11, 91.8], [2, 92.3], [3, 92.8], [4, 93.0], [5, 93.2], [6, 93.4]];
  const SFT = [[0, 76.2], [1, 76.8], [2, 78.5], [3, 84.0], [4, 91.0], [5, 92.5], [6, 93.2]];
  const path = (pts) => pts.map(([i, v], k) => `${k ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  const axis = svg('g', { 'font-family': 'monospace', 'font-size': 10 },
    svg('line', { x1: X0 - 10, y1: BOT, x2: X1 + 14, y2: BOT, stroke: PAL.mut, 'stroke-width': 1 }),
    TICKS.map((t, i) => svg('g', {},
      svg('line', { x1: x(i), y1: BOT, x2: x(i), y2: BOT + 5, stroke: PAL.mut, 'stroke-width': 1 }),
      svg('text', { x: x(i), y: BOT + 19, 'text-anchor': 'middle', fill: PAL.mut }, t))),
    [70, 80, 90].map((v) => svg('g', {},
      svg('line', { x1: X0 - 10, y1: y(v), x2: X1 + 14, y2: y(v), stroke: PAL.grid.replace('0.06', '0.12'), 'stroke-width': 1 }),
      svg('text', { x: X0 - 18, y: y(v) + 4, 'text-anchor': 'end', fill: PAL.mut }, v))),
    svg('text', { x: (X0 + X1) / 2, y: BOT + 38, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'trainable parameters in the update (log scale)'),
    svg('text', { x: X0 - 10, y: 24, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'GSM8K accuracy (%) · illustrative curves'));

  const rlPath = svg('path', { d: path(RL), stroke: PAL.train, 'stroke-width': 2.2, fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
  const sftPath = svg('path', { d: path(SFT), stroke: PAL.loss, 'stroke-width': 2.2, fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
  const rlDot = svg('circle', { cx: x(1.11), cy: y(91.8), r: 5, fill: PAL.train, opacity: 0 });
  const rlDotTag = svg('text', { x: x(1.11) + 12, y: y(91.8) + 24, fill: PAL.train, 'font-family': 'monospace', 'font-size': 11, opacity: 0 }, 'RL · 13 params');
  const rlTag = svg('text', { x: X1 + 10, y: y(93.4) - 12, 'text-anchor': 'end', fill: PAL.train, 'font-family': 'sans-serif', 'font-size': 12, opacity: 0 }, 'RL (GRPO) — selects');
  const sftTag = svg('text', { x: x(3.4), y: y(80.6) + 22, fill: PAL.loss, 'font-family': 'sans-serif', 'font-size': 12, opacity: 0 }, 'SFT — must absorb');
  const gap = svg('g', { opacity: 0 },
    svg('line', { x1: x(1.11), y1: y(91.8), x2: x(4.15), y2: y(91.8), stroke: PAL.mut, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', 'marker-start': 'url(#arrG)', 'marker-end': 'url(#arrG)' }),
    svg('text', { x: (x(1.11) + x(4.15)) / 2, y: y(91.8) - 8, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11 }, 'SFT needs a 100–1000× larger update to match'));
  const defs = svg('defs', {},
    svg('marker', { id: 'arrG', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const node = svgRoot(W, H, { role: 'img', 'aria-label': 'Two curves of accuracy versus update size on a log scale: the RL curve reaches about 91.8 percent at just 13 parameters, while the SFT curve stays near the base model until the update is 100 to 1000 times larger.' },
    defs, axis, sftPath, rlPath, rlDot, rlDotTag, rlTag, sftTag, gap);

  const update = (p) => {
    rlPath.setAttribute('stroke-dashoffset', 1 - seg(p, 0.14, 0.36, ease.inOut));
    sftPath.setAttribute('stroke-dashoffset', 1 - seg(p, 0.2, 0.44, ease.inOut));
    rlDot.setAttribute('opacity', seg(p, 0.3, 0.36));
    rlDotTag.setAttribute('opacity', seg(p, 0.32, 0.38));
    rlTag.setAttribute('opacity', seg(p, 0.36, 0.42));
    sftTag.setAttribute('opacity', seg(p, 0.4, 0.46));
    gap.setAttribute('opacity', seg(p, 0.46, 0.55));
  };
  return { node, update };
}

/* ---- chapter assembly ---------------------------------------------------- */

export function render({ id, num, title }) {
  const res = resultsFigure();
  const resFig = el('figure', { class: 'fig measure', style: { margin: '2.2rem auto' } },
    el('div', { class: 'fig-canvas' }, res.node),
    el('figcaption', {},
      el('span', { class: 'fig-n' }, 'Fig. 10.2 — '),
      el('span', { html: 'GSM8K, Qwen2.5-7B-Instruct, trained with GRPO on math problems. Thirteen parameters recover ~90% of the fine-tuning gains at ~1000× fewer trained parameters; even a single parameter buys about four points. Full fine-tuning bar illustrative.' })));
  track(resFig, res.update);

  const asym = asymmetryFigure();
  const asymFig = el('figure', { class: 'fig measure', style: { margin: '2.2rem auto' } },
    el('div', { class: 'fig-canvas' }, asym.node),
    el('figcaption', {},
      el('span', { class: 'fig-n' }, 'Fig. 10.3 — '),
      el('span', { html: 'the asymmetry: at equal tiny capacity, SFT fails where RL succeeds, needing 100–1000× larger updates to match. Curves illustrative, after the TinyLoRA paper.' })));
  track(asymFig, asym.update);

  return chapter(id,
    chapterHead(num, 'Adaptation', title),
    prose(
      `A pretrained-and-aligned model is a generalist. Making it excel at <em>your</em> task — your domain's vocabulary, your reasoning style, your output format — means continuing training on your data. The question that has defined the last five years of this field is embarrassingly simple: <strong>how much of the model do you actually have to touch?</strong> The answer has fallen ten orders of magnitude.`,
      `<strong>Full fine-tuning</strong> — update everything — is maximally expressive and brutally expensive. Recall chapter 07's arithmetic: gradients plus Adam state cost ~16 bytes per parameter, so even a modest 7B model wants ~112 GB before activations, and every task you tune becomes a complete multi-gigabyte copy of the model. At K3 scale it means re-provisioning the training cluster.`,
      `<strong>LoRA</strong> (2021) starts from an empirical observation: the change full fine-tuning makes to each weight matrix has low intrinsic rank — most of those trillions of deltas are redundant. So freeze W entirely and learn the update as a product of two thin matrices, ΔW = BA, through a tiny inner dimension r ≈ 8–64. The effective weight is W + BA; only B and A train — typically 0.1–1% of the model. Adapters are megabytes, hot-swappable per customer on one frozen base, and mergeable into W at deploy time for zero inference overhead. QLoRA quantizes the frozen base to 4 bits, putting 7B-scale tuning on one consumer GPU; it is the industry's default adaptation method.`),
    term('low-rank', 'adj.', 'a d×k matrix expressible as (d×r)(r×k) with r ≪ min(d,k); it has only r independent directions of action'),
    prose(
      `<strong>TinyLoRA</strong> (2026 — FAIR, Cornell, CMU; “Learning to Reason in 13 Parameters”) asks the reductio question: is even rank one necessary? Standard LoRA can't shrink below the model's width — B alone is d×1. TinyLoRA escapes that floor in three moves. First, work inside each frozen matrix's <strong>SVD subspace</strong> — its top singular directions, the axes along which it already acts — so updates need only r×r numbers between fixed factors (the LoRA-XS trick). Second, generate even those from a tiny trainable vector v pushed through a <strong>fixed random projection</strong> that is never trained. Third, <strong>weight tying</strong>: share one v across modules and layers (“tiled” across depth works best). The trainable count becomes whatever length you choose for v — down to one.`),

    createScene({
      id: 'adaptation-shrink',
      figure: shrinkFigure,
      steps: [
        { n: 'Full fine-tuning', html: `<p>The whole matrix trains — all ~7,000,000,000 parameters of a 7B model, glowing green. And training it means carrying ≈16 bytes per parameter of gradients and Adam state on top. Every tuned task is a complete multi-gigabyte copy.</p>` },
        { n: 'LoRA', html: `<p>W freezes to amber. The update moves into two thin green strips: ΔW = BA through a tiny rank r. Only ~10–50 million parameters train — a megabytes-sized adapter, hot-swappable on one frozen base.</p>` },
        { n: 'TinyLoRA', html: `<p>Even the strips collapse. The frozen SVD factors (amber) define the subspace; a fixed random projection P (gray — <em>never trained</em>) expands a tiny green vector v into the r×r update; one v is tied across every adapted layer.</p>` },
        { n: 'Thirteen numbers', html: `<p>The entire fine-tune is v: 13 numbers, 26 bytes, steering a model that fills a data center. Nine orders of magnitude between the first frame and this one.</p>` },
      ],
    }),
    prose(
      `<em>Fig. 10.1 — the same weight matrix, three philosophies. Nine orders of magnitude between the first column and the last.</em>`,
      `The headline result: trained with GRPO (chapter 08) on math problems, a 13-parameter TinyLoRA takes Qwen2.5-7B-Instruct from 76% to ~91.8% on GSM8K — near full-fine-tuning territory, with an update that fits in this sentence. Across harder benchmarks (MATH500, AIME, AMC) the method recovers ~90% of the fine-tuning gains while training ~1000× fewer parameters. Even a single trained parameter buys about four points.`),
    resFig,
    prose(
      `The deeper finding is the asymmetry between training regimes: at the same tiny capacity, <strong>SFT fails where RL succeeds</strong>, needing 100–1000× larger updates to match. The interpretation is the one this whole article has been building toward.`),
    asymFig,
    takeaway(
      `SFT must <em>absorb</em> the details of demonstrations — that takes room. RL with a verifiable reward only needs to <em>select</em>: amplify trajectories the model can already produce. Thirteen numbers cannot store the rules of algebra. They can only turn up circuits that pretraining already built. Reasoning fine-tuning, at least in this regime, is not teaching — it is <strong>activation</strong>.`),
    prose(
      `Honest caveats: the result lives where rewards are verifiable (math, code) — subjective domains may not compress this way; Qwen models respond to tiny budgets ~10× more readily than Llama for reasons nobody has pinned down; and the paper's own curiosities (fp32 beating bf16 bit-for-bit below 1 KB of update) mark this as an early map of a strange regime, not a finished theory. But the trendline is unambiguous — and it scales the right way: the bigger the base model, the fewer parameters adaptation seems to need. For a ${si(K3.totalParams)}-parameter ${K3.name}, “fine-tuning” may eventually mean a payload smaller than this paragraph.`),
    mathAside('LoRA to TinyLoRA in three equations', `
      <div class="eq">LoRA:     h = Wx + (α/r)·BAx        B ∈ ℝ^(d×r), A ∈ ℝ^(r×k), B init 0
LoRA-XS:  h = Wx + Uᵣ R Vᵣᵀ x        Uᵣ, Vᵣ = frozen top-r SVD factors of W; train R ∈ ℝ^(r×r)
TinyLoRA: h = Wx + Uᵣ mat(Pv) Vᵣᵀ x  P = fixed random projection; train v ∈ ℝⁿ</div>
      <p>B's zero-init makes ΔW = 0 at step zero — training starts from exactly the base model. In TinyLoRA, one v is shared across adapted modules (“tied”); random projections preserve enough geometry (Johnson–Lindenstrauss) for gradient signal to reach v. n is a free choice: the paper sweeps it from hundreds down to n = 1, and 13 is simply the smallest that held ~91% GSM8K on the 7–8B Qwen2.5 models.</p>`));
}
