/* Frontier — chapter 03 (the residual stream).
   Why a fixed-width shared bus with strictly serial layers is a bottleneck,
   what the field is doing about it, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>A fixed-width shared bus that every layer must read and write through.</strong>
      The residual stream is one d_model-wide vector per token, and everything — syntax flags,
      entity bindings, world-model state, the emerging next-token decision — must be encoded
      into it simultaneously. Interpretability work shows the model copes by
      <em>superposition</em>: packing far more features than dimensions as non-orthogonal
      directions, which buys capacity at the price of interference — features corrupt each other
      exactly when many are active at once. The width is also uniform where the workload is not:
      the same d_model that carries local syntax at layer 3 must carry accumulated long-range
      state at layer 50, with no way to widen mid-stack. Depth has the mirror problem: layers
      execute strictly serially, so depth is latency — every token pays the full stack — yet
      logit-lens-style probes show late layers often refine the prediction only marginally for
      easy tokens. Compute is spent uniformly on a workload that varies wildly per token, and
      each layer may communicate with the future only by adding a vector into a bus that
      everyone else is also shouting into.</p>`),

    researchItem('Sparse autoencoders on the stream', '2023', 'research', `
      <p>Anthropic's dictionary-learning line ("Towards Monosemanticity" 2023, "Scaling
      Monosemanticity" 2024) trains sparse autoencoders to decompose stream activations into
      millions of sparsely-active, often human-interpretable features — the strongest direct
      evidence that superposition is real and that the stream is a compressed encoding of many
      more variables than it has dimensions. As engineering, SAEs are a decompression tool:
      features can be monitored and steered. The honest caveats: reconstructions are lossy, the
      feature dictionaries are expensive to train, and there is no guarantee the learned basis
      matches the model's own computational units.</p>`),
    researchItem('Hyper-connections & multi-stream residuals', '2024', 'research', `
      <p>If one bus is too narrow, learn several: hyper-connections replace the single residual
      stream with a small set of parallel streams plus learned (even input-dependent) mixing
      weights that let each layer choose what to read from and write to — widening the
      communication channel without widening the matmuls, at negligible parameter cost.
      Reported to beat plain pre-norm residuals on both dense and MoE pretraining. K3's
      Attention Residuals belong to this family: they let a layer read stream states from
      arbitrary earlier depths rather than only the immediately previous one, turning the bus
      into something closer to a routed network.</p>`),
    researchItem('Early exit & layer skipping', '2022', 'contested', `
      <p>If late layers refine marginally, stop early: confidence-based early exit (CALM) and
      LayerSkip-style training let easy tokens leave the stack before the end, or let a serving
      stack drop layers under load. Variants ship in some production serving systems, and the
      self-speculative version (draft with early layers, verify with the full stack) keeps
      outputs exact. The contested part is naive skipping: per-token exit decisions interact
      badly with batching and the KV cache (a token that exits early still owes K/V entries to
      its successors), and quality degrades unevenly — fine on average, worst exactly on the
      hard tokens.</p>`),
    researchItem('Mixture-of-depths', '2024', 'research', `
      <p>Make depth a routed resource, symmetric with MoE's treatment of width: a per-layer
      router selects which tokens get the full attention+MLP treatment and which ride the
      residual bypass unchanged, under a fixed compute budget learned during training rather
      than decided heuristically at inference. Delivers equal-quality models with meaningfully
      fewer flops per forward pass at research scale, and composes with MoE. Not yet standard in
      frontier deployments; the capacity-scheduling machinery complicates batched inference.</p>`),
    researchItem('Depth recurrence & looped latent reasoning', '2025', 'research', `
      <p>The Universal Transformer idea — reuse the same block repeatedly, sharing weights across
      depth — is being revived as test-time compute: recurrent-depth models (e.g. the 2025
      "Huginn" line) loop a core block a variable number of times, spending more iterations on
      harder inputs, reasoning in latent space rather than in emitted tokens. This directly
      attacks the depth-is-fixed assumption: depth becomes a dial, not an architecture constant.
      Small-scale results show genuine iteration gains on reasoning tasks; whether looped small
      cores can match deep unshared stacks at frontier scale is open.</p>`),

    novelIdea('Lane leases: a softly-partitioned stream', `
      <p>Superposition is uncontrolled subletting — every feature squats wherever geometry
      allows. Suppose instead the stream were softly partitioned into ~32 <em>lanes</em>
      (contiguous blocks of dimensions), with each layer learning per-lane read and write gates,
      regularized so that writes are lane-sparse: a layer must "lease" the few lanes it needs
      rather than broadcasting into all of ℝ<sup>d</sup>. Features with long lifetimes (entity
      state) would settle into stable lanes protected from high-traffic short-lived computation;
      a lane whose content is consumed could be explicitly released and reused, giving the
      fixed width a form of garbage collection. The gates double as a free interpretability
      map — who wrote where, when. This is speculative, and the failure modes are sharp:
      gating the residual path risks damaging the clean identity gradient highway that makes
      deep stacks trainable at all (leases must stay soft, never zero); axis-aligned lanes
      fight the rotational symmetry of everything else in the network, and the model may simply
      learn rotations that smear features across lanes, silently reverting to superposition;
      and fragmentation is a real cost — reserved-but-idle lanes shrink effective width, so a
      badly tuned sparsity penalty could underperform a plain dense stream at equal d_model.
      The test: does interference (measured by SAE feature-collision rates) drop at equal loss,
      or does the model just pay the regularizer and route around it?</p>`),
  );
}
