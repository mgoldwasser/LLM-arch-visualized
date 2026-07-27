/* F5 — what can be checked, and what cannot. Left: an answer falls into a
   string comparison that snaps green or red — both branches shown, both
   computed by the same one-line function. Right: a joke falls into a neural
   network that emits a number with a wobble on it.
   Figure number is claimed by figure(); key 'verifiable'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, figRef, PAL } from '../../core/components.js';
import { seg, ease, rng, lerp, clamp } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

const GOLD = Math.floor(999 / 7) - Math.floor(99 / 7);   // 128
const check = (a, gold) => a === gold;                   // the entire verifier
const ATTEMPTS = [GOLD, 126];                            // one of each branch
const RM_BASE = 0.83;
const WOBBLE = (() => { const r = rng(29); return Array.from({ length: 24 }, () => r() * 2 - 1); })();

export function verifiableFigure() {
  const W = 720, H = 420;
  const MID = 360;

  const heads = svg('g', { opacity: 0 },
    svg('line', { x1: MID, y1: 20, x2: MID, y2: 396, stroke: 'rgba(230,237,243,0.10)', 'stroke-width': 1 }),
    txt(28, 36, 'VERIFIABLE — math, code, logic', { size: 10.5, fill: PAL.train }),
    txt(388, 36, 'UNVERIFIABLE — jokes, poems, advice', { size: 10.5, fill: PAL.weight }));

  /* ---- left: two attempts, one verifier, both branches ---- */
  const boxY = [72, 196];
  const rowsL = ATTEMPTS.map((a, i) => {
    const y = boxY[i];
    const ok = check(a, GOLD);
    const color = ok ? PAL.train : PAL.loss;
    const chip = svg('g', { opacity: 0 },
      svg('rect', { x: 30, y, width: 92, height: 30, rx: 6, fill: 'rgba(90,200,220,0.08)', stroke: PAL.act, 'stroke-width': 1.1 }),
      txt(76, y + 20, String(a), { size: 13, fill: PAL.ink, anchor: 'middle', mono: true }),
      txt(76, y - 6, i ? 'attempt 2' : 'attempt 1', { size: 9, fill: PAL.mut, anchor: 'middle' }));
    const arrow = svg('path', { d: `M 126 ${y + 15} L 156 ${y + 15}`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#rl-ver-arr)', opacity: 0 });
    const cmp = svg('g', { opacity: 0 },
      svg('rect', { x: 160, y, width: 108, height: 30, rx: 6, fill: 'rgba(230,237,243,0.04)', stroke: PAL.mut, 'stroke-width': 1 }),
      txt(214, y + 20, `= ${GOLD} ?`, { size: 12, fill: PAL.tx, anchor: 'middle', mono: true }));
    const out = svg('g', { opacity: 0 },
      svg('rect', { x: 286, y, width: 46, height: 30, rx: 6, fill: `${color}1F`, stroke: color, 'stroke-width': 1.4 }),
      txt(309, y + 20, ok ? '1' : '0', { size: 14, fill: color, anchor: 'middle', mono: true }));
    return { chip, arrow, cmp, out, ok };
  });
  const noteL = svg('g', { opacity: 0 },
    txt(30, 288, 'A string comparison. It has no opinion,', { size: 11, fill: PAL.tx }),
    txt(30, 305, 'no taste, and nothing to flatter.', { size: 11, fill: PAL.tx }),
    txt(30, 336, 'run it for as long as it keeps paying', { size: 11.5, fill: PAL.train }));

  /* ---- right: the joke, and the learned scorer ---- */
  const joke = svg('g', { opacity: 0 },
    svg('rect', { x: 388, y: 62, width: 300, height: 44, rx: 6, fill: 'rgba(90,200,220,0.08)', stroke: PAL.act, 'stroke-width': 1.1 }),
    txt(400, 80, 'Why did the transformer cross the road?', { size: 10.5, fill: PAL.ink, mono: true }),
    txt(400, 96, 'It attended to the other side.', { size: 10.5, fill: PAL.tx, mono: true }));

  const LAYERS = [4, 5, 5, 1];
  const NX = (l) => 412 + l * 62;
  const NY = (l, i) => 152 + (LAYERS[l] === 1 ? 48 : i * 24 + (5 - LAYERS[l]) * 12);
  const edges = [];
  for (let l = 0; l < LAYERS.length - 1; l++) {
    for (let i = 0; i < LAYERS[l]; i++) {
      for (let j = 0; j < LAYERS[l + 1]; j++) {
        edges.push(svg('line', {
          x1: NX(l), y1: NY(l, i), x2: NX(l + 1), y2: NY(l + 1, j),
          stroke: PAL.weight, 'stroke-width': 0.6, opacity: 0.25,
        }));
      }
    }
  }
  const nodes = LAYERS.flatMap((n, l) => Array.from({ length: n }, (_, i) =>
    svg('circle', { cx: NX(l), cy: NY(l, i), r: 5, fill: '#151B23', stroke: PAL.weight, 'stroke-width': 1.2 })));
  const rm = svg('g', { opacity: 0 }, edges, nodes,
    txt(412, 132, 'reward model — a network trained on human rankings', { size: 9.5, fill: PAL.weight }));

  const scoreBox = svg('g', { opacity: 0 },
    svg('rect', { x: 618, y: 182, width: 74, height: 36, rx: 6, fill: 'rgba(224,168,76,0.12)', stroke: PAL.weight, 'stroke-width': 1.3 }));
  const scoreTxt = txt(655, 206, RM_BASE.toFixed(2), { size: 15, fill: PAL.weight, anchor: 'middle', mono: true, opacity: 0 });
  const wobbleBar = svg('rect', { x: 618, y: 226, width: 74, height: 4, rx: 2, fill: PAL.weight, opacity: 0 });
  const wobbleMark = svg('circle', { cx: 655, cy: 228, r: 3.5, fill: PAL.loss, opacity: 0 });

  const noteR = svg('g', { opacity: 0 },
    txt(388, 288, 'A neural network standing in for a human', { size: 11, fill: PAL.tx }),
    txt(388, 305, 'ranker: differentiable, approximate, and — as', { size: 11, fill: PAL.tx }),
    txt(388, 322, 'the next figure shows — gameable.', { size: 11, fill: PAL.tx }),
    txt(388, 352, 'crop the run before it finds the seams', { size: 11.5, fill: PAL.loss }));

  const defs = svg('defs', {},
    svg('marker', { id: 'rl-ver-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `Two columns. On the left, two candidate answers, ${ATTEMPTS[0]} and ${ATTEMPTS[1]}, each dropping into an equality test against ${GOLD} and coming out as a clean one or zero. On the right, a joke dropping into a small neural network that emits a score near ${RM_BASE} which visibly wobbles.`,
  }, defs, heads,
    rowsL.map((r) => [r.chip, r.arrow, r.cmp, r.out]), noteL,
    joke, rm, scoreBox, scoreTxt, wobbleBar, wobbleMark, noteR);

  const fig = figure(
    `The axis that decides how far you can push. On the left the reward is a comparison against a known answer — it cannot be talked into anything, so the loop can run indefinitely. On the right there is no answer key, so the reward is a second neural network trained to predict what a human would have preferred, and the thing being optimized is now a model of a judgment rather than the judgment. ${figRef('rl', 'hacking')} is what happens when you forget the difference.`,
    root, { wide: true, key: 'verifiable' });

  return pin(fig, (p) => {
    heads.setAttribute('opacity', seg(p, 0.02, 0.08));
    rowsL.forEach((r, i) => {
      const base = 0.10 + i * 0.16;
      r.chip.setAttribute('opacity', seg(p, base, base + 0.05, ease.out));
      r.arrow.setAttribute('opacity', seg(p, base + 0.04, base + 0.08));
      r.cmp.setAttribute('opacity', seg(p, base + 0.05, base + 0.10));
      r.out.setAttribute('opacity', seg(p, base + 0.09, base + 0.14, ease.out));
    });
    noteL.setAttribute('opacity', seg(p, 0.44, 0.52));

    joke.setAttribute('opacity', seg(p, 0.52, 0.58));
    rm.setAttribute('opacity', seg(p, 0.58, 0.66));
    const emit = seg(p, 0.66, 0.74);
    scoreBox.setAttribute('opacity', emit);
    scoreTxt.setAttribute('opacity', emit);
    wobbleBar.setAttribute('opacity', emit * 0.35);
    wobbleMark.setAttribute('opacity', emit);
    const w = WOBBLE[Math.floor(clamp(seg(p, 0.66, 1, ease.linear), 0, 0.999) * WOBBLE.length)];
    const score = RM_BASE + w * 0.06 * emit;
    scoreTxt.textContent = score.toFixed(2);
    wobbleMark.setAttribute('cx', lerp(655, 655 + w * 30, emit));
    noteR.setAttribute('opacity', seg(p, 0.80, 0.88));
  }, { extent: 205 });
}
