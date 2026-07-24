/* Figure — four ways of slicing one model + one batch across a GPU fleet.
   Small multiples of the same rectangle: x = batch, y = the layer stack. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, chRef, PAL } from '../../core/components.js';
import { seg, ease, rng } from '../../core/anim.js';
import { track } from '../../core/scroll.js';

export function parallelismFigure() {
  const W = 720, H = 440;
  const GPU = [PAL.act, PAL.attn, PAL.moe, PAL.weight];   // gpu 0..3
  const rand = rng(11);

  const panels = [];
  const panelDefs = [
    {
      title: 'data parallelism', sub: 'split the batch · replicate (or ZeRO-shard) weights',
      draw(g, x0, y0, w, h) {
        for (let i = 0; i < 4; i++)
          g.append(svg('rect', { x: x0 + (w / 4) * i + 1, y: y0, width: w / 4 - 2, height: h, fill: GPU[i], opacity: 0.30, stroke: GPU[i], 'stroke-width': 1 }));
      },
    },
    {
      title: 'tensor parallelism', sub: 'split each matrix across GPUs',
      draw(g, x0, y0, w, h) {
        const layers = 5, lh = h / layers;
        for (let l = 0; l < layers; l++)
          for (let i = 0; i < 4; i++)
            g.append(svg('rect', { x: x0, y: y0 + l * lh + (lh / 4) * i + 0.5, width: w, height: lh / 4 - 1.4, fill: GPU[i], opacity: 0.30 }));
      },
    },
    {
      title: 'pipeline parallelism', sub: 'split the layer stack into stages',
      draw(g, x0, y0, w, h) {
        for (let i = 0; i < 4; i++)
          g.append(svg('rect', { x: x0, y: y0 + (h / 4) * i + 1, width: w, height: h / 4 - 2, fill: GPU[i], opacity: 0.30, stroke: GPU[i], 'stroke-width': 1 }));
      },
    },
    {
      title: 'expert parallelism', sub: 'scatter experts · route tokens cross-GPU',
      draw(g, x0, y0, w, h) {
        const cols = 8, rows = 5, cw = w / cols, ch = h / rows;
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            const gpu = Math.floor(rand() * 4);
            g.append(svg('rect', { x: x0 + c * cw + 1, y: y0 + r * ch + 1, width: cw - 2, height: ch - 2, rx: 2, fill: GPU[gpu], opacity: 0.30 }));
          }
      },
    },
  ];

  const nodes = panelDefs.map((def, i) => {
    const px = 24 + (i % 2) * 360, py = 30 + Math.floor(i / 2) * 205;
    const g = svg('g', { opacity: 0 });
    g.append(
      svg('text', { x: px, y: py - 8, fill: PAL.ink, 'font-family': 'sans-serif', 'font-size': 12, 'font-weight': 600 }, def.title),
      svg('rect', { x: px, y: py, width: 300, height: 130, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, rx: 4 }));
    def.draw(g, px, py, 300, 130);
    g.append(
      svg('text', { x: px, y: py + 146, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5 }, def.sub),
      svg('text', { x: px + 300, y: py + 146, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'batch →'),
      svg('text', { x: px - 7, y: py + 65, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, transform: `rotate(-90 ${px - 7} ${py + 65})` }, 'layers'));
    panels.push(g);
    return g;
  });

  const legend = svg('g', { opacity: 0 },
    GPU.map((c, i) => [
      svg('rect', { x: 250 + i * 60, y: H - 22, width: 10, height: 10, rx: 2, fill: c, opacity: 0.7 }),
      svg('text', { x: 264 + i * 60, y: H - 13, fill: PAL.tx, 'font-family': 'monospace', 'font-size': 10 }, `gpu ${i}`),
    ]));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Four small multiples of the same model-plus-batch rectangle, each sliced across four GPUs a different way: data parallelism slices the batch, tensor parallelism slices each matrix, pipeline parallelism slices the layer stack into stages, and expert parallelism scatters experts across GPUs.',
  }, nodes, legend);

  const fig = figure(
    `four ways to cut one model + one batch across a GPU fleet — a frontier run uses all of them at once, plus MoE&rsquo;s own expert parallelism from ${chRef('moe')}.`,
    root, { wide: true, key: 'parallelism' });

  track(fig, (p) => {
    panels.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.10 + i * 0.11, 0.20 + i * 0.11, ease.out)));
    legend.setAttribute('opacity', seg(p, 0.14, 0.22));
  });
  return fig;
}
