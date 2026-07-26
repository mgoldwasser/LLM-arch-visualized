/* Sticky scene — the vision-transformer pipeline: pixels → patches → one
   learned projection → a bidirectional encoder → soft tokens in the stream.
   The scene's caption lives in the prose paragraph that follows it in
   index.js, so the number is claimed here, where the scene appears. */

import { svg, svgRoot } from '../../core/dom.js';
import { claimFig, chRef, chNum, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease, rng } from '../../core/anim.js';
import { photoArt } from './art-photo.js';

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
  const arrEx = svg('path', { d: `M ${EX + EPS + 6} ${EY + EPS / 2} L ${FX - 10} ${FY + 9}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mm-vit-arr)', opacity: 0 });

  const WPX = 370, WPY = 108;
  const wpatch = svg('g', { opacity: 0 },
    svg('rect', { x: WPX, y: WPY, width: 214, height: 32, rx: 7, fill: 'rgba(224,168,76,0.10)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    svg('text', { x: WPX + 107, y: WPY + 21, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 12 }, 'W_patch ∈ ℝ^(768 × d_model)'));
  const arrW1 = svg('path', { d: `M ${WPX + 107} ${FY + 22} L ${WPX + 107} ${WPY - 4}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mm-vit-arr)', opacity: 0 });
  const arrW2 = svg('path', { d: `M ${WPX + 107} ${WPY + 34} L ${WPX + 107} ${WPY + 52}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mm-vit-arr)', opacity: 0 });
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
  const arrEnc = svg('path', { d: `M ${36 + SN * 42 + 18} ${SY + 12} L ${VEX - 6} ${SY + 12}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mm-vit-arr)', opacity: 0 });

  /* step 3 — projector, soft tokens into the residual stream */
  const PJX = 420, PJY = 344;
  const proj = svg('g', { opacity: 0 },
    svg('rect', { x: PJX, y: PJY, width: 202, height: 30, rx: 7, fill: 'rgba(224,168,76,0.10)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    svg('text', { x: PJX + 101, y: PJY + 20, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 11 }, 'projector MLP → LLM d_model'));
  const arrPj = svg('path', { d: `M ${VEX + VEW / 2} ${VEY + VEH + 4} L ${PJX + 101} ${PJY - 4}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mm-vit-arr)', opacity: 0 });

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
  const arrStack = svg('path', { d: `M 448 ${ROWY + 15} L 502 ${ROWY + 15}`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#mm-vit-arr)', opacity: 0 });
  const stackTag = svg('text', { x: 512, y: ROWY + 20, fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    `into the stack (ch. ${chNum('residual')})`);

  const defs = svg('defs', {},
    svg('marker', { id: 'mm-vit-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
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

export function vitScene() {
  claimFig('vit');
  return createScene({
    id: 'vit-pipeline',
    figure: vitFigure,
    steps: [
      { n: 'STEP 1 / 4 — PATCHIFY', html: `<p>Slice the photograph into a grid of square patches — 16 × 16 pixels each, so a 224 × 224 image becomes 14 × 14 = 196 patches. That grid decision is the image's "tokenization": it fixes how many sequence positions the picture will occupy.</p>` },
      { n: 'STEP 2 / 4 — FLATTEN & PROJECT', html: `<p>One patch is just 16 · 16 · 3 = 768 raw pixel numbers. Multiply that vector by a single learned matrix W_patch and it becomes a patch embedding. Compare ${chRef('tokens')}: a token embedding was <em>row lookup</em> in E; a patch embedding is the same object <em>computed</em> — pixels in, vector out.</p>` },
      { n: 'STEP 3 / 4 — A TRANSFORMER FOR PATCHES', html: `<p>All patch vectors, each tagged with its 2-D grid position, enter a vision transformer encoder. It is the same layer design you know — attention, MLP, residual stream — but <em>bidirectional</em>: no causal mask, because an image has no "earlier" and "later". Every patch sees every patch at once.</p>` },
      { n: 'STEP 4 / 4 — INTO THE LLM', html: `<p>A small projector MLP maps the encoder's outputs into the LLM's d_model, and the resulting soft tokens are spliced into the input sequence between ordinary text tokens. From the stack's point of view they are indistinguishable from text — vectors in the stream, attended to like any others.</p>` },
    ],
  });
}
