/* B2 — zoom out on the corpus. One readable paragraph of plausible crawled
   text scales continuously down until it is a texture, then a single row in a
   bar that is the whole corpus.

   The entire scene lives in one <g>, and the only thing the update function
   touches on it is a transform whose scale is a strictly monotonic function of
   p: cheap, and perfectly reversible. Our document sits at the exact centre of
   the bar, so the transform is a pure scale about a fixed point — no pan is
   needed, and nothing is created or destroyed mid-sweep.

   Colour: cyan (PAL.act) again — the corpus is data on its way in, never a
   learned parameter. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease, clamp, rng, si } from '../../core/anim.js';
import { pin } from '../../core/scroll.js';
import { CORPUS, PUBLISHED, fmtBig } from './corpus.js';

const W = 880, H = 520;
const CX = W / 2, CY = H / 2;

/* World geometry. One document card is 840 × 440 world units, so at scale 1
   it fills the canvas. Cards tile on a 900 × 500 pitch. */
const CARD_W = 840, CARD_H = 440, PITCH_X = 900, PITCH_Y = 500;
const GRID_COLS = 25, GRID_ROWS = 15;          // the neighbourhood, drawn cell by cell
const BAR_COLS = 100, BAR_ROWS = 90;           // the whole corpus
const BAR_W = BAR_COLS * PITCH_X, BAR_H = BAR_ROWS * PITCH_Y;

const K0 = 1;                                  // paragraph fills the canvas
const K1 = 780 / BAR_W;                        // whole bar fits, 780 px wide
const LEGIBLE = 0.42;                          // below this the 15-unit text is unreadable

/* A plausible crawled page. Not an excerpt of anything — written to be the
   kind of ordinary, unremarkable text that most of the corpus actually is. */
const PAGE = {
  url: 'hobbyist-kilns.example.org/logs/firing-14   ·   crawled 2023-11-04',
  title: 'Firing log 14 — cone 6 oxidation',
  lines: [
    'We packed the kiln on Saturday morning with the usual mixed load: eleven',
    'mugs, two casseroles, and the tall vase I have been trying to get right',
    'since March. Bisque was uneventful. I ramped at 150 °F per hour to 1900 °F,',
    'held twenty minutes, then let it fall on its own overnight.',
    'The glaze results were mixed. The satin white crawled badly on the vase,',
    'which I think means I put it on too thick over a dusty bisque surface.',
    'Everything else came out clean. Notes for next time: wipe the bisque down,',
    'and stop opening the lid before the kiln is under 200 °F. It never helps.',
  ],
};

export function zoomFigure() {
  const rand = rng(90210);

  /* The bar: the whole corpus, with a row separator every document-row. */
  const bar = svg('rect', {
    x: -BAR_W / 2, y: -BAR_H / 2, width: BAR_W, height: BAR_H,
    fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1,
    'vector-effect': 'non-scaling-stroke', opacity: 0,
  });
  const rules = svg('g', { opacity: 0 },
    Array.from({ length: BAR_ROWS + 1 }, (_, r) => svg('line', {
      x1: -BAR_W / 2, x2: BAR_W / 2,
      y1: -BAR_H / 2 + r * PITCH_Y, y2: -BAR_H / 2 + r * PITCH_Y,
      stroke: PAL.grid, 'stroke-width': 0.6, 'vector-effect': 'non-scaling-stroke',
    })));
  const ourRow = svg('rect', {
    x: -BAR_W / 2, y: -PITCH_Y / 2, width: BAR_W, height: PITCH_Y,
    fill: 'rgba(90,200,220,0.16)', stroke: PAL.act, 'stroke-width': 1.4,
    'vector-effect': 'non-scaling-stroke', opacity: 0,
  });

  /* The neighbourhood: every other document near ours, drawn as ruled lines of
     text. One <path> per document — built once, never touched again. */
  const neighbours = svg('g', { opacity: 0 });
  for (let gi = -(GRID_COLS - 1) / 2; gi <= (GRID_COLS - 1) / 2; gi++) {
    for (let gj = -(GRID_ROWS - 1) / 2; gj <= (GRID_ROWS - 1) / 2; gj++) {
      if (gi === 0 && gj === 0) continue;
      const ox = gi * PITCH_X - CARD_W / 2, oy = gj * PITCH_Y - CARD_H / 2;
      let d = '';
      for (let n = 0; n < 8; n++) {
        const y = oy + 62 + n * 46;
        d += `M ${ox + 24} ${y} L ${(ox + 24 + 260 + rand() * 540).toFixed(0)} ${y} `;
      }
      neighbours.append(svg('path', { d, stroke: PAL.act, 'stroke-width': 10, opacity: 0.22, fill: 'none' }));
    }
  }

  /* Our document. */
  const card = svg('rect', {
    x: -CARD_W / 2, y: -CARD_H / 2, width: CARD_W, height: CARD_H, rx: 12,
    fill: 'rgba(90,200,220,0.05)', stroke: PAL.act, 'stroke-width': 1.2,
    'vector-effect': 'non-scaling-stroke',
  });
  const copy = svg('g', {},
    txt(-CARD_W / 2 + 34, -CARD_H / 2 + 52, PAGE.url, { size: 13, fill: PAL.mut, mono: true }),
    txt(-CARD_W / 2 + 34, -CARD_H / 2 + 100, PAGE.title, { size: 19, fill: PAL.ink }),
    PAGE.lines.map((l, i) => txt(-CARD_W / 2 + 34, -CARD_H / 2 + 148 + i * 34, l, { size: 15, fill: PAL.tx })));
  const doc = svg('g', {}, card, copy);

  /* The whole point of this figure is content leaving the frame: at scale 1 the
     corpus bar is 90 000 units wide against an 880-unit viewBox. The <svg>
     viewport clips it; the layout-escape invariant is told so explicitly. */
  const world = svg('g', {
    transform: `translate(${CX} ${CY}) scale(${K0})`,
    'data-allow-overflow': '',
  }, bar, rules, ourRow, neighbours, doc);

  /* Overlays live outside the scaled group, so they stay legible throughout. */
  const scaleT = txt(W - 14, H - 14, '1 : 1', { size: 11, fill: PAL.mut, anchor: 'end', mono: true });
  const cap1 = txt(20, 22, `one document — about ${Math.round(CORPUS.tokensPerDoc)} tokens`, { size: 12, fill: PAL.act });
  const cap2 = txt(20, 22, 'the text is gone, the shape remains', { size: 12, fill: PAL.act, opacity: 0 });
  const cap3 = txt(20, 22, `the whole corpus — ${si(CORPUS.docs, 1)} documents, ${fmtBig(CORPUS.bytes)}, ≈ ${si(CORPUS.tokens, 0)} tokens`, { size: 12, fill: PAL.act, opacity: 0 });

  const pointer = svg('g', { opacity: 0 },
    svg('path', {
      d: `M 190 ${CY + 220} L 34 ${CY + 220} L 34 ${CY} L ${CX - BAR_W * K1 / 2 - 4} ${CY}`,
      stroke: PAL.mut, 'stroke-width': 1, fill: 'none', 'marker-end': 'url(#dat-here)',
    }),
    txt(198, CY + 224, `one row ≈ ${si(CORPUS.docs / BAR_ROWS, 1)} documents — including the paragraph you just read`,
      { size: 11.5, fill: PAL.tx }));

  const defs = svg('defs', {},
    svg('marker', {
      id: 'dat-here', viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse',
    }, svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': `A single readable web page — a hobbyist kiln firing log — scales continuously down until its text becomes an unreadable texture of neighbouring documents, and finally until it is one thin row in a bar representing the whole ${si(CORPUS.tokens, 0)}-token corpus, where each row stands for roughly ${si(CORPUS.docs / BAR_ROWS, 1)} documents.`,
  }, defs, world, cap1, cap2, cap3, pointer, scaleT);

  const node = figure(
    `zoom out on the corpus. The paragraph is one document of ${si(CORPUS.docs, 1)}; the bar is all of them — ${fmtBig(CORPUS.bytes)} of text, about ${si(CORPUS.tokens, 0)} tokens, matching ${PUBLISHED.name}&rsquo;s published totals. Every fact the model will ever know about kiln schedules arrives as rows like this one. The zoom spans roughly ${Math.round(K0 / K1)}× and is a pure scale on a single group, so scrubbing back restores the text exactly.`,
    root, { wide: true, key: 'zoom' });

  const update = (p) => {
    // Strictly monotonic in p across the whole sweep: ease.inOut is strictly
    // increasing on [0,1], and k is exponential in it.
    const u = ease.inOut(clamp(p));
    const k = K0 * Math.pow(K1 / K0, u);
    world.setAttribute('transform', `translate(${CX} ${CY}) scale(${k.toFixed(6)})`);

    // Past legibility the paragraph is decoration, not content. The card
    // itself never fades: with a non-scaling stroke it survives the zoom as a
    // few bright pixels at the centre of its row — the reader's "you are here".
    copy.setAttribute('aria-hidden', k >= LEGIBLE ? 'false' : 'true');
    copy.setAttribute('opacity', (1 - seg(p, 0.28, 0.42)).toFixed(3));

    neighbours.setAttribute('opacity', (seg(p, 0.12, 0.28) * (1 - seg(p, 0.78, 0.90))).toFixed(3));
    bar.setAttribute('opacity', seg(p, 0.70, 0.84).toFixed(3));
    rules.setAttribute('opacity', seg(p, 0.72, 0.86).toFixed(3));
    ourRow.setAttribute('opacity', seg(p, 0.78, 0.90).toFixed(3));
    pointer.setAttribute('opacity', seg(p, 0.90, 0.99).toFixed(3));

    cap1.setAttribute('opacity', (1 - seg(p, 0.30, 0.40)).toFixed(3));
    cap2.setAttribute('opacity', (seg(p, 0.46, 0.56) * (1 - seg(p, 0.70, 0.78))).toFixed(3));
    // How many drawn documents the viewport actually holds at this scale —
    // measured, not asserted.
    const onScreen = Math.round(Math.min(GRID_COLS, W / k / PITCH_X) * Math.min(GRID_ROWS, H / k / PITCH_Y));
    cap2.textContent = `${onScreen} documents on screen — the text is gone, the shape remains`;
    cap3.setAttribute('opacity', seg(p, 0.78, 0.86).toFixed(3));
    scaleT.textContent = `1 : ${Math.round(1 / k).toLocaleString('en-US')}`;
  };

  // Paint the p = 0 state into the DOM as built, so the figure cannot flash a
  // different frame before the reader reaches it.
  update(0);
  return pin(node, update, { extent: 260 });
}
