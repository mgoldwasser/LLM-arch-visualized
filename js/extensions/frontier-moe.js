/* Frontier — chapter 05 (mixture of experts).
   The distributed-systems tax behind sparse capacity, what the field is
   doing about it, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>Capacity bought with a distributed-systems tax.</strong> MoE decouples knowledge
      from per-token compute, but the bill arrives elsewhere. Experts are sharded across
      accelerators, so every MoE layer puts an all-to-all network exchange on the critical path —
      twice (dispatch and return), some sixty times per forward pass — and the slowest, hottest
      device paces everyone. Load balancing and specialization pull in opposite directions:
      perfect balance means every expert sees a near-uniform slice of the distribution, which is
      precisely the condition under which experts become interchangeable — and merging or pruning
      studies confirm the redundancy, with many experts removable at little cost. Routing is
      trained on its own consequences: an expert never chosen receives no gradient and never
      improves, so early routing accidents can freeze into permanent policy — a bandit
      exploration problem that top-k gating never explicitly solves. And serving inverts the
      bargain: each token touches ~2% of the parameters, but <em>which</em> 2% is unknown until
      the router fires, so all 2.8T must sit resident in fast memory. Memory capacity, not
      compute, sizes the cluster — that is what "supernodes of 64+ accelerators" is actually
      paying for.</p>`),

    researchItem('DeepSeekMoE: fine-grained + shared experts', '2024', 'deployed', `
      <p>The design K3 inherits. Two moves against redundancy: slice each expert into many
      smaller ones and activate more of them (finer-grained combinatorics — the same active
      parameter budget selects from vastly more expert subsets), and add shared experts that
      process every token unconditionally, absorbing the common patterns so routed experts stop
      duplicating them. Introduced in DeepSeekMoE, carried through V2/V3 into production, and
      now the default shape of frontier MoE — K3's 896-routed-plus-1-shared layout is this
      recipe at larger scale.</p>`),
    researchItem('Auxiliary-loss-free balancing', '2024', 'deployed', `
      <p>The classic fix for router collapse — an auxiliary balancing loss — injects a gradient
      that actively fights routing quality, tuned by a coefficient that is wrong in both
      directions. DeepSeek-V3 dropped the loss entirely: a per-expert bias, adjusted online
      outside the gradient (nudged down when an expert runs hot, up when cold), steers top-k
      selection without distorting the scores used for weighting. Balance improves <em>and</em>
      perplexity improves. K3's Quantile Balancing continues this line, deriving allocation
      directly from router-score quantiles with no tuned coefficient at all.</p>`),
    researchItem('PEER: a million tiny experts', '2024', 'research', `
      <p>Push granularity to its limit: DeepMind's PEER replaces the MLP with over a million
      single-neuron-scale experts selected by product-key retrieval — the query is split so that
      scoring n experts costs O(√n), making million-way routing tractable. Fine-grained scaling
      laws favor exactly this regime (many small experts beat few large ones at fixed active
      compute), and it blurs into Meta's related memory-layer work (chapter 06's frontier).
      Unproven at frontier scale, and the retrieval structure adds its own serving complexity —
      but it suggests today's hundreds-of-experts designs sit far from the granularity optimum.</p>`),
    researchItem('Expert offloading & caching', '2023', 'research', `
      <p>Attack the all-parameters-resident constraint directly: keep hot experts in GPU memory,
      cold ones in CPU RAM or NVMe, and exploit the empirical locality of routing (consecutive
      tokens reuse experts far more than chance) with LRU caches and speculative prefetching —
      MoE-offloading systems run Mixtral-class models on single desktop GPUs this way.
      Effective for local and low-throughput inference; at datacenter batch sizes the locality
      washes out (a large batch touches nearly every expert every layer), which is why frontier
      serving still holds everything resident and this remains a constrained-setting technique.</p>`),
    researchItem('Sparse upcycling from dense checkpoints', '2023', 'deployed', `
      <p>Skip training an MoE from scratch: clone a trained dense model's MLP into E identical
      experts, add a router, and continue training — the experts differentiate from a warm
      start. Introduced as sparse upcycling (Google, 2022–23), since used by several open model
      families (e.g. Qwen's MoE line) and studied systematically by NVIDIA at billion-parameter
      scale. The honest trade-off: upcycled experts start identical, so they explore less of
      expert-space than scratch training and can plateau below it given enough compute — cheap
      capacity now versus a lower ceiling later.</p>`),

    novelIdea('Counterfactual routing audits', `
      <p>The router never learns what would have happened. Proposal: spend a fixed ~0.5% of
      training tokens as an audit budget — for an audited token, run a handful of
      <em>non-selected</em> experts alongside the chosen top-k, compute the counterfactual loss
      each would have produced, and train the router on realized outcomes (regressing scores
      toward measured loss deltas) instead of purely on its own self-reinforcing preferences.
      This is off-policy evaluation for routing: cold experts get occasional real gradient and a
      chance to demonstrate value, turning the frozen-expert failure mode into a measured
      quantity. The audit batches are compute the schedule must absorb, but 0.5% is noise
      against a pretraining budget. Failure modes, named: single-sample counterfactual deltas
      are extremely noisy, so the regression needs heavy averaging or it teaches the router
      nothing but variance; auditing interacts with balancing — an expert that audits well gets
      traffic, which the balancer then throttles, and the two signals can oscillate; measuring
      one expert's marginal effect while others also fire misattributes credit when experts are
      complementary rather than substitutable; and if audits keep resurrecting genuinely useless
      experts, the mechanism preserves exactly the redundancy it was meant to price. Cheapest
      falsification: audit a mid-scale MoE run and check whether measured counterfactual deltas
      even disagree with router scores — if they agree, the exploration problem is smaller than
      argued and the machinery is unnecessary.</p>`),
  );
}
