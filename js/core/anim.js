/* Animation math — progress mapping, easing, interpolation, formatting.
   The scroll engine hands every figure a global progress p in [0,1];
   these helpers slice p into per-element animation windows.            */

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const norm = (v, a, b) => (b === a ? 0 : (v - a) / (b - a));

export const ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

/* Map global progress p to local [0,1] within window [a,b], eased.
   seg(p, 0.2, 0.5) → 0 before 20%, 1 after 50%, ramps between. */
export const seg = (p, a, b, fn = ease.inOut) => fn(clamp(norm(p, a, b)));

/* Step index for stepped scenes: which of n windows does p fall in. */
export const stepAt = (p, n) => clamp(Math.floor(p * n), 0, n - 1);

/* Deterministic PRNG (mulberry32) — figures must render identically
   on every load, so all "random" data is seeded.                     */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Number formatting: si(2.8e12) → "2.8T", si(5e10) → "50B" */
export function si(v, digits = 1) {
  const abs = Math.abs(v);
  if (abs >= 1e12) return trim(v / 1e12, digits) + 'T';
  if (abs >= 1e9) return trim(v / 1e9, digits) + 'B';
  if (abs >= 1e6) return trim(v / 1e6, digits) + 'M';
  if (abs >= 1e3) return trim(v / 1e3, digits) + 'k';
  return String(Math.round(v));
}
function trim(v, d) {
  const s = v.toFixed(d);
  return s.replace(/\.0+$/, '');
}

export const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';

/* Bytes at a given bits-per-parameter. fmtBytes(2.8e12*0.5) → "1.4 TB" */
export function fmtBytes(bytes) {
  if (bytes >= 1e12) return trim(bytes / 1e12, 1) + ' TB';
  if (bytes >= 1e9) return trim(bytes / 1e9, 1) + ' GB';
  if (bytes >= 1e6) return trim(bytes / 1e6, 1) + ' MB';
  if (bytes >= 1e3) return trim(bytes / 1e3, 1) + ' KB';
  return Math.round(bytes) + ' B';
}
