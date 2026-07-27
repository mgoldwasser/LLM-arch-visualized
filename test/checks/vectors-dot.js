/* Worked example 2 of the per-figure mechanism (plan 5.2).

   Target: the dot-product scene in the vectors chapter, which prints the same
   number three ways — geometrically as |a||b|cos θ, algebraically as
   a₁b₁ + a₂b₂, and as a signed bar — and claims they agree.

   The test reads the operands the figure itself printed, recomputes with
   js/core/mathtools.js, and requires the printed result to match. It has no
   idea what a or b are, so changing the example does not break it; breaking
   dot(), or wiring the readout to the wrong variable, does.                 */

import { dot } from '../../js/core/mathtools.js';

const FIG = '#vectors-dot';
const P = 0.7;      // past the coordinate-form and cosine reveals, before the
                    // step-4 rotation begins at p = 0.78

const num = (s) => Number(String(s).replace(/−/g, '-').trim());

/* The figure prints two-decimal operands but computes with full precision, so
   the printed product legitimately differs from the product of the printed
   operands. The slack is derived from that rounding rather than guessed:
   half a unit in the last place on the result, plus the propagated half-ulp
   on each operand. A magic tolerance would either hide a real error or trip
   on a rounding boundary — this one does neither. */
const HALF_ULP = 0.005;
const dotTolerance = (a, b) =>
  HALF_ULP + HALF_ULP * (Math.abs(a[0]) + Math.abs(b[0]) + Math.abs(a[1]) + Math.abs(b[1]));

function texts(root) {
  return [...root.querySelectorAll('svg text')].map((t) => t.textContent.trim());
}

function findText(root, re, what) {
  const hit = texts(root).find((s) => re.test(s));
  if (hit === undefined) throw new Error(`${what} is not on screen at p=${P} — looked for ${re}`);
  return hit;
}

export const checks = [
  {
    fig: FIG,
    p: P,
    name: 'the printed dot product equals dot() of the printed operands',
    assert(root) {
      /* "= 4.00×2.00 + 1.00×3.00" — the figure's own working, in its own
         notation. Parsing it is how the test learns what a and b are. */
      const working = findText(root, /×.+\+.+×/, 'the coordinate-form working');
      const m = /=?\s*(\S+)×(\S+)\s*\+\s*(\S+)×(\S+)/.exec(working);
      if (!m) throw new Error(`cannot parse the coordinate working ${JSON.stringify(working)}`);
      const a = [num(m[1]), num(m[3])];
      const b = [num(m[2]), num(m[4])];

      const expected = dot(a, b);                       // the reference computation
      const tol = dotTolerance(a, b);

      const printed = num(findText(root, /^=\s*-?[\d.−]+$/, 'the coordinate-form result').replace('=', ''));
      if (Math.abs(printed - expected) > tol) {
        throw new Error(`the figure prints a·b = ${printed}, but dot([${a}], [${b}]) = ${expected.toFixed(4)}`);
      }

      const headline = findText(root, /a\s*·\s*b\s*=/, 'the headline value');
      const big = num(headline.split('=').pop());
      if (Math.abs(big - expected) > tol) {
        throw new Error(`the headline says a·b = ${big}, the algebra says ${expected.toFixed(4)}`);
      }
    },
  },
  {
    fig: FIG,
    p: P,
    name: 'the geometric and algebraic forms agree: |a||b|cos θ = a·b',
    assert(root) {
      const working = findText(root, /×.+\+.+×/, 'the coordinate-form working');
      const m = /=?\s*(\S+)×(\S+)\s*\+\s*(\S+)×(\S+)/.exec(working);
      const a = [num(m[1]), num(m[3])];
      const b = [num(m[2]), num(m[4])];

      const magA = num(findText(root, /^\|a\|\s*=/, '|a|').split('=')[1]);
      const magB = num(findText(root, /^\|b\|\s*=/, '|b|').split('=')[1]);
      const cos = num(findText(root, /^cos/, 'cos θ').split('=')[1]);

      /* Reference: the magnitudes must be the magnitudes of the very vectors
         the figure is multiplying, and the three printed quantities must
         multiply out to the printed dot product. */
      const refA = Math.hypot(a[0], a[1]);
      const refB = Math.hypot(b[0], b[1]);
      if (Math.abs(magA - refA) > 0.01) throw new Error(`|a| prints as ${magA}, but |[${a}]| = ${refA.toFixed(4)}`);
      if (Math.abs(magB - refB) > 0.01) throw new Error(`|b| prints as ${magB}, but |[${b}]| = ${refB.toFixed(4)}`);

      const geometric = magA * magB * cos;
      const algebraic = dot(a, b);
      /* Same derivation as above, plus the half-ulp on cos θ (three decimals)
         scaled by |a||b|, which is what multiplies it. */
      if (Math.abs(geometric - algebraic) > dotTolerance(a, b) + magA * magB * 0.0005 + 0.02) {
        throw new Error(`|a||b|cos θ = ${geometric.toFixed(3)} but a·b = ${algebraic.toFixed(3)} — `
          + 'the figure\'s two forms of the dot product disagree');
      }
    },
  },
];
