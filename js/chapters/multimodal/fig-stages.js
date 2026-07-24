/* The three-stage training recipe — contrastive pretraining, projector-only
   alignment, then joint instruction tuning. Green = training, amber = frozen. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, chRef, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, lerp, ease } from '../../core/anim.js';

export function stagesFigure() {
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
    svg('path', { d: `M ${p1x + 98} 144 L ${p1x + 112} 144`, stroke: PAL.loss, 'stroke-width': 1.6, 'marker-start': 'url(#mm-stages-arr)', 'marker-end': 'url(#mm-stages-arr)' }),
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
    svg('marker', { id: 'mm-stages-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.loss })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Three training stages: stage one, contrastive CLIP pretraining with both an image tower and a text tower training; stage two, only a small projector trains between a frozen vision encoder and a frozen LLM; stage three, all blocks train jointly on multimodal instruction data. Green blocks are training, amber blocks are frozen.',
  }, defs, legend, stage1, stage2, stage3);

  const node = figure(
    `the standard recipe (CLIP 2021 → LLaVA 2023): contrastive pretraining builds a semantically organized vision encoder; a cheap alignment stage trains only the projector; joint instruction tuning finishes the job. Amber = frozen, green = training — the same color grammar as ${chRef('adaptation')}.`,
    root, { key: 'stages' });

  track(node, (p) => {
    [stage1, stage2, stage3].forEach((s, i) => {
      const t = seg(p, 0.12 + i * 0.14, 0.26 + i * 0.14, ease.out);
      s.setAttribute('opacity', t);
      s.setAttribute('transform', `translate(0, ${lerp(14, 0, t)})`);
    });
  });
  return node;
}
