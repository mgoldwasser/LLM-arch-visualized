/* Frontier — chapter 09 (inference).
   Decode as a bandwidth ritual — how serving research feeds the idle
   arithmetic units, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>Decode is a bandwidth ritual: the entire model re-streamed from memory to buy
      one token's worth of arithmetic.</strong> Each decode step reads every active weight once
      and does roughly two FLOPs per byte read — arithmetic intensity of 1–2 against the several
      hundred modern accelerators need to run at peak — so the math units idle while HBM does the
      work. The chapter's own numbers set the ceiling: ~25 GB of active weights at 4-bit against
      ~3 TB/s of bandwidth caps single-stream decode in the low hundreds of tokens per second,
      <em>no matter how much compute the chip has</em>. Batching many users amortizes the weight
      reads and recovers throughput, but at the price of latency and interference — a long
      prefill scheduled into the batch stalls every decoding user behind it, which is why
      time-between-tokens jitters under load. The KV cache converts context into resident memory,
      so concurrency is capped by HBM and an idle million-token chat holds gigabytes hostage
      while its user reads. And sampling is sequential by construction: token t+1 cannot be drawn
      until token t is chosen, so the ritual repeats once per token of a ten-thousand-token chain
      of thought.</p>`),

    researchItem('Self-drafting speculative decoding: Medusa, EAGLE', '2024', 'deployed', `
      <p>Chapter 01's frontier introduced the basic drafter-verifier trick; the deployed
      state-of-the-art internalizes it. Medusa (2024) bolts extra decoding heads onto the model
      itself; EAGLE (2024) drafts in the model's own feature space — predicting the next hidden
      state, from which cheap token candidates follow — and expands a <em>tree</em> of drafts
      that one verification pass scores in parallel, with EAGLE-2/3 growing the tree dynamically
      by draft confidence. Acceptance is the whole economics: at 3–5 accepted tokens per big-model
      pass, the same weight-streaming buys several tokens instead of one. The output distribution
      is provably unchanged; the speedup, however, shrinks exactly when batch sizes are large —
      speculation spends spare compute, and a saturated server has none to spare.</p>`),
    researchItem('PagedAttention & continuous batching (vLLM)', '2023', 'deployed', `
      <p>vLLM's PagedAttention manages the KV cache like an OS manages RAM: fixed-size blocks,
      a page table per sequence, zero fragmentation, and copy-on-write sharing of common
      prefixes. Combined with continuous batching — new requests join and finished ones leave the
      batch at every step rather than waiting for a full batch to drain — it multiplied
      real-world throughput by 2–4× and is now the reference architecture for essentially every
      serving stack. It attacks the concurrency cap directly: more of the finite HBM holds
      <em>useful</em> cache, so more streams share each ritual weight-read.</p>`),
    researchItem('Prefill/decode disaggregation: DistServe, Mooncake', '2024', 'deployed', `
      <p>Prefill is compute-bound, decode is bandwidth-bound — so stop running them on the same
      GPUs. DistServe (2024) formalized the win of splitting the phases across machine pools
      sized independently for time-to-first-token and time-between-tokens. Mooncake — Moonshot's
      own serving stack for Kimi — is the production proof: a disaggregated, KV-cache-centric
      design that treats the cluster's pooled DRAM and SSD as one giant cache layer, ships
      prefill-computed KV to decode nodes, and reported serving ~75% more requests under real
      SLOs. The interference problem in the bottleneck above is solved by never letting the two
      regimes queue against each other in the first place.</p>`),
    researchItem('KV-cache compression: H2O, SnapKV, quantization', '2023–24', 'research', `
      <p>The eviction line (H2O 2023, SnapKV 2024) exploits attention sparsity: a small set of
      "heavy-hitter" tokens receives most attention mass, so keep those plus a recent window and
      drop the rest — 3–5× cache reduction with small measured loss on the benchmarks tried.
      KV quantization (KIVI-style 2-4 bit, now common in serving stacks) is the deployed end of
      the same push. The honest caveat: eviction bets that past unimportance predicts future
      unimportance, and needle-in-a-haystack retrieval is exactly where that bet fails — which is
      why architectural fixes from chapter 04 (MLA's latent, KDA's constant state) compress
      <em>losslessly by construction</em> and are eating this problem from below.</p>`),
    researchItem('Diffusion & parallel decoding', '2025', 'research', `
      <p>The same escape hatch chapter 01's frontier flagged for the objective is also an escape
      from the decode ritual: a diffusion LM (Gemini Diffusion, Mercury, LLaDA) refines many
      positions per forward pass, so each streaming of the weights buys tens of tokens of
      progress rather than one — reported thousands of tokens per second on commodity-class
      hardware. Same honesty as before, seen from the serving side: quality parity at frontier
      scale is unproven, KV-cache reuse across denoising steps is an open research problem (naive
      implementations recompute attention over the whole canvas every step), and the
      compute-per-<em>quality-adjusted</em>-token accounting is still murky. If it lands, this is
      the only entry here that removes the bottleneck rather than amortizing it.</p>`),

    novelIdea('Expert-affinity batching: schedule the batch to reuse the weights', `
      <p>In a 896-expert MoE like K3, each decode step streams only the 16 experts a token
      routes to — but a mixed batch routes to nearly all of them, re-inflating the bandwidth
      bill that sparsity was supposed to cut. Proposal: make the scheduler router-aware. Keep a
      cheap online sketch of each active sequence's recent expert-usage histogram (domain and
      style make these sticky — code sessions keep hitting code-ish experts), and co-schedule
      sequences with overlapping histograms onto the same decode replicas, so each expert fetched
      from HBM is amortized across many tokens that actually want it; cold experts stay resident
      in slower tiers. This is continuous batching with a locality objective — paging logic for
      experts, by analogy with PagedAttention's paging for cache. Clearly speculative, and the
      failure modes are concrete: routing is per-token and layer-by-layer, so sequence-level
      histograms may predict too weakly to beat random batching (measurable first, cheaply, from
      routing logs); affinity grouping fights fairness — a sequence with rare expert taste waits
      for peers that never arrive, adding exactly the tail latency batching already taxes;
      replica-level expert specialization concentrates load and creates hotspots the load
      balancer must fight; and any scheduler that <em>prefers</em> some routings risks a feedback
      loop with chapter 05's load-balancing losses if its pressure ever leaks into training.</p>`),
  );
}
