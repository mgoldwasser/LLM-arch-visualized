/* Frontier — the `attention` chapter (the attention mechanism).
   What makes attention itself inefficient, what the field is doing about it,
   and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea, chRef } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>A content-addressed memory with no persistence.</strong> Attention retrieves by
      similarity, which is its superpower — but it carries nothing forward. Every decode step,
      every head re-derives its entire view of the past from the raw cache: the same pronoun gets
      re-resolved, the same bracket re-matched, thousands of times per generation, because the
      mechanism has no way to say &ldquo;I already looked this up.&rdquo; Training pays the other
      bill: the all-pairs score matrix makes context length quadratically expensive, so the
      long-document structure a model most needs to learn is exactly what it sees least of.
      And the multi-head bet is inefficient in its own way — heads are trained independently
      and redundantly relearn similar patterns; interpretability work keeps finding the same
      induction- and positional-head motifs duplicated across layers, and pruning studies
      show a large fraction of heads can be removed after training with little loss. We pay
      full price for h heads and get substantially fewer distinct behaviors.</p>`),

    researchItem('Native Sparse Attention', '2025', 'research', `
      <p>DeepSeek&rsquo;s answer to post-hoc sparsity: make the sparsity pattern <em>trainable
      from scratch</em>. Each query sees compressed block summaries, a selected top-k of fine
      blocks, and a local window — three branches learned end-to-end, with block granularity
      chosen to match GPU memory access. Trained into research models at scale, it reports
      full-attention-level quality with large long-context speedups, challenging the assumption
      that sparse attention must be a lossy retrofit.</p>`),
    researchItem('MoBA — Mixture of Block Attention', '2025', 'deployed', `
      <p>From Moonshot — the same lab as our specimen. Context is cut into blocks and each query
      routes, MoE-style, to the top-k most relevant blocks instead of attending everywhere:
      the router is the same learned-gating idea as ${chRef('moe')}, applied to <em>where to look</em>
      rather than <em>which expert to run</em>. Falls back to full attention per-layer when
      needed, and Moonshot reports it serving Kimi&rsquo;s long-context traffic in production.</p>`),
    researchItem('Mamba-2 and the SSM–attention duality', '2024', 'research', `
      <p>The attention-free line: state-space models process sequences through a recurrent state
      with no pairwise scores at all. Mamba-2&rsquo;s &ldquo;state-space duality&rdquo; result
      showed its selective-SSM update is mathematically a form of masked linear attention —
      collapsing what looked like rival architectures into one family, and explaining why the
      practical frontier (Jamba, K3 itself) is hybrids of recurrent-state and full-attention
      layers rather than a winner-take-all.</p>`),
    researchItem('Cross-layer KV sharing', '2024', 'research', `
      <p>Heads within a layer share K/V in GQA — why not across layers? Cross-Layer Attention
      ties KV caches between adjacent layers, and YOCO computes the cache once and lets all
      subsequent layers cross-attend to it, cutting cache roughly by the number of sharing
      layers on top of anything GQA/MLA already saved. Evidence that redundancy runs
      <em>vertically</em> through the stack, not just across heads.</p>`),

    novelIdea('Temporal coherence: attention as keyframes + deltas', `
      <p>Decode re-computes each head&rsquo;s attention distribution from scratch every token,
      yet consecutive steps&rsquo; distributions are usually nearly identical — the context
      barely changed. Borrow the video-codec trick: treat occasional full attention passes as
      <em>keyframes</em>, and between them predict each head&rsquo;s row from its previous row
      plus a cheap learned low-rank correction (rank-1 or -2 per head), triggered back to a full
      pass by a drift detector on the correction&rsquo;s magnitude. Heads whose maps barely move
      (positional, syntactic) would amortize almost everything; content-seeking heads would
      keyframe often. The risk to test first: error accumulation at topic boundaries, where
      every head&rsquo;s map shifts at once — the detector must fire reliably there, and
      retrieval-heavy benchmarks would expose it if it doesn&rsquo;t. Speculative; related
      cache-reuse ideas exist for prefix caching, but per-head decode-time map prediction
      does not, to our knowledge, ship anywhere.</p>`),
  );
}
