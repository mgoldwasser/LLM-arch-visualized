/* The discrete alternative — a learned codebook. An image becomes a grid of
   integers, and the lookup on the right is the text embedding lookup mirrored:
   same object, vocabulary learned by a neural net instead of counted. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, chNum, figRef, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, rng } from '../../core/anim.js';
import { photoArt } from './art-photo.js';

export function codebookFigure() {
  const W = 720, H = 320;
  const rInt = rng(23);

  const photo = svg('g', { transform: 'translate(30, 64)', opacity: 0 },
    photoArt(84),
    svg('rect', { width: 84, height: 84, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 }));
  const arr1 = svg('path', { d: 'M 120 106 L 148 106', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mm-codebook-arr)', opacity: 0 });
  const enc = svg('g', { opacity: 0 },
    svg('rect', { x: 152, y: 86, width: 96, height: 40, rx: 8, fill: 'rgba(224,168,76,0.10)', stroke: PAL.weight, 'stroke-width': 1.3 }),
    svg('text', { x: 200, y: 106, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 11 }, 'conv encoder'),
    svg('text', { x: 200, y: 119, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 9.5 }, '+ nearest code'));
  const arr2 = svg('path', { d: 'M 252 106 L 280 106', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mm-codebook-arr)', opacity: 0 });

  // 4×4 grid of code indices
  const IX = 288, IY = 48, CW2 = 44, CH2 = 28, GAP = 5;
  const codes = Array.from({ length: 16 }, () => Math.floor(rInt() * 8192));
  const idxCells = codes.map((c, i) => {
    const x = IX + (i % 4) * (CW2 + GAP), y = IY + Math.floor(i / 4) * (CH2 + GAP);
    return svg('g', { transform: `translate(${x}, ${y})`, opacity: 0 },
      svg('rect', { width: CW2, height: CH2, rx: 4, fill: 'rgba(224,168,76,0.12)', stroke: PAL.weight, 'stroke-width': 1 }),
      svg('text', { x: CW2 / 2, y: 18, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 11 }, c));
  });
  const idxLabel = svg('text', { x: IX, y: 38, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'grid of codebook indices');
  const idxSub = svg('text', { x: IX, y: IY + 4 * (CH2 + GAP) + 14, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 },
    '(32×32 in practice — drawn 4×4)');

  // the codebook — the embedding matrix E of the tokens chapter, mirrored
  const CBX = 540, CBY = 40, CBW = 84, CBH = 216;
  const cbLines = Array.from({ length: 12 }, (_, i) => svg('line', {
    x1: CBX + 1, y1: CBY + (i + 1) * (CBH / 13), x2: CBX + CBW - 1, y2: CBY + (i + 1) * (CBH / 13),
    stroke: PAL.weight, opacity: 0.12,
  }));
  const codebook = svg('g', { opacity: 0 },
    svg('rect', { x: CBX, y: CBY, width: CBW, height: CBH, rx: 4, fill: 'rgba(224,168,76,0.07)', stroke: PAL.weight, 'stroke-width': 1.4 }),
    cbLines,
    svg('text', { x: CBX + CBW, y: 28, 'text-anchor': 'end', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 11.5 }, 'codebook ∈ ℝ^(8192 × d)'),
    svg('text', { x: CBX + CBW / 2, y: CBY + CBH + 16, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'one row per code'));
  const hlRow = svg('rect', { x: CBX + 2, y: CBY + 96, width: CBW - 4, height: 9, rx: 2, fill: PAL.weight, opacity: 0 });
  const hlIdx = svg('rect', { x: IX + 2 * (CW2 + GAP) - 2, y: IY + (CH2 + GAP) - 2, width: CW2 + 4, height: CH2 + 4, rx: 5, fill: 'none', stroke: PAL.act, 'stroke-width': 1.6, opacity: 0 });
  const lookLine = svg('path', {
    d: `M ${IX + 2 * (CW2 + GAP) + CW2 + 4} ${IY + (CH2 + GAP) + CH2 / 2} C 500 ${IY + 40}, 510 ${CBY + 100}, ${CBX - 4} ${CBY + 100}`,
    stroke: PAL.act, 'stroke-width': 1.2, fill: 'none', 'stroke-dasharray': '4 4', opacity: 0, 'marker-end': 'url(#mm-codebook-arr-act)',
  });
  const outVec = svg('g', { opacity: 0 },
    svg('rect', { x: CBX + CBW + 12, y: CBY + 88, width: 60, height: 24, rx: 5, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.1 }),
    svg('text', { x: CBX + CBW + 42, y: CBY + 104, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'monospace', 'font-size': 12 }, 'eₖ'));

  const bottom = svg('text', { x: W / 2, y: 300, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    `indices are tokens — chapter ${chNum('objective')}’s next-token loss now trains image understanding and generation alike`);

  const defs = svg('defs', {},
    svg('marker', { id: 'mm-codebook-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'mm-codebook-arr-act', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.act })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `The discrete route: a photograph passes through a convolutional encoder and becomes a grid of integer codebook indices; one highlighted index looks up a row of a learned codebook matrix, mirroring the text embedding lookup of chapter ${chNum('tokens')}.`,
  }, defs, photo, arr1, enc, arr2, idxLabel, idxCells, idxSub, hlIdx, lookLine, codebook, hlRow, outVec, bottom);

  const node = figure(
    `vector quantization (VQ-VAE 2017, VQGAN 2021): compress the image to a grid of integers from a learned codebook. The lookup on the right is ${figRef('tokens', 'embedding')}'s embedding lookup, mirrored — except this vocabulary was learned by a neural net, not counted from text merges.`,
    root, { key: 'codebook' });

  track(node, (p) => {
    photo.setAttribute('opacity', seg(p, 0.1, 0.18));
    arr1.setAttribute('opacity', seg(p, 0.16, 0.21));
    enc.setAttribute('opacity', seg(p, 0.18, 0.24));
    arr2.setAttribute('opacity', seg(p, 0.22, 0.27));
    idxLabel.setAttribute('opacity', seg(p, 0.24, 0.3));
    idxCells.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.25 + i * 0.008, 0.32 + i * 0.008)));
    idxSub.setAttribute('opacity', seg(p, 0.38, 0.44));
    codebook.setAttribute('opacity', seg(p, 0.4, 0.48));
    hlIdx.setAttribute('opacity', seg(p, 0.48, 0.54));
    lookLine.setAttribute('opacity', seg(p, 0.5, 0.56));
    hlRow.setAttribute('opacity', seg(p, 0.53, 0.58));
    outVec.setAttribute('opacity', seg(p, 0.56, 0.62));
    bottom.setAttribute('opacity', seg(p, 0.6, 0.68));
  });
  return node;
}
