/* Chapter 03 — the residual stream and one layer of the stack.
   Sticky scene: one transformer layer built up in four steps — persistent
   per-token streams, attention (tokens mix), per-token MLP, then zoom out
   to the ×61 stack. Plus two scroll-tracked figures: the y = xW atom, and
   one layer's weight matrices drawn area-proportional.                     */

import { svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, figure, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { track } from '../core/scroll.js';
import { seg, lerp, ease, rng } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

const SUB = ['₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈'];

/* ---- scene figure: one transformer layer, built in four steps ------------ */

function layerFigure(canvas) {
  const W = 720, H = 470;
  const SX = [170, 300, 430, 560];          // the four token streams
  const L = K3.blueprint.layers;

  const defs = svg('defs', {},
    ['arrA03', PAL.act, 'arrV03', PAL.attn, 'arrT03', PAL.moe, 'arrM03', PAL.mut]
      .reduce((acc, v, i, arr) => (i % 2 === 0 ? acc.concat([svg('marker',
        { id: v, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
        svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: arr[i + 1] }))]) : acc), []));

  /* --- everything inside one layer lives in gLayer (scaled in step 4) --- */

  const streams = SX.map((x) => svg('line', {
    x1: x, y1: 416, x2: x, y2: 416, stroke: PAL.act, 'stroke-width': 2, opacity: 0, 'marker-end': 'url(#arrA03)',
  }));
  const tokChips = SX.map((x, i) => svg('g', { opacity: 0 },
    svg('rect', { x: x - 27, y: 420, width: 54, height: 26, rx: 6, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
    svg('text', { x, y: 438, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 13 }, `x${SUB[i]}`)));
  const tokLabel = svg('text', { x: 24, y: 438, fill: PAL.mut, 'font-family': 'monospace', 'font-size': 11, opacity: 0 }, 'xₜ ∈ ℝᵈ');
  const streamLabel = svg('text', { x: 24, y: 70, fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 },
    'residual stream · ℝᵈ');

  const rmsChip = (x, y) => svg('g', { opacity: 0 },
    svg('rect', { x: x - 39, y: y - 11, width: 78, height: 22, rx: 6, fill: '#182029', stroke: PAL.mut, 'stroke-width': 1 }),
    svg('text', { x, y: y + 4, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 11 }, 'RMSNorm'));
  const rms1 = SX.map((x) => rmsChip(x, 372));
  const rms2 = SX.map((x) => rmsChip(x, 232));

  const attnBox = svg('rect', {
    x: 132, y: 296, width: 496, height: 46, rx: 10, fill: 'rgba(180,140,224,0.08)', stroke: PAL.attn, 'stroke-width': 1.3, opacity: 0,
  });
  const attnLabel = svg('g', { opacity: 0 },
    svg('text', { x: 124, y: 315, 'text-anchor': 'end', fill: PAL.attn, 'font-family': 'monospace', 'font-size': 13 }, 'attn'),
    svg('text', { x: 124, y: 331, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'tokens mix'));
  const mixPairs = [[0, 1], [1, 2], [0, 2], [2, 3], [1, 3]];
  const mixArrows = mixPairs.map(([a, b]) => svg('path', {
    d: `M ${SX[a]} 336 C ${(SX[a] + SX[b]) / 2} 303, ${(SX[a] + SX[b]) / 2} 303, ${SX[b] - 9} 331`,
    stroke: PAL.attn, 'stroke-width': 1.3, fill: 'none', opacity: 0, 'marker-end': 'url(#arrV03)',
  }));
  const plusNode = (x, y) => svg('g', { opacity: 0 },
    svg('circle', { cx: x, cy: y, r: 9, fill: '#182029', stroke: PAL.act, 'stroke-width': 1.4 }),
    svg('text', { x, y: y + 4, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'monospace', 'font-size': 12 }, '+'));
  const plus1 = SX.map((x) => plusNode(x, 268));
  const d1 = SX.map((x) => svg('path', {
    d: `M ${x + 26} 296 C ${x + 26} 280, ${x + 19} 273, ${x + 12} 270`,
    stroke: PAL.attn, 'stroke-width': 1.2, fill: 'none', opacity: 0, 'marker-end': 'url(#arrV03)',
  }));

  const mlpBoxes = SX.map((x) => svg('g', { opacity: 0 },
    svg('rect', { x: x - 48, y: 156, width: 96, height: 52, rx: 9, fill: 'rgba(76,201,168,0.08)', stroke: PAL.moe, 'stroke-width': 1.3 }),
    svg('text', { x, y: 178, 'text-anchor': 'middle', fill: PAL.moe, 'font-family': 'monospace', 'font-size': 13 }, 'MLP'),
    svg('text', { x, y: 196, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'per token')));
  const mlpLabel = svg('text', { x: 116, y: 186, 'text-anchor': 'end', fill: PAL.moe, 'font-family': 'monospace', 'font-size': 11, opacity: 0 },
    'up·σ·down');
  const plus2 = SX.map((x) => plusNode(x, 128));
  const d2 = SX.map((x) => svg('path', {
    d: `M ${x + 26} 156 C ${x + 26} 140, ${x + 19} 133, ${x + 12} 130`,
    stroke: PAL.moe, 'stroke-width': 1.2, fill: 'none', opacity: 0, 'marker-end': 'url(#arrT03)',
  }));

  const outline = svg('g', { opacity: 0 },
    svg('rect', { x: 110, y: 100, width: 506, height: 316, rx: 12, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '5 5' }),
    svg('text', { x: 122, y: 113, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'one transformer layer'),
    svg('text', { x: 604, y: 404, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'reads · computes · adds'));

  const gLayer = svg('g', {},
    streams, tokChips, tokLabel, streamLabel, rms1, attnBox, attnLabel, mixArrows,
    d1, plus1, rms2, mlpBoxes, mlpLabel, d2, plus2, outline);

  /* --- step 4: the ×61 stack + final pipeline (outside gLayer) --- */

  const HIL = 38;
  const slabY = (i) => 108 + i * 4.95;
  const slabs = Array.from({ length: L }, (_, i) => svg('rect', {
    x: 440, y: slabY(i), width: 180, height: 3.1, rx: 1.2,
    fill: i === HIL ? PAL.act : 'rgba(230,237,243,0.16)', opacity: 0,
  }));
  const conn = [
    svg('line', { x1: 306, y1: 198, x2: 440, y2: slabY(HIL), stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0 }),
    svg('line', { x1: 306, y1: 328, x2: 440, y2: slabY(HIL) + 3.1, stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0 }),
  ];
  const stackLabel = svg('text', { x: 530, y: 430, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    `× ${L} layers (illustrative)`);
  const pipe = svg('g', { opacity: 0 },
    svg('path', { d: 'M 530 104 L 530 84', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#arrM03)' }),
    svg('text', { x: 530, y: 68, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 12 },
      'final RMSNorm → unembedding → logits'));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'One transformer layer built up step by step: four token columns each own a persistent vertical residual-stream vector; an attention sublayer lets tokens interact and adds its delta back; a per-token MLP sublayer adds its delta back; then the view zooms out to show the block repeated 61 times, ending in a final RMSNorm, the unembedding, and logits.',
  }, defs, conn, slabs, stackLabel, pipe, gLayer));

  return (p) => {
    const tS = seg(p, 0.03, 0.15);
    streams.forEach((s, i) => {
      const ti = seg(tS, i * 0.08, 0.7 + i * 0.08, ease.out);
      s.setAttribute('y2', lerp(416, 74, ti));
      s.setAttribute('opacity', ti > 0 ? 0.95 : 0);
    });
    tokChips.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.02 + i * 0.015, 0.09 + i * 0.015)));
    tokLabel.setAttribute('opacity', seg(p, 0.03, 0.1));
    streamLabel.setAttribute('opacity', seg(p, 0.10, 0.16));
    rms1.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.16 + i * 0.01, 0.22 + i * 0.01)));

    attnBox.setAttribute('opacity', seg(p, 0.27, 0.33));
    attnLabel.setAttribute('opacity', seg(p, 0.28, 0.34));
    mixArrows.forEach((a, i) => a.setAttribute('opacity', seg(p, 0.33 + i * 0.018, 0.40 + i * 0.018)));
    d1.forEach((a) => a.setAttribute('opacity', seg(p, 0.42, 0.47)));
    plus1.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.44 + i * 0.01, 0.49 + i * 0.01)));

    rms2.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.52 + i * 0.01, 0.57 + i * 0.01)));
    mlpBoxes.forEach((b, i) => b.setAttribute('opacity', seg(p, 0.56 + i * 0.02, 0.63 + i * 0.02)));
    mlpLabel.setAttribute('opacity', seg(p, 0.57, 0.63));
    d2.forEach((a) => a.setAttribute('opacity', seg(p, 0.65, 0.70)));
    plus2.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.67 + i * 0.01, 0.72 + i * 0.01)));
    outline.setAttribute('opacity', seg(p, 0.72, 0.76));

    // step 4: zoom out — the layer shrinks to become one slab among 61
    const tZ = seg(p, 0.78, 0.90);
    const s = lerp(1, 0.42, tZ);
    const cx = lerp(363, 200, tZ), cy = lerp(245, 255, tZ);
    gLayer.setAttribute('transform', `translate(${cx - 363 * s} ${cy - 245 * s}) scale(${s})`);

    const tSt = seg(p, 0.80, 0.92);
    slabs.forEach((r, i) => r.setAttribute('opacity', seg(tSt, i / (L * 1.3), (i + 12) / (L * 1.3)) * (i === HIL ? 1 : 0.9)));
    conn.forEach((l) => l.setAttribute('opacity', seg(p, 0.88, 0.93) * 0.8));
    stackLabel.setAttribute('opacity', seg(p, 0.86, 0.92));
    pipe.setAttribute('opacity', seg(p, 0.91, 0.98));
  };
}

/* ---- Fig 3.1: the atom — y = xW, one multiply-accumulate at a time ------- */

function atomFigure() {
  const W = 720, H = 376;
  const d = 8, k = 6, J = 2;                       // shown dims; column j = 3rd
  const r = rng(11);
  const val = () => Math.round((0.1 + 0.8 * r()) * (r() < 0.5 ? -1 : 1) * 10) / 10;
  const xv = Array.from({ length: d }, val);
  const wv = Array.from({ length: d }, val);       // column j of W
  const prods = xv.map((x, i) => Math.round(x * wv[i] * 100) / 100);
  const cums = prods.reduce((acc, v) => (acc.push(Math.round(((acc[acc.length - 1] ?? 0) + v) * 100) / 100), acc), []);
  const f = (v) => (v < 0 ? '−' + Math.abs(v) : String(v));

  const XC0 = 56, XY = 150, XW = 38, XH = 28;      // x row
  const GX = 428, GY = 56, CS = 27;                // W grid
  const YY = 306;                                  // y row

  const gX = svg('g', { opacity: 0 },
    svg('text', { x: 56, y: 118, fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11.5 }, 'x — the token’s vector (1×d)'),
    svg('text', { x: 56, y: 134, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'activation — new for every token'),
    xv.map((v, i) => svg('g', {},
      svg('rect', { x: XC0 + i * XW, y: XY, width: XW - 2, height: XH, rx: 4, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
      svg('text', { x: XC0 + i * XW + (XW - 2) / 2, y: XY + 19, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 11 }, f(v)))),
    svg('text', { x: XC0 + d * XW + 6, y: XY + 19, fill: PAL.mut, 'font-family': 'monospace', 'font-size': 12 }, '…'),
    svg('text', { x: 404, y: 168, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 15 }, '×'));

  const wCells = [];
  for (let i = 0; i < d; i++) for (let j = 0; j < k; j++) {
    wCells.push(svg('rect', {
      x: GX + j * CS, y: GY + i * CS, width: CS - 2, height: CS - 2, rx: 3,
      fill: PAL.weight, 'fill-opacity': j === J ? 0.30 : 0.10,
      stroke: PAL.weight, 'stroke-opacity': j === J ? 0.9 : 0.35, 'stroke-width': 1,
    }));
  }
  const gW = svg('g', { opacity: 0 },
    svg('text', { x: GX, y: 40, fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 11.5 }, 'W — d×k · learned, frozen'),
    wCells,
    wv.map((v, i) => svg('text', {
      x: GX + J * CS + (CS - 2) / 2, y: GY + i * CS + 17, 'text-anchor': 'middle',
      fill: PAL.ink, 'font-family': 'monospace', 'font-size': 11,
    }, f(v))),
    svg('line', { x1: GX + J * CS + (CS - 2) / 2, y1: GY + d * CS - 2, x2: GX + J * CS + (CS - 2) / 2, y2: YY - 4, stroke: PAL.weight, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0.7 }));

  const yjText = svg('text', { x: GX + J * CS + (CS - 2) / 2, y: YY + 17, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 11 }, '');
  const gY = svg('g', { opacity: 0 },
    svg('text', { x: 410, y: YY + 17, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 15 }, '='),
    Array.from({ length: k }, (_, j) => svg('rect', {
      x: GX + j * CS, y: YY, width: CS - 2, height: CS - 2, rx: 3,
      fill: PAL.act, 'fill-opacity': j === J ? 0.25 : 0.08,
      stroke: PAL.act, 'stroke-opacity': j === J ? 0.9 : 0.4, 'stroke-width': 1,
    })),
    yjText,
    svg('text', { x: GX + J * CS + (CS - 2) / 2, y: YY + 44, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'monospace', 'font-size': 11 }, 'y_j'),
    svg('text', { x: GX + k * CS + 12, y: YY + 17, fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11.5 }, 'y (1×k)'));

  const xHi = svg('rect', { y: XY - 3, width: XW + 2, height: XH + 6, rx: 6, fill: 'none', stroke: PAL.ink, 'stroke-width': 1.5, opacity: 0 });
  const wHi = svg('rect', { width: CS + 2, height: CS + 2, rx: 5, fill: 'none', stroke: PAL.ink, 'stroke-width': 1.5, opacity: 0 });
  const link = svg('line', { stroke: PAL.ink, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0 });
  const ro1 = svg('text', { x: 56, y: 236, fill: PAL.tx, 'font-family': 'monospace', 'font-size': 12 }, '');
  const ro2 = svg('text', { x: 56, y: 258, fill: PAL.act, 'font-family': 'monospace', 'font-size': 12 }, '');
  const footer = svg('text', { x: 360, y: 364, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 },
    'y_j = Σᵢ xᵢ·Wᵢⱼ — one dot product per output dimension; k dot products per multiply');

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The vector–matrix product y equals x times W: a cyan row vector x multiplied against one amber column of the weight matrix W, with each multiply-accumulate pair highlighted in turn as the running sum builds up the output entry y sub j.',
  }, gX, gW, gY, link, xHi, wHi, ro1, ro2, footer);

  const node = figure('3.1',
    'the atom of the whole machine. “Training” (ch. 07) means nudging W’s entries; “inference” (ch. 09) means streaming them past the multiplier.',
    root);

  track(node, (p) => {
    gX.setAttribute('opacity', seg(p, 0.05, 0.16));
    gW.setAttribute('opacity', seg(p, 0.08, 0.18));
    gY.setAttribute('opacity', seg(p, 0.12, 0.2));

    const t = seg(p, 0.22, 0.75, ease.linear);
    const active = t > 0;
    const i = Math.min(d - 1, Math.floor(t * d));
    xHi.setAttribute('x', XC0 + i * XW - 2);
    xHi.setAttribute('opacity', active ? 1 : 0);
    wHi.setAttribute('x', GX + J * CS - 2);
    wHi.setAttribute('y', GY + i * CS - 2);
    wHi.setAttribute('opacity', active ? 1 : 0);
    link.setAttribute('x1', XC0 + i * XW + (XW - 2) / 2);
    link.setAttribute('y1', XY + XH + 4);
    link.setAttribute('x2', GX + J * CS - 5);
    link.setAttribute('y2', GY + i * CS + CS / 2 - 1);
    link.setAttribute('opacity', active ? 0.55 : 0);
    ro1.textContent = active ? `x${SUB[i]} · W${SUB[i]}ⱼ  =  ${f(xv[i])} × ${f(wv[i])}  =  ${f(prods[i])}` : '';
    ro2.textContent = active ? `y_j so far  =  ${f(cums[i])}${i === d - 1 ? '  ✓' : '  + …'}` : '';
    yjText.textContent = active ? f(cums[i]) : '';
  });

  return node;
}

/* ---- Fig 3.2: one layer's weights, area ∝ parameter count ---------------- */

function scaleFigure() {
  const bp = K3.blueprint;
  const d = bp.dModel, hh = bp.expertHidden, L = bp.layers, V = K3.vocab;
  const nExp = bp.routedExpertsK2 + 1;             // 384 routed + 1 shared
  const perExpert = 3 * d * hh;
  const attnParams = 4 * d * d;
  const moeB = (Math.floor(nExp * perExpert / 1e8) / 10).toFixed(1);   // "16.9"

  const COLS = 24, PITCH = 29, CELL = 26, X0 = 12, FY = 92;
  const scale = (CELL * CELL) / perExpert;         // px² per parameter
  const attnSide = d * Math.sqrt(scale);           // side of one d×d square ≈ 28.7px
  const stripH = 3, stripW = (V * d / L) * scale / stripH;
  const rows = Math.ceil(nExp / COLS);
  const W = 720, H = FY + rows * PITCH + 34;

  const attnSquares = ['W_Q', 'W_K', 'W_V', 'W_O'].map((name, i) => svg('g', { opacity: 0 },
    svg('rect', { x: X0 + i * (attnSide + 8), y: 30, width: attnSide, height: attnSide, rx: 3, fill: PAL.weight, 'fill-opacity': 0.55, stroke: PAL.weight, 'stroke-width': 1 }),
    svg('text', { x: X0 + i * (attnSide + 8) + attnSide / 2, y: 24, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 11 }, name)));
  const attnNote = svg('text', { x: X0 + 4 * (attnSide + 8) + 8, y: 48, fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    `all of attention: ~${(attnParams / 1e9).toFixed(2)} B`);
  const strip = svg('rect', { x: X0, y: 70, width: 0, height: stripH, fill: PAL.weight, opacity: 0.75 });
  const stripNote = svg('text', { x: X0 + stripW + 10, y: 75, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 },
    `this layer’s share of embedding + unembedding: ~${(V * d / 1e9).toFixed(2)} B ÷ ${L}`);

  const rand = rng(33);
  const base = Array.from({ length: nExp }, () => 0.35 + 0.45 * rand());
  const cells = Array.from({ length: nExp }, (_, e) => svg('rect', {
    x: X0 + (e % COLS) * PITCH, y: FY + Math.floor(e / COLS) * PITCH,
    width: CELL, height: CELL, rx: 3, fill: PAL.moe, 'fill-opacity': 0.05,
    stroke: PAL.moe, 'stroke-opacity': e === nExp - 1 ? 0.9 : 0.2, 'stroke-width': e === nExp - 1 ? 1.4 : 0.6,
  }));
  const sharedLabel = svg('text', { x: X0 + PITCH + 10, y: FY + (rows - 1) * PITCH + 17, fill: PAL.moe, 'font-family': 'monospace', 'font-size': 11.5, opacity: 0 },
    '← the 1 shared expert');
  const fieldNote = svg('text', { x: 360, y: FY + rows * PITCH + 22, 'text-anchor': 'middle', fill: PAL.moe, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    `${bp.routedExpertsK2} routed experts + 1 shared ≈ ${moeB} B — each cell one expert (3 matrices of ${d.toLocaleString('en-US')}×${hh.toLocaleString('en-US')})`);

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Every weight matrix in one transformer layer drawn with area proportional to parameter count: the four attention projection matrices are four small amber squares, the layer’s share of embedding and unembedding is a thin strip, and a large teal field of 385 cells — one per expert MLP — dominates the picture.',
  }, attnSquares, attnNote, strip, stripNote, cells, sharedLabel, fieldNote);

  const node = figure('3.2',
    `one layer, areas ∝ parameters (K2 blueprint, standard-attention approximation). Stack ${L} of these and add the embedding strip once: that’s the whole 1T model. K3 scales the teal field to ${K3.experts.routed} experts.`,
    root);

  track(node, (p) => {
    attnSquares.forEach((sq, i) => sq.setAttribute('opacity', seg(p, 0.08 + i * 0.02, 0.16 + i * 0.02)));
    attnNote.setAttribute('opacity', seg(p, 0.14, 0.22));
    strip.setAttribute('width', stripW * seg(p, 0.18, 0.26, ease.out));
    stripNote.setAttribute('opacity', seg(p, 0.2, 0.28));
    const count = Math.ceil(seg(p, 0.18, 0.70, ease.linear) * nExp);
    cells.forEach((c, e) => c.setAttribute('fill-opacity', e < count ? base[e] : 0.05));
    sharedLabel.setAttribute('opacity', seg(p, 0.70, 0.80));
    fieldNote.setAttribute('opacity', seg(p, 0.66, 0.78));
  });

  return node;
}

/* ---- chapter assembly ---------------------------------------------------- */

export function render({ id, num, title }) {
  const L = K3.blueprint.layers;
  return chapter(id,
    chapterHead(num, 'The building block', title),
    prose(
      `Everything between embedding and unembedding is a stack of identical <strong>transformer layers</strong>. The cleanest way to read the stack is to follow each token’s vector as it flows upward — a highway called the <strong>residual stream</strong>. No sublayer ever replaces this vector; each one <em>reads</em> it, computes a delta, and <em>adds</em> the delta back. Scroll — the diagram builds up one full layer.`),
    term('residual connection', 'n.', 'output = input + f(input); the sublayer learns a <em>correction</em>, not a replacement'),

    createScene({
      id: 'one-layer',
      figure: layerFigure,
      steps: [
        { n: 'STEP 1 / 4 — THE STREAM', html: `<p><strong>The stream.</strong> Each of the T tokens in context owns one vector of width d_model that persists through the whole network. Residual addition is why hundred-layer networks are trainable at all: gradients flow straight down the identity path without vanishing, and an untrained sublayer defaults to “change nothing”.</p><p>Before every sublayer the vector is rescaled by <strong>RMSNorm</strong> — divide by the root-mean-square of its entries, multiply by a learned per-dimension gain — which keeps activations in a numerically stable range regardless of depth.</p>` },
        { n: 'STEP 2 / 4 — ATTENTION', html: `<p><strong>Sublayer one: attention.</strong> The only place in the entire architecture where tokens interact. Each token reads the stream, gathers information from earlier tokens (chapter 04 is devoted to how), and adds the gathered summary back into its own stream.</p><p>Everything else in the network processes each token in isolation.</p>` },
        { n: 'STEP 3 / 4 — THE MLP', html: `<p><strong>Sublayer two: the MLP.</strong> A per-token feed-forward block: project the d_model vector up to a wider space, apply an elementwise nonlinearity, project back down. This is where the bulk of the parameters — and, per interpretability research, most stored factual knowledge — lives.</p><p>In K3 this sublayer is where the mixture-of-experts substitution happens: ${K3.experts.routed} small MLPs instead of one big one (chapter 05).</p>` },
        { n: 'STEP 4 / 4 — STACK IT', html: `<p><strong>Stack it.</strong> That two-sublayer block repeats ~${L} times (K2’s figure; K3’s is undisclosed). Depth buys iterative refinement: early layers resolve syntax and local structure, middle layers assemble entities and relations, late layers converge on the next-token decision — you can watch this by decoding the stream early (“logit lens”).</p><p>After the last layer: one final RMSNorm, the unembedding, softmax. That’s the whole forward pass.</p>` },
      ],
    }),

    prose(
      `<strong>What a weight actually does.</strong> Before stacking anything higher, pin down the atom. The model has exactly two kinds of numbers. <strong>Weights</strong> are the ${(K3.totalParams / 1e12).toFixed(1)} trillion learned constants, frozen at inference, organized almost entirely into matrices. <strong>Activations</strong> are the transient values computed per input — the residual stream vectors flowing through those matrices. Every sublayer you’ve met reduces to the same primitive: a vector–matrix product y = xW, plus a cheap elementwise nonlinearity. And each output dimension of that product is just one dot product — the token’s vector against one learned column.`),

    atomFigure(),

    prose(
      `Two readings of the same operation are worth holding simultaneously. <em>Per output:</em> each column of W is a learned feature detector, and y_j measures how strongly the token expresses feature j. <em>Per input:</em> y is a weighted combination of W’s rows — the matrix re-mixes the token’s coordinates into a new basis. A d×k matrix is nothing more than a learned linear map ℝ<sup>d</sup> → ℝ<sup>k</sup>; the entire transformer is a long composition of such maps, with just enough nonlinearity (softmax, gated activations) in between to keep the composition from collapsing into one matrix.`,
      `<strong>One layer’s weights, drawn to scale.</strong> So what does one layer of a trillion-parameter model actually <em>hold</em>? Below, every weight matrix in a single K2-blueprint layer, with area proportional to parameter count. The four attention projections that chapter 04 spends five stages on are the small squares in the corner. The expert MLPs are the field.`),

    scaleFigure(),

    prose(
      `Hold onto this picture. When chapter 04 walks through attention’s five stages, remember its machinery is the amber corner — attention decides where information flows, cheaply; the teal field is where the model’s knowledge sits, expensively. It is also chapter 10’s map: fine-tuning methods are strategies for touching as little of this picture as possible.`),

    mathAside('one layer, in two lines', `
      <p>With hₗ the stream entering layer ℓ (one row per token):</p>
      <div class="eq">a     = hₗ + Attn(RMSNorm(hₗ))
hₗ₊₁  = a  + MLP(RMSNorm(a))</div>
      <p>RMSNorm(x) = x / √(mean(x²) + ε) ⊙ g, with learned gain g ∈ ℝ<sup>d</sup>. Normalizing <em>before</em> each sublayer (“pre-norm”) rather than after is what lets very deep stacks train without careful warm-up — the residual path stays an unmodified identity.</p>`));
}
