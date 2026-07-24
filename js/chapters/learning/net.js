/* The tiny network this chapter computes by hand: 2 → 2 → 1, ReLU hidden
   units, a linear output, squared-error loss. Every number the reader sees
   anywhere in this chapter comes out of these five functions, so redoing the
   arithmetic on paper reproduces the figures exactly. */

import { dot } from '../../core/mathtools.js';

export const X = [1.0, 0.5];      // the single training example
export const TARGET = 1.0;        // …and its label
export const ETA = 0.2;           // learning rate used throughout

export const INIT = {
  W1: [[0.5, -0.2], [0.3, 0.8]],  // row i = weights into hidden unit i
  b1: [0.1, -0.1],
  W2: [0.7, -0.4],
  b2: 0.2,
};

const relu = (v) => (v > 0 ? v : 0);

/* Forward pass. Returns every intermediate value — these are exactly the
   quantities the backward pass will need, which is why they are cached. */
export function forward(P, x = X, y = TARGET) {
  const z1 = P.W1.map((row, i) => dot(row, x) + P.b1[i]);
  const a1 = z1.map(relu);
  const yhat = dot(P.W2, a1) + P.b2;
  return { x, y, z1, a1, yhat, err: yhat - y, loss: 0.5 * (yhat - y) ** 2 };
}

/* Backward pass. Each line is one application of the chain rule: the incoming
   gradient times the local derivative of that node. */
export function backward(P, F) {
  const dz2 = F.err;                                   // ∂L/∂ŷ = ŷ − y
  const dW2 = F.a1.map((a) => dz2 * a);                // (∂L/∂z₂) aᵀ
  const db2 = dz2;
  const da1 = P.W2.map((w) => w * dz2);                // W⁽²⁾ᵀ (∂L/∂z₂)
  const dz1 = da1.map((g, i) => (F.z1[i] > 0 ? g : 0));// ⊙ 1[z⁽¹⁾ > 0]
  const dW1 = dz1.map((g) => F.x.map((xi) => g * xi)); // (∂L/∂z⁽¹⁾) xᵀ
  const db1 = dz1.slice();
  const dx = F.x.map((_, j) => dz1.reduce((s, g, i) => s + g * P.W1[i][j], 0));
  return { dz2, dW2, db2, da1, dz1, dW1, db1, dx };
}

/* One gradient-descent update of every parameter. */
export function step(P, G, eta = ETA) {
  return {
    W1: P.W1.map((row, i) => row.map((w, j) => w - eta * G.dW1[i][j])),
    b1: P.b1.map((b, i) => b - eta * G.db1[i]),
    W2: P.W2.map((w, i) => w - eta * G.dW2[i]),
    b2: P.b2 - eta * G.db2,
  };
}

/* n successive steps. entry k holds the parameters *before* update k, the
   forward values they produce, and the gradients computed from them. */
export function trajectory(n, eta = ETA, P0 = INIT) {
  const out = [];
  let P = P0;
  for (let k = 0; k < n; k++) {
    const F = forward(P);
    const G = backward(P, F);
    out.push({ k, P, F, G });
    P = step(P, G, eta);
  }
  return out;
}

/* Display helpers — a real minus sign, and half-away-from-zero rounding so a
   value like 0.2415 shows as 0.242 rather than following the binary double a
   hair below it. */
const fix = (v, d) => {
  const m = 10 ** d;
  return (Math.round(Math.abs(v) * m + 1e-9) / m).toFixed(d);
};
export const f2 = (v) => (v < 0 ? '−' : '') + fix(v, 2);
export const f3 = (v) => (v < 0 ? '−' : '') + fix(v, 3);
/* losses cross several orders of magnitude during a run */
export const fLoss = (v) => (v >= 5e-4 ? f3(v) : v.toExponential(1).replace('e-', 'e−'));
export const vec2 = (a, f = f3) => `[${f(a[0])}, ${f(a[1])}]`;
