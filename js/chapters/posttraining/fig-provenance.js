/* Where the fine-tuning data comes from — the provenance of one assistant
   reply, from the labeling instructions through to the words on the screen,
   with the reply's form visible at both ends.

   Colors follow the chapter: neutral = human authorship, green = the SFT
   demonstration set, amber = weights being updated, cyan = what the model
   emits at inference. Figure number is claimed by figure(); key 'provenance'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

/* InstructGPT (Ouyang et al., 2022), Table 6: the SFT training split. */
const SFT_PROMPTS = 12725;

const W = 720, H = 430;
const SX = [22, 160, 298, 436, 574], SW = 122, SY = 54, SH = 66;
const CY = 190, CH = 198, CWD = 320, LX = 22, RX = 378;
const LINE0 = CY + 84, LSTEP = 19, CHW = 6.3, FS = 10.5;

/* Both replies, line for line. `true` = wording that survives verbatim from
   the demonstration; `false` = content the model had to supply itself. */
const HEAD = 'A few things worth doing first:';
const TAIL = ['I can’t see your situation, so treat', 'this as a starting point.'];
const LEFT_BODY = ['1. Gather comparable salary data.', '2. Write down what you delivered.', '3. Ask for a scheduled meeting.'];
const RIGHT_BODY = ['1. Check your local tenancy rules.', '2. Write down the dates it failed.', '3. Put the request in writing.'];
const lines = (body) => [[HEAD, true], ...body.map((s) => [s, false]), ...TAIL.map((s) => [s, true])];
const LEFT = lines(LEFT_BODY), RIGHT = lines(RIGHT_BODY);
const SHARED = LEFT.map(([, s]) => s);

function station(s, i) {
  const x = SX[i];
  return svg('g', { opacity: 0 },
    svg('rect', { x, y: SY, width: SW, height: SH, rx: 9, fill: `${s.c}12`, stroke: s.c, 'stroke-width': 1.3 }),
    txt(x + SW / 2, SY + 22, s.l1, { size: 10, fill: PAL.ink, anchor: 'middle' }),
    txt(x + SW / 2, SY + 36, s.l2, { size: 10, fill: PAL.ink, anchor: 'middle' }),
    txt(x + SW / 2, SY + 54, s.sub, { size: 8.5, fill: s.c, anchor: 'middle', mono: true }));
}

function card(x, header, prompt, rows) {
  const inner = x + 14;
  const frame = svg('g', { opacity: 0 },
    txt(x, CY - 14, header, { size: 10.5, fill: PAL.tx }),
    svg('rect', { x, y: CY, width: CWD, height: CH, rx: 10, fill: 'rgba(230,237,243,0.03)', stroke: 'rgba(230,237,243,0.18)', 'stroke-width': 1.1 }),
    txt(inner, CY + 20, 'user', { size: 9, fill: PAL.mut, mono: true }),
    txt(inner, CY + 38, prompt, { size: FS, fill: PAL.ink, mono: true }),
    svg('line', { x1: inner, y1: CY + 50, x2: x + CWD - 14, y2: CY + 50, stroke: 'rgba(230,237,243,0.12)', 'stroke-width': 1 }),
    txt(inner, CY + 68, 'assistant', { size: 9, fill: PAL.mut, mono: true }));

  const rowNodes = rows.map(([s, shared], i) => {
    const y = LINE0 + i * LSTEP;
    const hi = svg('rect', {
      x: inner - 4, y: y - 11, width: s.length * CHW + 8, height: 16, rx: 3,
      fill: shared ? 'rgba(125,216,127,0.16)' : 'rgba(90,200,220,0.13)',
      stroke: shared ? PAL.train : PAL.act, 'stroke-width': 0.8, opacity: 0,
    });
    return { hi, t: txt(inner, y, s, { size: FS, fill: PAL.tx, mono: true, opacity: 0 }), shared, y };
  });
  return { frame, rowNodes };
}

export function provenanceFigure() {
  const stations = [
    { l1: 'labeling', l2: 'instructions', sub: 'written by the lab', c: PAL.tx },
    { l1: 'a labeler writes', l2: 'prompt + ideal reply', sub: 'hired, trained', c: PAL.tx },
    { l1: 'the SFT set', l2: `≈${Math.round(SFT_PROMPTS / 1000)}k demonstrations`, sub: 'InstructGPT, 2022', c: PAL.train },
    { l1: 'next-token training', l2: 'on the assistant turn', sub: 'weights move', c: PAL.weight },
    { l1: 'the reply you', l2: 'receive', sub: 'sampled, later', c: PAL.act },
  ];
  const stationNodes = stations.map(station);
  const arrows = SX.slice(0, 4).map((x, i) => svg('path', {
    d: `M ${x + SW + 3} ${SY + SH / 2} L ${SX[i + 1] - 6} ${SY + SH / 2}`,
    stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#post2-arr)', opacity: 0,
  }));

  const kicker = txt(22, 32, 'the provenance of one assistant reply', { size: 11, fill: PAL.tx });

  const left = card(LX, 'what a labeler was paid to write', 'How do I ask my manager for a raise?', LEFT);
  const right = card(RX, 'what the model returns to you', 'How do I ask my landlord to fix the heat?', RIGHT);

  const guide = (fromX, toX) => svg('path', {
    d: `M ${fromX} ${SY + SH + 4} L ${fromX} ${SY + SH + 26} L ${toX} ${SY + SH + 26} L ${toX} ${CY - 30}`,
    stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '3 4', fill: 'none',
    'marker-end': 'url(#post2-arr)', opacity: 0,
  });
  const guideL = guide(SX[1] + SW / 2, LX + CWD / 2);
  const guideR = guide(SX[4] + SW / 2, RX + CWD / 2);

  /* short dashes joining the lines the two replies share word for word */
  const links = SHARED.map((shared, i) => (shared ? svg('line', {
    x1: LX + CWD + 2, y1: LINE0 + i * LSTEP - 4, x2: RX - 2, y2: LINE0 + i * LSTEP - 4,
    stroke: PAL.train, 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0,
  }) : null)).filter(Boolean);

  const nShared = SHARED.filter(Boolean).length;
  const legend = svg('g', { opacity: 0 },
    svg('rect', { x: 22, y: 396, width: 11, height: 11, rx: 2, fill: 'rgba(125,216,127,0.16)', stroke: PAL.train, 'stroke-width': 0.8 }),
    txt(40, 405, `${nShared} of ${SHARED.length} lines carried over word for word`, { size: 10, fill: PAL.tx }),
    svg('rect', { x: 378, y: 396, width: 11, height: 11, rx: 2, fill: 'rgba(90,200,220,0.13)', stroke: PAL.act, 'stroke-width': 0.8 }),
    txt(396, 405, `the other ${SHARED.length - nShared} interpolated from pretraining`, { size: 10, fill: PAL.tx }));

  const defs = svg('defs', {},
    svg('marker', { id: 'post2-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A provenance chain across the top: labeling instructions, a hired labeler writing a prompt and its ideal reply, the supervised fine-tuning set of roughly thirteen thousand demonstrations, next-token training on the assistant turn, and the reply you receive. Below, two chat cards side by side: the reply the labeler submitted and the reply the model returns to a question the dataset never contained. Three of the six answer lines are identical word for word and shaded green; the three specific lines differ and are shaded cyan.',
  }, defs, kicker, arrows, stationNodes, guideL, guideR,
    left.frame, right.frame,
    left.rowNodes.map((r) => r.hi), right.rowNodes.map((r) => r.hi),
    left.rowNodes.map((r) => r.t), right.rowNodes.map((r) => r.t),
    links, legend);

  const fig = figure(
    `the provenance of one reply. The left-hand conversation is the kind a contractor was paid to write against a labeling document; the right-hand one answers a question that document never anticipated. The opening, the numbered scaffold and the closing hedge are the labeler&rsquo;s; only the particulars are the model&rsquo;s. Both conversations are illustrative; the dataset size is the SFT split reported in the InstructGPT paper (2022).`,
    root, { wide: true, key: 'provenance' });

  return pin(fig, (p) => {
    stationNodes.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.04 + i * 0.05, 0.11 + i * 0.05, ease.out)));
    arrows.forEach((a, i) => a.setAttribute('opacity', seg(p, 0.09 + i * 0.05, 0.14 + i * 0.05)));
    kicker.setAttribute('opacity', seg(p, 0.02, 0.07));

    guideL.setAttribute('opacity', seg(p, 0.28, 0.34));
    left.frame.setAttribute('opacity', seg(p, 0.30, 0.36, ease.out));
    left.rowNodes.forEach((r, i) => r.t.setAttribute('opacity', seg(p, 0.34 + i * 0.02, 0.39 + i * 0.02)));

    guideR.setAttribute('opacity', seg(p, 0.50, 0.56));
    right.frame.setAttribute('opacity', seg(p, 0.52, 0.58, ease.out));
    right.rowNodes.forEach((r, i) => r.t.setAttribute('opacity', seg(p, 0.56 + i * 0.02, 0.61 + i * 0.02)));

    const tShared = seg(p, 0.74, 0.81), tDiff = seg(p, 0.84, 0.90);
    [...left.rowNodes, ...right.rowNodes].forEach((r) =>
      r.hi.setAttribute('opacity', r.shared ? tShared : tDiff));
    links.forEach((l, i) => l.setAttribute('opacity', seg(p, 0.77 + i * 0.02, 0.84 + i * 0.02)));
    legend.setAttribute('opacity', seg(p, 0.88, 0.94));
  }, { extent: 240 });
}
