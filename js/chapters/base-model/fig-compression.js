/* The weights as lossy compression — how much the run squeezed the corpus,
   and how unevenly it can give any of it back. Figure key 'compression'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, fmtBytes } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { K3 } from '../../../data/k3.js';

const CORPUS = 44e12;          // ≈15T tokens of filtered web text, FineWeb-scale
const GZIP_RATIO = 4;          // gzip on plain English text, approximately
const BYTES_PER_PARAM = 2;     // the base checkpoint is bf16; MXFP4 arrives at SFT

/* Recall fidelity as a saturating function of how often a document was seen.
   Schematic — the shape is the claim, not the constant. */
const fid = (n) => n / (n + 8);

export function compressionFigure() {
  const W = 720, H = 430;

  const ckpt = K3.totalParams * BYTES_PER_PARAM;
  const gz = CORPUS / GZIP_RATIO;
  const ratio = CORPUS / ckpt;

  /* ---- panel A: three sizes --------------------------------------------- */
  const BX = 190, BMAX = 480, BH = 20;
  const bars = [
    { lab: 'the corpus, as text', v: CORPUS, fill: 'rgba(107,118,131,0.55)', stroke: PAL.mut, note: '' },
    { lab: 'the same text, gzipped', v: gz, fill: 'rgba(107,118,131,0.28)', stroke: PAL.mut, note: 'lossless — every byte comes back' },
    { lab: 'the base checkpoint', v: ckpt, fill: 'rgba(224,168,76,0.35)', stroke: PAL.weight, note: `${K3.totalParams / 1e12} T parameters × ${BYTES_PER_PARAM} bytes` },
  ].map((b, i) => {
    const y = 56 + i * 36, w = (b.v / CORPUS) * BMAX;
    return {
      ...b, w,
      rect: svg('rect', { x: BX, y, width: 0, height: BH, rx: 3, fill: b.fill, stroke: b.stroke, 'stroke-width': 1 }),
      /* value labels are built at their p = 0 position (the bar has no width
         yet) so the first paint matches the update function's p = 0 state */
      name: txt(BX - 10, y + 14, b.lab, { size: 11, fill: i === 2 ? PAL.weight : PAL.tx, anchor: 'end', opacity: 0 }),
      val: txt(BX + 8, y + 14, fmtBytes(b.v), { size: 11, fill: i === 2 ? PAL.weight : PAL.tx, mono: true, opacity: 0 }),
      sub: b.note ? txt(BX + 8, y + 26, b.note, { size: 9, opacity: 0 }) : null,
    };
  });
  const titleA = txt(26, 34, 'what the run compressed', { size: 12, fill: PAL.ink, opacity: 0 });
  const ratioG = svg('g', { opacity: 0 },
    txt(26, 178, `≈ ${ratio.toFixed(1)}× smaller than the text it was trained on — a gzip-scale ratio, and nothing at all like gzip:`, { size: 11, fill: PAL.ink }),
    txt(26, 193, 'the compressed file cannot reproduce its input, and has no way to report which parts it lost.', { size: 11, fill: PAL.ink }),
    txt(26, 210, `(served after quantization — ${K3.weightsFormat} — the same weights are ${fmtBytes(K3.totalParams * 0.5)}.)`, { size: 9.5 }));

  const rule = svg('line', { x1: 26, y1: 228, x2: 694, y2: 228, stroke: 'rgba(230,237,243,0.10)', 'stroke-width': 1 });

  /* ---- panel B: fidelity vs how often a document was seen ---------------- */
  const X0 = 140, PW = 540, Y1 = 384, PH = 120;
  const xFor = (n) => X0 + (Math.log10(n + 1) / 3) * PW;
  const yFor = (f) => Y1 - f * PH;

  const titleB = txt(26, 252, 'and how unevenly it can give any of it back', { size: 12, fill: PAL.ink, opacity: 0 });
  const axes = svg('g', { opacity: 0 },
    svg('line', { x1: X0, y1: Y1, x2: X0 + PW, y2: Y1, stroke: PAL.mut, 'stroke-width': 1 }),
    svg('line', { x1: X0, y1: Y1, x2: X0, y2: yFor(1), stroke: PAL.mut, 'stroke-width': 1 }),
    txt(26, yFor(1) + 4, 'recall fidelity', { size: 10 }),
    txt(X0 - 8, yFor(1) + 4, '1.0', { size: 9, anchor: 'end', mono: true }),
    txt(X0 - 8, Y1 + 4, '0', { size: 9, anchor: 'end', mono: true }),
    [0, 1, 10, 100, 1000].map((n) => txt(xFor(n), Y1 + 16, n.toLocaleString('en-US'), { size: 9, anchor: 'middle', mono: true })),
    txt(X0, Y1 + 34, 'times the document appeared in the training corpus (log scale; the shape is the claim, not the constant)', { size: 9.5 }));

  const pts = Array.from({ length: 81 }, (_, i) => {
    const n = 10 ** ((i / 80) * 3) - 1;
    return `${i ? 'L' : 'M'} ${xFor(n).toFixed(2)} ${yFor(fid(n)).toFixed(2)}`;
  }).join(' ');
  const curve = svg('path', { d: pts, stroke: PAL.weight, 'stroke-width': 2, fill: 'none', 'clip-path': 'url(#bm-comp-clip)' });
  const clipRect = svg('rect', { x: X0 - 4, y: yFor(1) - 12, width: 0, height: PH + 20 });
  const defs = svg('defs', {}, svg('clipPath', { id: 'bm-comp-clip' }, clipRect));

  /* Annotations are placed on the empty side of the curve: n = 0 above it,
     n = 3 below it, n = 800 to its left. */
  const mark = (n, col, dy, anchor, lines) => {
    const x = xFor(n), y = yFor(fid(n));
    return svg('g', { opacity: 0 },
      svg('circle', { cx: x, cy: y, r: 3.6, fill: col }),
      lines.map((s, i) => txt(anchor === 'end' ? x - 10 : x + 10, y + dy + i * 12, s, { size: 9.5, fill: col, anchor })));
  };
  const wall = svg('g', { opacity: 0 },
    svg('line', { x1: X0 + 3, y1: Y1, x2: X0 + 3, y2: yFor(0.80), stroke: PAL.loss, 'stroke-width': 1.2, 'stroke-dasharray': '4 4' }),
    svg('circle', { cx: X0, cy: Y1, r: 3.6, fill: PAL.loss }),
    txt(X0 + 12, yFor(1) + 2, 'n = 0 — never crawled, or published after the cutoff.', { size: 9.5, fill: PAL.loss }),
    txt(X0 + 12, yFor(1) + 14, 'The continuation is assembled from documents like it.', { size: 9.5, fill: PAL.loss }));
  const m1 = mark(3, PAL.tx, 15, 'start', ['seen a handful of times: the gist, in the wrong words']);
  const m2 = mark(800, PAL.weight, 34, 'end', ['upsampled encyclopedia text:', 'long verbatim stretches, then drift']);

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Top: three bars comparing 44 terabytes of training text, the same text gzipped, and the 5.6-terabyte base checkpoint, about 7.9 times smaller than the corpus. Bottom: a saturating curve of recall fidelity against how many times a document appeared in the corpus — zero at the knowledge cutoff, partial for pages seen a few times, near-verbatim for heavily upsampled text.',
  }, defs, titleA, bars.map((b) => [b.rect, b.name, b.val, b.sub]), ratioG, rule,
     titleB, axes, curve, wall, m1, m2);

  const fig = figure(
    `the run squeezed roughly ${fmtBytes(CORPUS)} of filtered text into ${fmtBytes(ckpt)} of weights — about ${ratio.toFixed(1)}×, computed from ${K3.name}&rsquo;s parameter count at ${BYTES_PER_PARAM} bytes each. Corpus size is a FineWeb-scale approximation and the lower curve is schematic; the asymmetry is not. What a model can return depends on how often it saw the thing, and the left-hand end of that curve — where the count is zero — is where confident invention lives.`,
    root, { wide: true, key: 'compression' });

  return pin(fig, (p) => {
    titleA.setAttribute('opacity', seg(p, 0.03, 0.08));
    bars.forEach((b, i) => {
      const a = 0.08 + i * 0.10;
      const t = seg(p, a, a + 0.11, ease.out);
      b.rect.setAttribute('width', b.w * t);
      b.name.setAttribute('opacity', seg(p, a, a + 0.05));
      b.val.setAttribute('opacity', t);
      b.val.setAttribute('x', BX + b.w * t + 8);
      if (b.sub) {
        b.sub.setAttribute('opacity', t * 0.9);
        b.sub.setAttribute('x', BX + b.w * t + 8);
      }
    });
    ratioG.setAttribute('opacity', seg(p, 0.40, 0.47));
    titleB.setAttribute('opacity', seg(p, 0.50, 0.55));
    axes.setAttribute('opacity', seg(p, 0.52, 0.58));
    clipRect.setAttribute('width', (PW + 12) * seg(p, 0.56, 0.76, ease.inOut));
    wall.setAttribute('opacity', seg(p, 0.76, 0.82));
    m1.setAttribute('opacity', seg(p, 0.84, 0.89));
    m2.setAttribute('opacity', seg(p, 0.90, 0.95));
  }, { extent: 220 });
}
