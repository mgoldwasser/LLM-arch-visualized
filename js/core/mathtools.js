/* Numerics used by figures and widgets — small, dependency-free. */

export function softmax(xs, temperature = 1) {
  const t = Math.max(1e-6, temperature);
  const m = Math.max(...xs.filter(Number.isFinite));
  const ex = xs.map((x) => (Number.isFinite(x) ? Math.exp((x - m) / t) : 0));
  const s = ex.reduce((a, b) => a + b, 0) || 1;
  return ex.map((e) => e / s);
}

export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

/* matmul(A, B): A is m×k (array of rows), B is k×n → m×n */
export function matmul(A, B) {
  const m = A.length, k = B.length, n = B[0].length;
  const C = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += A[i][t] * B[t][j];
      C[i][j] = s;
    }
  return C;
}

export const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));

/* Causal-masked scaled dot-product attention for tiny worked examples.
   Returns { S (scores, -Inf above diagonal), A (softmax rows), Z (A·V) } */
export function attention(Q, K, V, dHead) {
  const scale = 1 / Math.sqrt(dHead ?? Q[0].length);
  const S = Q.map((q, i) =>
    K.map((k, j) => (j <= i ? dot(q, k) * scale : -Infinity)));
  const A = S.map((row) => softmax(row));
  const Z = matmul(A, V);
  return { S, A, Z };
}

export const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
