/* Figure — one sampled chunk is many training examples.

   A window of BLOCK+1 tokens carries BLOCK (context, target) pairs, and the
   causal mask means all of them are supervised in the same forward pass. The
   tally is derived from BLOCK; no count is typed anywhere in this file. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, figure, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, clamp, norm, ease, si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

/* Block size — the number of tokens a sampled chunk predicts, so the chunk
   itself is one token longer. Eight is small enough to count by eye; a
   frontier run uses a block four orders of magnitude larger and the
   arithmetic is unchanged. */
export const BLOCK = 8;
const CHUNK = BLOCK + 1;
const TOKENS = ['The', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog'].slice(0, CHUNK);

const DIM = 'rgba(230,237,243,0.035)';
const CTX = 'rgba(90,200,220,0.22)';
const TGT = 'rgba(224,168,76,0.22)';

export function chunkExamplesFigure() {
  const W = 720, H = 452;
  const CW = 64, CG = 7, CY = 54, CH = 32;
  const px = (j) => 44 + j * (CW + CG);
  const cx = (j) => px(j) + CW / 2;

  /* the chunk itself */
  const cells = TOKENS.map((_, j) => svg('rect', {
    x: px(j), y: CY, width: CW, height: CH, rx: 5,
    fill: DIM, stroke: PAL.mut, 'stroke-width': 1, opacity: 0,
  }));
  const words = TOKENS.map((t, j) => txt(cx(j), CY + 21, t, { size: 12, fill: PAL.mut, anchor: 'middle', mono: true, opacity: 0 }));
  const idxs = TOKENS.map((_, j) => txt(cx(j), CY - 9, String(j), { size: 9, anchor: 'middle', mono: true, opacity: 0 }));
  const chunkTag = txt(44, 30, `one sampled chunk — ${CHUNK} tokens`, { size: 11, fill: PAL.tx, opacity: 0 });

  /* the moving bracket: context in the activation colour, target in the weight colour */
  const ctxBar = svg('path', { d: '', stroke: PAL.act, 'stroke-width': 1.6, fill: 'none', opacity: 0 });
  const ctxTag = txt(0, 118, '', { size: 10.5, fill: PAL.act, anchor: 'middle' });
  const tgtBar = svg('path', { d: '', stroke: PAL.weight, 'stroke-width': 1.6, fill: 'none', opacity: 0 });
  const tgtTag = txt(0, 118, 'target', { size: 10.5, fill: PAL.weight, anchor: 'middle', opacity: 0 });

  /* the ledger: one row per example, each a miniature of the row above */
  const MW = 11, MG = 2.5, LY = 154, RH = 27;
  const mx = (j) => 44 + j * (MW + MG);
  const rows = Array.from({ length: BLOCK }, (_, i) => {
    const k = i + 1, y = LY + i * RH;
    const mini = TOKENS.map((_, j) => svg('rect', {
      x: mx(j), y, width: MW, height: 12, rx: 2,
      fill: j < k ? CTX : (j === k ? TGT : DIM),
      stroke: j < k ? PAL.act : (j === k ? PAL.weight : PAL.mut), 'stroke-width': 0.7,
    }));
    const lab = txt(mx(CHUNK) + 14, y + 11,
      `example ${k} — predict “${TOKENS[k]}” from ${k} token${k === 1 ? '' : 's'}`,
      { size: 11, fill: PAL.tx });
    return svg('g', { opacity: 0 }, mini, lab);
  });

  /* the tally */
  const tallyBox = svg('g', { opacity: 0 },
    svg('rect', { x: 470, y: 152, width: 210, height: 104, rx: 10, fill: 'rgba(90,200,220,0.05)', stroke: PAL.act, 'stroke-width': 1.2 }),
    txt(575, 174, 'training examples so far', { size: 10.5, anchor: 'middle' }));
  const tallyNum = txt(575, 222, '0', { size: 40, fill: PAL.act, anchor: 'middle', mono: true, opacity: 0 });
  const tallyDen = txt(575, 244, `of ${BLOCK} — one per prefix`, { size: 10.5, anchor: 'middle', opacity: 0 });
  const tallyDone = txt(575, 278, `${BLOCK} = the block size`, { size: 11.5, fill: PAL.act, anchor: 'middle', mono: true, opacity: 0 });

  const notes = [
    txt(44, 372, 'every one of these is supervised in the same forward pass — that is what the causal mask buys', { size: 10.5, fill: PAL.tx }),
    txt(44, 396, `so the model is trained at context length 1, 2, 3, … up to ${BLOCK}, in one pass over one chunk`, { size: 10.5, fill: PAL.tx }),
    txt(44, 420, 'which is why a trained model will continue from a one-token prompt: that case was in every chunk it read', { size: 10.5, fill: PAL.act }),
  ];
  notes.forEach((n) => n.setAttribute('opacity', 0));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `A row of ${CHUNK} tokens. A bracket walks left to right; at each stop the tokens before the bracket are lit as context and the next token as the target, and a ledger below accumulates one row per example until it holds ${BLOCK} of them — one training example for every prefix of the chunk.`,
  }, chunkTag, idxs, cells, words, ctxBar, ctxTag, tgtBar, tgtTag, rows, tallyBox, tallyNum, tallyDen, tallyDone, notes);

  const fig = figure(
    `one chunk of ${CHUNK} tokens is ${BLOCK} training examples — every prefix of it, supervised at once. Nothing here is special to ${BLOCK}: K3&rsquo;s context runs to ${si(K3.contextWindow)} tokens, and a chunk that long is that many examples for the price of one forward pass.`,
    root, { wide: true, key: 'chunk' });

  return pin(fig, (p) => {
    const intro = seg(p, 0.02, 0.09, ease.out);
    chunkTag.setAttribute('opacity', intro);
    cells.forEach((c, j) => c.setAttribute('opacity', seg(p, 0.02 + j * 0.006, 0.08 + j * 0.006, ease.out)));
    words.forEach((w, j) => w.setAttribute('opacity', seg(p, 0.02 + j * 0.006, 0.08 + j * 0.006, ease.out)));
    idxs.forEach((n) => n.setAttribute('opacity', intro * 0.85));

    /* the sweep: k = the example currently being read off, 0 = not started */
    const sweep = clamp(norm(p, 0.14, 0.86));
    const k = sweep <= 0 ? 0 : Math.min(BLOCK, Math.floor(sweep * BLOCK) + 1);

    cells.forEach((c, j) => {
      const isCtx = k > 0 && j < k, isTgt = k > 0 && j === k;
      c.setAttribute('fill', isCtx ? CTX : (isTgt ? TGT : DIM));
      c.setAttribute('stroke', isCtx ? PAL.act : (isTgt ? PAL.weight : PAL.mut));
      words[j].setAttribute('fill', isCtx || isTgt ? PAL.ink : PAL.mut);
    });

    /* geometry is written every call from kk, visibility from k — so the
       figure's DOM at a given p is the same whichever direction you arrived */
    const on = k > 0 ? 1 : 0;
    const kk = Math.max(1, k);
    const cEnd = px(kk - 1) + CW;
    ctxBar.setAttribute('d', `M ${px(0)} 94 V 101 H ${cEnd} V 94`);
    ctxBar.setAttribute('opacity', on);
    ctxTag.setAttribute('x', (px(0) + cEnd) / 2);
    ctxTag.textContent = `context — ${kk} token${kk === 1 ? '' : 's'}`;
    ctxTag.setAttribute('opacity', on);
    tgtBar.setAttribute('d', `M ${px(kk)} 94 V 101 H ${px(kk) + CW} V 94`);
    tgtBar.setAttribute('opacity', on);
    tgtTag.setAttribute('x', cx(kk));
    tgtTag.setAttribute('opacity', on);

    rows.forEach((g, i) => g.setAttribute('opacity', i < k ? 1 : 0));

    tallyBox.setAttribute('opacity', seg(p, 0.14, 0.20));
    tallyNum.setAttribute('opacity', seg(p, 0.14, 0.20));
    tallyDen.setAttribute('opacity', seg(p, 0.14, 0.20));
    tallyNum.textContent = String(k);
    tallyDone.setAttribute('opacity', k === BLOCK ? seg(p, 0.84, 0.88) : 0);

    notes.forEach((n, i) => n.setAttribute('opacity', seg(p, 0.88 + i * 0.035, 0.93 + i * 0.035)));
  });
}
