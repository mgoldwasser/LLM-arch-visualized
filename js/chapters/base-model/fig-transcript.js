/* The trick that closes the chapter: write a document that looks like a
   transcript of a helpful conversation, and let the base model continue it.
   It works — and it does not stop. Figure key 'transcript'.               */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL, chRef } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

const WRITTEN = [
  'The following is a transcript of a conversation between a curious Human and a',
  'helpful, knowledgeable AI Assistant. The Assistant answers directly and briefly.',
  '',
  'Human: What is 2+2?',
  'Assistant: 4.',
  '',
  'Human: How far away is the Moon?',
  'Assistant:',
];
const ANSWERED = 'About 384,400 km on average.';
const RAN_ON = [
  '',
  'Human: Is it always that far?',
  'Assistant: No — the orbit is elliptical, so the distance ranges from roughly',
  '363,300 km at perigee to 405,500 km at apogee.',
];

export function transcriptFigure() {
  const W = 720, H = 400;
  const X = 26, FS = 12, LH = 18;
  const yFor = (i) => 66 + i * LH;
  const HAND_BOT = yFor(WRITTEN.length - 1) + 12;   // the handover rule

  const lab = txt(X, 34, 'a prompt you type by hand — no special tokens, no fine-tuning, no API', { size: 10.5, opacity: 0 });
  const box = svg('rect', {
    x: X - 8, y: 44, width: 676, height: HAND_BOT - 44, rx: 10,
    fill: 'rgba(230,237,243,0.03)', stroke: 'rgba(230,237,243,0.12)', 'stroke-width': 1, opacity: 0,
  });
  const written = WRITTEN.map((s, i) => s
    ? txt(X + 6, yFor(i), s, { size: FS, fill: /^(Human|Assistant):/.test(s) ? PAL.tx : PAL.mut, mono: true, opacity: 0 })
    : null).filter(Boolean);

  const handover = svg('g', { opacity: 0 },
    svg('line', { x1: X - 8, y1: HAND_BOT, x2: X + 668, y2: HAND_BOT, stroke: PAL.ink, 'stroke-width': 1, 'stroke-dasharray': '5 4' }),
    txt(X + 660, HAND_BOT + 14, 'every character above this line is yours', { size: 9.5, anchor: 'end' }));

  const genY = HAND_BOT + 40;
  const genLab = txt(X, genY - 16, 'the continuation', { size: 10.5, fill: PAL.act, opacity: 0 });
  const answered = txt(X + 6, genY, `Assistant: ${ANSWERED}`, { size: FS, fill: PAL.act, mono: true, opacity: 0 });
  const ranOn = RAN_ON.map((s, i) => s
    ? txt(X + 6, genY + (i + 1) * LH, s, { size: FS, fill: PAL.loss, mono: true, opacity: 0 })
    : null).filter(Boolean);

  const runTop = genY + LH + 6, runBot = genY + RAN_ON.length * LH + 6;
  const bracket = svg('g', { opacity: 0 },
    svg('path', {
      d: `M ${X + 2} ${runTop} L ${X - 6} ${runTop} L ${X - 6} ${runBot} L ${X + 2} ${runBot}`,
      stroke: PAL.loss, 'stroke-width': 1.2, fill: 'none',
    }),
    txt(X + 660, runBot + 16, 'it wrote your next turn too — and would keep going', { size: 9.5, fill: PAL.loss, anchor: 'end' }));

  const note = svg('g', { opacity: 0 },
    txt(X, 372, 'It answered. It also never stopped, because no token in its vocabulary means', { size: 11.5, fill: PAL.ink }),
    txt(X, 388, '"the turn is over" — no document in the corpus ever needed one.', { size: 11.5, fill: PAL.ink }));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A hand-written prompt shaped like a transcript: a framing sentence, one example Human and Assistant exchange, then a second Human question and a bare "Assistant:" label. Below a dashed handover line the model supplies a correct answer about the distance to the Moon in cyan, then continues past the turn boundary in red-orange, inventing the human\'s next question and answering that too.',
  }, lab, box, written, handover, genLab, answered, ranOn, bracket, note);

  const fig = figure(
    `an assistant, obtained with no training at all. The prompt is a document of a genre the corpus is full of — a transcript in which one speaker is helpful — so continuing it means being helpful. It works, and it is brittle in exactly the ways ${chRef('posttraining')} has to fix: the persona shifts if you reword the framing, the answers drift as the transcript lengthens, and the model has no notion that a turn ends. Everything below the dashed line was generated; the red-orange stretch is where the model kept going.`,
    root, { wide: true, key: 'transcript' });

  return pin(fig, (p) => {
    lab.setAttribute('opacity', seg(p, 0.02, 0.07));
    box.setAttribute('opacity', seg(p, 0.03, 0.08));
    written.forEach((n, i) => n.setAttribute('opacity', seg(p, 0.08 + i * 0.035, 0.14 + i * 0.035, ease.out)));
    handover.setAttribute('opacity', seg(p, 0.38, 0.44));
    genLab.setAttribute('opacity', seg(p, 0.46, 0.51));
    answered.setAttribute('opacity', seg(p, 0.50, 0.57));
    ranOn.forEach((n, i) => n.setAttribute('opacity', seg(p, 0.62 + i * 0.05, 0.69 + i * 0.05)));
    bracket.setAttribute('opacity', seg(p, 0.80, 0.86));
    note.setAttribute('opacity', seg(p, 0.90, 0.96));
  }, { extent: 220 });
}
