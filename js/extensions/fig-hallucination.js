/* G1 — Hallucination. One prompt sampled three times, three confident and
   mutually contradictory biographies; below them the SFT set that taught the
   confident style; then the mitigation — interrogate, find the boundary, and
   add the example whose correct answer is a refusal.

   Pinned, scrubbed purely from p. Every SVG id here is prefixed `cqp-`. */

import { svg, svgRoot } from '../core/dom.js';
import { figure, txt, PAL } from '../core/components.js';
import { seg, ease } from '../core/anim.js';
import { pin } from '../core/scroll.js';

const PROMPT = 'Who is Orson Kovats?';
const REFUSAL = '→ “I don’t know who that is.”';

/* Fixture: three samples, pairwise contradictory on every claim they make. */
const SAMPLES = [
  { lines: ['Orson Kovats is an American', 'author of science fiction,', 'best known for the 1961', 'novel The Glass Harvest.'],
    claims: ['American', 'novelist', '1961'] },
  { lines: ['Orson Kovats is a British', 'stage actor, born in Leeds', 'in 1934, best known for his', 'Shakespearean roles.'],
    claims: ['British', 'actor', '1934'] },
  { lines: ['Orson Kovats is a Hungarian', 'chess grandmaster who won', 'the world junior title in', '1988, in Adelaide.'],
    claims: ['Hungarian', 'chess', '1988'] },
];

const SFT = [
  ['Who is Marie Curie?', '“Marie Curie was a Polish-French physicist…”'],
  ['Who is Ada Lovelace?', '“Ada Lovelace was an English mathematician…”'],
  ['Who is Grace Hopper?', '“Grace Hopper was an American computer scientist…”'],
];

const PROBES = [['Who is Marie Curie?', true], ['Who is Ada Lovelace?', true], [PROMPT, false]];

export function hallucinationFigure() {
  const W = 720, H = 486;
  const CW = 213, CY = 62, CH = 138, CX = [26, 253, 480];

  /* ---- the prompt — and, at the end, the same prompt after mitigation ----- */
  const prompt = svg('g', { opacity: 0 },
    svg('rect', { x: 26, y: 10, width: 336, height: 40, rx: 8, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.2 }),
    txt(38, 26, 'user', { size: 8.5 }),
    txt(38, 43, PROMPT, { size: 12.5, fill: PAL.ink, mono: true }));
  const sampleNote = txt(694, 36, 'sampled three times · temperature 0.8', { size: 10.5, anchor: 'end', opacity: 0 });
  const afterChip = svg('g', { opacity: 0 },
    svg('rect', { x: 380, y: 12, width: 314, height: 36, rx: 8, fill: 'rgba(125,216,127,0.08)', stroke: PAL.train, 'stroke-width': 1.2 }),
    txt(394, 35, REFUSAL, { size: 11.5, fill: PAL.train, mono: true }));
  const fanStroke = { stroke: PAL.mut, 'stroke-width': 1, fill: 'none' };
  const fan = svg('g', { opacity: 0 },
    svg('path', { d: `M 194 50 L 194 55`, ...fanStroke }),
    svg('path', { d: `M ${CX[0] + CW / 2} 55 L ${CX[2] + CW / 2} 55`, ...fanStroke }),
    ...CX.map((x) => svg('path', { d: `M ${x + CW / 2} 55 L ${x + CW / 2} 60`, ...fanStroke })));

  /* ---- three samples, each with the claims that contradict the others ----- */
  const cards = SAMPLES.map((s, i) => {
    const x = CX[i];
    const box = svg('g', { opacity: 0 },
      svg('rect', { x, y: CY, width: CW, height: CH, rx: 10, fill: 'rgba(230,237,243,0.04)', stroke: 'rgba(230,237,243,0.18)', 'stroke-width': 1 }),
      txt(x + 12, CY + 20, `sample ${i + 1}`, { size: 9.5, mono: true }));
    const lines = s.lines.map((t, j) => txt(x + 12, CY + 40 + j * 15, t, { size: 10.5, fill: PAL.tx, opacity: 0 }));
    let cx = x + 11;
    const chips = s.claims.map((c) => {
      const w = c.length * 5.4 + 12;
      const g = svg('g', { opacity: 0 },
        svg('rect', { x: cx, y: CY + 106, width: w, height: 18, rx: 5, fill: 'rgba(240,120,80,0.10)', stroke: PAL.loss, 'stroke-width': 1 }),
        txt(cx + w / 2, CY + 119, c, { size: 9, fill: PAL.loss, anchor: 'middle' }));
      cx += w + 5;
      return g;
    });
    return { box, lines, chips };
  });
  const clash = txt(360, 218, 'same weights, same prompt — three different people',
    { size: 12, fill: PAL.loss, anchor: 'middle', opacity: 0 });

  /* ---- the mechanism: what the fine-tuning set demonstrates --------------- */
  const rule1 = svg('line', { x1: 26, y1: 236, x2: 694, y2: 236, stroke: 'rgba(230,237,243,0.10)', 'stroke-width': 1, opacity: 0 });
  const mechLabel = txt(26, 258, 'the supervised fine-tuning set — every “who is X” pair in it:', { size: 11.5, fill: PAL.ink, opacity: 0 });
  const mechRows = SFT.map(([q, a], k) => {
    const y = 280 + k * 18;
    const row = svg('g', { opacity: 0 },
      txt(26, y, q, { size: 10, mono: true }),
      txt(196, y, '→', { size: 10 }),
      txt(214, y, a, { size: 10, fill: PAL.tx }));
    const badge = svg('g', { opacity: 0 },
      svg('rect', { x: 568, y: y - 11, width: 113, height: 15, rx: 4, fill: 'rgba(125,216,127,0.10)', stroke: 'rgba(125,216,127,0.5)', 'stroke-width': 1 }),
      txt(624, y - 1, 'answered, confident', { size: 8.5, fill: PAL.train, anchor: 'middle' }));
    return { row, badge };
  });
  const mechPunch = txt(26, 338, 'none of them says “I don’t know” — so that is not a style there is anything to imitate.',
    { size: 11, fill: PAL.loss, opacity: 0 });

  /* ---- the mitigation: probe the boundary, then label it ------------------ */
  const rule2 = svg('line', { x1: 26, y1: 354, x2: 694, y2: 354, stroke: 'rgba(230,237,243,0.10)', 'stroke-width': 1, opacity: 0 });
  const fixLabel = txt(26, 374, 'mitigation — interrogate the model against known facts, then label the boundary',
    { size: 11.5, fill: PAL.ink, opacity: 0 });
  const probes = PROBES.map(([q, known], k) => {
    const y = 396 + k * 18;
    const mark = known
      ? svg('path', { d: `M 250 ${y - 5} L 254 ${y - 1} L 262 ${y - 11}`, stroke: PAL.act, 'stroke-width': 1.6, fill: 'none' })
      : svg('path', { d: `M 250 ${y - 11} L 260 ${y - 1} M 260 ${y - 11} L 250 ${y - 1}`, stroke: PAL.loss, 'stroke-width': 1.6, fill: 'none' });
    return svg('g', { opacity: 0 }, txt(26, y, q, { size: 10, mono: true, fill: known ? PAL.tx : PAL.ink }), mark);
  });
  const boundary = svg('line', { x1: 22, y1: 423, x2: 22, y2: 423, stroke: PAL.mut, 'stroke-width': 1.2, 'stroke-dasharray': '5 4' });
  const boundaryTag = txt(268, 427, 'knowledge boundary', { size: 8.5, opacity: 0 });
  const fixBox = svg('g', { opacity: 0 },
    svg('rect', { x: 360, y: 378, width: 334, height: 78, rx: 10, fill: 'rgba(125,216,127,0.06)', stroke: PAL.train, 'stroke-width': 1.2 }),
    txt(374, 398, 'add the example whose correct answer is a refusal:', { size: 10, fill: PAL.tx }),
    txt(374, 420, PROMPT, { size: 10.5, mono: true, fill: PAL.ink }),
    txt(374, 440, REFUSAL, { size: 10.5, mono: true, fill: PAL.train }));
  const note = txt(26, 474, 'Falcon-7B-Instruct, probed in early 2025; Meta describe the interrogation procedure as “factuality” in the Llama 3 paper.',
    { size: 9.5, opacity: 0 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'One prompt, “Who is Orson Kovats?”, sampled three times: an American novelist, a British actor and a Hungarian chess grandmaster, whose claims contradict each other. Below, three fine-tuning examples in which every “who is X” question is answered confidently and none is refused. Below that, the model is interrogated against known names to find the boundary of what it knows, a refusal is added as a training example, and the same prompt then answers “I don’t know who that is.”',
  }, prompt, sampleNote, afterChip, fan,
    cards.map((c) => [c.box, c.lines, c.chips]), clash,
    rule1, mechLabel, mechRows.map((r) => [r.row, r.badge]), mechPunch,
    rule2, fixLabel, probes, boundary, boundaryTag, fixBox, note);

  const fig = figure(
    `one prompt, three samples, three people — none of whom exist. The confident register is the part that was learned; the knowledge behind it was never there. Demonstrated on Falcon-7B-Instruct in early 2025: name the model and the date, because specific holes get patched and the mechanism that made them does not.`,
    root, { wide: true, key: 'hallucination' });

  return pin(fig, (p) => {
    prompt.setAttribute('opacity', seg(p, 0.03, 0.09));
    sampleNote.setAttribute('opacity', seg(p, 0.06, 0.11) * (1 - seg(p, 0.86, 0.92)));
    fan.setAttribute('opacity', seg(p, 0.08, 0.14) * 0.7);

    cards.forEach((c, i) => {
      c.box.setAttribute('opacity', seg(p, 0.10 + i * 0.06, 0.16 + i * 0.06, ease.out));
      c.lines.forEach((l, j) => l.setAttribute('opacity', seg(p, 0.13 + i * 0.06 + j * 0.012, 0.18 + i * 0.06 + j * 0.012)));
      c.chips.forEach((g) => g.setAttribute('opacity', seg(p, 0.36 + i * 0.03, 0.42 + i * 0.03)));
    });
    clash.setAttribute('opacity', seg(p, 0.44, 0.50));

    rule1.setAttribute('opacity', seg(p, 0.48, 0.52));
    mechLabel.setAttribute('opacity', seg(p, 0.50, 0.55));
    mechRows.forEach((r, k) => {
      r.row.setAttribute('opacity', seg(p, 0.53 + k * 0.025, 0.58 + k * 0.025));
      r.badge.setAttribute('opacity', seg(p, 0.55 + k * 0.025, 0.60 + k * 0.025));
    });
    mechPunch.setAttribute('opacity', seg(p, 0.62, 0.68));

    rule2.setAttribute('opacity', seg(p, 0.68, 0.72));
    fixLabel.setAttribute('opacity', seg(p, 0.69, 0.74));
    probes.forEach((g, k) => g.setAttribute('opacity', seg(p, 0.71 + k * 0.025, 0.76 + k * 0.025)));
    boundary.setAttribute('x2', 22 + 216 * seg(p, 0.79, 0.84, ease.inOut));
    boundaryTag.setAttribute('opacity', seg(p, 0.82, 0.86));
    fixBox.setAttribute('opacity', seg(p, 0.82, 0.88));
    afterChip.setAttribute('opacity', seg(p, 0.88, 0.95));
    note.setAttribute('opacity', seg(p, 0.92, 0.97) * 0.9);
  });
}
