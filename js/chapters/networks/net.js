/* Shared numerics for the networks chapter: the toy dataset, the activation
   family, screen mapping, and two bits of geometry (clipped hyperplanes and a
   marching-squares zero contour). Everything here is pure — figures call it
   fresh on every frame, so scrolling backwards recomputes rather than rewinds. */

import { rng } from '../../core/anim.js';
import { PAL } from '../../core/components.js';

export const sigmoid = (z) => 1 / (1 + Math.exp(-z));
export const relu = (z) => (z > 0 ? z : 0);

/* One continuous family from identity to ReLU: a = 0 is the identity (no
   nonlinearity at all), a = 1 is max(0, z). In between it is a leaky ReLU,
   which lets a figure dissolve the nonlinearity smoothly and honestly. */
export const leaky = (z, a) => (z > 0 ? z : (1 - a) * z);

/* Plot half-width. All 2-D panels in this chapter show [-DOM, DOM]². */
export const DOM = 1.15;

/* Four Gaussian-ish blobs at the corners of a square: the two blobs on the
   main diagonal are one class, the two on the anti-diagonal are the other.
   No straight line separates them. Seeded, so it is the same cloud always. */
export function xorData({ seed = 7, per = 13, radius = 0.2, c = 0.72 } = {}) {
  const r = rng(seed);
  const centers = [[c, c, 0], [-c, -c, 0], [c, -c, 1], [-c, c, 1]];
  const pts = [];
  for (const [cx, cy, cls] of centers) {
    for (let i = 0; i < per; i++) {
      const ang = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * radius;
      pts.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, c: cls });
    }
  }
  return pts;
}

/* Data coordinates → SVG coordinates for a square panel at (x0, y0). */
export function frame(x0, y0, size, dom = DOM) {
  const s = size / (2 * dom);
  return {
    x0, y0, size, dom,
    sx: (x) => x0 + (x + dom) * s,
    sy: (y) => y0 + size - (y + dom) * s,
  };
}

/* The line a·x + b·y + c = 0, clipped to the panel. null if it misses. */
export function clipLine(a, b, c, fr) {
  const d = fr.dom, hits = [];
  const ok = (v) => v >= -d - 1e-9 && v <= d + 1e-9;
  if (Math.abs(b) > 1e-9) {
    const yl = -(a * -d + c) / b, yr = -(a * d + c) / b;
    if (ok(yl)) hits.push([-d, yl]);
    if (ok(yr)) hits.push([d, yr]);
  }
  if (Math.abs(a) > 1e-9) {
    const xb = -(b * -d + c) / a, xt = -(b * d + c) / a;
    if (ok(xb)) hits.push([xb, -d]);
    if (ok(xt)) hits.push([xt, d]);
  }
  if (hits.length < 2) return null;
  let best = null, far = -1;
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const dx = hits[i][0] - hits[j][0], dy = hits[i][1] - hits[j][1];
      const l = dx * dx + dy * dy;
      if (l > far) { far = l; best = [hits[i], hits[j]]; }
    }
  }
  if (far < 1e-9) return null;
  return {
    x1: fr.sx(best[0][0]), y1: fr.sy(best[0][1]),
    x2: fr.sx(best[1][0]), y2: fr.sy(best[1][1]),
  };
}

/* Marching squares on f = 0 over the panel, returned as one SVG path string.
   n cells per side; 44–64 is plenty for a smooth-looking boundary. */
export function zeroContour(f, fr, n = 48) {
  const d = fr.dom, step = (2 * d) / n;
  const v = [];
  for (let i = 0; i <= n; i++) {
    v[i] = [];
    for (let j = 0; j <= n; j++) v[i][j] = f(-d + i * step, -d + j * step);
  }
  const cut = (p, q, vp, vq) => p + (q - p) * (0 - vp) / (vq - vp);
  let out = '';
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x0 = -d + i * step, x1 = x0 + step;
      const y0 = -d + j * step, y1 = y0 + step;
      const v00 = v[i][j], v10 = v[i + 1][j], v11 = v[i + 1][j + 1], v01 = v[i][j + 1];
      const pts = [];
      if ((v00 > 0) !== (v10 > 0)) pts.push([cut(x0, x1, v00, v10), y0]);
      if ((v10 > 0) !== (v11 > 0)) pts.push([x1, cut(y0, y1, v10, v11)]);
      if ((v11 > 0) !== (v01 > 0)) pts.push([cut(x1, x0, v11, v01), y1]);
      if ((v01 > 0) !== (v00 > 0)) pts.push([x0, cut(y1, y0, v01, v00)]);
      if (pts.length >= 2) {
        out += `M ${fr.sx(pts[0][0]).toFixed(1)} ${fr.sy(pts[0][1]).toFixed(1)} `
             + `L ${fr.sx(pts[1][0]).toFixed(1)} ${fr.sy(pts[1][1]).toFixed(1)} `;
      }
    }
  }
  return out;
}

/* How many of the points does score(x, y) > 0 ↔ class 1 get right? */
export function tally(pts, score) {
  let ok = 0;
  const wrong = pts.map((p) => {
    const bad = (score(p.x, p.y) > 0 ? 1 : 0) !== p.c;
    if (!bad) ok += 1;
    return bad;
  });
  return { ok, wrong, acc: ok / pts.length };
}

/* Colour interpolation for painted score fields. */
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function hexMix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/* Class colours: cyan and violet, never amber — amber is reserved for weights. */
export const CLS = [PAL.attn, PAL.act];
