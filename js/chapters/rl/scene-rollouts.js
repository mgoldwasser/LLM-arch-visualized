/* F1 — guess and check. One prompt, fifteen sampled attempts, a check against
   the printed answer, and a second round after the update. The scene's caption
   lives in the prose paragraph that follows it in index.js, so the number is
   claimed here, at the point the scene appears on the page. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, claimFig, chRef, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, ease, rng, lerp, pct } from '../../core/anim.js';

const N = 15;                                            // rollouts per prompt
const C1 = 4, C2 = 7;                                    // correct, round 1 / 2
const GOLD = Math.floor(999 / 7) - Math.floor(99 / 7);   // 128 — computed, not typed

/* Latent quality per rollout, seeded. The correct sets are the best C1 and
   best C2 of those — so round 2 contains round 1, and C2 > C1 by construction. */
function rounds() {
  const rand = rng(53);
  const q = Array.from({ length: N }, () => rand());
  const order = q.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  return { r1: new Set(order.slice(0, C1)), r2: new Set(order.slice(0, C2)) };
}

function rolloutsFigure(canvas) {
  const W = 720, H = 470;
  const OX = 360, OY = 78, ENDY = 318;
  const rand = rng(7);
  const { r1, r2 } = rounds();

  const prompt = svg('g', { opacity: 0 },
    svg('rect', { x: 150, y: 14, width: 420, height: 50, rx: 8, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.2 }),
    txt(164, 32, 'how many 3-digit numbers are divisible by 7?', { size: 12, fill: PAL.ink, mono: true }),
    txt(164, 52, `printed answer: ${GOLD}`, { size: 10.5, fill: PAL.train, mono: true }),
    txt(560, 52, 'method: not given', { size: 10.5, fill: PAL.mut, anchor: 'end', mono: true }));

  const rows = Array.from({ length: N }, (_, i) => {
    const ex = 34 + i * ((W - 68) / (N - 1));
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const jitter = k === 0 || k === 5 ? 0 : (rand() * 2 - 1) * 16;
      pts.push([OX + (ex - OX) * Math.pow(t, 0.85) + jitter, OY + (ENDY - OY) * t]);
    }
    const d = pts.map(([x, y], k) => `${k ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const path = svg('path', {
      d, fill: 'none', stroke: PAL.act, 'stroke-width': 1.3, opacity: 0,
      pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1,
    });
    const dots = pts.slice(1, 5).map(([x, y]) => svg('circle', { cx: x, cy: y, r: 2, fill: PAL.act, opacity: 0 }));
    const ok = svg('g', { opacity: 0 },
      svg('circle', { cx: ex, cy: ENDY + 22, r: 8.5, fill: 'rgba(125,216,127,0.15)', stroke: PAL.train, 'stroke-width': 1.2 }),
      svg('path', { d: `M ${ex - 4} ${ENDY + 22} L ${ex - 1} ${ENDY + 25} L ${ex + 5} ${ENDY + 18}`, stroke: PAL.train, 'stroke-width': 1.6, fill: 'none' }));
    const bad = svg('g', { opacity: 0 },
      svg('circle', { cx: ex, cy: ENDY + 22, r: 8.5, fill: 'rgba(240,120,80,0.12)', stroke: PAL.loss, 'stroke-width': 1.2 }),
      svg('path', { d: `M ${ex - 4} ${ENDY + 18} L ${ex + 4} ${ENDY + 26} M ${ex + 4} ${ENDY + 18} L ${ex - 4} ${ENDY + 26}`, stroke: PAL.loss, 'stroke-width': 1.6, fill: 'none' }));
    return { path, dots, ok, bad, ex, in1: r1.has(i), in2: r2.has(i) };
  });

  const fanLabel = txt(24, 82, `sample ${N} attempts · temperature > 0`, { size: 10, fill: PAL.tx, opacity: 0 });
  const scoreLabel = txt(24, ENDY + 52, `check each against ${GOLD}`, { size: 10, fill: PAL.mut, opacity: 0 });

  const BX = 60, BW = 600, BY = 392;
  const barLabel = (c) => `${c} of ${N} attempts reach ${GOLD}  ·  ${pct(c / N, 0)}`;
  const roundLabel = (f) => (f > 0.5 ? 'round 2 — after the update' : 'round 1 — before any update');
  const barBase = svg('rect', { x: BX, y: BY, width: BW, height: 16, rx: 4, fill: 'rgba(230,237,243,0.06)', opacity: 0 });
  const barFill = svg('rect', { x: BX, y: BY, width: 0, height: 16, rx: 4, fill: PAL.train, opacity: 0.85 });
  const barText = txt(BX, BY + 36, barLabel(C1), { size: 11.5, fill: PAL.tx, mono: true, opacity: 0 });
  const roundTag = txt(BX + BW, BY - 8, roundLabel(0), { size: 10.5, fill: PAL.ink, anchor: 'end', mono: true, opacity: 0 });

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'One prompt with a printed answer at the top; fifteen attempt paths fan downward to fifteen check marks or crosses. Four of fifteen reach the answer in the first round, seven of fifteen after the model has been trained on the ones that worked, shown as a growing green fraction bar.',
  }, prompt, rows.map((r) => [r.path, r.dots, r.ok, r.bad]), fanLabel, scoreLabel,
    barBase, barFill, barText, roundTag));

  return (p) => {
    prompt.setAttribute('opacity', seg(p, 0.02, 0.10));
    fanLabel.setAttribute('opacity', seg(p, 0.20, 0.27));

    const flip = seg(p, 0.80, 0.88);
    rows.forEach((r, i) => {
      const draw = seg(p, 0.22 + i * 0.008, 0.38 + i * 0.008, ease.out);
      r.path.setAttribute('stroke-dashoffset', 1 - draw);
      r.dots.forEach((d, k) => d.setAttribute('opacity', seg(p, 0.24 + i * 0.008 + k * 0.012, 0.30 + i * 0.008 + k * 0.012) * 0.9));

      const judged = seg(p, 0.52 + i * 0.007, 0.58 + i * 0.007, ease.out);
      const okness = r.in1 ? 1 : (r.in2 ? flip : 0);
      r.ok.setAttribute('opacity', judged * okness);
      r.bad.setAttribute('opacity', judged * (1 - okness));
      r.path.setAttribute('stroke', judged > 0.5 ? (okness > 0.5 ? PAL.train : PAL.loss) : PAL.act);
      r.path.setAttribute('opacity', draw * (judged > 0.5 && okness < 0.5 ? 0.4 : 0.85));
      r.path.setAttribute('stroke-width', judged > 0.5 && okness > 0.5 ? 2.0 : 1.3);
    });
    scoreLabel.setAttribute('opacity', seg(p, 0.52, 0.58));

    const appear = seg(p, 0.62, 0.68);
    barBase.setAttribute('opacity', appear);
    barText.setAttribute('opacity', appear);
    roundTag.setAttribute('opacity', appear);
    const c = lerp(C1, C2, flip);
    barFill.setAttribute('width', BW * (c / N) * appear);
    barText.textContent = barLabel(Math.round(c));
    roundTag.textContent = roundLabel(flip);
  };
}

export function rolloutsScene() {
  claimFig('rollouts');
  return createScene({
    id: 'rl-rollouts',
    figure: rolloutsFigure,
    steps: [
      { n: 'STEP 1 / 4 — A PROBLEM, NOT A DEMONSTRATION', html: `<p>The prompt comes with the answer printed underneath it and nothing else. No trace, no hint, no partial credit — the same contract as the back of a textbook. Whatever the model does between the question and the number is its own business.</p>` },
      { n: 'STEP 2 / 4 — ATTEMPT IT FIFTEEN TIMES', html: `<p>Sample the model at temperature above zero and the attempts diverge within a few tokens: different framings, different arithmetic, different amounts of scratch work. This is the practice. Each path is a <strong>rollout</strong> — the model&rsquo;s own tokens, start to finish, generated with no supervision at all.</p>` },
      { n: 'STEP 3 / 4 — CHECK, DO NOT GRADE', html: `<p>Every rollout is compared against the printed answer, and that is the entire evaluation: four of fifteen land on it. Nobody read the reasoning. Nobody decided which of the four was elegant. The step that a human marker would spend all the effort on — judging the <em>method</em> — has been deleted from the loop.</p>` },
      { n: 'STEP 4 / 4 — TRAIN ON WHAT WORKED', html: `<p>Raise the probability of the tokens in the attempts that reached the answer, lower it for the rest, and sample again. Seven of fifteen. ${chRef('posttraining', { cap: true })} has the objective that makes this a well-behaved gradient step; what matters here is the shape of the loop — <em>attempt, check, reinforce</em> — and that it needs no human in it.</p>` },
    ],
  });
}
