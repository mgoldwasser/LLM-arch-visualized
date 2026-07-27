/* B1 — the filter cascade. Billions of crawled pages fall as a dense column
   through six sieves; each one catches a measured fraction, and the surviving
   document count and byte total count down beside it.

   Colour: the corpus is data on its way into the machine, so it is cyan
   (PAL.act, "data in flight") throughout. Amber is deliberately absent —
   nothing here is learned, and a reader who has internalised "amber = weights"
   must not read the corpus as a parameter. Rejected material does not turn
   red (that channel belongs to loss and gradients); it fades out.

   Everything the figure prints is computed from ./corpus.js. Every particle's
   fate is derived from the cumulative retention, so the survivor counts are
   strictly decreasing by construction rather than by transcription. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, lerp, clamp, rng, si, pct } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { STAGES, CASCADE, CORPUS, CRAWL, PUBLISHED, fmtBig } from './corpus.js';

const W = 880, H = 572;
const X0 = 96, COLW = 300;                 // the falling column
const Y_TOP = 106;                         // where the source band ends
const SY = STAGES.map((_, s) => 154 + s * 54);
const Y_END = 498;                         // the collecting tray
const KNOTS = [Y_TOP, ...SY, Y_END];       // levels 0…7
const LX = 440, RX = 866;                  // label column, right edge

const N = 300;                             // particles
const DUR = 0.112;                         // length of one descent window
const A = KNOTS.slice(1).map((_, s) => 0.06 + s * 0.125);   // 7 window starts

/* Height in the column at a continuous "level" — 0 at the source, s+1 at
   sieve s, 7 in the tray. */
function yAt(l) {
  const i = Math.min(Math.floor(l), KNOTS.length - 2);
  return lerp(KNOTS[i], KNOTS[i + 1], l - i);
}
const levelAt = (p) => A.reduce((acc, a) => acc + seg(p, a, a + DUR, ease.linear), 0);

export function cascadeFigure() {
  const rand = rng(4207);

  /* Each particle's death stage comes from its quantile against the
     cumulative retention, so the surviving fraction after sieve s equals the
     product of the keeps up to s — exactly what the counters print. */
  const cum = [];
  STAGES.reduce((k, s) => (cum.push(k * s.keepPages), k * s.keepPages), 1);
  const dots = [], CAP = [], JIT = [], DY = [];
  for (let i = 0; i < N; i++) {
    const q = (i + 0.5) / N;
    const die = cum.findIndex((c) => q > c);
    const dy = rand() * 44;                       // thickness of the falling band
    CAP.push(die === -1 ? KNOTS.length - 1 : die + 1);
    JIT.push((rand() - 0.5) * 0.22);
    DY.push(dy);
    // Initial attributes are the p = 0 state, so the figure does not jump when
    // the reader first reaches it.
    dots.push(svg('circle', {
      cx: (X0 + rand() * COLW).toFixed(1), cy: (Y_TOP - dy).toFixed(2),
      r: 2.2, fill: PAL.act, opacity: 0.9,
    }));
  }

  const defs = svg('defs', {},
    svg('marker', {
      id: 'dat-discard', viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse',
    }, svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  /* Source header — what enters, before anything is thrown away. */
  const head = svg('g', { opacity: 0 },
    txt(X0, 30, `COMMON CRAWL — ${CRAWL.snapshots} snapshots, crawling since ${CRAWL.since}`, { size: 11, fill: PAL.tx }),
    txt(LX, 30, 'surviving after each sieve', { size: 10, fill: PAL.mut }),
    txt(RX, 30, si(CASCADE[0].pages, 1) + ' page fetches', { size: 12.5, fill: PAL.act, anchor: 'end', mono: true }),
    txt(RX, 45, fmtBig(CASCADE[0].bytes) + ' of raw HTTP responses', { size: 10, fill: PAL.mut, anchor: 'end', mono: true }));

  /* Six sieves: a slotted bar, a discard chute, and the counters. */
  const sieves = STAGES.map((s, i) => {
    const y = SY[i];
    const kp = s.keepPages, kb = s.keepBytes;
    const note = Math.abs(kp - kb) > 0.01
      ? `${s.short} · −${pct(1 - kp, 1)} docs · −${pct(1 - kb, 1)} bytes`
      : `${s.short} · −${pct(1 - kp, 1)} of documents`;
    const bar = svg('line', {
      x1: X0 - 12, y1: y, x2: X0 + COLW + 12, y2: y,
      stroke: PAL.mut, 'stroke-width': 6, 'stroke-dasharray': '7 6', 'stroke-linecap': 'butt', opacity: 0.35,
    });
    const chute = svg('path', {
      d: `M ${X0 - 14} ${y} L ${X0 - 52} ${y + 18}`,
      stroke: PAL.mut, 'stroke-width': 1.2, fill: 'none', 'marker-end': 'url(#dat-discard)', opacity: 0,
    });
    // Names sit dim from the start, so the reader can see the whole pipeline
    // ahead; the counters only appear once their sieve has been reached.
    const gName = svg('g', { opacity: 0.25 },
      txt(LX, y - 4, s.name, { size: 12.5, fill: PAL.tx }),
      txt(LX, y + 11, note, { size: 9.5, fill: PAL.mut }));
    const pagesT = txt(RX, y - 4, si(CASCADE[i].pages, 1) + ' docs', { size: 12.5, fill: PAL.act, anchor: 'end', mono: true });
    const bytesT = txt(RX, y + 11, fmtBig(CASCADE[i].bytes), { size: 10, fill: PAL.mut, anchor: 'end', mono: true });
    const gNum = svg('g', { opacity: 0 }, pagesT, bytesT);
    return { bar, chute, gName, gNum, pagesT, bytesT };
  });

  const tray = svg('rect', {
    x: X0 - 12, y: Y_END - 46, width: COLW + 24, height: 52, rx: 6,
    fill: 'none', stroke: PAL.act, 'stroke-width': 1, opacity: 0,
  });

  const result = svg('g', { opacity: 0 },
    txt(X0, 534, 'what survives', { size: 10.5, fill: PAL.mut }),
    txt(X0, 556, `${si(CORPUS.docs, 1)} documents · ${fmtBig(CORPUS.bytes)} · ≈ ${si(CORPUS.tokens, 0)} tokens`,
      { size: 15, fill: PAL.act, mono: true }),
    txt(RX, 556, `${pct(CORPUS.keepAll, 1)} of what entered`, { size: 11, fill: PAL.mut, anchor: 'end' }));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `A dense column of crawled pages falls through six labelled sieves — URL blocklist, text extraction, language identification, deduplication, PII removal and quality filters. Each sieve catches a measured share of the column while the surviving document count and byte total count down beside it, from ${si(CASCADE[0].pages, 1)} page fetches and ${fmtBig(CASCADE[0].bytes)} down to ${si(CORPUS.docs, 1)} documents, ${fmtBig(CORPUS.bytes)} and roughly ${si(CORPUS.tokens, 0)} tokens.`,
  }, defs, head, sieves.map((s) => s.bar), sieves.map((s) => s.chute), tray, dots,
     sieves.map((s) => s.gName), sieves.map((s) => s.gNum), result);

  const node = figure(
    `the filter cascade. ${PUBLISHED.name} (${PUBLISHED.org}, ${PUBLISHED.year}) is the public, well-documented example; every major lab runs an internal equivalent it does not publish. Per-stage retentions are illustrative values inside that pipeline's range — the counters are computed from them, and the totals they compose to are the published ones: ${fmtBig(PUBLISHED.bytes)} and ${si(PUBLISHED.tokens, 0)} tokens. Roughly ${pct(CORPUS.keepAll, 1)} of the crawl reaches the model.`,
    root, { wide: true, key: 'cascade' });

  const update = (p) => {
    const L = levelAt(p);
    for (let i = 0; i < N; i++) {
      const li = L + JIT[i];
      const cap = CAP[i];
      dots[i].setAttribute('cy', (yAt(clamp(Math.min(li, cap), 0, KNOTS.length - 1)) - DY[i]).toFixed(2));
      const gone = cap >= KNOTS.length - 1 ? 0 : clamp((li - cap) / 0.6);
      dots[i].setAttribute('opacity', (0.9 * (1 - gone)).toFixed(3));
    }
    head.setAttribute('opacity', seg(p, 0, 0.04));
    for (let s = 0; s < STAGES.length; s++) {
      const t = seg(p, A[s], A[s] + DUR, ease.linear);
      const v = sieves[s];
      const lit = seg(p, A[s] - 0.03, A[s] + 0.02);
      v.gName.setAttribute('opacity', 0.25 + 0.75 * lit);
      v.gNum.setAttribute('opacity', lit);
      v.bar.setAttribute('opacity', 0.35 + 0.4 * seg(p, A[s] - 0.05, A[s] + DUR));
      v.chute.setAttribute('opacity', (0.75 * t * (1 - seg(p, A[s] + DUR, A[s] + DUR + 0.06))).toFixed(3));
      v.pagesT.textContent = si(lerp(CASCADE[s].pages, CASCADE[s + 1].pages, t), 1) + ' docs';
      v.bytesT.textContent = fmtBig(lerp(CASCADE[s].bytes, CASCADE[s + 1].bytes, t));
    }
    tray.setAttribute('opacity', 0.5 * seg(p, 0.78, 0.86));
    result.setAttribute('opacity', seg(p, 0.86, 0.95));
  };

  // Paint the p = 0 state into the DOM as built, so the figure cannot flash a
  // different frame before the reader reaches it.
  update(0);
  return pin(node, update, { extent: 300 });
}
