/* Recite, then drift — a reference passage against what the model produced,
   coloured by an actual character-by-character comparison of the two strings.
   Nothing here is hand-coloured: DIV is computed. Figure key 'drift'.      */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

const REF = "Zebras are African equines with distinctive black-and-white striped coats. "
  + "There are three living species: the Grévy's zebra, the plains zebra, and the mountain zebra.";
const REC = "Zebras are African equines with distinctive black-and-white striped coats. "
  + "There are three living species: the Grévy's zebra, the plains zebra, and the Burchell's zebra, "
  + "first described by Linnaeus in 1758.";

/* the divergence point, walked rather than declared */
const DIV = (() => {
  let i = 0;
  while (i < REF.length && i < REC.length && REF[i] === REC[i]) i++;
  return i;
})();

const CW = 7.2, FS = 12, MAX = 86, X = 26;

function wrap(s) {
  const lines = [];
  let i = 0;
  while (i < s.length) {
    if (i + MAX >= s.length) { lines.push({ start: i, text: s.slice(i) }); break; }
    let cut = s.lastIndexOf(' ', i + MAX);
    if (cut <= i) cut = i + MAX;
    lines.push({ start: i, text: s.slice(i, cut) });
    i = cut + (s[cut] === ' ' ? 1 : 0);
  }
  return lines;
}

/* one <text> per word, split again wherever the divergence falls mid-word */
function runsFor(line, y) {
  const out = [];
  let off = 0;
  for (const w of line.text.split(' ')) {
    if (w) {
      const s = line.start + off;
      const cuts = (s < DIV && s + w.length > DIV) ? [[s, DIV - s], [DIV, w.length - (DIV - s)]] : [[s, w.length]];
      for (const [cs, len] of cuts) out.push({ start: cs, y, lineStart: line.start, text: REC.substr(cs, len) });
    }
    off += w.length + 1;
  }
  return out;
}

const mono = (x, y, s, fill, opacity) => svg('text', {
  x, y, fill, opacity, 'font-family': 'monospace', 'font-size': FS,
  textLength: s.length * CW, lengthAdjust: 'spacing',
}, s);

export function driftFigure() {
  const W = 720, H = 400;
  const refLines = wrap(REF), recLines = wrap(REC);

  const labA = txt(X, 30, 'the reference — an encyclopedia lead, upsampled, in the corpus many times over', { size: 10.5, opacity: 0 });
  const refNodes = refLines.map((l, i) => mono(X, 58 + i * 24, l.text, PAL.mut, 0));
  const rule = svg('line', { x1: X, y1: 106, x2: 694, y2: 106, stroke: 'rgba(230,237,243,0.10)', 'stroke-width': 1, opacity: 0 });
  const labB = txt(X, 130, 'what came back, prompted with the first six words', { size: 10.5, opacity: 0 });

  const rowY = (i) => 160 + i * 30;
  const runs = recLines.flatMap((l, i) => runsFor(l, rowY(i)));
  const runNodes = runs.map((r) =>
    mono(X + (r.start - r.lineStart) * CW, r.y, r.text, r.start < DIV ? PAL.weight : PAL.loss, 0));

  /* the rule under everything invented, drawn from the same DIV */
  const underlines = recLines.map((l, i) => {
    const end = l.start + l.text.length;
    if (end <= DIV) return null;
    const from = Math.max(l.start, DIV);
    return svg('line', {
      x1: X + (from - l.start) * CW, y1: rowY(i) + 6, x2: X + (end - l.start) * CW, y2: rowY(i) + 6,
      stroke: PAL.loss, 'stroke-width': 1, opacity: 0,
    });
  }).filter(Boolean);

  const divLine = recLines.findIndex((l) => DIV >= l.start && DIV < l.start + l.text.length);
  const divX = X + (DIV - recLines[divLine].start) * CW;
  const divMark = svg('g', { opacity: 0 },
    svg('path', { d: `M ${divX - 5} ${rowY(divLine) + 15} L ${divX + 5} ${rowY(divLine) + 15} L ${divX} ${rowY(divLine) + 8} z`, fill: PAL.loss }),
    txt(694, rowY(divLine) + 34, 'recall gives way to invention here', { size: 9.5, fill: PAL.loss, anchor: 'end' }));

  const matchPct = (DIV / REF.length) * 100;
  const readout = svg('g', { opacity: 0 },
    txt(X, 272, `${DIV} of ${REF.length} characters reproduced exactly (${matchPct.toFixed(0)}%) — computed by walking the two strings.`, { size: 11.5, fill: PAL.ink }),
    txt(X, 290, `The ${REC.length - DIV} characters after the divergence are fluent, specific, and absent from the source.`, { size: 11.5, fill: PAL.ink }));

  const BARW = 500, matchW = BARW * (DIV / REF.length);
  const barBg = svg('rect', { x: X, y: 310, width: BARW, height: 14, rx: 3, fill: 'rgba(107,118,131,0.30)', opacity: 0 });
  const barFg = svg('rect', { x: X, y: 310, width: 0, height: 14, rx: 3, fill: PAL.weight, opacity: 0.85 });
  const barLab = svg('g', { opacity: 0 },
    txt(X, 340, 'verbatim from the weights', { size: 9.5, fill: PAL.weight }),
    txt(X + BARW, 340, 'never recovered', { size: 9.5, anchor: 'end' }),
    txt(X + BARW + 14, 321, `${matchPct.toFixed(0)}%`, { size: 12, fill: PAL.weight, mono: true }));

  const note = svg('g', { opacity: 0 },
    txt(X, 368, `Nothing changes at character ${DIV}. The same loop that recited produced the invention —`, { size: 11, fill: PAL.ink }),
    txt(X, 384, 'there is no internal boundary between remembering and making something up.', { size: 11, fill: PAL.ink }));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `A reference encyclopedia sentence about zebras above what the model produced below. The first ${DIV} characters match exactly and are shown in amber; everything after them, an invented attribution to Linnaeus, is shown in red-orange and underlined. A bar reports ${matchPct.toFixed(0)} percent verbatim reproduction.`,
  }, labA, refNodes, rule, labB, runNodes, underlines, divMark, readout, barBg, barFg, barLab, note);

  const fig = figure(
    `the fidelity and the drift in one picture. The colour split is not authored: the two strings are compared character by character and the boundary falls where they stop agreeing, at character ${DIV} of ${REF.length}. Documents the crawl saw hundreds of times can be recited a long way — and the recitation ends without any signal that it has ended. (Passage written for this figure; the behaviour is the one Llama&nbsp;3.1&nbsp;405B base, Meta, July&nbsp;2024, shows on heavily-duplicated encyclopedia text.)`,
    root, { wide: true, key: 'drift' });

  return pin(fig, (p) => {
    labA.setAttribute('opacity', seg(p, 0.02, 0.07));
    refNodes.forEach((n, i) => n.setAttribute('opacity', seg(p, 0.04 + i * 0.03, 0.10 + i * 0.03)));
    rule.setAttribute('opacity', seg(p, 0.11, 0.15));
    labB.setAttribute('opacity', seg(p, 0.12, 0.17));
    const span = 0.40 / Math.max(1, runNodes.length);
    runNodes.forEach((n, i) => n.setAttribute('opacity', seg(p, 0.16 + i * span, 0.20 + i * span, ease.out)));
    underlines.forEach((u, i) => u.setAttribute('opacity', seg(p, 0.60 + i * 0.02, 0.66 + i * 0.02)));
    divMark.setAttribute('opacity', seg(p, 0.64, 0.70));
    readout.setAttribute('opacity', seg(p, 0.72, 0.78));
    barBg.setAttribute('opacity', seg(p, 0.78, 0.83));
    barFg.setAttribute('width', matchW * seg(p, 0.80, 0.88, ease.out));
    barLab.setAttribute('opacity', seg(p, 0.86, 0.91));
    note.setAttribute('opacity', seg(p, 0.92, 0.98));
  }, { extent: 220 });
}
