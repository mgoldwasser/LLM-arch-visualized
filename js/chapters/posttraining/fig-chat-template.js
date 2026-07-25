/* The chat template as raw tokens — special tokens, the loss mask over the
   user turn, and the highlight over the only tokens that carry loss.
   Figure number is claimed by figure(); key 'chat'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';

export function chatTemplateFigure() {
  const W = 720, H = 210;
  const chipH = 26, fs = 11, y1 = 46, y2 = 118;

  // kind: special | nl | user | asst
  const line1 = [
    ['<|im_start|>', 'special'], ['user', 'special'], ['⏎', 'nl'],
    ['What', 'user'], [' is', 'user'], [' the', 'user'], [' capital', 'user'], [' of', 'user'], [' France', 'user'], ['?', 'user'],
    ['<|im_end|>', 'special'],
  ];
  const line2 = [
    ['<|im_start|>', 'special'], ['assistant', 'special'], ['⏎', 'nl'],
    ['The', 'asst'], [' capital', 'asst'], [' of', 'asst'], [' France', 'asst'], [' is', 'asst'], [' Paris', 'asst'], ['.', 'asst'],
    ['<|im_end|>', 'asst'],
  ];

  const chipW = (t) => Math.round(t.length * 6.6) + 12;
  function layout(tokens, y) {
    let x = 30;
    return tokens.map(([t, kind]) => {
      const w = chipW(t);
      const node = { t, kind, x, y, w };
      x += w + 5;
      return node;
    });
  }
  const chips1 = layout(line1, y1), chips2 = layout(line2, y2);
  const styleFor = (kind) => kind === 'special'
    ? { fill: 'rgba(180,140,224,0.14)', stroke: PAL.attn, text: PAL.attn }
    : kind === 'nl'
      ? { fill: 'none', stroke: PAL.mut, text: PAL.mut }
      : { fill: 'rgba(230,237,243,0.06)', stroke: 'rgba(230,237,243,0.25)', text: PAL.tx };

  const mkChip = (c) => {
    const s = styleFor(c.kind);
    return svg('g', { opacity: 0 },
      svg('rect', { x: c.x, y: c.y, width: c.w, height: chipH, rx: 5, fill: s.fill, stroke: s.stroke, 'stroke-width': 1 }),
      txt(c.x + c.w / 2, c.y + 17, c.t, { size: fs, fill: s.text, anchor: 'middle', mono: true }));
  };
  const chipNodes1 = chips1.map(mkChip), chipNodes2 = chips2.map(mkChip);

  /* mask over everything that is not assistant output */
  const maskEnd1 = chips1[chips1.length - 1];
  const maskW1full = maskEnd1.x + maskEnd1.w - 24;
  const mask1 = svg('rect', { x: 24, y: y1 - 6, width: 0, height: chipH + 12, rx: 7, fill: 'rgba(107,118,131,0.30)', stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '4 4' });
  const roleEnd2 = chips2[2];
  const maskW2full = roleEnd2.x + roleEnd2.w - 24;
  const mask2 = svg('rect', { x: 24, y: y2 - 6, width: 0, height: chipH + 12, rx: 7, fill: 'rgba(107,118,131,0.30)', stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '4 4' });
  const maskTag = txt(694, y1 + 16, 'loss masked', { size: 11, anchor: 'end', opacity: 0 });

  /* highlight + brace under the assistant's tokens */
  const aStart = chips2[3], aEnd = chips2[chips2.length - 1];
  const hi = svg('rect', {
    x: aStart.x - 4, y: y2 - 6, width: aEnd.x + aEnd.w - aStart.x + 8, height: chipH + 12, rx: 7,
    fill: 'rgba(240,120,80,0.10)', stroke: PAL.loss, 'stroke-width': 1.4, opacity: 0,
  });
  const braceY = y2 + chipH + 14;
  const brace = svg('path', {
    d: `M ${aStart.x - 4} ${braceY} L ${aStart.x - 4} ${braceY + 6} L ${aEnd.x + aEnd.w + 4} ${braceY + 6} L ${aEnd.x + aEnd.w + 4} ${braceY}`,
    stroke: PAL.loss, 'stroke-width': 1.2, fill: 'none', opacity: 0,
  });
  const braceTag = txt((aStart.x + aEnd.x + aEnd.w) / 2, braceY + 24, 'loss computed only on these tokens',
    { size: 11.5, fill: PAL.loss, anchor: 'middle', opacity: 0 });
  const legend = txt(694, 20, '■ special (template) tokens', { size: 10, fill: PAL.attn, anchor: 'end', opacity: 0.9 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A chat rendered as raw token chips: im_start user, the question, im_end, then im_start assistant and the answer. The user turn is covered by a loss mask; only the assistant tokens are highlighted as carrying training loss.',
  }, legend, mask1, mask2, chipNodes1, chipNodes2, maskTag, hi, brace, braceTag);

  const fig = figure(
    `the raw token view of every chat you've had. &ldquo;Turns&rdquo; are a formatting convention the model learns, not an API feature — and the loss mask means the model learns to produce answers, not to imitate users.`,
    root, { wide: true, key: 'chat' });

  const all = [...chipNodes1, ...chipNodes2];
  return pin(fig, (p) => {
    all.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.08 + i * 0.012, 0.13 + i * 0.012, ease.out)));
    const tMask = seg(p, 0.42, 0.54, ease.inOut);
    mask1.setAttribute('width', maskW1full * tMask);
    mask2.setAttribute('width', maskW2full * tMask);
    maskTag.setAttribute('opacity', seg(p, 0.50, 0.56));
    hi.setAttribute('opacity', seg(p, 0.58, 0.66));
    brace.setAttribute('opacity', seg(p, 0.62, 0.70));
    braceTag.setAttribute('opacity', seg(p, 0.64, 0.72));
  });
}
