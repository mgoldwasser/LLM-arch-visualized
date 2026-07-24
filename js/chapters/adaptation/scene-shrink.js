/* The shrink scene — one weight matrix under three philosophies: full
   fine-tuning, LoRA, TinyLoRA, ending on thirteen numbers.

   The scene's caption lives in the prose that follows it, so its figure
   number is reserved here with claimFig('shrink') — this function is called
   at the point in render() where the scene appears. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, claimFig, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease } from '../../core/anim.js';

function shrinkFigure(canvas) {
  const W = 720, H = 470;
  const MX = 60, MY = 80, MS = 210;   // the matrix W

  /* legend — the chapter's color grammar, stated once */
  const legend = svg('g', { 'font-family': 'sans-serif', 'font-size': 11 },
    svg('rect', { x: 470, y: 20, width: 11, height: 11, rx: 2, fill: PAL.train }),
    txt(487, 30, 'trainable', { fill: PAL.tx }),
    svg('rect', { x: 566, y: 20, width: 11, height: 11, rx: 2, fill: PAL.weight }),
    txt(583, 30, 'frozen', { fill: PAL.tx }));

  /* optimizer-state slabs stacked behind W (full fine-tuning only) */
  const slabs = [1, 2].map((i) => svg('g', { opacity: 0 },
    svg('rect', { x: MX + i * 16, y: MY - i * 16, width: MS, height: MS, rx: 8, fill: 'rgba(240,120,80,0.05)', stroke: PAL.loss, 'stroke-width': 1, 'stroke-dasharray': '4 4' })));
  const slabTag = txt(MX + MS + 26, MY - 16, 'gradients + Adam m, v  ·  ≈16 bytes / param', { size: 11, fill: PAL.loss, opacity: 0 });

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
  const wLetter = txt(MX + MS / 2, MY + MS / 2 + 2, 'W', { size: 26, fill: PAL.ink, anchor: 'middle', mono: true, opacity: 0 });
  const wFrozen = txt(MX + MS / 2, MY + MS / 2 + 26, 'frozen', { size: 11, fill: PAL.weight, anchor: 'middle', opacity: 0 });
  const wSvd = txt(MX + MS / 2, MY + MS / 2 + 44, '(SVD subspace)', { size: 10, fill: PAL.weight, anchor: 'middle', opacity: 0 });
  const wDim = txt(MX + MS / 2, MY + MS + 18, 'd × k', { size: 11, anchor: 'middle', mono: true, opacity: 0 });
  const gW = svg('g', {}, slabs, wGreen, wAmber, gridPath, wLetter, wFrozen, wSvd, wDim, slabTag);

  const plus = txt(296, MY + MS / 2 + 8, '+', { size: 22, anchor: 'middle', mono: true, opacity: 0 });

  /* LoRA: two thin trainable strips B (d×r) and A (r×k) */
  const gLora = svg('g', { opacity: 0 },
    svg('rect', { x: 322, y: MY, width: 24, height: MS, rx: 5, fill: 'rgba(125,216,127,0.22)', stroke: PAL.train, 'stroke-width': 1.4 }),
    txt(334, MY - 10, 'B', { size: 13, fill: PAL.train, anchor: 'middle', mono: true }),
    txt(334, MY + MS + 18, 'd×r', { size: 10, anchor: 'middle', mono: true }),
    svg('rect', { x: 364, y: MY, width: MS, height: 24, rx: 5, fill: 'rgba(125,216,127,0.22)', stroke: PAL.train, 'stroke-width': 1.4 }),
    txt(364 + MS / 2, MY - 10, 'A', { size: 13, fill: PAL.train, anchor: 'middle', mono: true }),
    txt(364 + MS + 26, MY + 17, 'r×k', { size: 10, anchor: 'middle', mono: true }),
    txt(364 + MS / 2, MY + 62, 'ΔW = BA · rank r ≈ 8–64', { size: 11, anchor: 'middle' }));

  /* TinyLoRA: frozen SVD factors + fixed random P + a 13-cell vector v */
  const VX = 640, VY = 66, VP = 14;
  const vCells = Array.from({ length: 13 }, (_, i) =>
    svg('rect', { x: VX, y: VY + i * VP, width: 13, height: 12, rx: 2, fill: PAL.train, opacity: 0 }));
  const vRing = svg('rect', { x: VX - 5, y: VY - 5, width: 23, height: 12 * VP + 20, rx: 5, fill: 'none', stroke: PAL.train, 'stroke-width': 1.6, opacity: 0 });
  const gTinyStatic = svg('g', {},
    svg('rect', { x: 322, y: MY, width: 20, height: MS, rx: 5, fill: 'rgba(224,168,76,0.16)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    txt(332, MY - 10, 'Uᵣ', { size: 12, fill: PAL.weight, anchor: 'middle', mono: true }),
    txt(332, MY + MS + 18, 'frozen SVD', { size: 9, anchor: 'middle' }),
    svg('rect', { x: 358, y: 168, width: 36, height: 36, rx: 5, fill: 'rgba(125,216,127,0.15)', stroke: PAL.train, 'stroke-width': 1.3 }),
    txt(376, 190, 'r×r', { size: 10, fill: PAL.train, anchor: 'middle', mono: true }),
    txt(376, 160, 'mat(Pv)', { size: 10, fill: PAL.train, anchor: 'middle', mono: true }),
    svg('rect', { x: 410, y: 176, width: 164, height: 20, rx: 5, fill: 'rgba(224,168,76,0.16)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    txt(492, 168, 'Vᵣᵀ', { size: 12, fill: PAL.weight, anchor: 'middle', mono: true }),
    svg('rect', { x: 428, y: 252, width: 64, height: 42, rx: 6, fill: 'rgba(107,118,131,0.14)', stroke: PAL.mut, 'stroke-width': 1.3 }),
    txt(460, 278, 'P', { size: 13, fill: PAL.tx, anchor: 'middle', mono: true }),
    txt(460, 310, 'fixed random ·', { size: 9, anchor: 'middle' }),
    txt(460, 322, 'never trained', { size: 9, anchor: 'middle' }),
    svg('path', { d: 'M 636 160 C 590 220, 540 258, 498 268', stroke: PAL.mut, 'stroke-width': 1.2, fill: 'none', 'stroke-dasharray': '4 4', 'marker-end': 'url(#ad-arrT)' }),
    svg('path', { d: 'M 428 262 C 400 244, 386 226, 378 210', stroke: PAL.mut, 'stroke-width': 1.2, fill: 'none', 'stroke-dasharray': '4 4', 'marker-end': 'url(#ad-arrT)' }));
  const vLabel = txt(646, 52, 'v', { size: 13, fill: PAL.train, anchor: 'middle', mono: true, opacity: 0 });
  const vSub = txt(684, VY + 13 * VP + 22, '13 numbers · tied across all layers', { size: 10, fill: PAL.train, anchor: 'end', opacity: 0 });
  const gTiny = svg('g', { opacity: 0 }, gTinyStatic, vCells, vRing, vLabel, vSub);

  /* stat band at the bottom, crossfading per philosophy */
  const stat = (v, sub, col) => svg('g', { opacity: 0 },
    txt(W / 2, 408, v, { size: 21, fill: col, anchor: 'middle', mono: true }),
    txt(W / 2, 432, sub, { size: 12, anchor: 'middle' }));
  const s0 = stat('trainable: ~7,000,000,000', 'per-task copy: gigabytes — plus ≈16 B/param of optimizer state while training', PAL.train);
  const s1 = stat('trainable: ~10–50 million', 'per-task adapter: megabytes — W frozen, hot-swappable, mergeable at deploy', PAL.train);
  const s2 = stat('trainable: just v', 'P fixed random, never trained · one v shared — “tiled” — across all layers', PAL.train);
  const punch = svg('g', { opacity: 0 },
    txt(W / 2, 412, '13 numbers · 26 bytes', { size: 27, fill: PAL.train, anchor: 'middle', mono: true }),
    txt(W / 2, 438, 'nine orders of magnitude below full fine-tuning — an update that fits in a sentence', { size: 12, anchor: 'middle' }));

  const defs = svg('defs', {},
    svg('marker', { id: 'ad-arrT', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
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

export function shrinkScene() {
  claimFig('shrink');
  return createScene({
    id: 'adaptation-shrink',
    figure: shrinkFigure,
    steps: [
      { n: 'Full fine-tuning', html: `<p>The whole matrix trains — all ~7,000,000,000 parameters of a 7B model, glowing green. And training it means carrying ≈16 bytes per parameter of gradients and Adam state on top. Every tuned task is a complete multi-gigabyte copy.</p>` },
      { n: 'LoRA', html: `<p>W freezes to amber. The update moves into two thin green strips: ΔW = BA through a tiny rank r. Only ~10–50 million parameters train — a megabytes-sized adapter, hot-swappable on one frozen base.</p>` },
      { n: 'TinyLoRA', html: `<p>Even the strips collapse. The frozen SVD factors (amber) define the subspace; a fixed random projection P (gray — <em>never trained</em>) expands a tiny green vector v into the r×r update; one v is tied across every adapted layer.</p>` },
      { n: 'Thirteen numbers', html: `<p>The entire fine-tune is v: 13 numbers, 26 bytes, steering a model that fills a data center. Nine orders of magnitude between the first frame and this one.</p>` },
    ],
  });
}
