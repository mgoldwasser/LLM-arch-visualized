/* Per-figure checks that live in test/ rather than beside their figure.

   The normal home for a `checks` array is the chapter part file that builds
   the figure — the harness discovers it there automatically, and keeping the
   assertion next to the drawing code is what stops the two drifting apart.

   This file exists for the cases where that is not possible: figures owned by
   someone else, or (as with both entries below) worked examples written by the
   harness itself to prove the mechanism end to end. Adding a file here is a
   fallback, not the pattern to copy.                                        */

import { checks as attentionWorked } from './attention-worked.js';
import { checks as vectorsDot } from './vectors-dot.js';

export const EXTRA_CHECKS = [
  ...attentionWorked.map((c) => ({ ...c, source: 'test/checks/attention-worked.js' })),
  ...vectorsDot.map((c) => ({ ...c, source: 'test/checks/vectors-dot.js' })),
];
