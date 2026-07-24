/* Scroll scene — one attention head assembling itself in five stages. Scroll
   IS the timeline: this builds the SVG once and returns update(p), which sets
   every attribute idempotently from p, so scrubbing back rewinds exactly. */

import { svg, svgRoot } from '../../core/dom.js';
import { PAL } from '../../core/components.js';
import { seg, clamp, norm } from '../../core/anim.js';
import { SCENE_W, SCENE_H } from './shared.js';
import { stageProject } from './stage-project.js';
import { stageScore } from './stage-score.js';
import { stageNormalize } from './stage-normalize.js';
import { stageGather } from './stage-gather.js';
import { stageMultiHead } from './stage-multihead.js';

export function attentionScene(canvas) {
  const arrow = (id, fill) => svg('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse' },
    svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill }));
  const defs = svg('defs', {},
    arrow('attn-arr', PAL.mut),
    arrow('attn-arrA', PAL.attn),
    arrow('attn-arrC', PAL.act));

  const stages = [stageProject(), stageScore(), stageNormalize(), stageGather(), stageMultiHead()];

  canvas.append(svgRoot(SCENE_W, SCENE_H, {
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
