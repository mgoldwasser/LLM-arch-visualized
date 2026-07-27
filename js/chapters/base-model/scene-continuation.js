/* Sticky scene — what a base model actually does with "What is 2+2?".
   A prefix, one distribution over the vocabulary, a sampled token, appended,
   repeat. The punchline is what comes back: more of the worksheet.
   The number is claimed in index.js via claimFig('continuation').           */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, ease, lerp, rng } from '../../core/anim.js';
import { softmax } from '../../core/mathtools.js';
import { K3 } from '../../../data/k3.js';

/* Illustrative logits for the position after "?". The softmax over them is
   real, and so is the draw: rng(7) is the sampler, fixed so the page renders
   identically every time. */
const POOLED = K3.vocab - 5;
const CAND = [
  { t: '⏎', logit: 3.05 },
  { t: ' What', logit: 2.60 },
  { t: ' 4', logit: 2.15 },
  { t: ' A', logit: 1.40 },
  { t: ' (', logit: 1.05 },
  { t: `${POOLED.toLocaleString('en-US')} more`, logit: 2.72 },
];
const PROBS = softmax(CAND.map((c) => c.logit));
const DRAWN = (() => {
  const u = rng(7)();
  let acc = 0;
  for (let i = 0; i < PROBS.length; i++) { acc += PROBS[i]; if (u < acc) return i; }
  return PROBS.length - 1;
})();

const PROMPT = ['What', ' is', ' 2', '+', '2', '?'];
const TAIL = [
  'What is 4+4?    Show your work.',
  'Answers on the back of this sheet.',
];

function build(canvas) {
  const W = 720, H = 450;

  /* ---- the document panel ------------------------------------------------ */
  const docBox = svg('rect', {
    x: 26, y: 30, width: 668, height: 152, rx: 10,
    fill: 'rgba(230,237,243,0.03)', stroke: 'rgba(230,237,243,0.12)', 'stroke-width': 1,
  });
  const docLab = txt(40, 50, 'the document so far', { size: 10 });

  const chipW = (t) => Math.round(t.length * 7.4) + 14;
  let cx = 40;
  const chips = PROMPT.map((t) => {
    const w = chipW(t);
    const g = svg('g', { opacity: 0 },
      svg('rect', { x: cx, y: 60, width: w, height: 26, rx: 5, fill: 'rgba(230,237,243,0.06)', stroke: 'rgba(230,237,243,0.28)', 'stroke-width': 1 }),
      txt(cx + w / 2, 78, t, { size: 12, fill: PAL.tx, anchor: 'middle', mono: true }));
    cx += w + 5;
    return g;
  });
  const endX = cx;

  /* ---- the distribution panel geometry ----------------------------------- */
  const DX = 150, DSCALE = 420, ROW = (i) => 244 + i * 26;
  const flyFromX = DX + 6, flyFromY = ROW(DRAWN) - 10;

  /* the sampled token, which flies from the distribution up into the line.
     Built where p = 0 puts it, so the first paint is the p = 0 state. */
  const drawnW = chipW(CAND[DRAWN].t);
  const flyRect = svg('rect', { x: flyFromX, y: flyFromY, width: drawnW, height: 26, rx: 5, fill: 'rgba(90,200,220,0.16)', stroke: PAL.act, 'stroke-width': 1.2 });
  const flyText = txt(flyFromX + drawnW / 2, flyFromY + 18, CAND[DRAWN].t, { size: 12, fill: PAL.act, anchor: 'middle', mono: true });
  const fly = svg('g', { opacity: 0 }, flyRect, flyText);

  const tailLines = TAIL.map((s, i) =>
    txt(40, 132 + i * 22, s, { size: 12.5, fill: PAL.act, mono: true, opacity: 0 }));
  const firstTail = txt(40, 110, 'What is 3+3?', { size: 12.5, fill: PAL.act, mono: true, opacity: 0 });

  /* ---- the distribution panel -------------------------------------------- */
  const distTitle = svg('g', { opacity: 0 },
    txt(26, 214, 'p(next token | the prefix)', { size: 12, fill: PAL.ink, mono: true }),
    txt(26, 230, `softmax over all ${K3.vocab.toLocaleString('en-US')} tokens — top five, then the rest pooled`, { size: 9.5 }));

  const rows = CAND.map((c, i) => {
    const w = PROBS[i] * DSCALE;
    const isAns = i === 2;
    const col = i === DRAWN ? PAL.act : (isAns ? PAL.weight : 'rgba(107,118,131,0.55)');
    const bar = svg('rect', { x: DX, y: ROW(i) - 11, width: 0, height: 15, rx: 3, fill: col, opacity: 0.85 });
    const lab = txt(DX - 8, ROW(i), c.t, { size: 10.5, fill: i === DRAWN ? PAL.act : PAL.tx, anchor: 'end', mono: true, opacity: 0 });
    const val = txt(DX + 7, ROW(i), `${(PROBS[i] * 100).toFixed(1)}%`, { size: 10, fill: PAL.mut, mono: true, opacity: 0 });
    return { bar, lab, val, w };
  });
  const ansNote = svg('g', { opacity: 0 },
    txt(DX + rows[2].w + 46, ROW(2) - 4, 'the answer is in there —', { size: 9, fill: PAL.weight }),
    txt(DX + rows[2].w + 46, ROW(2) + 7, 'not what the document asks for', { size: 9, fill: PAL.weight }));

  /* ---- the loop ---------------------------------------------------------- */
  const LB = [
    { x: 434, y: 238, t: 'prefix' },
    { x: 578, y: 238, t: 'distribution' },
    { x: 578, y: 330, t: 'sample' },
    { x: 434, y: 330, t: 'append' },
  ];
  const BW = 112, BH = 34;
  const loopBoxes = LB.map((b) => svg('g', { opacity: 0 },
    svg('rect', { x: b.x, y: b.y, width: BW, height: BH, rx: 8, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.1 }),
    txt(b.x + BW / 2, b.y + 22, b.t, { size: 11, fill: PAL.act, anchor: 'middle' })));
  const loopArrows = [
    `M ${434 + BW + 4} 255 L ${578 - 6} 255`,
    `M ${578 + BW / 2} ${238 + BH + 4} L ${578 + BW / 2} ${330 - 6}`,
    `M ${578 - 4} 347 L ${434 + BW + 6} 347`,
    `M ${434 + BW / 2} ${330 - 4} L ${434 + BW / 2} ${238 + BH + 6}`,
  ].map((d) => svg('path', { d, stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#bm-cont-arr)', opacity: 0 }));
  const loopMid = svg('g', { opacity: 0 },
    txt(578, 296, 'one token', { size: 11, fill: PAL.ink, anchor: 'middle' }),
    txt(578, 311, 'per lap', { size: 10, anchor: 'middle' }));
  const loopLab = txt(434, 224, 'the whole operation', { size: 10, opacity: 0 });

  const punch = txt(26, 424,
    'No refusal, no failure. Answering was never the operation being performed.',
    { size: 12.5, fill: PAL.ink, opacity: 0 });

  const defs = svg('defs', {},
    svg('marker', { id: 'bm-cont-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 1 L 9 5 L 0 9 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The prompt "What is 2+2?" shown as six token chips, a bar chart of the next-token distribution in which a newline leads, the token "4" sits third, and a four-box loop labelled prefix, distribution, sample, append. The continuation that results is three more worksheet questions rather than an answer.',
  }, defs, docBox, docLab, chips, fly, firstTail, tailLines,
     distTitle, rows.map((r) => [r.bar, r.lab, r.val]), ansNote,
     loopLab, loopArrows, loopBoxes, loopMid, punch);

  canvas.append(root);

  return (p) => {
    chips.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.03 + i * 0.018, 0.09 + i * 0.018, ease.out)));

    distTitle.setAttribute('opacity', seg(p, 0.26, 0.31));
    rows.forEach((r, i) => {
      const t = seg(p, 0.29 + i * 0.018, 0.40 + i * 0.018, ease.out);
      r.bar.setAttribute('width', r.w * t);
      r.lab.setAttribute('opacity', t);
      r.val.setAttribute('opacity', t);
      r.val.setAttribute('x', DX + r.w * t + 7);
    });
    ansNote.setAttribute('opacity', seg(p, 0.42, 0.48));

    loopLab.setAttribute('opacity', seg(p, 0.52, 0.56));
    loopBoxes.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.53 + i * 0.02, 0.59 + i * 0.02)));
    loopArrows.forEach((a, i) => a.setAttribute('opacity', seg(p, 0.56 + i * 0.02, 0.62 + i * 0.02)));
    loopMid.setAttribute('opacity', seg(p, 0.62, 0.67));

    const tFly = seg(p, 0.64, 0.74, ease.inOut);
    fly.setAttribute('opacity', seg(p, 0.62, 0.66));
    const fx = lerp(flyFromX, endX, tFly), fy = lerp(flyFromY, 60, tFly);
    flyRect.setAttribute('x', fx);
    flyRect.setAttribute('y', fy);
    flyText.setAttribute('x', fx + drawnW / 2);
    flyText.setAttribute('y', fy + 18);

    firstTail.setAttribute('opacity', seg(p, 0.76, 0.81));
    tailLines.forEach((l, i) => l.setAttribute('opacity', seg(p, 0.80 + i * 0.05, 0.86 + i * 0.05)));
    punch.setAttribute('opacity', seg(p, 0.92, 0.98));
  };
}

export function continuationScene() {
  return createScene({
    id: 'bm-continuation',
    steps: [
      { n: 'STEP 1 / 4 — A PREFIX, NOT A QUESTION', html: `<p>Six tokens arrive. There is no field marked <em>question</em>, no instruction channel, no flag that separates this string from the middle of an arithmetic worksheet — because during pretraining it usually <em>was</em> the middle of an arithmetic worksheet.</p>` },
      { n: 'STEP 2 / 4 — ONE DISTRIBUTION', html: `<p>The stack runs once and produces exactly what it has produced since the first chapter: a probability for every token in the vocabulary. A newline leads. <span style="color:var(--fig-weight)">The token <code>4</code> sits third, at ${(PROBS[2] * 100).toFixed(1)}%</span> — the knowledge is present and correctly weighted for a document of this kind, which is the entire problem.</p>` },
      { n: 'STEP 3 / 4 — SAMPLE, APPEND, REPEAT', html: `<p>Draw one token from that distribution, glue it to the end of the prefix, and run the stack again on the longer string. That is the whole machine. Nothing in the lap is a question-answering step; there is no branch labelled <em>if the user asked something, answer it</em>.</p>` },
      { n: 'STEP 4 / 4 — WHAT CAME BACK', html: `<p>A few hundred laps later you have a worksheet. Run the same six tokens through Llama&nbsp;3.1&nbsp;405B base (Meta, July&nbsp;2024) and you get continuations of this shape: more questions, an answer key, a page header. The model has not declined to help. Helping is not a thing it does.</p>` },
    ],
    figure: build,
    stepVh: 92,
  });
}
