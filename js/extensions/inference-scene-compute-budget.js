/* Finite compute per token — the fixed stack of layers a token gets, and what
   happens to a problem that needs more sequential work than the stack has.

   Every bar in this figure is drawn in the SAME unit: one pixel-pitch per
   sequential step, so the layer stack and the required-work bars are directly
   comparable. The required work is computed from the operands, never placed by
   hand. Caption lives in the prose after the scene; number reserved here.

   All SVG ids are prefixed `inf-cq-`.                                        */

import { svg, svgRoot } from '../core/dom.js';
import { txt, claimFig, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { seg, rng } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

const L = K3.blueprint.layers;            // depth available before a token is emitted
const SRC = K3.blueprint.source.split(' (')[0];
const PITCH = 4;                          // px per sequential step — layers AND work
const BASE = 396;                         // the baseline both stacks stand on
const CEIL = BASE - L * PITCH;            // the budget ceiling, drawn to scale

/* Sequential steps in a long multiplication: one partial product per digit of
   the multiplier, four steps per digit-multiply-and-carry, then the additions.
   The unit is illustrative — what is real is that this count grows with the
   operands while the depth of the stack does not. */
const workUnits = (a, b) => {
  const da = String(a).length, db = String(b).length;
  return db * (da * 4) + (db - 1) * (da + db);
};
const EASY = [372, 8];
const HARD = [4831, 7692];
const CHAIN = 12;                         // intermediate tokens in step 3
const easyU = workUnits(...EASY);
const hardU = workUnits(...HARD);
const stepU = hardU / CHAIN;
const callU = String(HARD[0]).length + String(HARD[1]).length + 2;   // writing the call

const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const easyAns = EASY[0] * EASY[1];
const hardAns = HARD[0] * HARD[1];
/* A plausible near-miss: right magnitude, one interior digit gone. Seeded, so
   the figure renders identically every load. */
const wrongAns = (() => {
  const d = String(hardAns).split('');
  const r = rng(9);
  const i = 1 + Math.floor(r() * (d.length - 2));
  d[i] = String((Number(d[i]) + 3 + Math.floor(r() * 5)) % 10);
  return d.join('');
})();

const wash = (hex, a) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
const kicker = (x, y, s, anchor = 'start') => svg('text', {
  x, y, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 9.5,
  'letter-spacing': 1.4, 'text-anchor': anchor,
}, s);

function workBar(x, w, units, color) {
  return svg('rect', {
    x, y: BASE - units * PITCH, width: w, height: units * PITCH,
    rx: 2, fill: wash(color, 0.5), stroke: color, 'stroke-width': 1.2, opacity: 0,
  });
}
function answerChip(label, color) {
  return svg('g', { opacity: 0 },
    svg('rect', { x: 536, y: 300, width: 156, height: 48, rx: 10, fill: wash(color, 0.12), stroke: color, 'stroke-width': 1.5 }),
    txt(614, 331, label, { size: 14, fill: PAL.ink, anchor: 'middle', mono: true }));
}

function budgetFigure(canvas) {
  const W = 720, H = 460;

  /* the fixed budget: L layer bars, drawn to scale */
  const layers = Array.from({ length: L }, (_, i) => svg('rect', {
    x: 56, y: BASE - (i + 1) * PITCH, width: 132, height: PITCH - 1.4,
    rx: 1, fill: PAL.weight, opacity: 0,
  }));
  const ceilLine = svg('line', { x1: 48, y1: CEIL, x2: 692, y2: CEIL, stroke: PAL.weight, 'stroke-width': 1.2, 'stroke-dasharray': '5 5', opacity: 0 });
  const ceilTag = txt(692, CEIL - 8, 'budget ceiling — the depth runs out here', { size: 10, fill: PAL.weight, anchor: 'end', opacity: 0 });
  const baseLine = svg('line', { x1: 48, y1: BASE, x2: 692, y2: BASE, stroke: PAL.mut, 'stroke-width': 1 });
  const tokChip = svg('rect', { x: 56, y: 408, width: 132, height: 26, rx: 6, fill: wash(PAL.act, 0.12), stroke: PAL.act, 'stroke-width': 1.1 });
  const tok1 = txt(122, 425, 'the next token', { size: 11, fill: PAL.ink, anchor: 'middle', mono: true });
  const tok2 = txt(122, 425, 'twelve tokens', { size: 11, fill: PAL.ink, anchor: 'middle', mono: true, opacity: 0 });

  /* the work each version of the task demands */
  const easyBar = workBar(230, 70, easyU, PAL.act);
  const hardBar = workBar(230, 70, hardU, PAL.loss);
  const callBar = workBar(230, 70, callU, PAL.act);
  const chainBars = Array.from({ length: CHAIN }, (_, i) => workBar(230 + i * 24, 17, stepU, PAL.act));

  const easyTag = svg('g', { opacity: 0 },
    txt(312, BASE - easyU * PITCH + 4, `needs ${easyU} sequential steps`, { size: 11, fill: PAL.act }),
    txt(312, BASE - easyU * PITCH + 20, `the stack has ${L}`, { size: 10 }));
  const hardTag = svg('g', { opacity: 0 },
    txt(312, 62, `needs ${hardU} sequential steps`, { size: 11.5, fill: PAL.loss }),
    txt(312, 78, `${hardU - L} more than ${L} layers can perform, at any width`, { size: 10 }));
  const chainTag = svg('g', { opacity: 0 },
    txt(222, 340, `the same ${hardU} steps, spread over ${CHAIN} tokens`, { size: 11, fill: PAL.act }),
    txt(222, 356, `${stepU.toFixed(1)} steps each — every one inside the budget`, { size: 10 }));
  const callTag = svg('g', { opacity: 0 },
    txt(312, BASE - callU * PITCH + 4, `writes the call — ${callU} steps`, { size: 11, fill: PAL.act }),
    txt(312, BASE - callU * PITCH + 20, 'the arithmetic happens elsewhere', { size: 10 }));

  const toolBox = svg('g', { opacity: 0 },
    svg('rect', { x: 330, y: 232, width: 170, height: 58, rx: 10, fill: 'rgba(107,118,131,0.12)', stroke: PAL.mut, 'stroke-width': 1.1 }),
    txt(415, 256, 'code interpreter', { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }),
    txt(415, 274, 'exact · steps unbounded', { size: 10, anchor: 'middle', mono: true }));
  const toolIn = svg('path', { d: 'M 302 358 Q 332 336 372 294', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#inf-cq-tip2)', opacity: 0 });
  const toolOut = svg('path', { d: 'M 502 264 Q 540 274 572 296', stroke: PAL.act, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#inf-cq-tip2-act)', opacity: 0 });

  /* what gets emitted */
  const a1 = answerChip(group(easyAns), PAL.act);
  const a2 = answerChip(group(wrongAns), PAL.loss);
  const a3 = answerChip(group(hardAns), PAL.act);
  const a4 = answerChip(group(hardAns), PAL.act);
  const v1 = txt(614, 366, 'inside the budget', { size: 10, fill: PAL.act, anchor: 'middle', opacity: 0 });
  const v2 = txt(614, 366, 'depth ran out mid-algorithm', { size: 10, fill: PAL.loss, anchor: 'middle', opacity: 0 });
  const v3 = txt(614, 366, 'same work, twelve budgets', { size: 10, fill: PAL.act, anchor: 'middle', opacity: 0 });
  const v4 = txt(614, 366, 'computed outside the model', { size: 10, fill: PAL.act, anchor: 'middle', opacity: 0 });

  const prob1 = txt(692, 29, `${group(EASY[0])} × ${EASY[1]}`, { size: 14, fill: PAL.ink, anchor: 'end', mono: true, opacity: 0 });
  const prob2 = txt(692, 29, `${group(HARD[0])} × ${group(HARD[1])}`, { size: 14, fill: PAL.ink, anchor: 'end', mono: true, opacity: 0 });
  const mode1 = txt(692, 46, 'answer immediately', { size: 10.5, anchor: 'end', opacity: 0 });
  const mode2 = txt(692, 46, 'think out loud first', { size: 10.5, anchor: 'end', opacity: 0 });
  const mode3 = txt(692, 46, 'call a tool', { size: 10.5, anchor: 'end', opacity: 0 });

  const defs = svg('defs', {},
    svg('marker', { id: 'inf-cq-tip2', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'inf-cq-tip2-act', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': `A stack of ${L} layer bars stands for the fixed compute one token gets. An easy multiplication needs ${easyU} sequential steps and fits inside it. A four-digit multiplication needs ${hardU} steps, overflows the ceiling, and the emitted answer is wrong. Spread across ${CHAIN} intermediate tokens the same work becomes ${stepU.toFixed(1)} steps per token, all inside the budget, and the answer is right. Handed to a code interpreter, the model only writes the call and the budget stops mattering.`,
  }, defs, kicker(56, 26, "ONE TOKEN'S COMPUTE BUDGET"),
    txt(56, 42, `${L} layers of depth · one forward pass · illustrative ${SRC} blueprint`, { size: 10 }),
    kicker(692, 12, 'PROBLEM', 'end'), prob1, prob2, mode1, mode2, mode3,
    layers, ceilLine, ceilTag, baseLine, tokChip, tok1, tok2,
    toolBox, toolIn, toolOut,
    easyBar, hardBar, chainBars, callBar, easyTag, hardTag, chainTag, callTag,
    kicker(614, 292, 'EMITTED', 'middle'), a1, a2, a3, a4, v1, v2, v3, v4));

  return (p) => {
    layers.forEach((b, i) => b.setAttribute('opacity', seg(p, 0.01 + i * 0.0009, 0.05 + i * 0.0009) * 0.85));
    ceilLine.setAttribute('opacity', seg(p, 0.07, 0.12) * 0.7);
    ceilTag.setAttribute('opacity', seg(p, 0.09, 0.14));

    prob1.setAttribute('opacity', seg(p, 0.03, 0.08) * (1 - seg(p, 0.26, 0.30)));
    prob2.setAttribute('opacity', seg(p, 0.27, 0.32));
    mode1.setAttribute('opacity', seg(p, 0.03, 0.08) * (1 - seg(p, 0.51, 0.55)));
    mode2.setAttribute('opacity', seg(p, 0.52, 0.56) * (1 - seg(p, 0.76, 0.80)));
    mode3.setAttribute('opacity', seg(p, 0.77, 0.81));
    tok1.setAttribute('opacity', 1 - seg(p, 0.53, 0.57));
    tok2.setAttribute('opacity', seg(p, 0.54, 0.58) * (1 - seg(p, 0.78, 0.82)));

    /* step 1 — an easy problem fits */
    const outEasy = 1 - seg(p, 0.26, 0.31);
    easyBar.setAttribute('opacity', seg(p, 0.11, 0.18) * outEasy);
    easyTag.setAttribute('opacity', seg(p, 0.15, 0.21) * outEasy);
    a1.setAttribute('opacity', seg(p, 0.19, 0.24) * outEasy);
    v1.setAttribute('opacity', seg(p, 0.22, 0.27) * outEasy);

    /* step 2 — answer first, and the work overflows the ceiling */
    const outHard = 1 - seg(p, 0.51, 0.56);
    hardBar.setAttribute('opacity', seg(p, 0.29, 0.38) * outHard);
    hardTag.setAttribute('opacity', seg(p, 0.37, 0.43) * outHard);
    a2.setAttribute('opacity', seg(p, 0.42, 0.47) * outHard);
    v2.setAttribute('opacity', seg(p, 0.45, 0.50) * outHard);

    /* step 3 — the same work, spread across twelve tokens */
    const outChain = 1 - seg(p, 0.76, 0.81);
    chainBars.forEach((b, i) => b.setAttribute('opacity', seg(p, 0.56 + i * 0.011, 0.60 + i * 0.011) * outChain));
    chainTag.setAttribute('opacity', seg(p, 0.66, 0.71) * outChain);
    a3.setAttribute('opacity', seg(p, 0.70, 0.74) * outChain);
    v3.setAttribute('opacity', seg(p, 0.72, 0.76) * outChain);

    /* step 4 — hand it to a tool; the budget stops mattering */
    callBar.setAttribute('opacity', seg(p, 0.80, 0.85));
    callTag.setAttribute('opacity', seg(p, 0.82, 0.87));
    toolIn.setAttribute('opacity', seg(p, 0.84, 0.88));
    toolBox.setAttribute('opacity', seg(p, 0.85, 0.90));
    toolOut.setAttribute('opacity', seg(p, 0.89, 0.93));
    a4.setAttribute('opacity', seg(p, 0.90, 0.95));
    v4.setAttribute('opacity', seg(p, 0.93, 0.98));
  };
}

export function computeBudgetScene() {
  claimFig('compute-budget');
  return createScene({
    id: 'inference-compute-budget',
    figure: budgetFigure,
    steps: [
      { n: 'One token, one pass', html: `<p>Decode gives every token the same thing: one pass down the stack — ${L} layers of depth, then it must emit. That budget does not know what you asked. ${group(EASY[0])} × ${EASY[1]} needs ${easyU} sequential steps, so it fits with room to spare, and the right digits come out.</p>` },
      { n: 'Answer first', html: `<p>Now ${group(HARD[0])} × ${group(HARD[1])}, with the answer demanded immediately. Long multiplication needs ${hardU} strictly sequential steps and there are ${L} layers to do them in. The bar goes through the ceiling. The model still emits a token — it always emits a token — so what arrives is the right magnitude with the interior wrong.</p>` },
      { n: 'Think out loud', html: `<p>Ask for the working instead. The same ${hardU} steps are now spread over ${CHAIN} intermediate tokens, about ${stepU.toFixed(1)} steps apiece, and each one is a fresh pass down the same ${L} layers. Nothing about the model improved. It was given more budgets to spend, and the partial results live in the context window where the next pass can read them.</p>` },
      { n: 'Hand it to a tool', html: `<p>Or stop spending the budget on arithmetic at all. Writing <code>${HARD[0]}*${HARD[1]}</code> as a tool call costs about ${callU} steps; the multiplication then runs somewhere with no ceiling and the exact result comes back as text in the context window. The same move as the previous figure, for the same reason.</p>` },
    ],
  });
}
