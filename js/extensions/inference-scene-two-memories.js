/* Two memories — the amber cloud of parameters (lossy, blurry recall) beside
   the cyan strip of context (exact, character for character).

   The blur is the whole argument: stdDeviation is a function of how thickly
   the queried fact is attested in the corpus, so a common fact resolves and a
   thin one never does. The caption lives in the prose that follows the scene,
   so the number is reserved here with claimFig('two-memories').

   Every SVG id in this file is prefixed `inf-cq-` — ids share one namespace
   across the whole page.                                                     */

import { svg, svgRoot } from '../core/dom.js';
import { txt, claimFig, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { seg, lerp, clamp, rng, si } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

/* How thickly each fact is attested in the training corpus. The counts are
   illustrative; the ratio is the real content. Reconstruction from a lossily
   compressed store degrades as attestation thins, so we model the residual
   blur as ∝ 1/√mentions, normalized so the thin fact sits at the maximum. */
const MENTIONS = { common: 2.4e6, rare: 3 };
const BLUR_MAX = 6.5;
const blurFor = (m) => clamp(BLUR_MAX * Math.sqrt(MENTIONS.rare / m), 0, BLUR_MAX);

const wash = (hex, a) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

const LP = { x: 40, y: 96, w: 288, h: 196 };
const RP = { x: 392, y: 96, w: 288, h: 196 };
const RC = RP.x + RP.w / 2;

/* The document a tool call would pull in — read from the spec sheet, so the
   strip contains the same numbers the rest of the book does. */
const LINES = [
  `# ${K3.name} — model card`,
  `vendor:          ${K3.vendor}`,
  `total params:    ${si(K3.totalParams)}`,
  `context:         ${si(K3.contextWindow)} tokens`,
  `experts.routed:  ${K3.experts.routed}`,
  `experts.active:  ${K3.experts.active}`,
  `weights:         ${K3.weightsFormat}`,
];
const HL = 4;                                   // the line that answers the question
const PRIOR = K3.blueprint.routedExpertsK2;     // the predecessor's count
const PRIOR_NAME = K3.blueprint.source.split(' (')[0];

function panel(p, color) {
  return svg('rect', {
    x: p.x, y: p.y, width: p.w, height: p.h, rx: 12,
    fill: wash(color, 0.05), stroke: color, 'stroke-width': 1.3,
  });
}
function kicker(x, y, s) {
  return svg('text', {
    x, y, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, 'letter-spacing': 1,
  }, s);
}
function answerBar(label, color) {
  return svg('g', { opacity: 0 },
    svg('rect', { x: 180, y: 364, width: 360, height: 46, rx: 10, fill: wash(color, 0.12), stroke: color, 'stroke-width': 1.5 }),
    txt(360, 394, label, { size: 15, fill: PAL.ink, anchor: 'middle', mono: true }));
}

function twoMemoriesFigure(canvas) {
  const W = 720, H = 470;

  /* the question, asked of one memory or the other */
  const qBar = svg('rect', { x: 150, y: 16, width: 420, height: 34, rx: 8, fill: 'rgba(107,118,131,0.10)', stroke: PAL.mut, 'stroke-width': 1 });
  const q1 = txt(360, 38, 'what does a residual connection compute?', { size: 12, fill: PAL.ink, anchor: 'middle', mono: true, opacity: 0 });
  const q2 = txt(360, 38, `how many routed experts does ${K3.name} have?`, { size: 12, fill: PAL.ink, anchor: 'middle', mono: true, opacity: 0 });

  /* left — the parameters, deliberately out of focus */
  const r = rng(11);
  const cloud = Array.from({ length: 150 }, () => svg('circle', {
    cx: (LP.x + 8 + r() * (LP.w - 16)).toFixed(1),
    cy: (LP.y + 8 + r() * (LP.h - 16)).toFixed(1),
    r: (2.5 + r() * 7).toFixed(1),
    fill: PAL.weight, opacity: (0.10 + r() * 0.28).toFixed(3),
  }));
  const recall1 = txt(LP.x + LP.w / 2, 206, 'input + f(input)', { size: 21, fill: PAL.weight, anchor: 'middle', mono: true, opacity: 0 });
  const recall2 = txt(LP.x + LP.w / 2, 206, `${PRIOR} routed experts`, { size: 20, fill: PAL.weight, anchor: 'middle', mono: true, opacity: 0 });
  const blur = svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: BLUR_MAX });
  const gRecall = svg('g', { 'clip-path': 'url(#inf-cq-lp-clip)' },
    svg('g', { filter: 'url(#inf-cq-recall)' }, cloud, recall1, recall2));
  const gLeft = svg('g', {},
    kicker(LP.x, 84, 'PARAMETERS — WHAT THE WEIGHTS REMEMBER'),
    panel(LP, PAL.weight), gRecall,
    txt(LP.x, 310, `~${si(K3.totalParams)} numbers · frozen · something you read once, a month ago`, { size: 10.5 }));

  /* right — the context window, exact by construction */
  const emptyNote = txt(RC, 200, '(empty — nothing pasted in)', { size: 12, anchor: 'middle', mono: true });
  const hlBand = svg('rect', { x: RP.x + 10, y: 122 + HL * 22 - 12, width: RP.w - 20, height: 17, rx: 3, fill: wash(PAL.act, 0.18), opacity: 0 });
  const lineEls = LINES.map((s, i) =>
    txt(RP.x + 14, 122 + i * 22, s, { size: 10, fill: i === HL ? PAL.ink : PAL.act, mono: true, opacity: 0 }));
  const gRight = svg('g', {},
    kicker(RP.x, 84, 'CONTEXT WINDOW — WHAT YOU PASTED IN'),
    panel(RP, PAL.act), emptyNote, hlBand, lineEls,
    txt(RP.x, 310, `up to ${si(K3.contextWindow)} tokens · exact, character for character`, { size: 10.5 }));

  /* routes: question → memory → answer */
  const routeW = svg('path', { d: 'M 288 52 Q 220 62 186 90', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#inf-cq-tip)', opacity: 0 });
  const toolChip = svg('g', { opacity: 0 },
    svg('rect', { x: RC - 104, y: 54, width: 208, height: 24, rx: 6, fill: 'rgba(107,118,131,0.12)', stroke: PAL.mut, 'stroke-width': 1 }),
    txt(RC, 70, 'tool call · fetch(model card)', { size: 10.5, fill: PAL.ink, anchor: 'middle', mono: true }));
  const routeC = svg('path', { d: `M ${RC} 80 L ${RC} 90`, stroke: PAL.act, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#inf-cq-tip-act)', opacity: 0 });
  const outW = svg('path', { d: 'M 186 298 Q 200 342 296 360', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#inf-cq-tip)', opacity: 0 });
  const outC = svg('path', { d: `M ${RC} 298 Q 520 342 424 360`, stroke: PAL.act, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#inf-cq-tip-act)', opacity: 0 });

  const ans1 = answerBar('output = input + f(input)', PAL.act);
  const ans2 = answerBar(`${PRIOR} routed experts`, PAL.loss);
  const ans3 = answerBar(`${K3.experts.routed} routed experts`, PAL.act);
  const v1 = txt(360, 432, 'correct — the fact is everywhere in the corpus', { size: 11, fill: PAL.act, anchor: 'middle', opacity: 0 });
  const v2 = txt(360, 432, `confabulated — that is ${PRIOR_NAME}'s number, fluently misremembered`, { size: 11, fill: PAL.loss, anchor: 'middle', opacity: 0 });
  const v3 = txt(360, 432, 'correct — read off the strip, not recalled', { size: 11, fill: PAL.act, anchor: 'middle', opacity: 0 });

  const defs = svg('defs', {},
    svg('filter', { id: 'inf-cq-recall', x: '-15%', y: '-15%', width: '130%', height: '130%' }, blur),
    svg('clipPath', { id: 'inf-cq-lp-clip' },
      svg('rect', { x: LP.x, y: LP.y, width: LP.w, height: LP.h, rx: 12 })),
    svg('marker', { id: 'inf-cq-tip', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'inf-cq-tip-act', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Two memories side by side. On the left, the parameters as a blurred amber cloud whose focus depends on how often a fact appeared in training: a common fact resolves and is answered correctly, a thinly attested one stays out of focus and the answer that emerges is wrong. On the right, the context window as a crisp cyan strip; a tool call fills it with the model card, and the same question is then answered exactly off the strip.',
  }, defs, qBar, q1, q2, routeW, toolChip, routeC, gLeft, gRight, outW, outC, ans1, ans2, ans3, v1, v2, v3));

  const bCommon = blurFor(MENTIONS.common);
  const bRare = blurFor(MENTIONS.rare);

  return (p) => {
    const dim = lerp(1, 0.3, seg(p, 0.68, 0.74));      // the weights step aside in step 3

    /* the one attribute the whole figure is about */
    const sd = lerp(lerp(BLUR_MAX, bCommon, seg(p, 0.05, 0.20)), bRare, seg(p, 0.36, 0.47));
    blur.setAttribute('stdDeviation', sd.toFixed(3));

    q1.setAttribute('opacity', seg(p, 0.02, 0.07) * (1 - seg(p, 0.34, 0.39)));
    q2.setAttribute('opacity', seg(p, 0.35, 0.40));
    routeW.setAttribute('opacity', seg(p, 0.04, 0.09) * dim);
    gLeft.setAttribute('opacity', dim);
    recall1.setAttribute('opacity', seg(p, 0.08, 0.16) * (1 - seg(p, 0.36, 0.42)));
    recall2.setAttribute('opacity', seg(p, 0.40, 0.48));

    outW.setAttribute('opacity', seg(p, 0.17, 0.22) * dim);
    ans1.setAttribute('opacity', seg(p, 0.19, 0.25) * (1 - seg(p, 0.35, 0.41)));
    v1.setAttribute('opacity', seg(p, 0.24, 0.30) * (1 - seg(p, 0.35, 0.41)));
    ans2.setAttribute('opacity', seg(p, 0.47, 0.54) * (1 - seg(p, 0.70, 0.76)));
    v2.setAttribute('opacity', seg(p, 0.53, 0.60) * (1 - seg(p, 0.70, 0.76)));

    const t3 = seg(p, 0.69, 0.75);
    toolChip.setAttribute('opacity', t3);
    routeC.setAttribute('opacity', t3);
    emptyNote.setAttribute('opacity', 1 - t3);
    lineEls.forEach((n, i) => n.setAttribute('opacity', seg(p, 0.73 + i * 0.017, 0.79 + i * 0.017)));
    hlBand.setAttribute('opacity', seg(p, 0.87, 0.92));
    outC.setAttribute('opacity', seg(p, 0.89, 0.93));
    ans3.setAttribute('opacity', seg(p, 0.90, 0.95));
    v3.setAttribute('opacity', seg(p, 0.93, 0.98));
  };
}

export function twoMemoriesScene() {
  claimFig('two-memories');
  return createScene({
    id: 'inference-two-memories',
    figure: twoMemoriesFigure,
    steps: [
      { n: 'A fact the corpus repeats', html: `<p>Ask something the training data says a million times over. The weights hold it redundantly enough that it survives the compression — the cloud pulls into focus and the answer is right. Nothing was looked up; this is recall.</p>` },
      { n: 'A fact the corpus barely mentions', html: `<p>Now ask a thinly attested one. The blur here is a function of how often the fact appeared, and at three mentions it never resolves. What comes out is fluent, specific, and wrong — ${PRIOR_NAME}'s number, the nearest thing in the neighbourhood. The model has no way to notice the difference; both answers came from the same operation.</p>` },
      { n: 'Put the text in working memory', html: `<p>A tool call fetches the model card and drops it into the context window. Nothing about the weights changed — they are frozen. But the same question now resolves off the strip, where the number sits verbatim rather than smeared across ${si(K3.totalParams)} parameters. Recollection became reading.</p>` },
    ],
    /* Three short cards would otherwise give this scene about 200px of scrub
       on a phone — the blur resolving and the tool call landing would both
       happen inside a flick. */
    stepVh: 104,
  });
}
