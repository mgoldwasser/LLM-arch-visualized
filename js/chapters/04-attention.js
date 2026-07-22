/* Chapter 04 — attention, step by step. The site's centerpiece.
   Sticky scene: one attention head assembling itself in five stages,
   then shape bookkeeping, a hand-checkable worked example, a pronoun-
   resolution widget, RoPE clock hands, and the variant zoo. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, figure, widget, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { seg, lerp, ease, clamp, norm, rng } from '../core/anim.js';
import { track, reveal } from '../core/scroll.js';
import { attention, softmax, round } from '../core/mathtools.js';
import { K3 } from '../../data/k3.js';

const BP = K3.blueprint; // illustrative K2 dims: d 7168, dHead 128, 64 heads

/* ---- tiny local helpers --------------------------------------------------- */

const txt = (x, y, s, { size = 11, fill = PAL.mut, anchor = 'start', mono = false, opacity } = {}) =>
  svg('text', {
    x, y, fill, 'text-anchor': anchor, 'font-size': size,
    'font-family': mono ? 'monospace' : 'sans-serif',
    ...(opacity != null ? { opacity } : {}),
  }, s);

/* Section subhead (the source's inner headings). */
const subhead = (s) => reveal(el('h3', { class: 'measure', style: { margin: '3.2rem auto 1rem', fontSize: '1.32rem' } }, s));

/* A standalone equation line (styled like .math-aside .eq, outside an aside). */
const eqLine = (s) => reveal(el('div', {
  class: 'measure',
  style: {
    fontFamily: 'var(--mono)', fontSize: '0.86em', color: 'var(--ink)',
    background: 'var(--code-bg)', borderRadius: '8px', padding: '0.7rem 0.9rem',
    margin: '1.6rem auto', overflowX: 'auto', lineHeight: 1.7,
  },
}, s));

/* ===========================================================================
   Scene figure — one attention head in five stages
   =========================================================================== */

function attnSceneFigure(canvas) {
  const W = 720, H = 460;
  const SUB = ['₁', '₂', '₃', '₄', '₅', '₆'];

  const defs = svg('defs', {},
    svg('marker', { id: 'ch4-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'ch4-arrA', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.attn })),
    svg('marker', { id: 'ch4-arrC', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })));

  const stageTitle = (tag, formula) => [
    txt(24, 32, tag, { size: 11, fill: PAL.attn }),
    txt(24, 54, formula, { size: 12.5, fill: PAL.tx, mono: true }),
  ];

  /* -- stage 0 · PROJECT ---------------------------------------------------- */
  const s0 = (() => {
    const g = svg('g', {});
    const gx = svg('g', {},
      txt(30, 122, 'stream vector', { size: 11 }),
      svg('rect', { x: 56, y: 132, width: 28, height: 168, rx: 7, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.4 }),
      [1, 2, 3, 4, 5].map((i) => svg('line', { x1: 58, y1: 132 + i * 28, x2: 82, y2: 132 + i * 28, stroke: PAL.grid })),
      txt(70, 322, 'xₜ ∈ ℝᵈ', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true }),
      txt(70, 340, `d = ${BP.dModel}`, { size: 10, anchor: 'middle', mono: true }));

    const names = ['W_Q', 'W_K', 'W_V'];
    const chipTxt = [['q', 'what I seek', 'ℝ^d_head = ℝ¹²⁸'], ['k', 'what I advertise', 'ℝ^d_head'], ['v', 'what I hand over', 'ℝ^d_head']];
    const boxes = [], arr1 = [], arr2 = [], chips = [];
    const by = [72, 192, 312], cy = [80, 200, 320];
    for (let i = 0; i < 3; i++) {
      boxes.push(svg('g', {},
        svg('rect', { x: 240, y: by[i], width: 110, height: 76, rx: 10, fill: 'rgba(224,168,76,0.13)', stroke: PAL.weight, 'stroke-width': 1.4 }),
        txt(295, by[i] + 36, names[i], { size: 15, fill: PAL.weight, anchor: 'middle', mono: true }),
        txt(295, by[i] + 58, `${BP.dModel} × ${BP.dHead}`, { size: 10, anchor: 'middle', mono: true })));
      arr1.push(svg('path', { d: `M 88 ${216} C 150 216, 160 ${by[i] + 38}, 234 ${by[i] + 38}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch4-arr)' }));
      arr2.push(svg('path', { d: `M 352 ${by[i] + 38} L 452 ${cy[i] + 16}`, stroke: PAL.attn, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch4-arrA)' }));
      chips.push(svg('g', {},
        svg('rect', { x: 458, y: cy[i], width: 64, height: 32, rx: 8, fill: 'rgba(180,140,224,0.16)', stroke: PAL.attn, 'stroke-width': 1.3 }),
        txt(490, cy[i] + 21, chipTxt[i][0], { size: 15, fill: PAL.attn, anchor: 'middle', mono: true }),
        txt(534, cy[i] + 14, chipTxt[i][1], { size: 12, fill: PAL.tx }),
        txt(534, cy[i] + 30, chipTxt[i][2], { size: 10, mono: true })));
    }
    g.append(...stageTitle('1 · PROJECT', 'q = W_Q x   k = W_K x   v = W_V x'), gx, ...boxes, ...arr1, ...arr2, ...chips);
    const u = (q) => {
      gx.setAttribute('opacity', seg(q, 0, 0.18));
      for (let i = 0; i < 3; i++) {
        boxes[i].setAttribute('opacity', seg(q, 0.14 + i * 0.06, 0.34 + i * 0.06));
        arr1[i].setAttribute('opacity', seg(q, 0.28 + i * 0.06, 0.42 + i * 0.06));
        arr2[i].setAttribute('opacity', seg(q, 0.44 + i * 0.06, 0.58 + i * 0.06));
        const t = seg(q, 0.52 + i * 0.08, 0.72 + i * 0.08, ease.out);
        chips[i].setAttribute('opacity', t);
        chips[i].setAttribute('transform', `translate(${lerp(-12, 0, t)}, 0)`);
      }
    };
    return { g, u };
  })();

  /* -- stage 1 · SCORE ------------------------------------------------------ */
  const s1 = (() => {
    const g = svg('g', {});
    const T = 6, cell = 44, gx0 = 230, gy0 = 96;
    const rand = rng(42);
    const heads = [], lows = [], masks = [];
    for (let j = 0; j < T; j++) heads.push(txt(gx0 + j * cell + 22, 88, 'k' + SUB[j], { size: 11, anchor: 'middle', mono: true }));
    for (let i = 0; i < T; i++) heads.push(txt(gx0 - 12, gy0 + i * cell + 27, 'q' + SUB[i], { size: 11, anchor: 'end', mono: true }));
    heads.push(txt(gx0 + T * cell / 2, 70, 'cols = keys (j)', { size: 10, anchor: 'middle' }));
    heads.push(svg('text', { x: 190, y: gy0 + T * cell / 2, fill: PAL.mut, 'font-size': 10, 'font-family': 'sans-serif', 'text-anchor': 'middle', transform: `rotate(-90, 190, ${gy0 + T * cell / 2})` }, 'rows = queries (i)'));
    for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) {
      const x = gx0 + j * cell + 1, y = gy0 + i * cell + 1;
      if (j <= i) {
        lows.push(svg('rect', { x, y, width: cell - 2, height: cell - 2, rx: 4, fill: PAL.attn, 'fill-opacity': 0.14 + rand() * 0.68 }));
      } else {
        masks.push(svg('g', {},
          svg('rect', { x, y, width: cell - 2, height: cell - 2, rx: 4, fill: '#0B0F14', stroke: PAL.grid }),
          txt(x + 21, y + 26, '−∞', { size: 12, anchor: 'middle', mono: true })));
      }
    }
    const maskAnno = svg('g', {},
      txt(560, 108, 'causal mask:', { size: 11, fill: PAL.ink }),
      txt(560, 124, 'j ≤ i only —', { size: 11 }),
      txt(560, 140, 'no token may', { size: 11 }),
      txt(560, 156, 'see its future', { size: 11 }),
      svg('path', { d: 'M 556 116 C 530 118, 512 124, 492 134', stroke: PAL.mut, 'stroke-width': 1.2, fill: 'none', 'marker-end': 'url(#ch4-arr)' }));
    const footer = txt(gx0 + T * cell / 2, 392, 'T×T scores, one multiply', { size: 11, anchor: 'middle' });
    const headG = svg('g', {}, heads);
    g.append(...stageTitle('2 · SCORE', 'S = QKᵀ / √d_head'), headG, ...lows, ...masks, maskAnno, footer);
    const u = (q) => {
      headG.setAttribute('opacity', seg(q, 0, 0.12));
      lows.forEach((c, i) => c.setAttribute('opacity', seg(q, 0.05 + i * 0.02, 0.11 + i * 0.02)));
      masks.forEach((c, i) => c.setAttribute('opacity', seg(q, 0.55 + i * 0.014, 0.62 + i * 0.014)));
      footer.setAttribute('opacity', seg(q, 0.48, 0.58));
      maskAnno.setAttribute('opacity', seg(q, 0.74, 0.86));
    };
    return { g, u };
  })();

  /* -- stage 2 · NORMALIZE -------------------------------------------------- */
  const s2 = (() => {
    const g = svg('g', {});
    const scores = [0.57, 1.25, -0.41, -0.04, -0.66];
    const weights = softmax(scores).map((v) => round(v, 2)); // .24 .47 .09 .13 .07 — computed, not hard-coded
    const x0 = 130, y0 = 92, cw = 64, ch = 38;
    const fmt = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);

    const rowLabel = txt(x0, 80, 'one row of S  (i = 5)', { size: 11 });
    const cells = scores.map((s, j) => svg('g', {},
      svg('rect', { x: x0 + j * cw, y: y0, width: cw - 4, height: ch, rx: 5, fill: PAL.attn, 'fill-opacity': 0.14 + weights[j] * 1.2, stroke: 'rgba(180,140,224,0.4)' }),
      txt(x0 + j * cw + 30, y0 + 24, fmt(s), { size: 12, fill: PAL.ink, anchor: 'middle', mono: true })));
    cells.push(svg('g', {},
      svg('rect', { x: x0 + 5 * cw, y: y0, width: cw - 4, height: ch, rx: 5, fill: '#0B0F14', stroke: PAL.grid }),
      txt(x0 + 5 * cw + 30, y0 + 24, '−∞', { size: 12, anchor: 'middle', mono: true })));

    const mid = x0 + 3 * cw - 4;
    const a1 = svg('path', { d: `M ${mid} ${y0 + ch + 6} L ${mid} 166`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch4-arr)' });
    const box = svg('g', {},
      svg('rect', { x: mid - 90, y: 170, width: 180, height: 46, rx: 10, fill: 'rgba(230,237,243,0.04)', stroke: PAL.tx, 'stroke-width': 1.2 }),
      txt(mid, 190, 'softmax', { size: 14, fill: PAL.ink, anchor: 'middle', mono: true }),
      txt(mid, 208, 'eˢ / Σ eˢ', { size: 10, anchor: 'middle', mono: true }));
    const a2 = svg('path', { d: `M ${mid} 218 L ${mid} 248`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch4-arr)' });

    const bx = 110, byy = 256, bh = 36, bw = 470;
    const segOp = [0.95, 0.8, 0.5, 0.62, 0.42];
    const segRects = weights.map((w, j) => svg('rect', { x: bx, y: byy, height: bh, width: 0, fill: PAL.attn, 'fill-opacity': segOp[j], stroke: PAL.bg, 'stroke-width': 1 }));
    const segLabels = weights.map((w) => txt(0, byy + 23, '.' + String(Math.round(w * 100)).padStart(2, '0'), { size: 12, fill: '#10141A', anchor: 'middle', mono: true }));
    const maskNote = txt(bx + bw + 8, byy + 23, '−∞ → 0', { size: 11, mono: true });
    const bracket = svg('g', {},
      svg('path', { d: `M ${bx} ${byy + 46} L ${bx} ${byy + 52} L ${bx + bw} ${byy + 52} L ${bx + bw} ${byy + 46}`, stroke: PAL.mut, fill: 'none', 'stroke-width': 1.2 }),
      txt(bx + bw / 2, byy + 72, '≥ 0 · sums to 1', { size: 12, fill: PAL.tx, anchor: 'middle' }));
    const note = txt(W / 2, 420, 'a weighted blend of every match — differentiable end to end', { size: 11, anchor: 'middle' });

    g.append(...stageTitle('3 · NORMALIZE', 'A = softmax(row):  aᵢⱼ = eˢᵢⱼ / Σⱼ eˢᵢⱼ'),
      rowLabel, ...cells, a1, box, a2, ...segRects, ...segLabels, maskNote, bracket, note);
    const u = (q) => {
      rowLabel.setAttribute('opacity', seg(q, 0, 0.1));
      cells.forEach((c, j) => c.setAttribute('opacity', seg(q, j * 0.03, 0.14 + j * 0.03)));
      a1.setAttribute('opacity', seg(q, 0.18, 0.27));
      box.setAttribute('opacity', seg(q, 0.24, 0.35));
      a2.setAttribute('opacity', seg(q, 0.33, 0.42));
      let x = bx;
      weights.forEach((w, j) => {
        const t = seg(q, 0.42 + j * 0.06, 0.58 + j * 0.06, ease.out);
        const wpx = w * bw * t;
        segRects[j].setAttribute('x', x);
        segRects[j].setAttribute('width', wpx);
        segLabels[j].setAttribute('x', x + wpx / 2);
        segLabels[j].setAttribute('opacity', seg(q, 0.58 + j * 0.06, 0.66 + j * 0.06));
        x += wpx;
      });
      maskNote.setAttribute('opacity', seg(q, 0.76, 0.85));
      bracket.setAttribute('opacity', seg(q, 0.8, 0.9));
      note.setAttribute('opacity', seg(q, 0.88, 0.98));
    };
    return { g, u };
  })();

  /* -- stage 3 · GATHER ------------------------------------------------------ */
  const s3 = (() => {
    const g = svg('g', {});
    const weights = softmax([0.57, 1.25, -0.41, -0.04, -0.66]).map((v) => round(v, 2));
    const chips = [], wLabels = [], lines = [];
    const zx = 352, zy = 222;
    weights.forEach((w, j) => {
      const x = 120 + j * 100;
      wLabels.push(txt(x + 32, 88, '× .' + String(Math.round(w * 100)).padStart(2, '0'), { size: 11, fill: PAL.attn, anchor: 'middle', mono: true }));
      chips.push(svg('g', {},
        svg('rect', { x, y: 98, width: 64, height: 30, rx: 8, fill: 'rgba(180,140,224,0.13)', stroke: PAL.attn, 'stroke-width': 1.2 }),
        txt(x + 32, 118, 'v' + SUB[j], { size: 13, fill: PAL.ink, anchor: 'middle', mono: true })));
      lines.push(svg('line', { x1: x + 32, y1: 130, x2: zx, y2: zy - 2, stroke: PAL.attn, 'stroke-width': 1 + w * 7, 'stroke-opacity': clamp(0.3 + w * 1.4) }));
    });
    const z = svg('g', {},
      svg('rect', { x: zx - 30, y: zy, width: 60, height: 32, rx: 8, fill: 'rgba(180,140,224,0.32)', stroke: PAL.attn, 'stroke-width': 1.4 }),
      txt(zx, zy + 21, 'z', { size: 14, fill: PAL.ink, anchor: 'middle', mono: true }));
    const a1 = svg('path', { d: `M ${zx} ${zy + 34} L ${zx} 282`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch4-arr)' });
    const wo = svg('g', {},
      svg('rect', { x: zx - 60, y: 286, width: 120, height: 50, rx: 10, fill: 'rgba(224,168,76,0.13)', stroke: PAL.weight, 'stroke-width': 1.4 }),
      txt(zx, 308, 'W_O', { size: 15, fill: PAL.weight, anchor: 'middle', mono: true }),
      txt(zx, 326, 'back to d_model', { size: 9.5, anchor: 'middle' }));
    const a2 = svg('path', { d: `M ${zx} 336 L ${zx} 372`, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch4-arr)' });
    const stream = svg('g', {},
      svg('rect', { x: 110, y: 386, width: 500, height: 16, rx: 8, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.2 }),
      svg('circle', { cx: zx, cy: 394, r: 10, fill: PAL.bg, stroke: PAL.act, 'stroke-width': 1.4 }),
      txt(zx, 398.5, '+', { size: 13, fill: PAL.act, anchor: 'middle', mono: true }),
      txt(610, 378, 'residual stream', { size: 11, anchor: 'end' }));
    const note = txt(W / 2, 432, 'attention transports · the MLP transforms', { size: 11, anchor: 'middle' });
    g.append(...stageTitle('4 · GATHER', 'zᵢ = Σⱼ aᵢⱼ vⱼ ,  then  W_O z → stream'),
      ...wLabels, ...chips, ...lines, z, a1, wo, a2, stream, note);
    const u = (q) => {
      chips.forEach((c, j) => {
        const t = seg(q, j * 0.05, 0.16 + j * 0.05);
        c.setAttribute('opacity', t);
        wLabels[j].setAttribute('opacity', t);
      });
      lines.forEach((l, j) => l.setAttribute('opacity', seg(q, 0.22 + j * 0.04, 0.38 + j * 0.04)));
      const tz = seg(q, 0.44, 0.54, ease.out);
      z.setAttribute('opacity', tz);
      z.setAttribute('transform', `translate(0, ${lerp(8, 0, tz)})`);
      a1.setAttribute('opacity', seg(q, 0.54, 0.62));
      wo.setAttribute('opacity', seg(q, 0.58, 0.7));
      a2.setAttribute('opacity', seg(q, 0.7, 0.78));
      stream.setAttribute('opacity', seg(q, 0.75, 0.88));
      note.setAttribute('opacity', seg(q, 0.88, 0.98));
    };
    return { g, u };
  })();

  /* -- stage 4 · MULTI-HEAD -------------------------------------------------- */
  const s4 = (() => {
    const g = svg('g', {});
    const lw = 104, lh = 196, gap = 16, x0 = (W - (5 * lw + 4 * gap)) / 2, y0 = 64;
    const names = ['head 1', 'head 2', 'head 3', '…', `head ${BP.heads}`];
    const lanes = names.map((name, i) => {
      const lx = x0 + i * (lw + gap);
      const lane = svg('g', {});
      if (name === '…') {
        lane.append(
          svg('rect', { x: lx, y: y0, width: lw, height: lh, rx: 10, fill: 'none', stroke: 'rgba(180,140,224,0.3)', 'stroke-dasharray': '4 5' }),
          txt(lx + lw / 2, y0 + lh / 2 + 8, '…', { size: 24, anchor: 'middle' }));
        return lane;
      }
      const r = rng(31 + i * 7);
      lane.append(svg('rect', { x: lx, y: y0, width: lw, height: lh, rx: 10, fill: 'rgba(180,140,224,0.05)', stroke: 'rgba(180,140,224,0.45)', 'stroke-width': 1.2 }));
      for (let k = 0; k < 3; k++)
        lane.append(svg('rect', { x: lx + 10 + k * 29, y: y0 + 14, width: 26, height: 11, rx: 3, fill: 'rgba(224,168,76,0.45)' }));
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++)
        lane.append(svg('rect', {
          x: lx + 24 + b * 14, y: y0 + 40 + a * 14, width: 12, height: 12, rx: 2,
          fill: b <= a ? PAL.attn : '#0B0F14',
          'fill-opacity': b <= a ? 0.2 + r() * 0.7 : 1,
          stroke: b > a ? PAL.grid : 'none',
        }));
      let sx = lx + 12;
      const parts = [r(), r(), r(), r()];
      const tot = parts.reduce((s, v) => s + v, 0);
      parts.forEach((v, k) => {
        const wseg = (v / tot) * 80;
        lane.append(svg('rect', { x: sx, y: y0 + 110, width: Math.max(1, wseg - 1), height: 10, rx: 2, fill: PAL.attn, 'fill-opacity': 0.35 + 0.6 * (v / tot) * 2 }));
        sx += wseg;
      });
      lane.append(
        svg('rect', { x: lx + 38, y: y0 + 134, width: 28, height: 12, rx: 3, fill: 'rgba(180,140,224,0.4)' }),
        txt(lx + lw / 2, y0 + 178, name, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }));
      return lane;
    });
    const laneArrows = names.map((_, i) => {
      const cx = x0 + i * (lw + gap) + lw / 2;
      return svg('line', { x1: cx, y1: y0 + lh + 4, x2: cx, y2: y0 + lh + 26, stroke: PAL.mut, 'stroke-width': 1.2, 'marker-end': 'url(#ch4-arr)' });
    });
    const concat = svg('g', {},
      svg('rect', { x: 100, y: 294, width: 520, height: 30, rx: 8, fill: 'rgba(90,200,220,0.1)', stroke: PAL.act, 'stroke-width': 1.2 }),
      txt(360, 313, `concat → T × (${BP.heads}·${BP.dHead}) = T × ${BP.heads * BP.dHead}`, { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }));
    const a1 = svg('path', { d: 'M 360 324 L 360 344', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch4-arr)' });
    const wo = svg('g', {},
      svg('rect', { x: 300, y: 348, width: 120, height: 44, rx: 10, fill: 'rgba(224,168,76,0.13)', stroke: PAL.weight, 'stroke-width': 1.4 }),
      txt(360, 370, 'W_O', { size: 14, fill: PAL.weight, anchor: 'middle', mono: true }),
      txt(360, 386, `${BP.heads * BP.dHead} × ${BP.dModel}`, { size: 9.5, anchor: 'middle', mono: true }));
    const out = svg('g', {},
      svg('path', { d: 'M 422 370 L 508 370', stroke: PAL.act, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch4-arrC)' }),
      txt(516, 374, '+ residual stream', { size: 12, fill: PAL.act }));
    const note = txt(W / 2, 428, 'same total cost per layer as one full-width head', { size: 11, anchor: 'middle' });
    g.append(...stageTitle('5 · MULTI-HEAD', `× h heads in parallel  (h = ${BP.heads} in K2)`),
      ...lanes, ...laneArrows, concat, a1, wo, out, note);
    const u = (q) => {
      lanes.forEach((l, i) => {
        const t = seg(q, i * 0.08, 0.2 + i * 0.08, ease.out);
        l.setAttribute('opacity', t);
        l.setAttribute('transform', `translate(0, ${lerp(14, 0, t)})`);
        laneArrows[i].setAttribute('opacity', seg(q, 0.46, 0.58));
      });
      concat.setAttribute('opacity', seg(q, 0.54, 0.66));
      a1.setAttribute('opacity', seg(q, 0.64, 0.72));
      wo.setAttribute('opacity', seg(q, 0.68, 0.78));
      out.setAttribute('opacity', seg(q, 0.78, 0.88));
      note.setAttribute('opacity', seg(q, 0.88, 0.98));
    };
    return { g, u };
  })();

  const stages = [s0, s1, s2, s3, s4];
  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'One attention head assembling in five stages: project the stream vector into q, k, v; score every pair of tokens into a masked T-by-T matrix; softmax one row into weights that sum to one; gather a weighted blend of value vectors back into the stream; and run the whole mechanism as 64 parallel heads.',
  }, defs, stages.map((s) => s.g)));

  return (p) => {
    stages.forEach((s, i) => {
      const a = i / 5, b = (i + 1) / 5;
      const fadeIn = i === 0 ? 1 : seg(p, a - 0.012, a + 0.012);
      const fadeOut = i === 4 ? 0 : seg(p, b - 0.012, b + 0.012);
      const op = fadeIn * (1 - fadeOut);
      s.g.setAttribute('opacity', op);
      s.g.setAttribute('visibility', op < 0.01 ? 'hidden' : 'visible');
      s.u(clamp(norm(p, a + 0.008, b - 0.015)));
    });
  };
}

/* ===========================================================================
   Fig 4.2 — the shapes, end to end
   =========================================================================== */

function shapesFigure() {
  const W = 760, H = 296, midY = 130;
  const items = [];
  const box = (x, w, h, { fill, stroke, name, nameFill, dim, extra = [] }) => {
    const y = midY - h / 2;
    const g = svg('g', {},
      svg('rect', { x, y, width: w, height: h, rx: 5, fill, stroke, 'stroke-width': 1.3 }),
      name ? txt(x + w / 2, 58, name, { size: 10.5, fill: nameFill, anchor: 'middle', mono: true }) : null,
      dim ? txt(x + w / 2, 212, dim, { size: 10, anchor: 'middle', mono: true }) : null,
      ...extra);
    items.push(g);
    return g;
  };
  const op = (x, s, y = midY + 4) => { const t = txt(x, y, s, { size: 11.5, anchor: 'middle', mono: true }); items.push(t); return t; };

  const actFill = 'rgba(90,200,220,0.13)';
  const wFill = 'rgba(224,168,76,0.14)';

  box(28, 64, 124, { fill: actFill, stroke: PAL.act, name: 'X', nameFill: PAL.act, dim: 'T×7168', extra: [txt(60, midY + 4, 'X', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true })] });
  op(108, '×');
  box(122, 13, 96, { fill: wFill, stroke: PAL.weight, name: 'W_Q·K·V', nameFill: PAL.weight, dim: '7168×128' });
  op(152, '→');
  box(166, 16, 124, { fill: actFill, stroke: PAL.act, name: 'Q K V', nameFill: PAL.act, dim: 'T×128' });
  op(218, 'QKᵀ→');
  box(248, 110, 110, {
    fill: 'rgba(180,140,224,0.12)', stroke: PAL.attn, name: 'S → A', nameFill: PAL.attn, dim: 'T×T · masked',
    extra: [
      svg('path', { d: `M 250 ${midY - 53} L 356 ${midY - 53} L 356 ${midY + 53} Z`, fill: '#0B0F14', 'fill-opacity': 0.85 }),
      txt(330, midY - 26, '−∞', { size: 10, anchor: 'middle', mono: true }),
      txt(282, midY + 26, 'A', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true }),
    ],
  });
  op(384, 'AV→');
  box(414, 16, 124, { fill: actFill, stroke: PAL.act, name: 'Z', nameFill: PAL.act, dim: 'T×128' });
  const concatTxt = svg('g', {},
    txt(472, midY - 4, 'concat', { size: 10, anchor: 'middle' }),
    txt(472, midY + 10, `${BP.heads} heads`, { size: 10, anchor: 'middle' }));
  items.push(concatTxt);
  box(508, 56, 124, { fill: actFill, stroke: PAL.act, name: 'H₁‖…‖H₆₄', nameFill: PAL.act, dim: `T×${BP.heads * BP.dHead}` });
  op(578, '×');
  box(592, 44, 96, { fill: wFill, stroke: PAL.weight, name: 'W_O', nameFill: PAL.weight, dim: '8192×7168' });
  op(650, '→');
  box(666, 64, 124, { fill: actFill, stroke: PAL.act, name: '+ stream', nameFill: PAL.act, dim: 'T×7168' });

  const head = txt(24, 28, `per head · K2 numbers: d = ${BP.dModel}, d_head = ${BP.dHead}, ${BP.heads} heads (illustrative)`, { size: 11 });
  const note1 = svg('text', { x: W / 2, y: 250, 'text-anchor': 'middle', 'font-family': 'sans-serif', 'font-size': 11, fill: PAL.mut },
    svg('tspan', { fill: PAL.weight }, 'amber = learned weights, fixed shapes'),
    svg('tspan', {}, '  ·  '),
    svg('tspan', { fill: PAL.act }, 'cyan/violet = activations — T grows with context'));
  const note2 = txt(W / 2, 272, 'the only T×T object is A — the quadratic cost — and the only cached ones are K,V (ch. 09)', { size: 11, fill: PAL.tx, anchor: 'middle' });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Shape bookkeeping for one attention head: X of shape T by 7168, times weight matrices of 7168 by 128, gives Q, K, V of T by 128; scores and attention weights are the only T by T objects; outputs concatenate across 64 heads into T by 8192, and W O returns T by 7168 to the stream.',
  }, head, items, note1, note2);

  const node = figure('4.2', 'shape bookkeeping for one head. GQA shrinks the K,V boxes; MLA replaces them with a thin latent; KDA deletes the T×T object entirely.', root, { wide: true });
  track(node, (p) => {
    head.setAttribute('opacity', seg(p, 0.1, 0.16));
    items.forEach((g, i) => {
      const t = seg(p, 0.12 + i * 0.028, 0.2 + i * 0.028, ease.out);
      g.setAttribute('opacity', t);
      g.setAttribute('transform', `translate(0, ${lerp(10, 0, t)})`);
    });
    note1.setAttribute('opacity', seg(p, 0.62, 0.7));
    note2.setAttribute('opacity', seg(p, 0.66, 0.74));
  });
  return node;
}

/* ===========================================================================
   Fig 4.3 — attention with actual numbers (computed live)
   =========================================================================== */

function workedExample() {
  const TOKS = ['the', 'cat', 'sat', 'down'];
  const Q = [[1.2, 0.4], [0.2, 1.0], [1.0, 0.8], [0.6, -0.4]];
  const Km = [[1.0, 0.2], [0.4, 1.2], [0.8, 0.6], [0.2, -0.8]];
  const V = [[0.5, 1.0], [-0.3, 0.7], [0.9, 0.1], [0.4, -0.2]];

  const { S } = attention(Q, Km, V, 2);                    // live: scores + causal mask
  const Sr = S.map((r) => r.map((v) => (Number.isFinite(v) ? round(v, 2) : v)));
  const A = Sr.map((r) => softmax(r).map((v) => round(v, 2))); // softmax of the displayed scores
  const zSat = [0, 1].map((c) => round(A[2].reduce((s, a, j) => s + a * V[j][c], 0), 2));

  const f1 = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
  const f2 = (v) => (Number.isFinite(v) ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(2) : '−∞');

  const card = (titleHtml, gridEl, annotation) => el('div', {
    style: { background: 'rgba(230,237,243,0.03)', border: '1px solid rgba(230,237,243,0.1)', borderRadius: '10px', padding: '0.7rem 0.9rem 0.8rem', fontFamily: 'var(--mono)', fontSize: '0.76rem', color: 'var(--fig-tx)' },
  },
    el('div', { style: { marginBottom: '0.55rem', fontSize: '0.8rem' }, html: titleHtml }),
    gridEl,
    annotation ? el('div', { style: { marginTop: '0.55rem', fontSize: '0.68rem', color: 'var(--fig-mut)', maxWidth: '21rem', lineHeight: 1.6 }, html: annotation }) : null);

  const grid = (colHeads, data, { hlRow = -1, fmt, heat = false } = {}) => {
    const cols = data[0].length;
    const cell = (content, style) => el('div', { style: { padding: '0.18rem 0.15rem', textAlign: 'center', borderRadius: '4px', ...style } }, content);
    const kids = [];
    if (colHeads) {
      kids.push(cell('', {}));
      colHeads.forEach((h) => kids.push(cell(h, { color: 'var(--fig-mut)' })));
    }
    data.forEach((row, i) => {
      const hl = i === hlRow;
      kids.push(cell(TOKS[i], { color: hl ? 'var(--fig-attn)' : 'var(--fig-mut)', textAlign: 'right', paddingRight: '0.4rem', fontWeight: hl ? '700' : '400' }));
      row.forEach((v) => {
        const masked = !Number.isFinite(v);
        kids.push(cell(fmt(v), {
          background: masked ? '#0B0F14'
            : heat ? `rgba(180,140,224,${(0.08 + v * 0.75).toFixed(2)})`
            : hl ? 'rgba(180,140,224,0.22)' : 'rgba(90,200,220,0.07)',
          color: masked ? 'var(--fig-mut)' : hl ? 'var(--fig-ink)' : 'var(--fig-tx)',
          outline: hl ? '1px solid rgba(180,140,224,0.55)' : 'none',
        }));
      });
    });
    return el('div', { style: { display: 'grid', gridTemplateColumns: `2.9em repeat(${cols}, 3.1em)`, gap: '2px' } }, kids);
  };

  const stage1 = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.9rem' } },
    card('<span style="color:var(--fig-act)">Q</span> = X·<span style="color:var(--fig-weight)">W_Q</span>', grid(null, Q, { hlRow: 2, fmt: f1 })),
    card('<span style="color:var(--fig-act)">K</span> = X·<span style="color:var(--fig-weight)">W_K</span>', grid(null, Km, { fmt: f1 })),
    card('<span style="color:var(--fig-act)">V</span> = X·<span style="color:var(--fig-weight)">W_V</span>', grid(null, V, { fmt: f1 })));

  const stage23 = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.9rem' } },
    card('<span style="color:var(--fig-attn)">S</span> = QKᵀ/√2, masked', grid(TOKS, Sr, { hlRow: 2, fmt: f2 }),
      'e.g. row sat: q_sat·k_cat = (1.0)(0.4)+(0.8)(1.2) = 1.36; ÷√2 = 0.96'),
    card('<span style="color:var(--fig-attn)">A</span> = softmax per row', grid(TOKS, A.map((r, i) => r.map((v, j) => (j <= i ? v : -Infinity))), { hlRow: 2, fmt: f2, heat: true }),
      `row sat: e^${f2(Sr[2][0])}, e^${f2(Sr[2][1])}, e^${f2(Sr[2][2])} → normalize → ${f2(A[2][0])}, ${f2(A[2][1])}, ${f2(A[2][2])}`));

  const stage4 = el('div', {
    style: { fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--fig-ink)', background: 'rgba(180,140,224,0.1)', border: '1px solid rgba(180,140,224,0.35)', borderRadius: '10px', padding: '0.7rem 0.9rem', lineHeight: 1.7 },
    html: `z_sat = ${f2(A[2][0])}·v_the + ${f2(A[2][1])}·v_cat + ${f2(A[2][2])}·v_sat = [${f2(zSat[0])}, ${f2(zSat[1])}] → ×<span style="color:var(--fig-weight)">W_O</span> → added to sat&rsquo;s residual stream`,
  });

  const stages = [stage1, stage23, stage4];
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.4rem', overflowX: 'auto' } }, stages);
  stages.forEach((s) => { s.style.opacity = 0; s.style.transform = 'translateY(14px)'; });

  const node = figure('4.3', 'the whole mechanism, checkable by hand. The learned part is W_Q, W_K, W_V (which produced these Q, K, V); everything after is fixed arithmetic — S, A, and z here are computed live by the same code path as the figures.', wrap);
  const wins = [[0.1, 0.2], [0.22, 0.34], [0.36, 0.48]];
  track(node, (p) => {
    stages.forEach((s, i) => {
      const t = seg(p, wins[i][0], wins[i][1], ease.out);
      s.style.opacity = t;
      s.style.transform = `translateY(${lerp(14, 0, t)}px)`;
    });
  });
  return node;
}

/* ===========================================================================
   Widget — who is "it"?  (hand-set coreference-style head)
   =========================================================================== */

function coreferenceWidget() {
  const SENT = ['the', 'trophy', 'didn’t', 'fit', 'in', 'the', 'suitcase', 'because', 'it', 'was', 'too', 'big'];
  // Hand-set rows (sum to 1 over j ≤ i); everything after token i is masked.
  const HAND = {
    8:  { 1: 0.62, 6: 0.18, 7: 0.05, 8: 0.04, 3: 0.04, 2: 0.03, 0: 0.02, 4: 0.01, 5: 0.01 },              // "it"
    11: { 1: 0.44, 8: 0.26, 3: 0.10, 10: 0.06, 6: 0.05, 9: 0.03, 7: 0.02, 0: 0.01, 2: 0.01, 4: 0.01, 5: 0.01, 11: 0 }, // "big"
    3:  { 1: 0.58, 2: 0.20, 3: 0.12, 0: 0.10 },                                                            // "fit"
  };
  const weightsFor = (i) => {
    if (HAND[i]) return SENT.map((_, j) => (j <= i ? (HAND[i][j] || 0) : null));
    const r = rng(104 + i * 13);
    const raw = SENT.map((_, j) => {
      if (j > i) return null;
      let v = 0.15 + r() * 0.5;
      if (j === i) v += 0.9;               // self
      if (j === i - 1) v += 0.7;           // recency
      if (j === 1 || j === 6) v += 0.35;   // the nouns pull a little
      return v;
    });
    const tot = raw.reduce((s, v) => s + (v || 0), 0);
    return raw.map((v) => (v == null ? null : v / tot));
  };

  const buttons = SENT.map((t, i) => el('button', { class: 'tok', type: 'button', onclick: () => select(i) }, t));
  const title = el('div', { style: { fontSize: '0.78rem', color: 'var(--fig-mut)', margin: '1rem 0 0.6rem' } });
  const rows = SENT.map(() => {
    const label = el('span', { style: { fontFamily: 'var(--mono)', fontSize: '0.76rem', textAlign: 'right', color: 'var(--fig-tx)', overflow: 'hidden', textOverflow: 'ellipsis' } });
    const bar = el('div', { style: { height: '100%', width: '0%', background: 'var(--fig-attn)', borderRadius: '4px', transition: 'width 300ms var(--ease-out)' } });
    const barBox = el('div', { style: { height: '0.85rem', background: 'rgba(230,237,243,0.05)', borderRadius: '4px', overflow: 'hidden' } }, bar);
    const val = el('span', { style: { fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--fig-mut)' } });
    const row = el('div', { style: { display: 'grid', gridTemplateColumns: '5.2em 1fr 3.4em', gap: '0.6rem', alignItems: 'center', margin: '0.18rem 0' } }, label, barBox, val);
    return { row, label, bar, val };
  });

  function select(i) {
    buttons.forEach((b, j) => b.classList.toggle('sel', j === i));
    title.innerHTML = `attention weights from &ldquo;<strong style="color:var(--fig-ink)">${SENT[i]}</strong>&rdquo; (one softmax row — sums to 1; later tokens masked out)`;
    const w = weightsFor(i);
    rows.forEach((r, j) => {
      r.label.textContent = SENT[j];
      if (w[j] == null) {
        r.label.style.opacity = 0.35;
        r.bar.style.width = '0%';
        r.val.textContent = 'masked';
        r.val.style.opacity = 0.4;
      } else {
        r.label.style.opacity = 1;
        r.bar.style.width = (w[j] * 100).toFixed(1) + '%';
        r.val.textContent = '.' + String(Math.round(w[j] * 100)).padStart(2, '0');
        r.val.style.opacity = 1;
      }
    });
  }

  const body = el('div', {},
    el('div', { class: 'tokens' }, buttons),
    title,
    el('div', {}, rows.map((r) => r.row)));
  select(8);
  return widget('Who is “it”?', 'click a token — bars = attention weights from it', body, { wide: false });
}

/* ===========================================================================
   Fig 4.4b — RoPE clock hands
   =========================================================================== */

function ropeFigure() {
  const W = 720, H = 258, cy = 122, r = 70;
  const dials = [
    { cx: 130, th: 0.9, name: 'pair 1 · θ₁ fast' },
    { cx: 360, th: 0.32, name: 'pair 2 · θ₂' },
    { cx: 590, th: 0.11, name: 'pair 3 · θ₃ slow' },
  ].map((d) => {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return svg('line', {
        x1: d.cx + Math.cos(a) * (r - 4), y1: cy - Math.sin(a) * (r - 4),
        x2: d.cx + Math.cos(a) * r, y2: cy - Math.sin(a) * r, stroke: PAL.grid, 'stroke-width': 1.5,
      });
    });
    d.wedge = svg('path', { d: '', fill: 'rgba(180,140,224,0.22)', stroke: 'none' });
    d.qLine = svg('line', { x1: d.cx, y1: cy, x2: d.cx, y2: cy, stroke: PAL.attn, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    d.kLine = svg('line', { x1: d.cx, y1: cy, x2: d.cx, y2: cy, stroke: PAL.act, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    d.qTip = svg('circle', { r: 3.5, fill: PAL.attn });
    d.kTip = svg('circle', { r: 3.5, fill: PAL.act });
    d.g = svg('g', {},
      svg('circle', { cx: d.cx, cy, r, fill: 'rgba(230,237,243,0.02)', stroke: 'rgba(230,237,243,0.14)', 'stroke-width': 1.2 }),
      ticks, d.wedge, d.kLine, d.qLine, d.kTip, d.qTip,
      svg('circle', { cx: d.cx, cy, r: 3, fill: PAL.mut }),
      txt(d.cx, cy + r + 26, d.name, { size: 11, anchor: 'middle', mono: true }));
    return d;
  });

  const legend = svg('g', {},
    svg('line', { x1: 24, y1: 18, x2: 44, y2: 18, stroke: PAL.attn, 'stroke-width': 2.4 }),
    txt(50, 22, 'q at position m', { size: 11, fill: PAL.tx }),
    svg('line', { x1: 160, y1: 18, x2: 180, y2: 18, stroke: PAL.act, 'stroke-width': 2.4 }),
    txt(186, 22, 'k at position n = m − 3', { size: 11, fill: PAL.tx }));
  const readout = txt(696, 22, '', { size: 12, fill: PAL.ink, anchor: 'end', mono: true });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Three clock dials, one per rotary frequency. A violet hand for the query at position m and a cyan hand for the key at position n both rotate as you scroll, but the shaded angle between them stays constant because it depends only on m minus n.',
  }, legend, readout, dials.map((d) => d.g));

  const pt = (cx, a, rr) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  const update = (p) => {
    const m = 3 + 27 * p, n = m - 3;
    readout.textContent = `m = ${Math.round(m)} · n = ${Math.round(n)} · m−n = 3`;
    for (const d of dials) {
      const aq = m * d.th, ak = n * d.th;
      const [qx, qy] = pt(d.cx, aq, r - 10);
      const [kx, ky] = pt(d.cx, ak, r - 10);
      d.qLine.setAttribute('x2', qx); d.qLine.setAttribute('y2', qy);
      d.kLine.setAttribute('x2', kx); d.kLine.setAttribute('y2', ky);
      d.qTip.setAttribute('cx', qx); d.qTip.setAttribute('cy', qy);
      d.kTip.setAttribute('cx', kx); d.kTip.setAttribute('cy', ky);
      const [w1x, w1y] = pt(d.cx, ak, 32);
      const [w2x, w2y] = pt(d.cx, aq, 32);
      const large = 3 * d.th > Math.PI ? 1 : 0;
      d.wedge.setAttribute('d', `M ${d.cx} ${cy} L ${w1x} ${w1y} A 32 32 0 ${large} 0 ${w2x} ${w2y} Z`);
    }
  };
  update(0);

  const node = figure('4.4b',
    'RoPE as clock hands. Each (q,k) coordinate pair rotates by position × frequency — scroll and both hands spin, fast dials faster than slow ones. The shaded angle between q (at position m) and k (at position n), and therefore their dot product, depends only on m − n: attention scores encode relative offset.',
    root, { wide: true });
  track(node, update);
  return node;
}

/* ===========================================================================
   Fig 4.5 — the variant zoo, as shrinking KV-cache bars
   =========================================================================== */

function variantsFigure() {
  const W = 760, H = 330;
  const mha = BP.heads * BP.dHead * 2;   // 16,384 values per token per layer
  const gqa = 8 * BP.dHead * 2;          // 2,048 (8 KV groups)
  const mla = 576;                       // DeepSeek-style latent (512 + 64 RoPE)
  const rows = [
    { name: 'MHA', sub: '2017 · every head owns K,V', val: mha, label: `${BP.heads} heads × K,V = ${mha.toLocaleString('en-US')} values/token`, inside: true },
    { name: 'MQA / GQA', sub: 'heads share K,V sets', val: gqa, label: `8 groups → ${gqa.toLocaleString('en-US')}  (8× smaller)` },
    { name: 'MLA', sub: 'DeepSeek, K2 · one latent', val: mla, label: '~576 — decompressed on the fly' },
    { name: 'Gated MLA + KDA', sub: 'K3 · linear-attention state', val: 0, label: 'constant-size state — cost O(T), not O(T²)' },
  ];
  const x0 = 190, maxW = 420, y0 = 78, dy = 62;
  const els = rows.map((row, i) => {
    const y = y0 + i * dy;
    const w = (row.val / mha) * maxW;
    const bar = row.val > 0
      ? svg('rect', { x: x0, y: y - 12, width: 0, height: 26, rx: 4, fill: PAL.attn, 'fill-opacity': i === 0 ? 0.9 : 0.75 })
      : svg('rect', { x: x0, y: y - 12, width: 26, height: 26, rx: 4, fill: 'rgba(90,200,220,0.14)', stroke: PAL.act, 'stroke-dasharray': '3 3' });
    const label = row.inside
      ? txt(x0 + 8, y + 5, row.label, { size: 11, fill: '#10141A', mono: true })
      : txt(0, y + 5, row.label, { size: 11, fill: PAL.tx, mono: true });
    const g = svg('g', {},
      txt(24, y, row.name, { size: 12.5, fill: i === 3 ? PAL.act : PAL.ink, mono: true }),
      txt(24, y + 17, row.sub, { size: 10 }),
      bar, label);
    return { g, bar, label, w, row, y };
  });
  const head = txt(24, 30, 'per-token KV cache, one layer — what inference must hold for every past token (K2-scale dims, illustrative)', { size: 11 });
  const axis = svg('g', {},
    svg('line', { x1: x0, y1: y0 - 34, x2: x0, y2: y0 + 3 * dy + 18, stroke: PAL.grid, 'stroke-width': 1 }),
    txt(x0, y0 + 3 * dy + 36, '0', { size: 10, anchor: 'middle', mono: true }),
    txt(x0 + maxW, y0 + 3 * dy + 36, mha.toLocaleString('en-US') + ' values', { size: 10, anchor: 'end', mono: true }));
  const kdaNote = txt(24, 318, `Moonshot: up to 6.3× faster decoding at ${(K3.contextWindow / 1e6)}M-token context`, { size: 10, fill: PAL.moe });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Four attention variants as bars of per-token KV-cache size: MHA largest at 16,384 values, grouped-query attention 2,048, multi-head latent attention about 576, and K3’s KDA hybrid a constant-size state with no per-token growth.',
  }, head, axis, els.map((e) => e.g), kdaNote);

  const node = figure('4.5', 'ten years of attention variants, one motive: shrink the per-token memory inference must hold.', root, { wide: true });
  track(node, (p) => {
    head.setAttribute('opacity', seg(p, 0.1, 0.18));
    axis.setAttribute('opacity', seg(p, 0.12, 0.2));
    els.forEach((e, i) => {
      const t = seg(p, 0.14 + i * 0.08, 0.34 + i * 0.08, ease.out);
      e.g.setAttribute('opacity', t);
      if (e.row.val > 0) {
        const wNow = e.w * t;
        e.bar.setAttribute('width', wNow);
        if (!e.row.inside) e.label.setAttribute('x', x0 + Math.max(wNow, 26) + 10);
      } else {
        e.label.setAttribute('x', x0 + 36);
      }
    });
    kdaNote.setAttribute('opacity', seg(p, 0.5, 0.6));
  });
  return node;
}

/* ---- chapter assembly ----------------------------------------------------- */

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'The mechanism', title),
    prose(
      `The word &ldquo;sat&rdquo; means something different in &ldquo;the cat sat&rdquo; than in &ldquo;the verdict sat poorly&rdquo;. A token&rsquo;s stream vector must therefore be updated using the other tokens — and <strong>self-attention</strong> is the machinery. The 2017 insight (&ldquo;Attention Is All You Need&rdquo;) was that this one mechanism could replace recurrence entirely: every token consults every earlier token <em>simultaneously</em>, as a batch of matrix multiplications, which is exactly the workload GPUs are built for.`,
      `The mechanism is a <strong>soft key–value lookup</strong>. From its stream vector, each token derives three small vectors through learned projection matrices: a <strong>query</strong> (what am I looking for?), a <strong>key</strong> (what do I advertise?), and a <strong>value</strong> (what content do I hand over if selected?). Scroll through the five stages.`),
    eqLine('q = W_Q x,  k = W_K x,  v = W_V x — three learned matrices, applied to every token independently'),

    createScene({
      id: 'attention-steps',
      figure: attnSceneFigure,
      steps: [
        { n: 'STEP 1 / 5 — PROJECT', html: `<p>Every token multiplies its stream vector by W_Q, W_K, W_V. Note the sizes: queries and keys land in a small comparison space (d_head, typically 64–128 dims), not the full d_model. The projections are the learnable part — training shapes what kinds of relationships get looked up.</p>` },
        { n: 'STEP 2 / 5 — SCORE', html: `<p>Token i&rsquo;s query is dotted against every token j&rsquo;s key: one similarity score per pair, forming a T×T matrix in a single multiply, S&nbsp;=&nbsp;QKᵀ. Scores are divided by √d_head — without this, dot products grow with dimension and softmax saturates into one-hot spikes with vanishing gradients.</p><p>The upper triangle is erased with −∞: the <strong>causal mask</strong>. No token may see its future — otherwise next-token training would be trivially cheatable, and one forward pass could no longer train all T positions at once.</p>` },
        { n: 'STEP 3 / 5 — NORMALIZE', html: `<p>Each row of scores passes through <strong>softmax</strong>: exponentiate every entry, divide by the row sum. Out come attention weights — non-negative, summing to 1. A masked −∞ becomes exactly 0.</p><p>This is the &ldquo;soft&rdquo; in soft lookup: instead of retrieving the single best match, the token takes a weighted blend of all of them — which keeps the whole operation differentiable, so it can be trained by gradient descent.</p>` },
        { n: 'STEP 4 / 5 — GATHER', html: `<p>Each token&rsquo;s output is the weight-averaged sum of the value vectors of the tokens it attends to. An output projection W_O maps the result back to d_model and adds it into the residual stream. Net effect: information moved between positions — attention transports, the MLP transforms.</p>` },
        { n: 'STEP 5 / 5 — MULTI-HEAD', html: `<p>One softmax per row can only express one mixing pattern — so run the whole thing h times in parallel with independent, smaller projections. Each head (${BP.heads} of them in K2) learns its own relation: some track adjacent tokens, some resolve pronouns, some find matching brackets in code.</p><p>Heads&rsquo; outputs are concatenated and mixed by W_O. Total cost per layer stays the same as one full-width head.</p>` },
      ],
    }),
    prose(`<em>Fig. 4.1 — one attention head in five stages: project into q/k/v, score every pair, mask and normalize, gather a weighted blend, then ×${BP.heads} heads in parallel.</em>`),

    subhead('The shapes, end to end'),
    prose(
      `The five stages compress into one line of shape bookkeeping — worth internalizing, because every attention variant in Fig.&nbsp;4.5 is just an edit to these dimensions. With K2&rsquo;s numbers (d&nbsp;=&nbsp;${BP.dModel}, d_head&nbsp;=&nbsp;${BP.dHead}, ${BP.heads} heads) and a T-token context, per head:`),
    shapesFigure(),

    subhead('Attention with actual numbers'),
    prose(
      `Shapes tell you what&rsquo;s legal; numbers tell you what&rsquo;s happening. Here is the entire mechanism for four tokens at d_head&nbsp;=&nbsp;2 — small enough to check by hand, and structurally identical to the real thing at ${BP.dHead}. Follow the highlighted row: token 3 (&ldquo;sat&rdquo;) building its output.`),
    workedExample(),

    prose(
      `Here is the mechanism doing its signature trick — pronoun resolution. In &ldquo;the trophy didn&rsquo;t fit in the suitcase because <strong>it</strong> was too big&rdquo;, grammar alone cannot tell you what &ldquo;it&rdquo; refers to; world knowledge can. Click any token to see a coreference-style head&rsquo;s weights from that token.`),
    coreferenceWidget(),
    prose(`<em>Fig. 4.4 — try &ldquo;it&rdquo; (trophy vs. suitcase), then &ldquo;big&rdquo;, then &ldquo;fit&rdquo;. Values are hand-set to illustrate one coreference-style head; real models spread this across many heads and layers.</em>`),

    subhead('Where does word order come from?'),
    prose(
      `Nothing so far distinguishes &ldquo;dog bites man&rdquo; from &ldquo;man bites dog&rdquo; — attention is a set operation, blind to position. Modern models inject order with <strong>rotary position embeddings (RoPE)</strong>: before the dot product, each query and key vector is rotated, two coordinates at a time, by angles proportional to the token&rsquo;s position — clock hands spinning at many different frequencies. Rotating both q and k by their own positions leaves the dot product depending only on the <em>difference</em> of positions, so attention scores encode relative offset — which generalizes far better than absolute position and is one of the levers behind million-token contexts.`),
    term('RoPE', 'n.', 'at position <em>m</em>, rotate each (q,k) coordinate pair by <em>m</em>·θᵢ, one frequency θᵢ per pair; ⟨q_m, k_n⟩ then depends on <em>m</em>−<em>n</em> only'),
    ropeFigure(),

    subhead('The variants you’ll actually meet'),
    prose(
      `Vanilla multi-head attention has an inference problem: every past token&rsquo;s keys and values must sit in GPU memory (the KV cache — chapter 09), and at 1M tokens × ${BP.heads} heads that is crushing. The variant zoo is mostly a series of attacks on that cost:`,
      `<strong>MHA (2017)</strong> — Every head owns its own K and V. Maximum quality, maximum cache.`,
      `<strong>MQA / GQA</strong> — All heads (MQA) or groups of heads (GQA — the Llama-family default) share one K/V set: cache shrinks 8–64×, small quality cost.`,
      `<strong>MLA (DeepSeek, K2)</strong> — Multi-head Latent Attention: cache one low-rank compressed latent per token instead of full K/V, decompress on the fly. Near-MHA quality at a fraction of the memory.`,
      `<strong>K3: ${K3.attention}</strong> — A hybrid: most layers run Kimi Delta Attention — a linear-attention form whose running state is constant-size, making cost O(T) rather than O(T²) — while a subset of layers keeps full (gated) MLA for precise long-range recall. Moonshot credits KDA with up to 6.3× faster decoding at 1M-token context. K3&rsquo;s Attention Residuals additionally let a layer pull representations from arbitrary earlier layers, not just the one below.`),
    variantsFigure(),

    mathAside('full attention in one expression', `
      <p>For one head with Q, K, V ∈ ℝ^(T×d_head) and causal mask M (Mᵢⱼ = 0 if j ≤ i, −∞ otherwise):</p>
      <div class="eq">Attn(Q,K,V) = softmax(QKᵀ/√d_head + M) V</div>
      <p>Multi-head: h copies with separate projections; concatenate the T×d_head outputs into T×d_model; multiply by W_O. The √d_head keeps score variance ≈ 1 when q,k entries are ≈ unit variance. The T×T matrix is why naive attention is O(T²) in time and memory — FlashAttention computes the identical result tile-by-tile without ever materializing it, and linear attention (KDA&rsquo;s family) replaces softmax with a kernel that admits a constant-size running state.</p>`));
}
