/* Video — images × time, and the token-budget explosion. Every number below
   the film strip is computed from the frame rate, the per-frame budget and
   K3's real context window; nothing is typed in. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, chNum, PAL } from '../../core/components.js';
import { track } from '../../core/scroll.js';
import { seg, pct } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { photoArt } from './art-photo.js';

export function videoFigure() {
  const TOK_PER_FRAME = 256, FPS = 1, SECS = 3600;
  const total = TOK_PER_FRAME * FPS * SECS;                    // computed, not typed
  const share = total / K3.contextWindow;

  const W = 720, H = 300;
  const FS = 76, FY = 52;
  const frames = Array.from({ length: 5 }, (_, i) => {
    const x = 56 + i * 126;
    return svg('g', { opacity: 0 },
      // sprocket holes
      [0, 1, 2, 3].map((k) => svg('rect', { x: x + 8 + k * 18, y: FY - 12, width: 9, height: 6, rx: 1.5, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 })),
      [0, 1, 2, 3].map((k) => svg('rect', { x: x + 8 + k * 18, y: FY + FS + 6, width: 9, height: 6, rx: 1.5, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 })),
      svg('g', { transform: `translate(${x}, ${FY})` }, photoArt(FS, i)),
      svg('rect', { x, y: FY, width: FS, height: FS, fill: 'none', stroke: PAL.mut, 'stroke-width': 1 }),
      svg('text', { x: x + FS / 2, y: FY + FS + 30, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'monospace', 'font-size': 10.5 }, `≈${TOK_PER_FRAME} tok`),
      svg('text', { x: x + FS / 2, y: FY + FS + 44, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 9.5 }, `t = ${i}s`));
  });
  const stripLine = svg('path', { d: `M 56 ${FY + FS + 56} L 664 ${FY + FS + 56}`, stroke: PAL.mut, 'stroke-width': 1.2, fill: 'none', 'marker-end': 'url(#mm-video-arr)', opacity: 0 });
  const stripTag = svg('text', { x: 56, y: FY + FS + 74, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'sample at 1–2 fps · patchify each frame · add a temporal position');

  const math1 = svg('text', { x: W / 2, y: 236, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 14, opacity: 0 },
    `1 hour · ${FPS} fps · ${TOK_PER_FRAME} tokens/frame = ${total.toLocaleString('en-US')} tokens`);
  const math2 = svg('text', { x: W / 2, y: 260, 'text-anchor': 'middle', fill: PAL.loss, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0 },
    `= ${pct(share, 0)} of K3's ${K3.contextWindow.toLocaleString('en-US')}-token window — this is what million-token contexts are for (ch. ${chNum('attention-scale')})`);

  const defs = svg('defs', {},
    svg('marker', { id: 'mm-video-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `A film strip of five sampled video frames, each costing about ${TOK_PER_FRAME} tokens; the arithmetic below shows one hour at one frame per second equals ${total.toLocaleString('en-US')} tokens, about ${pct(share, 0)} of K3's context window.`,
  }, defs, frames, stripLine, stripTag, math1, math2);

  const node = figure(
    `video is images × time — and the token bill multiplies accordingly. Mitigations are aggressive: temporal pooling (merge neighboring frames' tokens), keyframe selection, and token merging, often compressing a frame to 16–64 tokens before the LLM sees it.`,
    root, { key: 'video' });

  track(node, (p) => {
    frames.forEach((f, i) => f.setAttribute('opacity', seg(p, 0.12 + i * 0.05, 0.22 + i * 0.05)));
    stripLine.setAttribute('opacity', seg(p, 0.36, 0.44));
    stripTag.setAttribute('opacity', seg(p, 0.4, 0.48));
    math1.setAttribute('opacity', seg(p, 0.48, 0.56));
    math2.setAttribute('opacity', seg(p, 0.54, 0.62));
  });
  return node;
}
