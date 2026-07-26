/* Figure — two honest footnotes to "1M context": attention sinks + the sliding
   window (StreamingLLM), and the lost-in-the-middle U-curve. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, rng, si } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { T1M } from './shared.js';

export function contextFigure() {
  const W = 760, H = 288;

  /* panel A — StreamingLLM: sinks + sliding window */
  const ax0 = 34, cw = 12.5, nTok = 25, cy = 206;
  const rA = rng(19);
  const massOf = (i) => (i === 0 ? 78 : i === 1 ? 50 : i === 2 ? 36 : i === 3 ? 26 : i >= nTok - 6 ? 14 + (i - (nTok - 6)) * 2.5 : 5 + rA() * 6);
  const aTitle = txt(ax0, 40, 'STREAMING — keep the sinks + a window', { size: 10.5, fill: PAL.ink });
  const aCells = [], aBars = [];
  for (let i = 0; i < nTok; i++) {
    const x = ax0 + i * (cw + 1);
    const sink = i < 4, win = i >= nTok - 6;
    aCells.push(svg('rect', {
      x, y: cy, width: cw, height: 16, rx: 2,
      fill: sink ? 'rgba(224,168,76,0.3)' : win ? 'rgba(90,200,220,0.25)' : 'rgba(107,118,131,0.12)',
      stroke: sink ? PAL.weight : win ? PAL.act : 'none', 'stroke-width': 1,
    }));
    aBars.push({ el: svg('rect', { x: x + 2, y: cy - 8, width: cw - 4, height: 0, rx: 1.5, fill: PAL.attn, 'fill-opacity': sink ? 0.9 : 0.55 }), h: massOf(i) });
  }
  const aMassLabel = txt(ax0, 100, 'attention mass received', { size: 9.5, fill: PAL.attn });
  const aSinkTag = txt(ax0, cy + 34, 'attention sinks — first tokens hoard mass; evict them and the model breaks', { size: 9.5, fill: PAL.weight });
  const aEvictTag = txt(ax0 + 12 * (cw + 1), cy - 62, 'evicted', { size: 9.5, anchor: 'middle' });
  const aWinTag = txt(ax0 + nTok * (cw + 1), cy + 52, 'sliding window — the recent past', { size: 9.5, fill: PAL.act, anchor: 'end' });

  /* panel B — lost in the middle */
  const bx0 = 424, bx1 = 726, by0 = 76, by1 = 206;
  const bTitle = txt(bx0, 40, 'CAPACITY ≠ COMPREHENSION', { size: 10.5, fill: PAL.ink });
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const acc = 1 - 0.52 * Math.pow(Math.abs(Math.sin(Math.PI * t)), 1.4);
    pts.push(`${bx0 + t * (bx1 - bx0)},${by1 - acc * (by1 - by0)}`);
  }
  const uCurve = svg('polyline', { points: pts.join(' '), fill: 'none', stroke: PAL.act, 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
  const needle = svg('line', { x1: bx0, y1: by1 - 0.97 * (by1 - by0), x2: bx1, y2: by1 - 0.97 * (by1 - by0), stroke: PAL.moe, 'stroke-width': 1.5, 'stroke-dasharray': '6 5' });
  const needleTag = txt(bx1, by1 - 0.97 * (by1 - by0) - 8, 'needle-in-a-haystack — saturated', { size: 9.5, fill: PAL.moe, anchor: 'end' });
  const uTag = txt((bx0 + bx1) / 2, by1 - 0.42 * (by1 - by0) + 20, 'multi-fact use — lost in the middle', { size: 9.5, fill: PAL.act, anchor: 'middle' });
  const bAxis = svg('g', {},
    svg('line', { x1: bx0, y1: by1, x2: bx1, y2: by1, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: bx0, y1: by0 - 8, x2: bx0, y2: by1, stroke: PAL.mut, 'stroke-width': 1 }),
    txt(bx0, by1 + 16, 'fact at start', { size: 9.5, mono: true }),
    txt((bx0 + bx1) / 2, by1 + 16, 'middle', { size: 9.5, anchor: 'middle', mono: true }),
    txt(bx1, by1 + 16, 'at end', { size: 9.5, anchor: 'end', mono: true }),
    svg('text', { x: bx0 - 10, y: (by0 + by1) / 2, fill: PAL.mut, 'font-size': 9.5, 'font-family': 'sans-serif', 'text-anchor': 'middle', transform: `rotate(-90, ${bx0 - 10}, ${(by0 + by1) / 2})` }, 'answer quality'));
  const bNote = txt(bx0, by1 + 46, `a ${si(T1M)}-token window is a capacity claim, not a comprehension claim`, { size: 10, fill: PAL.tx });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Left: a strip of context tokens under streaming attention — the first four tokens (attention sinks) receive tall bars of attention mass and are kept, the middle is evicted, and a sliding window keeps the recent past. Right: answer quality versus the position of a fact in context forms a U-shape — high at the start and end, sagging in the middle — while the needle-in-a-haystack score sits flat and saturated near the top.',
  }, aTitle, aCells, aBars.map((b2) => b2.el), aMassLabel, aSinkTag, aEvictTag, aWinTag,
    bTitle, bAxis, needle, needleTag, uCurve, uTag, bNote);

  const node = figure(
    `two honest footnotes to &ldquo;1M context&rdquo;. Left: softmax must sum to 1, so surplus mass parks on the first tokens (<em>sinks</em>) — StreamingLLM keeps them plus a window and streams forever in constant memory. Right: needle tests saturate long before real multi-fact comprehension does; position of information still matters.`,
    root, { wide: true, key: 'context' });
  return pin(node, (p) => {
    aTitle.setAttribute('opacity', seg(p, 0.08, 0.16));
    aCells.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.1 + i * 0.005, 0.18 + i * 0.005)));
    aBars.forEach((b2, i) => {
      const t = seg(p, 0.18 + i * 0.006, 0.3 + i * 0.006, ease.out);
      b2.el.setAttribute('height', b2.h * t);
      b2.el.setAttribute('y', cy - 8 - b2.h * t);
    });
    aMassLabel.setAttribute('opacity', seg(p, 0.22, 0.3));
    aSinkTag.setAttribute('opacity', seg(p, 0.3, 0.38));
    aEvictTag.setAttribute('opacity', seg(p, 0.32, 0.4));
    aWinTag.setAttribute('opacity', seg(p, 0.34, 0.42));
    bTitle.setAttribute('opacity', seg(p, 0.2, 0.28));
    bAxis.setAttribute('opacity', seg(p, 0.22, 0.3));
    needle.setAttribute('opacity', seg(p, 0.3, 0.38));
    needleTag.setAttribute('opacity', seg(p, 0.32, 0.4));
    uCurve.setAttribute('stroke-dashoffset', 1 - seg(p, 0.34, 0.52));
    uTag.setAttribute('opacity', seg(p, 0.48, 0.56));
    bNote.setAttribute('opacity', seg(p, 0.52, 0.62));
  });
}
