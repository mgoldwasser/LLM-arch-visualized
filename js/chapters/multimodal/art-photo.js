/* The chapter's stand-in photograph — a cat under the moon. One drawing, shared
   by every figure here that needs an image (the converging streams, the ViT
   scene, the patchify widget, the codebook, the film strip), so the reader sees
   the same picture travel through five different pipelines.

   Authored in a 100×100 box; scale to any display size. `phase` nudges the moon
   so successive video frames differ. */

import { svg } from '../../core/dom.js';

export function photoArt(s, phase = 0) {
  const k = s / 100;
  return svg('g', { transform: `scale(${k})` },
    svg('rect', { width: 100, height: 100, fill: '#1D2A38' }),
    svg('circle', { cx: 72 + phase * 4, cy: 22, r: 11, fill: '#E6DCC3', opacity: 0.92 }),
    svg('circle', { cx: 30, cy: 14, r: 1.1, fill: '#E6DCC3', opacity: 0.7 }),
    svg('circle', { cx: 48, cy: 26, r: 0.9, fill: '#E6DCC3', opacity: 0.55 }),
    svg('circle', { cx: 14, cy: 34, r: 0.9, fill: '#E6DCC3', opacity: 0.5 }),
    svg('rect', { y: 74, width: 100, height: 26, fill: '#20301F' }),
    // the cat: body, head, ears, tail
    svg('path', { d: 'M 32 78 C 30 62 36 54 44 52 L 41 41 L 48 47 C 51 45.5 55 45.5 58 47 L 65 41 L 62 52 C 70 54 76 63 74 78 Z', fill: '#0B0E12' }),
    svg('path', { d: 'M 74 76 C 86 72 90 62 85 55', stroke: '#0B0E12', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }),
    svg('circle', { cx: 48, cy: 53, r: 1.5, fill: '#E6DCC3' }),
    svg('circle', { cx: 58, cy: 53, r: 1.5, fill: '#E6DCC3' }));
}
