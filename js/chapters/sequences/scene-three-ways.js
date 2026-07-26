/* The sticky scene: one short sentence processed three ways — counted by an
   n-gram, threaded by a recurrence, then differentiated backwards through that
   recurrence — and finally, as a teaser, compared all-pairs in one step.
   Each stage is built once; update(p) only sets attributes from p. */

import { svg, svgRoot } from '../../core/dom.js';
import { PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, clamp, norm } from '../../core/anim.js';
import { T, NGRAM, GAMMA, sci } from './shared.js';
import { stageCount } from './stage-count.js';
import { stageRecur, stageShrink } from './stage-chain.js';
import { stageAttend } from './stage-attend.js';

function sceneFigure(canvas) {
  const W = 720, H = 462;
  const marker = (id, fill) => svg('marker', {
    id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse',
  }, svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill }));
  const defs = svg('defs', {}, marker('seq-arr-act', PAL.act), marker('seq-arr-loss', PAL.loss));
  const stages = [stageCount(), stageRecur(), stageShrink(), stageAttend()];

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'One sentence processed four ways: an n-gram sliding a three-token window across two sentences, whose count table is zero for every window containing an unfamiliar word; a recurrent network threading a hidden state left to right, one sequential step per token; the gradient travelling back along that chain and shrinking geometrically with distance; and the same sentence as a triangular all-pairs grid computed in a single parallel step.',
  }, defs, stages.map((s) => s.g)));

  const n = stages.length;
  return (p) => {
    stages.forEach((s, i) => {
      const a = i / n, b = (i + 1) / n;
      const fadeIn = i === 0 ? 1 : seg(p, a - 0.012, a + 0.012);
      const fadeOut = i === n - 1 ? 0 : seg(p, b - 0.012, b + 0.012);
      const op = fadeIn * (1 - fadeOut);
      s.g.setAttribute('opacity', op);
      s.g.setAttribute('visibility', op < 0.01 ? 'hidden' : 'visible');
      s.u(clamp(norm(p, a + 0.008, b - 0.015)));
    });
  };
}

export function threeWaysScene() {
  return createScene({
    id: 'sequences-three-ways',
    figure: sceneFigure,
    steps: [
      { n: 'STEP 1 / 4 — COUNT', html: `<p>The n-gram model keeps a fixed window — ${NGRAM} tokens here — and estimates the next-token probability by counting how often that window was followed by each token in a corpus. Slide the window along sentence A and every count is healthy.</p><p>Sentence B is the same English with one ordinary noun swapped in. Every window that touches it has a count of zero, and a ratio with zero on top is not a small probability, it is no probability at all. Smoothing patches the arithmetic; it cannot supply the missing knowledge, because nothing the table learned about &ldquo;the cat sat&rdquo; is connected in any way to &ldquo;the wombat sat&rdquo;.</p>` },
      { n: 'STEP 2 / 4 — RECUR', html: `<p>The recurrent network replaces the window with a single vector. Read one token, fold it into the hidden state, move on: hₜ = σ(W_h hₜ₋₁ + W_x xₜ). One pair of matrices, reused at every position, handles a sequence of any length — and because the state is a learned dense vector rather than an index, similar words produce similar states, so evidence is shared instead of siloed.</p><p>Watch the bar underneath fill one segment at a time. That is not decoration: hₜ is a function of hₜ₋₁, so the steps happen in order or not at all.</p>` },
      { n: 'STEP 3 / 4 — SHRINK', html: `<p>Now run training backwards. The gradient of the loss with respect to an early hidden state is a product of one Jacobian per step in between. Products of numbers below 1 shrink geometrically; products of numbers above 1 blow up.</p><p>At a per-step norm of ${GAMMA.toFixed(2)}, the correction reaching ${T} steps back is already down to ${(GAMMA ** T).toFixed(2)} of full strength; a hundred steps back it is ${sci(GAMMA ** 100)}, far beneath the floating-point noise floor. The long-range dependency is exactly the one that cannot be learned.</p>` },
      { n: 'STEP 4 / 4 — ATTEND', html: `<p>Here is the alternative, stated as a shape. Instead of passing information along a chain, compute the compatibility of every position with every earlier position at once: one triangular grid, one matrix multiply, no ordering constraint inside it.</p><p>The dependency chain of length T collapses to a single step. The price is the square: T² pairs of work instead of T. On hardware built to perform enormous matrix multiplies in parallel, that is a trade worth making — and it is the subject of the machine chapters that follow.</p>` },
    ],
  });
}
