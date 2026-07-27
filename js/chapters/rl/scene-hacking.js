/* F4 — reward hacking. Optimize against a learned judge and for a few hundred
   updates everything works; then the judge's score keeps climbing while the
   thing it is supposed to measure falls off a cliff. The divergence point is
   found by scanning the generated series. Caption lives in the prose that
   follows the scene in index.js, so the number is claimed here. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, claimFig, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, ease, lerp, clamp } from '../../core/anim.js';

const N = 61;
const UPDATES = 900;

const rmScore = (t) => 0.30 + 0.66 * (1 - Math.exp(-3.2 * t));
const trueQuality = (t) => {
  const rise = 1 - Math.exp(-7 * t);
  const fall = 1 / (1 + Math.exp((t - 0.42) * 14));
  return 0.30 + 0.45 * rise * fall - 0.22 * (1 - fall);
};

const SERIES = Array.from({ length: N }, (_, i) => i / (N - 1));
const TRUE = SERIES.map(trueQuality);
/* Derived, not chosen: the first sample where the two series start to disagree. */
const DIV = TRUE.findIndex((v, i) => i > 0 && v < TRUE[i - 1]);
const DIV_T = SERIES[DIV];
const DIV_UPDATE = Math.round(DIV_T * UPDATES);

const ADVERSARIAL = [
  { text: '"the the the the the the"', rm: 0.97 },
  { text: '"Why did the the the the"', rm: 0.96 },
  { text: '"[[[ ]]] joke joke joke"', rm: 0.98 },
];

function hackingFigure(canvas) {
  const W = 720, H = 460;
  const X0 = 60, X1 = 416, Y0 = 306, Y1 = 62;

  const xAt = (t) => X0 + t * (X1 - X0);
  const yAt = (q) => Y0 - clamp(q) * (Y0 - Y1);
  const rmPts = SERIES.map((t) => [xAt(t), yAt(rmScore(t))]);
  const tqPts = SERIES.map((t) => [xAt(t), yAt(trueQuality(t))]);

  const upTo = (pts, t) => {
    const f = clamp(t) * (N - 1), last = Math.floor(f), s = f - last;
    const out = pts.slice(0, last + 1).map(([x, y], k) => `${k ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    if (last < N - 1) {
      const [ax, ay] = pts[last], [bx, by] = pts[last + 1];
      out.push(`L ${lerp(ax, bx, s).toFixed(1)} ${lerp(ay, by, s).toFixed(1)}`);
    }
    return out.join(' ');
  };

  const grid = svg('g', {},
    ...[0, 0.25, 0.5, 0.75, 1].map((q) => svg('line', { x1: X0, y1: yAt(q), x2: X1, y2: yAt(q), stroke: PAL.grid, 'stroke-width': 1 })),
    ...[0, 0.25, 0.5, 0.75, 1].map((q) => txt(X0 - 8, yAt(q) + 4, q.toFixed(2), { size: 9, anchor: 'end', mono: true })),
    ...[0, 300, 600, 900].map((u) => txt(xAt(u / UPDATES), Y0 + 20, String(u), { size: 9.5, anchor: 'middle', mono: true })),
    txt((X0 + X1) / 2, Y0 + 40, 'RL updates against the reward model', { size: 10.5, fill: PAL.tx, anchor: 'middle' }),
    txt(X0, 40, 'reward-model score', { size: 10.5, fill: PAL.weight }),
    txt(X1, 40, 'joke quality, rated blind', { size: 10.5, fill: PAL.act, anchor: 'end' }));

  /* The shaded gap is a fixed shape — the region between the two curves after
     they part — so it is built once and only its opacity animates. */
  const gapD = [
    rmPts.slice(DIV).map(([x, y], k) => `${k ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' '),
    tqPts.slice(DIV).reverse().map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' '),
    'Z',
  ].join(' ');
  const gap = svg('path', { d: gapD, fill: PAL.loss, opacity: 0 });
  const rmLine = svg('path', { d: upTo(rmPts, 0), fill: 'none', stroke: PAL.weight, 'stroke-width': 2 });
  const tqLine = svg('path', { d: upTo(tqPts, 0), fill: 'none', stroke: PAL.act, 'stroke-width': 2 });

  const crop = svg('g', { opacity: 0 },
    svg('line', { x1: xAt(DIV_T), y1: Y1 - 6, x2: xAt(DIV_T), y2: Y0, stroke: PAL.loss, 'stroke-width': 1.3, 'stroke-dasharray': '4 4' }),
    txt(xAt(DIV_T) + 8, Y1 + 8, `crop the run here — update ≈ ${DIV_UPDATE}`, { size: 10, fill: PAL.loss }));

  /* right panel: what the top-scoring output actually is */
  const cards = ADVERSARIAL.map((a, i) => {
    const y = 76 + i * 92;
    return svg('g', { opacity: 0 },
      svg('rect', { x: 448, y, width: 252, height: 74, rx: 7, fill: 'rgba(240,120,80,0.07)', stroke: PAL.loss, 'stroke-width': 1.1 }),
      txt(462, y + 22, `top-scoring output, attempt ${i + 1}`, { size: 9, fill: PAL.mut }),
      txt(462, y + 42, a.text, { size: 11.5, fill: PAL.ink, mono: true }),
      txt(462, y + 62, `reward model ${a.rm.toFixed(2)}`, { size: 10, fill: PAL.weight, mono: true }),
      txt(688, y + 62, 'human 0.00', { size: 10, fill: PAL.act, anchor: 'end', mono: true }));
  });
  const counterLabel = (k) => `adversarial inputs found: ${k}`;
  const counter = txt(448, 388, counterLabel(0), { size: 11, fill: PAL.loss, mono: true, opacity: 0 });
  const closing = svg('g', { opacity: 0 },
    txt(60, 388, 'Patch one and the next appears. The space of', { size: 11, fill: PAL.tx }),
    txt(60, 405, 'inputs that fool the judge is unbounded, and the', { size: 11, fill: PAL.tx }),
    txt(60, 422, 'policy searches it far faster than you can fence it.', { size: 11, fill: PAL.tx }));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': `A plot of two series over ${UPDATES} reinforcement-learning updates. The reward model's score climbs steadily to about ${rmScore(1).toFixed(2)}; blind human ratings of the same outputs climb with it for roughly ${DIV_UPDATE} updates, then fall away to about ${trueQuality(1).toFixed(2)}. The widening gap is shaded, and the top-scoring outputs beside it are degenerate strings.`,
  }, grid, gap, rmLine, tqLine, crop, cards, counter, closing));

  return (p) => {
    /* The first step draws only as far as the divergence; the second carries
       the rest of the run. Both pieces are pure functions of p, and they meet
       at the step boundary. */
    const t = p < 0.25
      ? DIV_T * seg(p, 0.04, 0.22, ease.linear)
      : DIV_T + (1 - DIV_T) * seg(p, 0.27, 0.46, ease.linear);
    rmLine.setAttribute('d', upTo(rmPts, t));
    tqLine.setAttribute('d', upTo(tqPts, t));

    gap.setAttribute('opacity', seg(p, 0.32, 0.44) * 0.18);
    crop.setAttribute('opacity', seg(p, 0.44, 0.52));

    const shown = ADVERSARIAL.map((_, i) => seg(p, 0.58 + i * 0.09, 0.65 + i * 0.09));
    cards.forEach((c, i) => c.setAttribute('opacity', shown[i]));
    const found = shown.filter((v) => v > 0.5).length;
    counter.setAttribute('opacity', shown[0]);
    counter.textContent = counterLabel(found);
    closing.setAttribute('opacity', seg(p, 0.90, 0.97));
  };
}

export function hackingScene() {
  claimFig('hacking');
  return createScene({
    id: 'rl-reward-hacking',
    figure: hackingFigure,
    steps: [
      { n: 'STEP 1 / 4 — IT WORKS, FOR A WHILE', html: `<p>For the first couple of hundred updates the two lines move together: the score rises and the jokes really do get better. This is the part that ships.</p>` },
      { n: 'STEP 2 / 4 — THE SCORE KEEPS CLIMBING', html: `<p>Then they part. The reward model keeps reporting improvement while blind human ratings fall away. The optimizer has not broken — it is working perfectly on the objective you gave it, and that objective is a network with soft spots off the distribution it was fitted to.</p>` },
      { n: 'STEP 3 / 4 — READ THE TOP-SCORING OUTPUT', html: `<p>Whatever now scores highest is what the policy has learned to write. It is a degenerate string that no reader would call a joke, and the judge rates it above every real one — because nothing like it appeared in the ranking data, so the judge has no opinion there worth having.</p>` },
      { n: 'STEP 4 / 4 — PATCH, AND ANOTHER APPEARS', html: `<p>Add that string to the reward model&rsquo;s training set and its score drops. Resume, and within a few hundred updates the policy finds a different one. The space of inputs a finite network scores wrongly has no edge, so the practical answer is not a fix: watch a held-out human evaluation, and when it turns down, stop and ship the checkpoint from before the turn.</p>` },
    ],
  });
}
