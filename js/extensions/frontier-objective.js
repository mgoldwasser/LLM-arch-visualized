/* Frontier — chapter 01 (the next-token objective).
   What makes pure next-token prediction inefficient, what the field is
   doing about it, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>One token of supervision per position, delivered one position at a time.</strong>
      The objective is gloriously cheap to label but informationally thin: the model does a full
      forward pass over the whole context to earn a single log-probability's worth of training
      signal per position, and at generation time it must re-run the entire stack once per emitted
      token. Teacher forcing also trains the model only on <em>its own ground-truth history</em> —
      it never practices recovering from its own mistakes (exposure bias), and a myopic one-step
      objective can reward locally-plausible continuations that paint the model into a corner
      three sentences later. Finally, next-token likelihood weights every token equally: the
      "the" after "capital of France is" and the digit that decides a proof carry the same loss
      weight, even though their information content differs by orders of magnitude.</p>`),

    researchItem('Multi-token prediction', '2024', 'deployed', `
      <p>Train extra output heads to predict tokens t+1…t+k simultaneously (Meta's
      multi-token-prediction work; DeepSeek-V3 ships an MTP head). Densifies the training signal,
      measurably improves code and reasoning benchmarks, and the auxiliary heads double as a
      built-in drafter for speculative decoding at inference.</p>`),
    researchItem('Speculative decoding', '2023', 'deployed', `
      <p>Attack the one-forward-pass-per-token serving cost: a small drafter proposes several
      tokens, the big model verifies them in one parallel pass, and rejection sampling keeps the
      output distribution provably identical. Standard practice in every major serving stack.</p>`),
    researchItem('Diffusion language models', '2025', 'research', `
      <p>Replace left-to-right factorization entirely: denoise all positions in parallel over a
      few iterative steps (Gemini Diffusion, LLaDA, Mercury). Trades the autoregressive
      bottleneck for parallel refinement — competitive quality at small scale with far higher
      token throughput, though frontier-scale parity remains unproven.</p>`),
    researchItem('Reverse-curse & data-efficiency results', '2023', 'contested', `
      <p>"A is B" training famously fails to teach "B is A" — evidence that autoregressive
      likelihood extracts far less knowledge per document than is available. Whether this is
      fundamental to the objective or fixable with data augmentation (e.g. training on both
      directions, paraphrase mixing) is still debated.</p>`),

    novelIdea('Surprise-weighted curriculum inside the loss', `
      <p>If tokens differ wildly in information content, the loss could say so: reweight each
      position's cross-entropy by a running estimate of its <em>excess</em> surprisal — the gap
      between the model's current loss on that token and a small reference model's loss.
      Positions both models find easy (boilerplate) fade toward zero weight; positions where the
      large model <em>should</em> do better but doesn't get amplified. This is selective-language-
      modeling territory (RHO-1 showed a static version helps); the speculative step is making the
      reference gap <em>dynamic</em> — recomputed as the model trains, so the curriculum
      automatically migrates from syntax to facts to reasoning as each tier saturates. The risk to
      test first: positive-feedback loops where noisy tokens (typos, OCR garbage) look permanently
      "surprising" and soak up gradient — likely needs a robust-loss cap on the weight.</p>`),
  );
}
