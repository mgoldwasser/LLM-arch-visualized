/* Chapter 05 — mixture of experts. The dense SwiGLU block replaced by
   896 small experts behind a router, a click-the-token routing widget,
   and the rich-get-richer collapse that balancing schemes exist to stop. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, figure, widget, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { seg, lerp, ease, clamp, norm, rng, si } from '../core/anim.js';
import { track } from '../core/scroll.js';
import { K3 } from '../../data/k3.js';

const E = K3.experts;          // { routed: 896, active: 16, shared: 1 }
const GRID_COLS = 32, GRID_ROWS = 28; // 32 × 28 = 896

const txt = (x, y, s, { size = 11, fill = PAL.mut, anchor = 'start', mono = false, opacity } = {}) =>
  svg('text', {
    x, y, fill, 'text-anchor': anchor, 'font-size': size,
    'font-family': mono ? 'monospace' : 'sans-serif',
    ...(opacity != null ? { opacity } : {}),
  }, s);

/* ===========================================================================
   Scene — the dense SwiGLU block, replaced by 896 experts + router + shared
   =========================================================================== */

function moeSceneFigure(canvas) {
  const W = 720, H = 440;

  const defs = svg('defs', {},
    svg('marker', { id: 'ch5-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'ch5-arrM', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.moe })));

  /* -- dense stage ----------------------------------------------------------- */
  const dense = (() => {
    const g = svg('g', {});
    const title = [
      txt(24, 32, 'THE DENSE MLP BLOCK', { size: 11, fill: PAL.weight }),
      txt(24, 54, 'down( up(x) ⊙ SiLU(gate(x)) ) — SwiGLU (K3: SiTU)', { size: 12.5, fill: PAL.tx, mono: true }),
    ];
    const xg = svg('g', {},
      svg('rect', { x: 48, y: 182, width: 26, height: 88, rx: 6, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.4 }),
      txt(61, 292, 'xₜ', { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }));
    const wBox = (x, y, name, dims) => svg('g', {},
      svg('rect', { x, y, width: 130, height: 72, rx: 10, fill: 'rgba(224,168,76,0.13)', stroke: PAL.weight, 'stroke-width': 1.4 }),
      txt(x + 65, y + 34, name, { size: 14, fill: PAL.weight, anchor: 'middle', mono: true }),
      txt(x + 65, y + 56, dims, { size: 10, anchor: 'middle', mono: true }));
    const up = wBox(170, 86, 'W_up', 'd_model → d_ff');
    const gate = wBox(170, 282, 'W_gate', 'd_model → d_ff');
    const silu = svg('g', {},
      svg('rect', { x: 320, y: 300, width: 54, height: 26, rx: 8, fill: 'rgba(230,237,243,0.04)', stroke: PAL.tx, 'stroke-width': 1.1 }),
      txt(347, 317, 'SiLU', { size: 11, fill: PAL.ink, anchor: 'middle', mono: true }));
    const mult = svg('g', {},
      svg('circle', { cx: 415, cy: 225, r: 16, fill: 'rgba(230,237,243,0.03)', stroke: PAL.ink, 'stroke-width': 1.2 }),
      txt(415, 231, '⊙', { size: 15, fill: PAL.ink, anchor: 'middle', mono: true }),
      txt(415, 262, 'elementwise', { size: 10, anchor: 'middle' }));
    const down = wBox(470, 189, 'W_down', 'd_ff → d_model');
    const arrows = [
      svg('path', { d: 'M 74 208 C 120 208, 118 122, 164 122', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch5-arr)' }),
      svg('path', { d: 'M 74 244 C 120 244, 118 318, 164 318', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch5-arr)' }),
      svg('path', { d: 'M 302 122 C 370 122, 400 168, 411 204', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch5-arr)' }),
      svg('path', { d: 'M 302 313 L 314 313', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch5-arr)' }),
      svg('path', { d: 'M 376 306 C 398 300, 406 268, 412 246', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch5-arr)' }),
      svg('path', { d: 'M 433 225 L 464 225', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch5-arr)' }),
    ];
    const out = svg('g', {},
      svg('path', { d: 'M 602 225 L 646 225', stroke: PAL.act, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#ch5-arr)' }),
      txt(652, 229, '+ stream', { size: 12, fill: PAL.act }));
    const note = txt(W / 2, 420, 'three matrices — across the stack, these blocks dwarf everything else', { size: 11, anchor: 'middle' });
    g.append(...title, xg, up, gate, silu, mult, down, ...arrows, out, note);
    const u = (q) => {
      xg.setAttribute('opacity', seg(q, 0, 0.15));
      up.setAttribute('opacity', seg(q, 0.12, 0.28));
      gate.setAttribute('opacity', seg(q, 0.16, 0.32));
      arrows[0].setAttribute('opacity', seg(q, 0.24, 0.36));
      arrows[1].setAttribute('opacity', seg(q, 0.28, 0.4));
      silu.setAttribute('opacity', seg(q, 0.36, 0.48));
      arrows[3].setAttribute('opacity', seg(q, 0.36, 0.48));
      mult.setAttribute('opacity', seg(q, 0.44, 0.56));
      arrows[2].setAttribute('opacity', seg(q, 0.44, 0.56));
      arrows[4].setAttribute('opacity', seg(q, 0.48, 0.6));
      down.setAttribute('opacity', seg(q, 0.58, 0.72));
      arrows[5].setAttribute('opacity', seg(q, 0.56, 0.68));
      out.setAttribute('opacity', seg(q, 0.72, 0.84));
      note.setAttribute('opacity', seg(q, 0.84, 0.96));
    };
    return { g, u };
  })();

  /* -- sparse stage (covers scene steps 2 and 3) ----------------------------- */
  const sparse = (() => {
    const g = svg('g', {});
    const title = [
      txt(24, 32, 'THE SAME SLOT, REBUILT SPARSE', { size: 11, fill: PAL.moe }),
      txt(24, 54, `${E.routed} experts · router picks ${E.active} · 1 shared, always on`, { size: 12.5, fill: PAL.tx, mono: true }),
    ];
    // ghost of the dense block
    const ghost = svg('g', {},
      svg('rect', { x: 44, y: 76, width: 122, height: 58, rx: 10, fill: 'none', stroke: PAL.weight, 'stroke-dasharray': '4 4', 'stroke-opacity': 0.5 }),
      txt(105, 100, 'one big MLP', { size: 11, fill: PAL.weight, anchor: 'middle', opacity: 0.6 }),
      txt(105, 118, `(dense)`, { size: 10, anchor: 'middle', opacity: 0.6 }));
    const strike = svg('line', { x1: 48, y1: 130, x2: 162, y2: 80, stroke: PAL.loss, 'stroke-width': 1.6 });

    // 896-cell expert grid
    const gx = 230, gy = 64, pitch = 8;
    const cells = [];
    for (let r = 0; r < GRID_ROWS; r++) for (let c = 0; c < GRID_COLS; c++)
      cells.push(svg('rect', { x: gx + c * pitch, y: gy + r * pitch, width: pitch - 1.5, height: pitch - 1.5, rx: 1, fill: PAL.moe, 'fill-opacity': 0.16 }));
    const gridLabel = txt(gx + (GRID_COLS * pitch) / 2, 54, `${E.routed} experts, each small`, { size: 11, fill: PAL.moe, anchor: 'middle' });

    // router + fan-out
    const router = svg('g', {},
      svg('rect', { x: 56, y: 182, width: 110, height: 54, rx: 10, fill: 'rgba(76,201,168,0.1)', stroke: PAL.moe, 'stroke-width': 1.4 }),
      txt(111, 205, 'router', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true }),
      txt(111, 224, `linear: d → ${E.routed} scores`, { size: 9, anchor: 'middle', mono: true }));
    const fan = [124, 176, 228].map((y2) =>
      svg('path', { d: `M 168 209 C 198 209, 200 ${y2}, ${gx - 6} ${y2}`, stroke: PAL.moe, 'stroke-width': 1.2, fill: 'none', 'marker-end': 'url(#ch5-arrM)', 'stroke-opacity': 0.8 }));

    // shared expert
    const shared = svg('g', {},
      svg('rect', { x: 530, y: gy, width: 54, height: GRID_ROWS * pitch - 1.5, rx: 8, fill: 'rgba(76,201,168,0.13)', stroke: PAL.moe, 'stroke-width': 1.3 }),
      svg('text', {
        x: 557, y: gy + (GRID_ROWS * pitch) / 2, fill: PAL.moe, 'font-size': 11, 'font-family': 'sans-serif',
        'text-anchor': 'middle', transform: `rotate(-90, 557, ${gy + (GRID_ROWS * pitch) / 2})`,
      }, 'shared expert — always on'));

    // routing one token (step 3)
    const tok = svg('g', {},
      svg('rect', { x: 56, y: 96, width: 110, height: 30, rx: 7, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.2 }),
      txt(111, 116, '“autograd”', { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }));
    const tokArrow = svg('path', { d: 'M 111 128 L 111 176', stroke: PAL.act, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#ch5-arr)' });
    const winR = rng(77);
    const winners = [];
    const winSet = new Set();
    while (winSet.size < E.active) winSet.add(Math.floor(winR() * E.routed));
    for (const idx of winSet) {
      const r = Math.floor(idx / GRID_COLS), c = idx % GRID_COLS;
      winners.push(svg('rect', { x: gx + c * pitch - 1, y: gy + r * pitch - 1, width: pitch + 0.5, height: pitch + 0.5, rx: 1.5, fill: PAL.moe, stroke: '#10141A', 'stroke-width': 0.6 }));
    }
    const sharedGlow = svg('rect', { x: 530, y: gy, width: 54, height: GRID_ROWS * pitch - 1.5, rx: 8, fill: 'none', stroke: PAL.moe, 'stroke-width': 2.4 });
    const eq = txt(W / 2, 326, `output = shared + Σ gᵢ · expertᵢ — ${E.active} of ${E.routed} fire · under 2%`, { size: 12.5, fill: PAL.ink, anchor: 'middle', mono: true });
    const eqNote = txt(W / 2, 348, `exactly how ${si(K3.totalParams)} total parameters coexist with ~${si(K3.activeParams)} active ones`, { size: 10.5, anchor: 'middle' });

    g.append(...title, ghost, strike, ...cells, gridLabel, router, ...fan, shared,
      tok, tokArrow, ...winners, sharedGlow, eq, eqNote);

    const u = (q2, q3) => {
      ghost.setAttribute('opacity', seg(q2, 0, 0.14) * (1 - 0.45 * seg(q2, 0.2, 0.3)));
      strike.setAttribute('opacity', seg(q2, 0.1, 0.2));
      cells.forEach((c, i) => {
        const row = Math.floor(i / GRID_COLS);
        c.setAttribute('opacity', seg(q2, 0.12 + (row / GRID_ROWS) * 0.42, 0.2 + (row / GRID_ROWS) * 0.42));
      });
      gridLabel.setAttribute('opacity', seg(q2, 0.3, 0.42));
      router.setAttribute('opacity', seg(q2, 0.42, 0.56));
      fan.forEach((f, i) => f.setAttribute('opacity', seg(q2, 0.52 + i * 0.05, 0.64 + i * 0.05)));
      shared.setAttribute('opacity', seg(q2, 0.74, 0.9));

      tok.setAttribute('opacity', seg(q3, 0, 0.18));
      tokArrow.setAttribute('opacity', seg(q3, 0.12, 0.26));
      winners.forEach((w, i) => {
        const t = seg(q3, 0.2 + i * 0.024, 0.3 + i * 0.024, ease.out);
        w.setAttribute('opacity', t);
      });
      sharedGlow.setAttribute('opacity', seg(q3, 0.5, 0.62) * (0.4 + 0.6 * Math.abs(Math.sin(q3 * 3))));
      eq.setAttribute('opacity', seg(q3, 0.62, 0.76));
      eqNote.setAttribute('opacity', seg(q3, 0.74, 0.88));
    };
    return { g, u };
  })();

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The dense SwiGLU MLP block — up, gate and down matrices — is replaced by a grid of 896 small experts, a router that selects 16 of them per token, and one shared expert that always runs.',
  }, defs, dense.g, sparse.g));

  return (p) => {
    const swap = seg(p, 1 / 3 - 0.015, 1 / 3 + 0.025);
    dense.g.setAttribute('opacity', 1 - swap);
    dense.g.setAttribute('visibility', swap > 0.99 ? 'hidden' : 'visible');
    sparse.g.setAttribute('opacity', swap);
    sparse.g.setAttribute('visibility', swap < 0.01 ? 'hidden' : 'visible');
    dense.u(clamp(norm(p, 0.01, 1 / 3 - 0.02)));
    sparse.u(clamp(norm(p, 1 / 3 + 0.01, 2 / 3)), clamp(norm(p, 2 / 3 + 0.01, 0.985)));
  };
}

/* ===========================================================================
   Widget — watch the router (Fig 5.1)
   =========================================================================== */

function routerWidget() {
  const TOKS = [
    ['The', 'prose'], ['proof', 'math'], ['uses', 'prose'], ['Py', 'code'], ['Torch', 'code'],
    ['’s', 'prose'], ['autograd', 'code'], ['∑', 'math'], ['=', 'math'], ['42', 'math'],
  ];
  const CAT_LABEL = { prose: 'prose token', math: 'math token', code: 'code token' };
  const CAT_SEED = { prose: 11, math: 23, code: 37 };

  // Each flavor of token draws most winners from a few spatial clusters →
  // similar tokens light overlapping cells. Purely illustrative, but seeded
  // and deterministic, like every other figure.
  const poolFor = (cat) => {
    const r = rng(CAT_SEED[cat]);
    const set = new Set();
    for (let c = 0; c < 3; c++) {
      const cx = 3 + Math.floor(r() * (GRID_COLS - 6));
      const cyy = 3 + Math.floor(r() * (GRID_ROWS - 6));
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++)
        if (r() < 0.78) set.add((cyy + dy) * GRID_COLS + (cx + dx));
    }
    return [...set];
  };
  const pools = { prose: poolFor('prose'), math: poolFor('math'), code: poolFor('code') };

  const winnersFor = (i) => {
    const [, cat] = TOKS[i];
    const r = rng(500 + i * 37);
    const pool = pools[cat];
    const set = new Set();
    let guard = 0;
    while (set.size < 11 && guard++ < 200) set.add(pool[Math.floor(r() * pool.length)]);
    while (set.size < E.active) set.add(Math.floor(r() * E.routed));
    const gates = [...set].map(() => 0.3 + r());
    const tot = gates.reduce((s, v) => s + v, 0);
    return [...set].map((idx, k) => ({ idx, g: gates[k] / tot }));
  };

  const SW = 590, pitch = 15, cellW = 13, gx = 12, gy = 12;
  const cells = [];
  for (let r = 0; r < GRID_ROWS; r++) for (let c = 0; c < GRID_COLS; c++)
    cells.push(svg('rect', { x: gx + c * pitch, y: gy + r * pitch, width: cellW, height: cellW, rx: 2, fill: PAL.moe, 'fill-opacity': 0.1 }));
  const sharedBar = svg('g', {},
    svg('rect', { x: 512, y: gy, width: 58, height: GRID_ROWS * pitch - 2, rx: 8, fill: 'rgba(76,201,168,0.16)', stroke: PAL.moe, 'stroke-width': 1.4 }),
    svg('text', {
      x: 541, y: gy + (GRID_ROWS * pitch) / 2, fill: PAL.moe, 'font-size': 12, 'font-family': 'sans-serif',
      'text-anchor': 'middle', transform: `rotate(-90, 541, ${gy + (GRID_ROWS * pitch) / 2})`,
    }, 'shared expert — always on, for every token'));
  const gridSvg = svgRoot(SW, GRID_ROWS * pitch + 22, {
    role: 'img',
    'aria-label': 'A grid of 896 cells, one per routed expert, next to a shared-expert bar that is always on. Selecting a token lights the 16 expert cells its router chose.',
  }, cells, sharedBar);

  const buttons = TOKS.map(([t], i) => el('button', { class: 'tok', type: 'button', onclick: () => select(i) }, t));
  const header = el('div', { style: { fontSize: '0.78rem', color: 'var(--fig-mut)', margin: '0.9rem 0 0.55rem' } });

  function select(i) {
    buttons.forEach((b, j) => b.classList.toggle('sel', j === i));
    const [t, cat] = TOKS[i];
    header.innerHTML = `${E.routed} routed experts · <span style="color:var(--fig-moe)">■</span> ${E.active} selected for &ldquo;<strong style="color:var(--fig-ink)">${t}</strong>&rdquo; (${CAT_LABEL[cat]})`;
    cells.forEach((c) => { c.setAttribute('fill-opacity', 0.1); c.setAttribute('stroke', 'none'); });
    const win = winnersFor(i);
    const gMax = Math.max(...win.map((w) => w.g)), gMin = Math.min(...win.map((w) => w.g));
    for (const { idx, g } of win) {
      const c = cells[idx];
      c.setAttribute('fill-opacity', (0.55 + 0.45 * ((g - gMin) / (gMax - gMin || 1))).toFixed(2));
      c.setAttribute('stroke', PAL.moe);
      c.setAttribute('stroke-width', 1);
    }
  }

  const body = el('div', {},
    el('div', { class: 'tokens' }, buttons),
    header,
    el('div', { style: { overflowX: 'auto' } }, gridSvg),
    el('div', { class: 'w-note', style: { fontFamily: 'var(--mono)' } }, `output = shared + Σ gᵢ · expertᵢ, over the ${E.active} winners`));
  select(6); // "autograd"
  return widget('Watch the router', `click a token — each cell is one of ${E.routed} experts in one MoE layer`, body);
}

/* ===========================================================================
   Fig 5.2 — router collapse and Quantile Balancing
   =========================================================================== */

function collapseFigure() {
  const W = 720, H = 300;
  const N = 26, bw = 17, gap = 5, x0 = 74, baseY = 236, u = 64;
  const winners = new Set([4, 12, 19]);
  const rand = rng(55);
  const collapsedH = Array.from({ length: N }, (_, i) => (winners.has(i) ? 186 : 6 + rand() * 12));

  const bars = [], overlays = [];
  for (let i = 0; i < N; i++) {
    bars.push(svg('rect', { x: x0 + i * (bw + gap), y: baseY - u, width: bw, height: u, rx: 2, fill: PAL.moe, 'fill-opacity': 0.85 }));
    overlays.push(svg('rect', { x: x0 + i * (bw + gap), y: baseY - u, width: bw, height: u, rx: 2, fill: PAL.loss, 'fill-opacity': 0 }));
  }
  const axis = svg('line', { x1: x0 - 6, y1: baseY, x2: x0 + N * (bw + gap), y2: baseY, stroke: PAL.grid, 'stroke-width': 1.2 });
  const xl = txt(x0, 256, 'expert 1', { size: 10, mono: true });
  const xr = txt(x0 + N * (bw + gap) - gap, 256, `expert ${N} … of ${E.routed}`, { size: 10, anchor: 'end', mono: true });
  const yLab = txt(x0 - 6, 278, 'bar height = share of tokens routed to each expert (one layer)', { size: 10.5 });

  const t0Label = txt(x0, 40, 'expert traffic — starts uniform', { size: 11, fill: PAL.tx });
  const collapseLabel = txt(W / 2, 64, 'rich get richer: traffic → gradient → better → more traffic', { size: 11.5, fill: PAL.loss, anchor: 'middle' });
  const qbLine = svg('line', { x1: x0 - 6, y1: baseY - u, x2: x0 + N * (bw + gap), y2: baseY - u, stroke: PAL.moe, 'stroke-width': 1.2, 'stroke-dasharray': '5 4' });
  const qbLabel = txt(W / 2, 40, 'Quantile Balancing — allocation from router-score quantiles, no tuned coefficient', { size: 11.5, fill: PAL.moe, anchor: 'middle' });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Bar chart of routing traffic across experts. It starts uniform, then a few bars grow while the rest atrophy as the rich-get-richer loop takes hold, and Quantile Balancing restores a uniform allocation.',
  }, axis, bars, overlays, xl, xr, yLab, t0Label, collapseLabel, qbLine, qbLabel);

  const node = figure('5.2',
    `the routing feedback loop, and its fix. Left alone, early-lucky experts absorb the traffic and the gradient while the rest atrophy; K3&rsquo;s Quantile Balancing derives each expert&rsquo;s allocation directly from the router-score quantiles, with no hand-tuned coefficient to get wrong.`,
    root, { wide: true });

  track(node, (p) => {
    const c = seg(p, 0.14, 0.48);           // drift into collapse
    const b = seg(p, 0.58, 0.86);           // quantile balancing restores
    for (let i = 0; i < N; i++) {
      const h = lerp(lerp(u, collapsedH[i], c), u, b);
      bars[i].setAttribute('height', h);
      bars[i].setAttribute('y', baseY - h);
      bars[i].setAttribute('fill-opacity', winners.has(i) ? 0.85 : 0.85 - 0.55 * c * (1 - b));
      overlays[i].setAttribute('height', h);
      overlays[i].setAttribute('y', baseY - h);
      overlays[i].setAttribute('fill-opacity', winners.has(i) ? 0.75 * c * (1 - b) : 0);
    }
    t0Label.setAttribute('opacity', (1 - seg(p, 0.16, 0.3)));
    collapseLabel.setAttribute('opacity', c * (1 - b));
    qbLine.setAttribute('opacity', b);
    qbLabel.setAttribute('opacity', b);
  });
  return node;
}

/* ---- chapter assembly ----------------------------------------------------- */

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'Sparsity', `${title}: ${si(K3.totalParams).replace('T', '')} trillion parameters, mostly asleep`),

    createScene({
      id: 'moe-swap',
      figure: moeSceneFigure,
      steps: [
        { n: 'STEP 1 / 3 — THE DENSE BLOCK', html: `<p>First, the dense block being replaced. A modern MLP sublayer is three matrices in a gated arrangement (SwiGLU in most models; K3 uses a variant called SiTU): an up projection and a gate projection expand the token&rsquo;s vector into a wider space, the gate modulates the up path elementwise, and a down projection returns to d_model. Simple — and enormous. Across the stack, these blocks dwarf everything else.</p>` },
        { n: 'STEP 2 / 3 — THE DILEMMA', html: `<p>That creates a dilemma. Empirically, what a model can <em>know</em> tracks total parameters, but what each token <em>costs</em> tracks the parameters actually multiplied per token. A dense model buys knowledge and pays for it on every single token. Mixture of experts decouples the two: replace each layer&rsquo;s one large MLP with many small ones — <strong>experts</strong> — plus a <strong>router</strong> that picks a handful per token.</p>` },
        { n: 'STEP 3 / 3 — UNDER 2% AWAKE', html: `<p>K3 pushes this to the published extreme: ${E.active} of ${E.routed} experts fire per token, under 2% — which is exactly how ${si(K3.totalParams)} total parameters coexist with ~${si(K3.activeParams)} active ones.</p>` },
      ],
    }),
    prose(`<em>The MoE swap: one enormous gated MLP becomes ${E.routed} small experts behind a learned router, plus one shared expert that never switches off.</em>`),

    term('router', 'n.', 'a linear map from the token&rsquo;s stream vector to one affinity score per expert; the top-<em>k</em> scorers process the token, weighted by their (normalized) scores'),
    prose(
      `One refinement, inherited from DeepSeek and Kimi K2: a <strong>shared expert</strong> that processes every token unconditionally, alongside the routed winners. It soaks up the patterns all tokens need — basic syntax, common composition — freeing the routed experts to specialize. Watch the router work:`),

    routerWidget(),
    prose(`<em>Fig. 5.1 — illustrative routing. Note tokens of the same flavor (&ldquo;Py&rdquo;/&ldquo;Torch&rdquo;, math symbols) light up overlapping expert clusters — specialization is emergent, never programmed.</em>`),

    prose(
      `The catch is that routing is a learned decision feeding back into its own training data. Left alone, routers collapse: a few early-lucky experts get all the traffic, get all the gradient, get better, get more traffic — while the rest atrophy. Classic MoEs fight this with an auxiliary load-balancing loss and a hand-tuned coefficient; too weak and you collapse, too strong and routing quality suffers. K3&rsquo;s <strong>Quantile Balancing</strong> instead derives expert allocation directly from the router-score quantiles, eliminating that hyperparameter entirely — one of the things its ${K3.moeFramework} framework names.`),
    collapseFigure(),

    prose(
      `Balance also matters for a blunt hardware reason: ${E.routed} experts don&rsquo;t fit on one GPU, so they are sharded across many (<strong>expert parallelism</strong>), and every MoE layer becomes an all-to-all network exchange — tokens physically travel to whichever GPUs hold their winning experts and back. A hot expert means a hot GPU that every other device waits on. Moonshot reports training K3 with a fully balanced expert-parallel scheme — static tensor shapes, no host synchronization on the critical path — and recommends serving it on supernodes of 64+ accelerators.`),

    mathAside('routing and the balancing problem', `
      <p>With router weights W_r ∈ ℝ^(E×d), scores s = W_r x and gate values g = normalize(top-k(s)):</p>
      <div class="eq">y = E_shared(x) + Σ_{i ∈ top-k(s)} gᵢ · Eᵢ(x)</div>
      <p>Top-k is non-differentiable, but gradients still reach the router through the gᵢ weighting of selected experts. The classic auxiliary loss (Switch Transformer) is L_aux = α·E·Σᵢ fᵢ·Pᵢ, where fᵢ is the fraction of tokens dispatched to expert i and Pᵢ its mean router probability — minimized when traffic is uniform. DeepSeek-V3 dropped the loss for a per-expert bias adjusted online; K3&rsquo;s Quantile Balancing goes further, computing allocation from score quantiles with no tuned coefficient.</p>`),

    mathAside('none needed — what do experts actually specialize in?', `
      <p>Rarely the clean human categories you&rsquo;d hope for (&ldquo;the chemistry expert&rdquo;). Analyses of open MoEs find specialization is mostly at the token/pattern level — punctuation, numbers, code identifiers, particular languages, whitespace regimes — and varies by depth. The shared expert is one reason cleaner division of labor emerges at all: with common patterns handled unconditionally, routed experts stop duplicating them. Routing is decided per token per layer: the same word can visit ${E.active} different experts at layer 3 and layer 40.</p>`));
}
