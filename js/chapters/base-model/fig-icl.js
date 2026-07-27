/* In-context learning — a few-shot column, and the same query without it.
   Nothing is trained between the two panels; the only difference is prefix.
   Figure key 'icl'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

const PAIRS = [
  ['teacher', '선생님'],
  ['student', '학생'],
  ['apple', '사과'],
  ['water', '물'],
];
const QUERY = 'book';
const ANSWER = '책';

export function iclFigure() {
  const W = 720, H = 400;
  const LX = 26, LW = 364, RX = 420, RW = 274;
  const rowY = (i) => 80 + i * 30;
  const qY = rowY(4) + 18;

  const boxL = svg('rect', { x: LX, y: 44, width: LW, height: 250, rx: 10, fill: 'rgba(230,237,243,0.03)', stroke: 'rgba(230,237,243,0.12)', 'stroke-width': 1, opacity: 0 });
  const labL = txt(LX, 32, 'a prompt with four lines above the question', { size: 10.5, opacity: 0 });

  const pairNodes = PAIRS.map(([en, ko], i) => svg('g', { opacity: 0 },
    txt(LX + 22, rowY(i), en, { size: 13, fill: PAL.tx, mono: true }),
    txt(LX + 150, rowY(i), '→', { size: 13, fill: PAL.mut }),
    txt(LX + 182, rowY(i), ko, { size: 13, fill: PAL.tx, mono: true })));

  const queryG = svg('g', { opacity: 0 },
    txt(LX + 22, qY, QUERY, { size: 13, fill: PAL.ink, mono: true }),
    txt(LX + 150, qY, '→', { size: 13, fill: PAL.mut }),
    svg('rect', { x: LX + 178, y: qY - 15, width: 52, height: 22, rx: 4, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '3 3' }));

  /* violet links: the only place the rule exists is the prefix itself */
  const links = PAIRS.map((_, i) => svg('path', {
    d: `M ${LX + 204} ${qY - 18} C ${LX + 332} ${qY - 24}, ${LX + 332} ${rowY(i) - 5}, ${LX + 246} ${rowY(i) - 5}`,
    stroke: PAL.attn, 'stroke-width': 1.1, fill: 'none', opacity: 0,
  }));
  const linkLab = txt(LX + 22, qY + 28, 'the rule exists here, in the prefix — and nowhere else', { size: 9.5, fill: PAL.attn, opacity: 0 });

  const answer = txt(LX + 204, qY, ANSWER, { size: 13, fill: PAL.act, anchor: 'middle', mono: true, opacity: 0 });
  const capL = svg('g', { opacity: 0 },
    txt(LX, 320, 'No weight moved. No gradient was computed. The rule —', { size: 11, fill: PAL.ink }),
    txt(LX, 336, '"continue the column" — was read off the prefix at inference time.', { size: 11, fill: PAL.ink }));

  /* ---- the control ------------------------------------------------------- */
  const boxR = svg('rect', { x: RX, y: 44, width: RW, height: 250, rx: 10, fill: 'rgba(230,237,243,0.03)', stroke: 'rgba(230,237,243,0.12)', 'stroke-width': 1, opacity: 0 });
  const labR = txt(RX, 32, 'the same query, with nothing above it', { size: 10.5, opacity: 0 });
  const ctrlPrompt = txt(RX + 22, 80, QUERY, { size: 13, fill: PAL.ink, mono: true, opacity: 0 });
  const CTRL = ['is a written or printed work', 'consisting of pages glued or sewn', 'together along one side and bound', 'in covers.'];
  const ctrlLines = CTRL.map((s, i) => txt(RX + 22, 108 + i * 20, s, { size: 11, fill: PAL.mut, mono: true, opacity: 0 }));
  const capR = svg('g', { opacity: 0 },
    txt(RX, 320, 'A dictionary entry: an excellent continuation', { size: 11, fill: PAL.tx }),
    txt(RX, 336, 'of the token "book", and no use whatsoever.', { size: 11, fill: PAL.tx }));

  const note = svg('g', { opacity: 0 },
    txt(LX, 372, 'Same weights, same sampler, same temperature on both sides. The difference is four lines of prefix —', { size: 11.5, fill: PAL.ink }),
    txt(LX, 388, 'and the prefix changed what the next token is for.', { size: 11.5, fill: PAL.ink }));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Left: four English-to-Korean word pairs listed one per line, then the word "book" with an empty slot, which the model fills with the correct Korean word; violet links run from the empty slot back to the four examples. Right: the same word "book" alone, which the model continues as a dictionary definition instead.',
  }, boxL, labL, pairNodes, queryG, links, linkLab, answer, capL,
     boxR, labR, ctrlPrompt, ctrlLines, capR, note);

  const fig = figure(
    `a few-shot prompt and its control. Nothing was trained between the two panels — the weights are frozen, and were frozen before either prompt existed. The left panel infers a rule from four examples in its own context window and applies it; the right panel, given the identical query with the examples removed, produces a lexicographer. This is <strong>in-context learning</strong>, and no one designed it in. (Behaviour of the kind Llama&nbsp;3.1&nbsp;405B base, Meta, July&nbsp;2024, shows on few-shot prompts; the Korean is illustrative.)`,
    root, { wide: true, key: 'icl' });

  return pin(fig, (p) => {
    labL.setAttribute('opacity', seg(p, 0.02, 0.07));
    boxL.setAttribute('opacity', seg(p, 0.03, 0.08));
    pairNodes.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.09 + i * 0.055, 0.15 + i * 0.055, ease.out)));
    queryG.setAttribute('opacity', seg(p, 0.34, 0.40));
    links.forEach((l, i) => l.setAttribute('opacity', seg(p, 0.43 + i * 0.025, 0.49 + i * 0.025)));
    linkLab.setAttribute('opacity', seg(p, 0.50, 0.55));
    answer.setAttribute('opacity', seg(p, 0.56, 0.62));
    capL.setAttribute('opacity', seg(p, 0.62, 0.68));
    labR.setAttribute('opacity', seg(p, 0.70, 0.74));
    boxR.setAttribute('opacity', seg(p, 0.70, 0.75));
    ctrlPrompt.setAttribute('opacity', seg(p, 0.74, 0.78));
    ctrlLines.forEach((l, i) => l.setAttribute('opacity', seg(p, 0.77 + i * 0.022, 0.82 + i * 0.022)));
    capR.setAttribute('opacity', seg(p, 0.86, 0.90));
    note.setAttribute('opacity', seg(p, 0.91, 0.97));
  }, { extent: 220 });
}
