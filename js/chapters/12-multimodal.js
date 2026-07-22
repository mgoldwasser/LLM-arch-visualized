/* Chapter 11 — beyond text. How images, audio, and video enter a machine
   we have so far fed nothing but token IDs. The punchline: they enter the
   same way text does — as a sequence of d_model vectors — because the
   residual stream never asked where its vectors came from.
   Sticky scene: the ViT patch pipeline, pixels → soft tokens. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, figure, widget, takeaway, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { track } from '../core/scroll.js';
import { seg, lerp, ease, rng, si, pct } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

/* ---- a tiny SVG "photograph" — a cat under the moon, reused everywhere ---- */
/* Authored in a 100×100 box; scale to any display size. `phase` nudges the
   moon so video frames differ. */
function photoArt(s, phase = 0) {
  const k = s / 100;
  return svg('g', { transform: `scale(${k})` },
    svg('rect', { width: 100, height: 100, fill: '#1D2A38' }),
    svg('circle', { cx: 72 + phase * 4, cy: 22, r: 11, fill: '#E6DCC3', opacity: 0.92 }),
    svg('circle', { cx: 30, cy: 14, r: 1.1, fill: '#E6DCC3', opacity: 0.7 }),
    svg('circle', { cx: 48, cy: 26, r: 0.9, fill: '#E6DCC3', opacity: 0.55 }),
    svg('circle', { cx: 14, cy: 34, r: 0.9, fill: '#E6DCC3', opacity: 0.5 }),
    svg('rect', { y: 74, width: 100, height: 26, fill: '#20301F' }),
    // the cat: body, head, ears, tail
    svg('path', { d: 'M 32 78 C 30 62 36 54 44 52 L 41 41 L 48 47 C 51 45.5 55 45.5 58 47 L 65 41 L 62 52 C 70 54 76 63 74 78 Z', fill: '#0B0E12' }),
    svg('path', { d: 'M 74 76 C 86 72 90 62 85 55', stroke: '#0B0E12', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }),
    svg('circle', { cx: 48, cy: 53, r: 1.5, fill: '#E6DCC3' }),
    svg('circle', { cx: 58, cy: 53, r: 1.5, fill: '#E6DCC3' }));
}

/* ---- Fig 11.1: three modalities converge on one row of vector slots ------- */

function convergeFigure() {
  const W = 720, H = 350;

  const colLabel = (x, txt) => svg('text', { x, y: 34, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, txt);

  // text stream
  const words = [['a', 26], ['cat', 42], ['at', 30], ['night', 56]];
  let wx = 42;
  const chips = words.map(([w, cw]) => {
    const g = svg('g', { transform: `translate(${wx}, 48)`, opacity: 0 },
      svg('rect', { width: cw, height: 28, rx: 6, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
      svg('text', { x: cw / 2, y: 19, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 12.5 }, w));
    wx += cw + 7;
    return g;
  });

  // image stream
  const thumb = svg('g', { transform: 'translate(322, 44)', opacity: 0 },
    photoArt(78),
    svg('rect', { width: 78, height: 78, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, rx: 0.5 }));

  // audio stream
  const r = rng(11);
  let d = 'M 520 82';
  for (let i = 1; i <= 34; i++) {
    const x = 520 + i * 5;
    const a = (i % 2 ? -1 : 1) * (4 + r() * 22) * Math.sin((i / 34) * Math.PI);
    d += ` L ${x} ${(82 + a).toFixed(1)}`;
  }
  const wave = svg('path', { d, stroke: PAL.tx, 'stroke-width': 1.4, fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });

  // converging arrows, each tagged with its encoder
  const mkArrow = (x1, y1, x2, y2) => svg('path', {
    d: `M ${x1} ${y1} C ${x1} ${y1 + 46}, ${x2} ${y2 - 46}, ${x2} ${y2}`,
    stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch11-arr1)', opacity: 0,
  });
  const arrT = mkArrow(120, 84, 210, 202);
  const arrI = mkArrow(361, 130, 361, 202);
  const arrA = mkArrow(605, 112, 512, 202);
  const tagT = svg('text', { x: 122, y: 150, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 }, 'tokenizer + embedding rows (ch. 02)');
  const tagI = svg('text', { x: 374, y: 168, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 }, 'patch encoder');
  const tagA = svg('text', { x: 530, y: 150, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 }, 'audio encoder');

  // the one row of identical vector slots
  const SLOTS = 12, SW = 44, SG = 5;
  const sx0 = (W - (SLOTS * (SW + SG) - SG)) / 2;
  const slots = Array.from({ length: SLOTS }, (_, i) => svg('rect', {
    x: sx0 + i * (SW + SG), y: 210, width: SW, height: 26, rx: 5,
    fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.1, opacity: 0,
  }));
  const slotLabel = svg('text', { x: W / 2, y: 262, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    'a sequence of d_model vectors — the residual stream never asks where a vector came from');

  const arrS = svg('path', { d: 'M 360 272 L 360 292', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch11-arr1)', opacity: 0 });
  const stack = svg('g', { opacity: 0 },
    svg('rect', { x: 288, y: 298, width: 144, height: 36, rx: 9, fill: 'rgba(90,200,220,0.06)', stroke: PAL.act, 'stroke-width': 1.3 }),
    svg('text', { x: 360, y: 321, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11.5 }, 'the stack of layers'));

  const defs = svg('defs', {},
    svg('marker', { id: 'ch11-arr1', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Three input streams — text token chips, a small photograph, and an audio waveform — each pass through their own encoder and converge onto a single row of identical vector slots that feed the stack of layers.',
  }, defs, colLabel(42, 'text'), colLabel(322, 'image'), colLabel(520, 'audio (waveform)'),
    chips, thumb, wave, arrT, arrI, arrA, tagT, tagI, tagA, slots, slotLabel, arrS, stack);

  const node = figure('11.1',
    'the punchline of the chapter, stated first: a transformer layer consumes vectors, not text. Anything that can be turned into a sequence of d_model vectors can enter the stack.',
    root);

  track(node, (p) => {
    chips.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.08 + i * 0.02, 0.16 + i * 0.02)));
    thumb.setAttribute('opacity', seg(p, 0.12, 0.2));
    wave.setAttribute('stroke-dashoffset', 1 - seg(p, 0.14, 0.3, ease.inOut));
    [[arrT, tagT], [arrI, tagI], [arrA, tagA]].forEach(([a, t], i) => {
      const o = seg(p, 0.26 + i * 0.03, 0.36 + i * 0.03);
      a.setAttribute('opacity', o); t.setAttribute('opacity', o);
    });
    slots.forEach((s, i) => s.setAttribute('opacity', seg(p, 0.36 + i * 0.012, 0.46 + i * 0.012)));
    slotLabel.setAttribute('opacity', seg(p, 0.48, 0.56));
    arrS.setAttribute('opacity', seg(p, 0.54, 0.6));
    stack.setAttribute('opacity', seg(p, 0.56, 0.64));
  });
  return node;
}

/* ---- Fig 11.2 (scene): the ViT patch pipeline, pixels → soft tokens ------- */

function vitFigure(canvas) {
  const W = 720, H = 470;
  const PX = 36, PY = 40, PS = 168, NG = 6, CELL = PS / NG;

  /* step 0 — the photo + patch grid */
  const photo = svg('g', { transform: `translate(${PX}, ${PY})`, opacity: 0 }, photoArt(PS));
  let gd = '';
  for (let i = 1; i < NG; i++) {
    gd += `M ${PX + i * CELL} ${PY} V ${PY + PS} M ${PX} ${PY + i * CELL} H ${PX + PS} `;
  }
  const grid = svg('path', { d: gd, stroke: 'rgba(237,242,247,0.5)', 'stroke-width': 1, fill: 'none', opacity: 0 });
  const frame = svg('rect', { x: PX, y: PY, width: PS, height: PS, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, opacity: 0 });
  const photoLabel = svg('text', { x: PX, y: PY + PS + 20, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    '224 × 224 px → 14 × 14 = 196 patches (grid drawn coarser)');

  /* step 1 — one patch exploded, flattened, projected */
  const HR = 2, HC = 2; // the highlighted cell (on the cat)
  const hx = PX + HC * CELL, hy = PY + HR * CELL;
  const hl = svg('rect', { x: hx, y: hy, width: CELL, height: CELL, fill: 'none', stroke: PAL.weight, 'stroke-width': 1.8, opacity: 0 });

  const EX = 252, EY = 44, EPS = 60;
  const rp = rng(7);
  const pxCols = ['#1D2A38', '#0B0E12', '#16202C', '#101820', '#0B0E12', '#1D2A38'];
  const miniPx = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    miniPx.push(svg('rect', { x: EX + j * 15, y: EY + i * 15, width: 15, height: 15, fill: pxCols[Math.floor(rp() * pxCols.length)] }));
  }
  const explode = svg('g', { opacity: 0 },
    miniPx,
    svg('rect', { x: EX, y: EY, width: EPS, height: EPS, fill: 'none', stroke: PAL.weight, 'stroke-width': 1.4 }));
  const conn1 = svg('line', { x1: hx + CELL, y1: hy, x2: EX, y2: EY, stroke: PAL.weight, 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0 });
  const conn2 = svg('line', { x1: hx + CELL, y1: hy + CELL, x2: EX, y2: EY + EPS, stroke: PAL.weight, 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0 });

  const FX = 356, FY = 62;
  const flatLabel = svg('text', { x: FX, y: 50, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'flatten: 16 · 16 · 3 = 768 raw numbers');
  const stripCells = Array.from({ length: 13 }, (_, i) => svg('rect', {
    x: FX + i * 16, y: FY, width: 13, height: 18, rx: 2,
    fill: pxCols[Math.floor(rp() * pxCols.length)], stroke: 'rgba(237,242,247,0.25)', 'stroke-width': 0.6, opacity: 0,
  }));
  const stripMore = svg('text', { x: FX + 13 * 16 + 4, y: FY + 14, fill: PAL.mut, 'font-family': 'monospace', 'font-size': 12, opacity: 0 }, '…');
  const arrEx = svg('path', { d: `M ${EX + EPS + 6} ${EY + EPS / 2} L ${FX - 10} ${FY + 9}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch11-arr2)', opacity: 0 });

  const WPX = 370, WPY = 108;
  const wpatch = svg('g', { opacity: 0 },
    svg('rect', { x: WPX, y: WPY, width: 214, height: 32, rx: 7, fill: 'rgba(224,168,76,0.10)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    svg('text', { x: WPX + 107, y: WPY + 21, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 12 }, 'W_patch ∈ ℝ^(768 × d_model)'));
  const arrW1 = svg('path', { d: `M ${WPX + 107} ${FY + 22} L ${WPX + 107} ${WPY - 4}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch11-arr2)', opacity: 0 });
  const arrW2 = svg('path', { d: `M ${WPX + 107} ${WPY + 34} L ${WPX + 107} ${WPY + 52}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch11-arr2)', opacity: 0 });
  const pvec = svg('g', { opacity: 0 },
    svg('rect', { x: WPX + 27, y: WPY + 56, width: 160, height: 24, rx: 6, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.2 }),
    svg('text', { x: WPX + 107, y: WPY + 72, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11 }, 'one patch embedding'));
  const computedNote = svg('text', { x: WPX + 107, y: WPY + 98, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5, 'font-style': 'italic', opacity: 0 },
    'computed by a matrix multiply — not looked up in a table');

  /* step 2 — patch vectors + positions → vision encoder */
  const SY = 248, SN = 6;
  const slotRow = Array.from({ length: SN }, (_, i) => svg('g', { transform: `translate(${36 + i * 42}, ${SY})`, opacity: 0 },
    svg('rect', { width: 36, height: 24, rx: 5, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.1 })));
  const slotMore = svg('text', { x: 36 + SN * 42 + 2, y: SY + 17, fill: PAL.mut, 'font-family': 'monospace', 'font-size': 13, opacity: 0 }, '…');
  const posLabel = svg('text', { x: 36, y: SY + 42, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    '+ 2-D position: patch (row, col)');

  const VEX = 358, VEY = 230, VEW = 326, VEH = 96;
  const encBox = svg('g', { opacity: 0 },
    svg('rect', { x: VEX, y: VEY, width: VEW, height: VEH, rx: 11, fill: 'rgba(180,140,224,0.06)', stroke: PAL.attn, 'stroke-width': 1.4 }),
    svg('text', { x: VEX + VEW / 2, y: VEY + 22, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'sans-serif', 'font-size': 12.5 }, 'vision transformer encoder'),
    svg('text', { x: VEX + VEW / 2, y: VEY + 39, 'text-anchor': 'middle', fill: PAL.attn, 'font-family': 'sans-serif', 'font-size': 10.5 }, 'self-attention over all patches — no causal mask'));
  const dotXs = Array.from({ length: 6 }, (_, i) => VEX + 46 + i * 47);
  const dotY = VEY + 72;
  const pairLines = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const mid = (dotXs[i] + dotXs[j]) / 2, bow = (j - i) * 5;
    pairLines.push(svg('path', {
      d: `M ${dotXs[i]} ${dotY} Q ${mid} ${dotY - bow - 6} ${dotXs[j]} ${dotY}`,
      stroke: PAL.attn, 'stroke-width': 1, fill: 'none', opacity: 0,
    }));
  }
  const encDots = dotXs.map((x) => svg('circle', { cx: x, cy: dotY, r: 3.5, fill: PAL.attn, opacity: 0 }));
  const arrEnc = svg('path', { d: `M ${36 + SN * 42 + 18} ${SY + 12} L ${VEX - 6} ${SY + 12}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch11-arr2)', opacity: 0 });

  /* step 3 — projector, soft tokens into the residual stream */
  const PJX = 420, PJY = 344;
  const proj = svg('g', { opacity: 0 },
    svg('rect', { x: PJX, y: PJY, width: 202, height: 30, rx: 7, fill: 'rgba(224,168,76,0.10)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    svg('text', { x: PJX + 101, y: PJY + 20, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 11 }, 'projector MLP → LLM d_model'));
  const arrPj = svg('path', { d: `M ${VEX + VEW / 2} ${VEY + VEH + 4} L ${PJX + 101} ${PJY - 4}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch11-arr2)', opacity: 0 });

  const ROWY = 408;
  const textChip = (x, w, t) => svg('g', { transform: `translate(${x}, ${ROWY})`, opacity: 0 },
    svg('rect', { width: w, height: 30, rx: 6, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
    svg('text', { x: w / 2, y: 20, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 12 }, t));
  const tc = [textChip(36, 56, 'What'), textChip(98, 32, 'is'), textChip(136, 32, 'in')];
  const qChip = textChip(408, 26, '?');
  const softXs = Array.from({ length: 6 }, (_, i) => 174 + i * 39);
  const softChips = softXs.map((x) => svg('g', { opacity: 0 },
    svg('rect', { width: 33, height: 30, rx: 6, fill: 'rgba(90,200,220,0.18)', stroke: PAL.act, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }),
    svg('rect', { x: 8, y: 9, width: 17, height: 12, rx: 2, fill: 'none', stroke: PAL.act, 'stroke-width': 1 }),
    svg('circle', { cx: 13, cy: 13, r: 1.6, fill: PAL.act })));
  const softLabel = svg('text', { x: 174 + 3 * 39, y: ROWY + 50, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    '“soft tokens” — vectors with no vocabulary entry');
  const arrStack = svg('path', { d: `M 448 ${ROWY + 15} L 502 ${ROWY + 15}`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch11-arr2)', opacity: 0 });
  const stackTag = svg('text', { x: 512, y: ROWY + 20, fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 }, 'into the stack (ch. 03)');

  const defs = svg('defs', {},
    svg('marker', { id: 'ch11-arr2', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The vision transformer pipeline: a photograph is sliced into a grid of patches; one patch is flattened into 768 raw numbers and multiplied by a learned projection to become a patch embedding; all patch vectors plus their 2-D positions enter a vision transformer encoder with bidirectional self-attention; a projector MLP maps the output into the language model dimension and the resulting soft tokens slide into the residual stream between text tokens.',
  }, defs, photo, grid, frame, photoLabel, hl, conn1, conn2, explode, arrEx, flatLabel, stripCells, stripMore,
    arrW1, wpatch, arrW2, pvec, computedNote, slotRow, slotMore, posLabel, arrEnc, encBox, pairLines, encDots,
    arrPj, proj, tc, softChips, qChip, softLabel, arrStack, stackTag));

  return (p) => {
    /* step 0 — patchify */
    const tP = seg(p, 0.002, 0.045, ease.out);
    photo.setAttribute('opacity', tP);
    frame.setAttribute('opacity', tP);
    grid.setAttribute('opacity', seg(p, 0.06, 0.16));
    photoLabel.setAttribute('opacity', seg(p, 0.09, 0.16));

    /* step 1 — flatten + project */
    hl.setAttribute('opacity', seg(p, 0.27, 0.31));
    const tEx = seg(p, 0.29, 0.34);
    explode.setAttribute('opacity', tEx);
    conn1.setAttribute('opacity', tEx * 0.9);
    conn2.setAttribute('opacity', tEx * 0.9);
    arrEx.setAttribute('opacity', seg(p, 0.33, 0.37));
    flatLabel.setAttribute('opacity', seg(p, 0.34, 0.38));
    stripCells.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.34 + i * 0.004, 0.38 + i * 0.004)));
    stripMore.setAttribute('opacity', seg(p, 0.38, 0.41));
    arrW1.setAttribute('opacity', seg(p, 0.39, 0.42));
    wpatch.setAttribute('opacity', seg(p, 0.4, 0.44));
    arrW2.setAttribute('opacity', seg(p, 0.43, 0.46));
    pvec.setAttribute('opacity', seg(p, 0.44, 0.48));
    computedNote.setAttribute('opacity', seg(p, 0.46, 0.5));

    /* step 2 — all patches + positions → encoder */
    slotRow.forEach((s, i) => s.setAttribute('opacity', seg(p, 0.52 + i * 0.01, 0.57 + i * 0.01)));
    slotMore.setAttribute('opacity', seg(p, 0.58, 0.61));
    posLabel.setAttribute('opacity', seg(p, 0.56, 0.6));
    arrEnc.setAttribute('opacity', seg(p, 0.59, 0.62));
    encBox.setAttribute('opacity', seg(p, 0.6, 0.65));
    encDots.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.63 + i * 0.005, 0.67 + i * 0.005)));
    pairLines.forEach((l, i) => l.setAttribute('opacity', 0.5 * seg(p, 0.65 + i * 0.004, 0.7 + i * 0.004)));

    /* step 3 — projector → soft tokens into the stream */
    arrPj.setAttribute('opacity', seg(p, 0.77, 0.8));
    proj.setAttribute('opacity', seg(p, 0.78, 0.82));
    tc.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.8 + i * 0.01, 0.84 + i * 0.01)));
    qChip.setAttribute('opacity', seg(p, 0.88, 0.91));
    softChips.forEach((c, i) => {
      const t = seg(p, 0.83 + i * 0.015, 0.89 + i * 0.015, ease.out);
      c.setAttribute('opacity', t);
      c.setAttribute('transform', `translate(${lerp(PJX + 85, softXs[i], t)}, ${lerp(PJY - 10, ROWY, t)})`);
    });
    softLabel.setAttribute('opacity', seg(p, 0.9, 0.94));
    arrStack.setAttribute('opacity', seg(p, 0.93, 0.96));
    stackTag.setAttribute('opacity', seg(p, 0.94, 0.97));
  };
}

/* ---- Fig 11.3 (widget): patchify — the quadratic token bill --------------- */

const PATCH_SIZES = [8, 14, 16, 32];
const RESOLUTIONS = [256, 512, 1024];
const PAGE_TOKENS = 500;          // ~a paperback page of English, tokenized
const WORDS_PER_TOKEN = 0.75;

function patchifyBody() {
  const state = { pi: 2, ri: 1 };  // patch 16 · resolution 512
  const S = 300;

  const gridPath = svg('path', { d: '', stroke: 'rgba(237,242,247,0.55)', 'stroke-width': 0.6, fill: 'none' });
  const art = photoArt(S);
  const svgNode = svgRoot(S, S, {
    role: 'img', 'aria-label': 'The photograph with a live patch-grid overlay; the grid density updates as the patch size and resolution sliders move.',
    style: { display: 'block', width: '100%', height: 'auto', maxWidth: '320px', borderRadius: '8px' },
  }, art, gridPath, svg('rect', { width: S, height: S, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 }));

  const patchVal = el('span', { class: 'sl-v' }, '');
  const resVal = el('span', { class: 'sl-v' }, '');
  const patchSlider = el('input', {
    type: 'range', min: 0, max: PATCH_SIZES.length - 1, step: 1, value: state.pi,
    'aria-label': 'patch size in pixels',
    oninput: () => { state.pi = +patchSlider.value; update(); },
  });
  const resSlider = el('input', {
    type: 'range', min: 0, max: RESOLUTIONS.length - 1, step: 1, value: state.ri,
    'aria-label': 'image resolution in pixels',
    oninput: () => { state.ri = +resSlider.value; update(); },
  });
  const sliders = el('div', {},
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'patch size (px)'), patchSlider, patchVal),
    el('label', { class: 'slider-row' }, el('span', { class: 'sl-k' }, 'image resolution (px)'), resSlider, resVal));

  const formula = el('div', {
    style: { fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--fig-act)', margin: '0.5rem 0 0.8rem' },
  }, '');

  const cell = (label, hi = false) => {
    const v = el('div', { class: `sg-v${hi ? ' hi' : ''}` }, '—');
    return { root: el('div', { class: 'sg-cell' }, v, el('div', { class: 'sg-k' }, label)), v };
  };
  const cTokens = cell('image tokens', true);
  const cWords = cell('≈ English words of context');
  const cPages = cell('≈ pages of prose');
  const cBudget = cell(`share of K3's ${si(K3.contextWindow)} window`);
  const stats = el('div', { class: 'stat-grid' }, cTokens.root, cWords.root, cPages.root, cBudget.root);

  const note = el('div', { style: { fontSize: '0.76rem', color: 'var(--fig-mut)', marginTop: '0.6rem' } },
    'Halve the patch size and the bill quadruples; double the resolution and it quadruples again. This is why pipelines tile large images, downsample, or pool patch tokens before the LLM ever sees them.');

  function update() {
    const patch = PATCH_SIZES[state.pi], res = RESOLUTIONS[state.ri];
    const n = Math.floor(res / patch);
    const tokens = n * n;
    patchVal.textContent = `${patch} px`;
    resVal.textContent = `${res} px`;

    // grid overlay — n×n cells over the S×S display
    const c = S / n;
    let d = '';
    for (let i = 1; i < n; i++) d += `M ${(i * c).toFixed(2)} 0 V ${S} M 0 ${(i * c).toFixed(2)} H ${S} `;
    gridPath.setAttribute('d', d);
    gridPath.setAttribute('stroke-width', n > 40 ? 0.4 : 0.7);

    formula.textContent = `tokens = (${res} / ${patch})² = ${n}² = ${tokens.toLocaleString('en-US')}`;
    cTokens.v.textContent = tokens.toLocaleString('en-US');
    cWords.v.textContent = Math.round(tokens * WORDS_PER_TOKEN).toLocaleString('en-US');
    cPages.v.textContent = (tokens / PAGE_TOKENS).toFixed(tokens / PAGE_TOKENS < 10 ? 1 : 0);
    cBudget.v.textContent = pct(tokens / K3.contextWindow, tokens / K3.contextWindow < 0.01 ? 2 : 1);
  }
  update();

  return el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '1.4rem', alignItems: 'flex-start' } },
    el('div', { style: { flex: '0 1 320px', minWidth: '220px' } }, svgNode),
    el('div', { style: { flex: '1 1 300px', minWidth: '260px' } }, sliders, formula, stats, note));
}

/* ---- Fig 11.4: the three-stage training recipe (frozen vs training) ------- */

function stagesFigure() {
  const W = 720, H = 330;
  const block = (x, y, w, h, label, train, sub) => svg('g', {},
    svg('rect', {
      x, y, width: w, height: h, rx: 7,
      fill: train ? 'rgba(125,216,127,0.16)' : 'rgba(224,168,76,0.10)',
      stroke: train ? PAL.train : PAL.weight, 'stroke-width': 1.3,
    }),
    svg('text', { x: x + w / 2, y: y + h / 2 + (sub ? -2 : 4), 'text-anchor': 'middle', fill: train ? PAL.train : PAL.weight, 'font-family': 'sans-serif', 'font-size': 11 }, label),
    sub ? svg('text', { x: x + w / 2, y: y + h / 2 + 13, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 9.5 }, sub) : null);

  const title = (x, l1, l2) => svg('g', { 'font-family': 'sans-serif' },
    svg('text', { x, y: 62, fill: PAL.ink, 'font-size': 11, 'font-weight': 600, 'letter-spacing': '0.06em' }, l1),
    svg('text', { x, y: 78, fill: PAL.mut, 'font-size': 10.5 }, l2));

  const legend = svg('g', { 'font-family': 'sans-serif', 'font-size': 11 },
    svg('rect', { x: 452, y: 18, width: 11, height: 11, rx: 2, fill: PAL.train }),
    svg('text', { x: 469, y: 28, fill: PAL.tx }, 'training'),
    svg('rect', { x: 548, y: 18, width: 11, height: 11, rx: 2, fill: PAL.weight }),
    svg('text', { x: 565, y: 28, fill: PAL.tx }, 'frozen'));

  // stage 1 — CLIP: two towers, contrastive pull
  const p1x = 24;
  const stage1 = svg('g', { opacity: 0 },
    title(p1x, 'STAGE 1 — CONTRASTIVE', 'CLIP-style pretraining'),
    block(p1x + 6, 96, 88, 96, 'image', true, 'tower'),
    block(p1x + 116, 96, 88, 96, 'text', true, 'tower'),
    svg('path', { d: `M ${p1x + 98} 144 L ${p1x + 112} 144`, stroke: PAL.loss, 'stroke-width': 1.6, 'marker-start': 'url(#ch11-arrL)', 'marker-end': 'url(#ch11-arrL)' }),
    svg('text', { x: p1x + 105, y: 216, 'text-anchor': 'middle', fill: PAL.loss, 'font-family': 'sans-serif', 'font-size': 10.5 }, 'InfoNCE: pull matched pairs together'),
    svg('text', { x: p1x + 105, y: 232, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'hundreds of millions of image–caption pairs'),
    svg('text', { x: p1x + 105, y: 262, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5 }, 'the encoder organizes its space'),
    svg('text', { x: p1x + 105, y: 276, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5 }, 'before ever meeting the LLM'));

  // stages 2 & 3 — the VLM sandwich
  const sandwich = (x, encTrain, projTrain, llmTrain) => [
    block(x + 22, 96, 164, 40, 'vision encoder', encTrain),
    block(x + 52, 146, 104, 26, 'projector', projTrain),
    block(x + 22, 182, 164, 56, 'LLM', llmTrain),
  ];
  const p2x = 256;
  const stage2 = svg('g', { opacity: 0 },
    title(p2x, 'STAGE 2 — ALIGN', 'train only the projector'),
    sandwich(p2x, false, true, false),
    svg('text', { x: p2x + 104, y: 262, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5 }, 'caption data teaches the adapter'),
    svg('text', { x: p2x + 104, y: 276, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5 }, 'to speak the LLM’s dialect'));
  const p3x = 488;
  const stage3 = svg('g', { opacity: 0 },
    title(p3x, 'STAGE 3 — JOINT', 'multimodal instruction tuning'),
    sandwich(p3x, true, true, true),
    svg('text', { x: p3x + 104, y: 262, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5 }, 'unfreeze (much or all) and tune'),
    svg('text', { x: p3x + 104, y: 276, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5 }, 'on image + text conversations'));

  const defs = svg('defs', {},
    svg('marker', { id: 'ch11-arrL', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.loss })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Three training stages: stage one, contrastive CLIP pretraining with both an image tower and a text tower training; stage two, only a small projector trains between a frozen vision encoder and a frozen LLM; stage three, all blocks train jointly on multimodal instruction data. Green blocks are training, amber blocks are frozen.',
  }, defs, legend, stage1, stage2, stage3);

  const node = figure('11.4',
    `the standard recipe (CLIP 2021 → LLaVA 2023): contrastive pretraining builds a semantically organized vision encoder; a cheap alignment stage trains only the projector; joint instruction tuning finishes the job. Amber = frozen, green = training — the same color grammar as chapter 10.`,
    root);

  track(node, (p) => {
    [stage1, stage2, stage3].forEach((s, i) => {
      const t = seg(p, 0.12 + i * 0.14, 0.26 + i * 0.14, ease.out);
      s.setAttribute('opacity', t);
      s.setAttribute('transform', `translate(0, ${lerp(14, 0, t)})`);
    });
  });
  return node;
}

/* ---- Fig 11.5: the discrete alternative — a learned codebook -------------- */

function codebookFigure() {
  const W = 720, H = 320;
  const rInt = rng(23);

  const photo = svg('g', { transform: 'translate(30, 64)', opacity: 0 },
    photoArt(84),
    svg('rect', { width: 84, height: 84, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 }));
  const arr1 = svg('path', { d: 'M 120 106 L 148 106', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch11-arr5)', opacity: 0 });
  const enc = svg('g', { opacity: 0 },
    svg('rect', { x: 152, y: 86, width: 96, height: 40, rx: 8, fill: 'rgba(224,168,76,0.10)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    svg('text', { x: 200, y: 106, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 11 }, 'conv encoder'),
    svg('text', { x: 200, y: 119, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 9.5 }, '+ nearest code'));
  const arr2 = svg('path', { d: 'M 252 106 L 280 106', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch11-arr5)', opacity: 0 });

  // 4×4 grid of code indices
  const IX = 288, IY = 48, CW2 = 44, CH2 = 28, GAP = 5;
  const codes = Array.from({ length: 16 }, () => Math.floor(rInt() * 8192));
  const idxCells = codes.map((c, i) => {
    const x = IX + (i % 4) * (CW2 + GAP), y = IY + Math.floor(i / 4) * (CH2 + GAP);
    return svg('g', { transform: `translate(${x}, ${y})`, opacity: 0 },
      svg('rect', { width: CW2, height: CH2, rx: 4, fill: 'rgba(224,168,76,0.12)', stroke: PAL.weight, 'stroke-width': 1 }),
      svg('text', { x: CW2 / 2, y: 18, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 11 }, c));
  });
  const idxLabel = svg('text', { x: IX, y: 38, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'grid of codebook indices');
  const idxSub = svg('text', { x: IX, y: IY + 4 * (CH2 + GAP) + 14, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 },
    '(32×32 in practice — drawn 4×4)');

  // the codebook — chapter 02's E, mirrored
  const CBX = 540, CBY = 40, CBW = 84, CBH = 216;
  const cbLines = Array.from({ length: 12 }, (_, i) => svg('line', {
    x1: CBX + 1, y1: CBY + (i + 1) * (CBH / 13), x2: CBX + CBW - 1, y2: CBY + (i + 1) * (CBH / 13),
    stroke: PAL.weight, opacity: 0.12,
  }));
  const codebook = svg('g', { opacity: 0 },
    svg('rect', { x: CBX, y: CBY, width: CBW, height: CBH, rx: 4, fill: 'rgba(224,168,76,0.07)', stroke: PAL.weight, 'stroke-width': 1.4 }),
    cbLines,
    svg('text', { x: CBX + CBW, y: 28, 'text-anchor': 'end', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 11.5 }, 'codebook ∈ ℝ^(8192 × d)'),
    svg('text', { x: CBX + CBW / 2, y: CBY + CBH + 16, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'one row per code'));
  const hlRow = svg('rect', { x: CBX + 2, y: CBY + 96, width: CBW - 4, height: 9, rx: 2, fill: PAL.weight, opacity: 0 });
  const hlIdx = svg('rect', { x: IX + 2 * (CW2 + GAP) - 2, y: IY + (CH2 + GAP) - 2, width: CW2 + 4, height: CH2 + 4, rx: 5, fill: 'none', stroke: PAL.act, 'stroke-width': 1.6, opacity: 0 });
  const lookLine = svg('path', {
    d: `M ${IX + 2 * (CW2 + GAP) + CW2 + 4} ${IY + (CH2 + GAP) + CH2 / 2} C 500 ${IY + 40}, 510 ${CBY + 100}, ${CBX - 4} ${CBY + 100}`,
    stroke: PAL.act, 'stroke-width': 1.2, fill: 'none', 'stroke-dasharray': '4 4', opacity: 0, 'marker-end': 'url(#ch11-arr5a)',
  });
  const outVec = svg('g', { opacity: 0 },
    svg('rect', { x: CBX + CBW + 12, y: CBY + 88, width: 60, height: 24, rx: 5, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.1 }),
    svg('text', { x: CBX + CBW + 42, y: CBY + 104, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'monospace', 'font-size': 12 }, 'eₖ'));

  const bottom = svg('text', { x: W / 2, y: 300, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    'indices are tokens — chapter 01’s next-token loss now trains image understanding and generation alike');

  const defs = svg('defs', {},
    svg('marker', { id: 'ch11-arr5', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'ch11-arr5a', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The discrete route: a photograph passes through a convolutional encoder and becomes a grid of integer codebook indices; one highlighted index looks up a row of a learned codebook matrix, mirroring the text embedding lookup of chapter two.',
  }, defs, photo, arr1, enc, arr2, idxLabel, idxCells, idxSub, hlIdx, lookLine, codebook, hlRow, outVec, bottom);

  const node = figure('11.5',
    `vector quantization (VQ-VAE 2017, VQGAN 2021): compress the image to a grid of integers from a learned codebook. The lookup on the right is Fig. 2.2's embedding lookup, mirrored — except this vocabulary was learned by a neural net, not counted from text merges.`,
    root);

  track(node, (p) => {
    photo.setAttribute('opacity', seg(p, 0.1, 0.18));
    arr1.setAttribute('opacity', seg(p, 0.16, 0.21));
    enc.setAttribute('opacity', seg(p, 0.18, 0.24));
    arr2.setAttribute('opacity', seg(p, 0.22, 0.27));
    idxLabel.setAttribute('opacity', seg(p, 0.24, 0.3));
    idxCells.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.25 + i * 0.008, 0.32 + i * 0.008)));
    idxSub.setAttribute('opacity', seg(p, 0.38, 0.44));
    codebook.setAttribute('opacity', seg(p, 0.4, 0.48));
    hlIdx.setAttribute('opacity', seg(p, 0.48, 0.54));
    lookLine.setAttribute('opacity', seg(p, 0.5, 0.56));
    hlRow.setAttribute('opacity', seg(p, 0.53, 0.58));
    outVec.setAttribute('opacity', seg(p, 0.56, 0.62));
    bottom.setAttribute('opacity', seg(p, 0.6, 0.68));
  });
  return node;
}

/* ---- Fig 11.6: audio — waveform → spectrogram → token strip --------------- */

function audioFigure() {
  const W = 720, H = 330;
  const r = rng(31);

  // waveform
  let d = 'M 36 72';
  for (let i = 1; i <= 56; i++) {
    const x = 36 + i * 5;
    const env = Math.sin((i / 56) * Math.PI);
    const a = (i % 2 ? -1 : 1) * (3 + r() * 26) * env;
    d += ` L ${x} ${(72 + a).toFixed(1)}`;
  }
  const wave = svg('path', { d, stroke: PAL.tx, 'stroke-width': 1.3, fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
  const waveLabel = svg('text', { x: 36, y: 122, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'waveform · 16,000 samples per second');

  const arr1 = svg('path', { d: 'M 330 72 L 372 72', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch11-arr6)', opacity: 0 });

  // mel spectrogram: 26 cols × 10 rows
  const SGX = 384, SGY = 30, COLS = 26, ROWS = 10, CS = 11;
  const cols = Array.from({ length: COLS }, (_, cI) => {
    const cells = [];
    for (let rI = 0; rI < ROWS; rI++) {
      const energy = Math.max(0, Math.sin((cI / COLS) * Math.PI) * (1 - rI / ROWS) * 0.9 + (r() - 0.5) * 0.45);
      cells.push(svg('rect', {
        x: SGX + cI * CS, y: SGY + rI * CS, width: CS - 1, height: CS - 1,
        fill: PAL.act, opacity: 0, dataset: undefined,
      }));
      cells[cells.length - 1].dataset.o = Math.min(0.92, 0.06 + energy).toFixed(2);
    }
    return cells;
  });
  const specFrame = svg('rect', { x: SGX - 2, y: SGY - 2, width: COLS * CS + 3, height: ROWS * CS + 3, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, opacity: 0 });
  const specLabel = svg('text', { x: SGX, y: SGY + ROWS * CS + 20, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'log-mel spectrogram — an image of sound (freq × time)');

  const arr2 = svg('path', { d: `M ${SGX + COLS * CS / 2} ${SGY + ROWS * CS + 30} L ${SGX + COLS * CS / 2 - 120} 216`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch11-arr6)', opacity: 0 });
  const convLabel = svg('text', { x: SGX + COLS * CS / 2 - 40, y: 200, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'conv stack: downsample in time, then a transformer encoder');

  // token strip
  const TY = 228, TN = 10;
  const tChips = Array.from({ length: TN }, (_, i) => svg('rect', {
    x: 130 + i * 42, y: TY, width: 36, height: 26, rx: 5,
    fill: 'rgba(90,200,220,0.14)', stroke: PAL.act, 'stroke-width': 1.1, opacity: 0,
  }));
  const tLabel = svg('text', { x: 130, y: TY + 46, fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 },
    '≈ 25–50 vectors per second of audio (Whisper-style encoder)');
  const tLabel2 = svg('text', { x: 130, y: TY + 64, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'or: a neural codec (EnCodec-style RVQ) emits discrete audio tokens — which a model can also generate, i.e. speak');
  const tick = svg('text', { x: 130, y: TY - 8, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 },
    'one second of speech →');

  const defs = svg('defs', {},
    svg('marker', { id: 'ch11-arr6', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Audio pipeline: a raw waveform becomes a mel spectrogram — a grid of intensity cells over frequency and time — which a convolutional stack downsamples into a strip of roughly 25 to 50 audio tokens per second.',
  }, defs, wave, waveLabel, arr1, cols, specFrame, specLabel, arr2, convLabel, tick, tChips, tLabel, tLabel2);

  const node = figure('11.6',
    `sound becomes an image, then tokens: waveform → log-mel spectrogram → convolutional downsampling → encoder vectors at ~25–50 per second (Whisper's recipe). Codec-token variants stream at a few hundred discrete tokens per second — cheap enough to generate in real time, which is what makes live voice assistants possible.`,
    root);

  track(node, (p) => {
    wave.setAttribute('stroke-dashoffset', 1 - seg(p, 0.08, 0.26, ease.inOut));
    waveLabel.setAttribute('opacity', seg(p, 0.18, 0.24));
    arr1.setAttribute('opacity', seg(p, 0.24, 0.29));
    specFrame.setAttribute('opacity', seg(p, 0.26, 0.32));
    cols.forEach((col, cI) => {
      const t = seg(p, 0.28 + cI * 0.006, 0.34 + cI * 0.006);
      col.forEach((c) => c.setAttribute('opacity', t * +c.dataset.o));
    });
    specLabel.setAttribute('opacity', seg(p, 0.42, 0.48));
    arr2.setAttribute('opacity', seg(p, 0.46, 0.52));
    convLabel.setAttribute('opacity', seg(p, 0.48, 0.54));
    tick.setAttribute('opacity', seg(p, 0.52, 0.58));
    tChips.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.52 + i * 0.012, 0.6 + i * 0.012)));
    tLabel.setAttribute('opacity', seg(p, 0.6, 0.66));
    tLabel2.setAttribute('opacity', seg(p, 0.64, 0.7));
  });
  return node;
}

/* ---- Fig 11.7: video — images × time, and the budget explosion ------------ */

function videoFigure() {
  const TOK_PER_FRAME = 256, FPS = 1, SECS = 3600;
  const total = TOK_PER_FRAME * FPS * SECS;                    // computed, not typed
  const share = total / K3.contextWindow;

  const W = 720, H = 300;
  const FS = 76, FY = 52;
  const frames = Array.from({ length: 5 }, (_, i) => {
    const x = 56 + i * 126;
    return svg('g', { opacity: 0 },
      // sprocket holes
      [0, 1, 2, 3].map((k) => svg('rect', { x: x + 8 + k * 18, y: FY - 12, width: 9, height: 6, rx: 1.5, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 })),
      [0, 1, 2, 3].map((k) => svg('rect', { x: x + 8 + k * 18, y: FY + FS + 6, width: 9, height: 6, rx: 1.5, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 })),
      svg('g', { transform: `translate(${x}, ${FY})` }, photoArt(FS, i)),
      svg('rect', { x, y: FY, width: FS, height: FS, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 }),
      svg('text', { x: x + FS / 2, y: FY + FS + 30, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'monospace', 'font-size': 10.5 }, `≈${TOK_PER_FRAME} tok`),
      svg('text', { x: x + FS / 2, y: FY + FS + 44, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 9.5 }, `t = ${i}s`));
  });
  const stripLine = svg('path', { d: `M 56 ${FY + FS + 56} L 664 ${FY + FS + 56}`, stroke: PAL.mut, 'stroke-width': 1.2, fill: 'none', 'marker-end': 'url(#ch11-arr7)', opacity: 0 });
  const stripTag = svg('text', { x: 56, y: FY + FS + 74, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'sample at 1–2 fps · patchify each frame · add a temporal position');

  const math1 = svg('text', { x: W / 2, y: 236, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 14, opacity: 0 },
    `1 hour · ${FPS} fps · ${TOK_PER_FRAME} tokens/frame = ${total.toLocaleString('en-US')} tokens`);
  const math2 = svg('text', { x: W / 2, y: 260, 'text-anchor': 'middle', fill: PAL.loss, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    `= ${pct(share, 0)} of K3's ${K3.contextWindow.toLocaleString('en-US')}-token window — this is what million-token contexts are for (ch. 04B)`);

  const defs = svg('defs', {},
    svg('marker', { id: 'ch11-arr7', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A film strip of five sampled video frames, each costing about 256 tokens; the arithmetic below shows one hour at one frame per second and 256 tokens per frame equals 921,600 tokens, about 92 percent of a million-token context window.',
  }, defs, frames, stripLine, stripTag, math1, math2);

  const node = figure('11.7',
    `video is images × time — and the token bill multiplies accordingly. Mitigations are aggressive: temporal pooling (merge neighboring frames' tokens), keyframe selection, and token merging, often compressing a frame to 16–64 tokens before the LLM sees it.`,
    root);

  track(node, (p) => {
    frames.forEach((f, i) => f.setAttribute('opacity', seg(p, 0.12 + i * 0.05, 0.22 + i * 0.05)));
    stripLine.setAttribute('opacity', seg(p, 0.36, 0.44));
    stripTag.setAttribute('opacity', seg(p, 0.4, 0.48));
    math1.setAttribute('opacity', seg(p, 0.48, 0.56));
    math2.setAttribute('opacity', seg(p, 0.54, 0.62));
  });
  return node;
}

/* ---- chapter assembly ---------------------------------------------------- */

export function render({ id, num, title }) {
  // token-budget arithmetic quoted in prose — computed, not typed
  const bigPatches = Math.floor(1024 / 14) ** 2;   // 1024px image, patch 14

  return chapter(id,
    chapterHead(num, 'Beyond text', title),
    prose(
      `Every chapter so far has fed the model exactly one thing: token IDs standing for text. Yet the same family of models now reads screenshots, describes photographs, transcribes speech, and answers questions about hour-long videos. The natural guess is that seeing required new machinery inside the model. It mostly didn't — and the reason is a fact you already know. Chapter 03's residual stream is just a sequence of d_model-dimensional vectors, and <strong>nothing in a transformer layer checks where a vector came from</strong>. Attention will route between any vectors; the MLPs will transform any vector. Text only ever entered through one narrow door — the embedding lookup of chapter 02, which turned an integer into a vector. Build a different door that turns <em>pixels</em> or <em>waveform samples</em> into residual-stream-shaped vectors, and the rest of the machine works unchanged.`,
      `So the whole subject reduces to one engineering question with two competing answers. <strong>Route one — continuous:</strong> train an <em>encoder</em> that maps an image (or a second of audio) to a short sequence of vectors, and splice those vectors into the input sequence as <strong>soft tokens</strong> — embeddings that correspond to no vocabulary entry and were computed rather than looked up. <strong>Route two — discrete:</strong> train a <em>quantizer</em> that compresses the signal into integer IDs from a new, learned vocabulary — at which point images literally <em>are</em> tokens, and chapter 01's next-token objective applies verbatim. Everything in this chapter is one of these two philosophies wearing different clothes.`),

    convergeFigure(),

    prose(
      `Start with route one and the modality that drove it: images. The recipe — the <strong>vision transformer</strong> (ViT, 2020) — is almost embarrassingly direct. There is no edge detector, no convolutional pyramid of classical computer vision. Slice the image into a grid of small square <strong>patches</strong>, typically 14 or 16 pixels on a side. Flatten each patch into its raw pixel numbers, multiply by one learned matrix, and you have a vector per patch. Then run a transformer over the patch sequence — with one crucial difference from everything since chapter 04: <em>no causal mask</em>. An image has no reading order, so every patch attends to every patch, and position becomes a 2-D coordinate rather than an index in time.`),
    term('patch embedding', 'n.', 'the vector a flattened image patch becomes after one learned linear projection — the visual analogue of a token embedding row, except <em>computed from pixels</em> rather than looked up by ID'),

    createScene({
      id: 'vit-pipeline',
      figure: vitFigure,
      steps: [
        { n: 'STEP 1 / 4 — PATCHIFY', html: `<p>Slice the photograph into a grid of square patches — 16 × 16 pixels each, so a 224 × 224 image becomes 14 × 14 = 196 patches. That grid decision is the image's "tokenization": it fixes how many sequence positions the picture will occupy.</p>` },
        { n: 'STEP 2 / 4 — FLATTEN & PROJECT', html: `<p>One patch is just 16 · 16 · 3 = 768 raw pixel numbers. Multiply that vector by a single learned matrix W_patch and it becomes a patch embedding. Compare chapter 02: a token embedding was <em>row lookup</em> in E; a patch embedding is the same object <em>computed</em> — pixels in, vector out.</p>` },
        { n: 'STEP 3 / 4 — A TRANSFORMER FOR PATCHES', html: `<p>All patch vectors, each tagged with its 2-D grid position, enter a vision transformer encoder. It is the same layer design you know — attention, MLP, residual stream — but <em>bidirectional</em>: no causal mask, because an image has no "earlier" and "later". Every patch sees every patch at once.</p>` },
        { n: 'STEP 4 / 4 — INTO THE LLM', html: `<p>A small projector MLP maps the encoder's outputs into the LLM's d_model, and the resulting soft tokens are spliced into the input sequence between ordinary text tokens. From the stack's point of view they are indistinguishable from text — vectors in the stream, attended to like any others.</p>` },
      ],
    }),
    prose(
      `<em>Fig. 11.2 — the ViT pipeline: patchify, project, encode, splice. The stack downstream is unmodified.</em>`,
      `The catch is arithmetic. Token count grows with the <em>square</em> of resolution: a 1024 × 1024 screenshot at patch size 14 is ${Math.floor(1024 / 14)} × ${Math.floor(1024 / 14)} = ${bigPatches.toLocaleString('en-US')} patches — over five thousand sequence positions for one image, before a single word of the conversation. Production systems therefore tile large images into crops, downsample, or pool neighboring patch tokens, and land on a budget of roughly <strong>256–1024 tokens per image</strong>. Drag the sliders below and watch the square law do its work.`),

    widget('Patchify: what one image costs', 'drag the sliders — the grid and the token bill update live', patchifyBody()),
    prose(
      `<em>Fig. 11.3 — tokens = (resolution / patch)², computed live. At patch 8 on a 1024 px image the single picture costs more context than a novella chapter.</em>`),

    prose(
      `Where does the encoder itself come from? Not from the LLM — and this ordering is the deep trick of the modern recipe. Vision encoders are pretrained separately by <strong>contrastive learning</strong>, CLIP (2021) being the canonical version: an image tower and a text tower are trained on hundreds of millions of image–caption pairs so that matched pairs land close in a shared embedding space and mismatched pairs land far apart. No pixel is ever predicted; the objective is purely relational. The result is an encoder whose vector space is already organized by <em>meaning</em> — photos of cats cluster near the caption "a cat" — before the language model ever enters the picture.`,
      `Bolting that encoder onto an LLM is then startlingly cheap — the LLaVA (2023) recipe is the standard template. <strong>Stage 2:</strong> freeze both the LLM and the encoder; train only a small projector (an MLP of a few million parameters) on image–caption data, teaching it to translate encoder outputs into vectors the frozen LLM finds intelligible. <strong>Stage 3:</strong> unfreeze and jointly tune on multimodal instruction data — image-grounded conversations, charts, OCR, UI screenshots. In chapter 10's color grammar: almost everything stays amber for most of the process; the green blocks are small and late.`),
    term('contrastive learning', 'n.', 'training on pairs rather than labels: pull representations of matched pairs together and push mismatched pairs apart — the encoder learns a semantically organized space without predicting a single pixel'),

    stagesFigure(),

    mathAside('the InfoNCE contrastive loss, precisely', `
      <p>Take a batch of N image–caption pairs. Encode images to vectors vᵢ and captions to tᵢ, ℓ₂-normalized, and let sim(v,t) = vᵀt (cosine similarity). With temperature τ, each image must pick out <em>its own</em> caption from the batch via a softmax over similarities:</p>
      <div class="eq">L_img = −(1/N) Σᵢ log [ exp(sim(vᵢ,tᵢ)/τ) / Σⱼ exp(sim(vᵢ,tⱼ)/τ) ]</div>
      <p>A symmetric term L_txt makes each caption pick out its own image, and the loss is (L_img + L_txt)/2. Structurally this is chapter 01's cross-entropy in disguise — a softmax classification where the "vocabulary" is the other side of the batch, so every batch of N pairs supplies N-way supervision in both directions. The learned τ sharpens the softmax as training proceeds. CLIP trained this at N in the tens of thousands, which is why the batch — not the model — was the engineering story.</p>`),

    prose(
      `Now route two, the discrete philosophy. A <strong>VQ-VAE</strong> (2017; VQGAN, 2021, is the sharper modern variant) learns three things jointly: a convolutional encoder that maps an image to a small grid of latent vectors, a <strong>codebook</strong> of, say, 8,192 learnable vectors, and a decoder that reconstructs pixels. Each latent is snapped to its <em>nearest codebook entry</em>, so the image becomes a grid of integers — a 256 × 256 photo compresses to a 32 × 32 grid of code IDs. Those integers can be appended to the text vocabulary, and then everything in this article applies with no modification at all: chapter 01's next-token loss trains image understanding and image <em>generation</em> in the same breath, since generating a picture is just predicting 1,024 image tokens and running the decoder. This is the early-fusion line — Chameleon (2024), Emu3 (2024) — and it is also, historically, how a whole family of image generators worked before diffusion took that crown.`),
    term('vector quantization', 'n.', 'snapping a continuous vector to the nearest entry of a finite learned codebook, so a signal becomes a sequence of integer indices — a <em>learned tokenizer</em> for pixels or audio'),

    codebookFigure(),

    mathAside('training through an argmax: the straight-through estimator', `
      <p>Quantization picks the nearest code, k = argminⱼ ‖z_e − eⱼ‖, and outputs z_q = e_k. The argmin has zero gradient almost everywhere, so backpropagation would stop dead at the quantizer. The <strong>straight-through estimator</strong> simply copies the gradient across the gap — ∂L/∂z_e := ∂L/∂z_q — pretending the snap was the identity. Two auxiliary terms then keep the fiction honest:</p>
      <div class="eq">L = L_recon + ‖sg[z_e] − e_k‖² + β·‖z_e − sg[e_k]‖²</div>
      <p>where sg[·] is stop-gradient. The middle term drags the chosen codebook entry toward the encoder's output (training the vocabulary); the last — the <em>commitment loss</em>, β ≈ 0.25 — drags the encoder toward the code it snapped to, so encoder and codebook do not drift apart. It is a hack, it is biased, and it works; a decade of attempts to replace it (Gumbel-softmax relaxations, FSQ's fixed grids) have mostly rediscovered how strong the baseline is.</p>`),

    prose(
      `The honest scorecard between the two routes: discrete buys a <em>unified objective</em> — one loss, one vocabulary, and generation for free — but quantization discards detail, and reconstructions cap the fidelity of anything downstream. Continuous soft tokens preserve more information per position and consistently win at <em>understanding</em> benchmarks — reading a chart, OCR-ing a receipt — but the model can only consume images, not emit them; generation needs a separate mechanism. Which is why the shipping frontier is, unglamorously, a hybrid: <strong>continuous encoders on the way in, and a diffusion model or discrete-token head on the way out</strong>.`),

    prose(
      `Audio walks the same fork with one preliminary step: sound arrives as a waveform, ~16,000 samples per second — far too raw to patchify directly. The near-universal move is to render it as a <strong>mel spectrogram</strong>: a frequency-by-time intensity map, quite literally an image of sound. From there the ViT playbook resumes — convolutional downsampling in time, then a transformer encoder. Whisper (2022) is the template, and the budget lands around <strong>25–50 tokens per second of audio</strong>. The discrete route exists here too, and it matters more than for images: neural audio codecs (SoundStream 2021, EnCodec 2022) use residual vector quantization — a stack of codebooks, each quantizing what the previous one missed — to compress speech into a few hundred discrete tokens per second. A model that generates <em>those</em> tokens can speak. And because they stream — a fraction of a second of audio per token, generated at chapter 09's decode rate — codec tokens are what make real-time, full-duplex voice models possible at all.`),

    audioFigure(),

    prose(
      `Video is not a new modality so much as a multiplication: images × time. Sample frames — 1–2 per second is typical, since adjacent frames are nearly identical — patchify each one, and add a temporal coordinate to the position information. The budgets are where it gets serious.`),

    videoFigure(),

    prose(
      `<em>Fig. 11.7's arithmetic is the punchline of chapter 04B rearriving from the outside: an hour of modestly-sampled video, at a modest 256 tokens per frame, nearly fills a ${si(K3.contextWindow)} context on its own.</em> Long-context machinery and multimodality are not separate features — the second is the main customer of the first. And even a million tokens is not enough without compression, so video pipelines pool ruthlessly: merging tokens across neighboring frames, selecting keyframes, collapsing static scenes — often down to 16–64 tokens per frame.`,
      `Finally, how is the assembled system trained? The pretraining substrate of choice is <strong>interleaved image–text web documents</strong> — pages kept in their natural order, images embedded mid-sentence where they originally appeared — because that is the only data that teaches a model to reason <em>across</em> the boundary, not just caption. But look at any frontier data mixture and text still dominates, usually overwhelmingly. This is scarcity, not preference: the paired multimodal web is orders of magnitude smaller than the text web, its captions are noisier than its prose, and — chapter 07's lesson — data quality is destiny. The reasoning depth of every multimodal model you have used was still learned mostly from text; the other modalities are taught to <em>meet</em> that reasoning in the residual stream.`,
      `A closing honesty note about our specimen. Moonshot's spec sheet for ${K3.name} discloses no modality details, and this article will not invent them — everything above is the frontier recipe, not a K3 teardown. What is public is the lineage: Kimi-VL (2025) is an open MoE vision-language model from the same lab — an efficient MoE language model behind a native-resolution vision encoder, trained on exactly the staged recipe of Fig. 11.4 — and the frontier's direction is unambiguous: the encoders keep shrinking as a fraction of the system, and the stack keeps not caring where its vectors came from.`),

    takeaway(
      `<strong>The transformer never learned to see.</strong> The stack still does exactly what chapters 03–05 said: route and transform vectors. What changed is upstream — an encoder learned to speak vector, translating pixels and waveforms into the residual stream's native tongue. Multimodality is a story about doors, not about the room.`));
}
