/* Widget — watch the router. Click a token; the cells its router chose light
   up. Tokens of the same flavor draw from overlapping clusters, so emergent
   specialization is visible without ever being programmed. */

import { el, svg, svgRoot } from '../../core/dom.js';
import { widget, PAL } from '../../core/components.js';
import { rng } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

const E = K3.experts;
const GRID_COLS = 32;                                        // 32 × 28 = 896 cells,
const GRID_ROWS = Math.ceil(E.routed / GRID_COLS);           // one per routed expert

export function routerWidget() {
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
    for (let c = 0; c < 2; c++) {
      const cx = 3 + Math.floor(r() * (GRID_COLS - 6));
      const cyy = 3 + Math.floor(r() * (GRID_ROWS - 6));
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++)
        if (r() < 0.85) set.add((cyy + dy) * GRID_COLS + (cx + dx));
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
    while (set.size < 12 && guard++ < 200) set.add(pool[Math.floor(r() * pool.length)]);
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
    'aria-label': `A grid of ${E.routed} cells, one per routed expert, next to a shared-expert bar that is always on. Selecting a token lights the ${E.active} expert cells its router chose.`,
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
