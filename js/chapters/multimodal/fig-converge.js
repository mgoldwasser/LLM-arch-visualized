/* The chapter's punchline, stated first: three modalities converge on one row
   of identical vector slots. Tracked figure — fades in as it transits. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, chNum, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, ease, rng } from '../../core/anim.js';
import { photoArt } from './art-photo.js';

export function convergeFigure() {
  const W = 720, H = 350;

  const colLabel = (x, s) => svg('text', { x, y: 34, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, s);

  // text stream
  const words = [['a', 26], ['cat', 42], ['at', 30], ['night', 56]];
  let wx = 42;
  const chips = words.map(([w, cw]) => {
    const g = svg('g', { transform: `translate(${wx}, 48)`, opacity: 0 },
      svg('rect', { width: cw, height: 28, rx: 6, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
      svg('text', { x: cw / 2, y: 19, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 12.5 }, w));
    wx += cw + 7;
    return g;
  });

  // image stream
  const thumb = svg('g', { transform: 'translate(322, 44)', opacity: 0 },
    photoArt(78),
    svg('rect', { width: 78, height: 78, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, rx: 0.5 }));

  // audio stream
  const r = rng(11);
  let d = 'M 520 82';
  for (let i = 1; i <= 34; i++) {
    const x = 520 + i * 5;
    const a = (i % 2 ? -1 : 1) * (4 + r() * 22) * Math.sin((i / 34) * Math.PI);
    d += ` L ${x} ${(82 + a).toFixed(1)}`;
  }
  const wave = svg('path', { d, stroke: PAL.tx, 'stroke-width': 1.4, fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });

  // converging arrows, each tagged with its encoder
  const mkArrow = (x1, y1, x2, y2) => svg('path', {
    d: `M ${x1} ${y1} C ${x1} ${y1 + 46}, ${x2} ${y2 - 46}, ${x2} ${y2}`,
    stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#mm-converge-arr)', opacity: 0,
  });
  const arrT = mkArrow(120, 84, 210, 202);
  const arrI = mkArrow(361, 130, 361, 202);
  const arrA = mkArrow(605, 112, 512, 202);
  const tagT = svg('text', { x: 122, y: 150, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    `tokenizer + embedding rows (ch. ${chNum('tokens')})`);
  const tagI = svg('text', { x: 374, y: 168, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 }, 'patch encoder');
  const tagA = svg('text', { x: 530, y: 150, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 }, 'audio encoder');

  // the one row of identical vector slots
  const SLOTS = 12, SW = 44, SG = 5;
  const sx0 = (W - (SLOTS * (SW + SG) - SG)) / 2;
  const slots = Array.from({ length: SLOTS }, (_, i) => svg('rect', {
    x: sx0 + i * (SW + SG), y: 210, width: SW, height: 26, rx: 5,
    fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 1.1, opacity: 0,
  }));
  const slotLabel = svg('text', { x: W / 2, y: 262, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    'a sequence of d_model vectors — the residual stream never asks where a vector came from');

  const arrS = svg('path', { d: 'M 360 272 L 360 292', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#mm-converge-arr)', opacity: 0 });
  const stack = svg('g', { opacity: 0 },
    svg('rect', { x: 288, y: 298, width: 144, height: 36, rx: 9, fill: 'rgba(90,200,220,0.06)', stroke: PAL.act, 'stroke-width': 1.3 }),
    svg('text', { x: 360, y: 321, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11.5 }, 'the stack of layers'));

  const defs = svg('defs', {},
    svg('marker', { id: 'mm-converge-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Three input streams — text token chips, a small photograph, and an audio waveform — each pass through their own encoder and converge onto a single row of identical vector slots that feed the stack of layers.',
  }, defs, colLabel(42, 'text'), colLabel(322, 'image'), colLabel(520, 'audio (waveform)'),
    chips, thumb, wave, arrT, arrI, arrA, tagT, tagI, tagA, slots, slotLabel, arrS, stack);

  const node = figure(
    'the punchline of the chapter, stated first: a transformer layer consumes vectors, not text. Anything that can be turned into a sequence of d_model vectors can enter the stack.',
    root, { key: 'converge' });

  return pin(node, (p) => {
    chips.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.08 + i * 0.02, 0.16 + i * 0.02)));
    thumb.setAttribute('opacity', seg(p, 0.12, 0.2));
    wave.setAttribute('stroke-dashoffset', 1 - seg(p, 0.14, 0.3, ease.inOut));
    [[arrT, tagT], [arrI, tagI], [arrA, tagA]].forEach(([a, t], i) => {
      const o = seg(p, 0.26 + i * 0.03, 0.36 + i * 0.03);
      a.setAttribute('opacity', o); t.setAttribute('opacity', o);
    });
    slots.forEach((s, i) => s.setAttribute('opacity', seg(p, 0.36 + i * 0.012, 0.46 + i * 0.012)));
    slotLabel.setAttribute('opacity', seg(p, 0.48, 0.56));
    arrS.setAttribute('opacity', seg(p, 0.54, 0.6));
    stack.setAttribute('opacity', seg(p, 0.56, 0.64));
  });
}
