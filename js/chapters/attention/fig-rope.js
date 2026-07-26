/* Figure — RoPE as clock hands. Three dials, one per rotary frequency: q and k
   both spin with position, but the angle between them depends only on m − n. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';

export function ropeFigure() {
  const W = 720, H = 258, cy = 122, r = 70;
  const dials = [
    { cx: 130, th: 0.9, name: 'pair 1 · θ₁ fast' },
    { cx: 360, th: 0.32, name: 'pair 2 · θ₂' },
    { cx: 590, th: 0.11, name: 'pair 3 · θ₃ slow' },
  ].map((d) => {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return svg('line', {
        x1: d.cx + Math.cos(a) * (r - 4), y1: cy - Math.sin(a) * (r - 4),
        x2: d.cx + Math.cos(a) * r, y2: cy - Math.sin(a) * r, stroke: PAL.grid, 'stroke-width': 1.5,
      });
    });
    d.wedge = svg('path', { d: '', fill: 'rgba(180,140,224,0.22)', stroke: 'none' });
    d.qLine = svg('line', { x1: d.cx, y1: cy, x2: d.cx, y2: cy, stroke: PAL.attn, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    d.kLine = svg('line', { x1: d.cx, y1: cy, x2: d.cx, y2: cy, stroke: PAL.act, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    d.qTip = svg('circle', { r: 3.5, fill: PAL.attn });
    d.kTip = svg('circle', { r: 3.5, fill: PAL.act });
    d.g = svg('g', {},
      svg('circle', { cx: d.cx, cy, r, fill: 'rgba(230,237,243,0.02)', stroke: 'rgba(230,237,243,0.14)', 'stroke-width': 1.2 }),
      ticks, d.wedge, d.kLine, d.qLine, d.kTip, d.qTip,
      svg('circle', { cx: d.cx, cy, r: 3, fill: PAL.mut }),
      txt(d.cx, cy + r + 26, d.name, { size: 11, anchor: 'middle', mono: true }));
    return d;
  });

  const legend = svg('g', {},
    svg('line', { x1: 24, y1: 18, x2: 44, y2: 18, stroke: PAL.attn, 'stroke-width': 2.4 }),
    txt(50, 22, 'q at position m', { size: 11, fill: PAL.tx }),
    svg('line', { x1: 160, y1: 18, x2: 180, y2: 18, stroke: PAL.act, 'stroke-width': 2.4 }),
    txt(186, 22, 'k at position n = m − 3', { size: 11, fill: PAL.tx }));
  const readout = txt(696, 22, '', { size: 12, fill: PAL.ink, anchor: 'end', mono: true });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Three clock dials, one per rotary frequency. A violet hand for the query at position m and a cyan hand for the key at position n both rotate as you scroll, but the shaded angle between them stays constant because it depends only on m minus n.',
  }, legend, readout, dials.map((d) => d.g));

  const pt = (cx, a, rr) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  const update = (p) => {
    const m = 3 + 27 * p, n = m - 3;
    readout.textContent = `m = ${Math.round(m)} · n = ${Math.round(n)} · m−n = 3`;
    for (const d of dials) {
      const aq = m * d.th, ak = n * d.th;
      const [qx, qy] = pt(d.cx, aq, r - 10);
      const [kx, ky] = pt(d.cx, ak, r - 10);
      d.qLine.setAttribute('x2', qx); d.qLine.setAttribute('y2', qy);
      d.kLine.setAttribute('x2', kx); d.kLine.setAttribute('y2', ky);
      d.qTip.setAttribute('cx', qx); d.qTip.setAttribute('cy', qy);
      d.kTip.setAttribute('cx', kx); d.kTip.setAttribute('cy', ky);
      const [w1x, w1y] = pt(d.cx, ak, 32);
      const [w2x, w2y] = pt(d.cx, aq, 32);
      const large = 3 * d.th > Math.PI ? 1 : 0;
      d.wedge.setAttribute('d', `M ${d.cx} ${cy} L ${w1x} ${w1y} A 32 32 0 ${large} 0 ${w2x} ${w2y} Z`);
    }
  };
  update(0);

  const node = figure(
    'RoPE as clock hands. Each (q,k) coordinate pair rotates by position × frequency — scroll and both hands spin, fast dials faster than slow ones. The shaded angle between q (at position m) and k (at position n), and therefore their dot product, depends only on m − n: attention scores encode relative offset.',
    root, { wide: true, key: 'rope' });
  return pin(node, update);
}
