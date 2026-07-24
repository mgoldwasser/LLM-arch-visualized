/* Sticky scene — the dense SwiGLU MLP block, replaced in the same slot by
   896 small experts, a router, and one shared expert that never switches off.
   Three steps: the dense block, the dilemma, under-2%-awake. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, clamp, norm, ease, rng, si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

const E = K3.experts;                                        // { routed, active, shared }
const GRID_COLS = 32;                                        // 32 × 28 = 896 cells,
const GRID_ROWS = Math.ceil(E.routed / GRID_COLS);           // one per routed expert

function swapFigure(canvas) {
  const W = 720, H = 440;

  const defs = svg('defs', {},
    svg('marker', { id: 'moe-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'moe-arrM', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
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
      svg('path', { d: 'M 74 208 C 120 208, 118 122, 164 122', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#moe-arr)' }),
      svg('path', { d: 'M 74 244 C 120 244, 118 318, 164 318', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#moe-arr)' }),
      svg('path', { d: 'M 302 122 C 370 122, 400 168, 411 204', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#moe-arr)' }),
      svg('path', { d: 'M 302 313 L 314 313', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#moe-arr)' }),
      svg('path', { d: 'M 376 306 C 398 300, 406 268, 412 246', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#moe-arr)' }),
      svg('path', { d: 'M 433 225 L 464 225', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#moe-arr)' }),
    ];
    const out = svg('g', {},
      svg('path', { d: 'M 602 225 L 646 225', stroke: PAL.act, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#moe-arr)' }),
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
      svg('rect', { x: 44, y: 66, width: 122, height: 46, rx: 10, fill: 'none', stroke: PAL.weight, 'stroke-dasharray': '4 4', 'stroke-opacity': 0.5 }),
      txt(105, 85, 'one big MLP', { size: 11, fill: PAL.weight, anchor: 'middle', opacity: 0.6 }),
      txt(105, 101, '(dense)', { size: 10, anchor: 'middle', opacity: 0.6 }));
    const strike = svg('line', { x1: 48, y1: 108, x2: 162, y2: 70, stroke: PAL.loss, 'stroke-width': 1.6 });

    // one cell per routed expert
    const gx = 230, gy = 64, pitch = 8;
    const cells = [];
    for (let r = 0; r < GRID_ROWS; r++) for (let c = 0; c < GRID_COLS; c++)
      cells.push(svg('rect', { x: gx + c * pitch, y: gy + r * pitch, width: pitch - 1.5, height: pitch - 1.5, rx: 1, fill: PAL.moe, 'fill-opacity': 0.16 }));
    const gridLabel = txt(gx + (GRID_COLS * pitch) / 2, 306, `${E.routed} experts, each small`, { size: 11, fill: PAL.moe, anchor: 'middle' });

    // router + fan-out
    const router = svg('g', {},
      svg('rect', { x: 56, y: 182, width: 110, height: 54, rx: 10, fill: 'rgba(76,201,168,0.1)', stroke: PAL.moe, 'stroke-width': 1.4 }),
      txt(111, 205, 'router', { size: 13, fill: PAL.ink, anchor: 'middle', mono: true }),
      txt(111, 224, `linear: d → ${E.routed} scores`, { size: 9, anchor: 'middle', mono: true }));
    const fan = [124, 176, 228].map((y2) =>
      svg('path', { d: `M 168 209 C 198 209, 200 ${y2}, ${gx - 6} ${y2}`, stroke: PAL.moe, 'stroke-width': 1.2, fill: 'none', 'marker-end': 'url(#moe-arrM)', 'stroke-opacity': 0.8 }));

    // shared expert
    const shared = svg('g', {},
      svg('rect', { x: 530, y: gy, width: 54, height: GRID_ROWS * pitch - 1.5, rx: 8, fill: 'rgba(76,201,168,0.13)', stroke: PAL.moe, 'stroke-width': 1.3 }),
      svg('text', {
        x: 557, y: gy + (GRID_ROWS * pitch) / 2, fill: PAL.moe, 'font-size': 11, 'font-family': 'sans-serif',
        'text-anchor': 'middle', transform: `rotate(-90, 557, ${gy + (GRID_ROWS * pitch) / 2})`,
      }, 'shared expert — always on'));

    // routing one token (step 3)
    const tok = svg('g', {},
      svg('rect', { x: 56, y: 126, width: 110, height: 30, rx: 7, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.2 }),
      txt(111, 146, '“autograd”', { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }));
    const tokArrow = svg('path', { d: 'M 111 158 L 111 176', stroke: PAL.act, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#moe-arr)' });
    const winR = rng(77);
    const winners = [];
    const winSet = new Set();
    while (winSet.size < E.active) winSet.add(Math.floor(winR() * E.routed));
    for (const idx of winSet) {
      const r = Math.floor(idx / GRID_COLS), c = idx % GRID_COLS;
      winners.push(svg('rect', { x: gx + c * pitch - 1, y: gy + r * pitch - 1, width: pitch + 0.5, height: pitch + 0.5, rx: 1.5, fill: PAL.moe, stroke: '#10141A', 'stroke-width': 0.6 }));
    }
    const sharedGlow = svg('rect', { x: 530, y: gy, width: 54, height: GRID_ROWS * pitch - 1.5, rx: 8, fill: 'none', stroke: PAL.moe, 'stroke-width': 2.4 });
    const eq = txt(W / 2, 340, `output = shared + Σ gᵢ · expertᵢ — ${E.active} of ${E.routed} fire · under 2%`, { size: 12.5, fill: PAL.ink, anchor: 'middle', mono: true });
    const eqNote = txt(W / 2, 362, `exactly how ${si(K3.totalParams)} total parameters coexist with ~${si(K3.activeParams)} active ones`, { size: 10.5, anchor: 'middle' });

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
    'aria-label': `The dense SwiGLU MLP block — up, gate and down matrices — is replaced by a grid of ${E.routed} small experts, a router that selects ${E.active} of them per token, and one shared expert that always runs.`,
  }, defs, dense.g, sparse.g));

  return (p) => {
    const swap = seg(p, 1 / 3 - 0.015, 1 / 3 + 0.025);
    dense.g.setAttribute('opacity', 1 - swap);
    dense.g.setAttribute('visibility', swap > 0.99 ? 'hidden' : 'visible');
    sparse.g.setAttribute('opacity', swap);
    sparse.g.setAttribute('visibility', swap < 0.01 ? 'hidden' : 'visible');
    dense.u(clamp(norm(p, 0.005, 0.30)));
    sparse.u(clamp(norm(p, 1 / 3 + 0.01, 2 / 3)), clamp(norm(p, 2 / 3 + 0.01, 0.985)));
  };
}

export function swapScene() {
  return createScene({
    id: 'moe-swap',
    figure: swapFigure,
    stepVh: 95,
    steps: [
      { n: 'STEP 1 / 3 — THE DENSE BLOCK', html: `<p>First, the dense block being replaced. A modern MLP sublayer is three matrices in a gated arrangement (SwiGLU in most models; K3 uses a variant called SiTU): an up projection and a gate projection expand the token&rsquo;s vector into a wider space, the gate modulates the up path elementwise, and a down projection returns to d_model. Simple — and enormous. Across the stack, these blocks dwarf everything else.</p>` },
      { n: 'STEP 2 / 3 — THE DILEMMA', html: `<p>That creates a dilemma. Empirically, what a model can <em>know</em> tracks total parameters, but what each token <em>costs</em> tracks the parameters actually multiplied per token. A dense model buys knowledge and pays for it on every single token. Mixture of experts decouples the two: replace each layer&rsquo;s one large MLP with many small ones — <strong>experts</strong> — plus a <strong>router</strong> that picks a handful per token.</p>` },
      { n: 'STEP 3 / 3 — UNDER 2% AWAKE', html: `<p>K3 pushes this to the published extreme: ${E.active} of ${E.routed} experts fire per token, under 2% — which is exactly how ${si(K3.totalParams)} total parameters coexist with ~${si(K3.activeParams)} active ones.</p>` },
    ],
  });
}
