/* Frontier — chapter 04B (attention at scale / the memory wall).
   Where the long-context program itself is stuck, what the field is doing,
   and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>Recall vs. memory is now the binding constraint — and nobody can measure the
      trade properly.</strong> Constant-state layers cannot do exact retrieval: d² numbers will
      not hold a million arbitrary associations, so KDA-style layers structurally cannot promise
      the verbatim recall a contract-analysis or codebase query needs. Full-attention layers can
      — but cannot afford a million tokens of cache. Hybrids split the difference, yet the split
      itself is folklore: 3:1 KDA:MLA, Gemma&rsquo;s 5:1 sliding-window:full, Jamba&rsquo;s
      7:1 — ratios tuned by ablation sweeps, with no theory predicting how much exact-recall
      capacity a given workload needs or which layers should carry it. Worse, the evaluation
      layer is itself knowledge-scarce: needle-in-a-haystack saturated years ago, so the tests
      that would adjudicate these designs no longer discriminate — models ace the needle while
      failing multi-hop use of the same context, and &ldquo;supports 1M tokens&rdquo; has quietly
      become a claim no public benchmark can falsify.</p>`),

    researchItem('Titans / test-time memorization', '2025', 'research', `
      <p>Google&rsquo;s Titans line (with 2024&rsquo;s TTT layers as precursor) pushes the
      chapter&rsquo;s delta-rule logic to its conclusion: make the fast memory a small neural
      network trained by gradient descent <em>at inference time</em>, writing more when input
      is surprising and provably subsuming linear-attention states as the rank-1 special case.
      Reports recall beyond 2M tokens on retrieval tasks — the most credible attack yet on
      &ldquo;constant state can&rsquo;t remember&rdquo; — though frontier-scale deployment
      remains undemonstrated.</p>`),
    researchItem('KV quantization + eviction (H2O, SnapKV, KIVI)', '2023', 'deployed', `
      <p>The pragmatic school: keep full attention but shrink its cache after the fact. Eviction
      policies exploit the heavy-hitter skew of attention mass — H2O keeps the few tokens that
      accumulate most attention, SnapKV selects per-head before decode — while KIVI-style
      quantization stores K/V at 2–4 bits. Compounds with GQA/MLA and ships in mainstream
      serving stacks; the honest caveat is that eviction is a bet that future queries resemble
      past ones, and adversarial &ldquo;ask about the evicted token&rdquo; cases lose.</p>`),
    researchItem('Prefill/decode disaggregation', '2024', 'deployed', `
      <p>The systems answer to chapter 09&rsquo;s two regimes: since prefill is compute-bound and
      decode is bandwidth-bound, run them on <em>separate</em> machines sized differently, and
      ship the KV cache between them over the interconnect. DistServe and Splitwise published
      the pattern; Moonshot&rsquo;s own Mooncake — the KV-cache-centric stack serving Kimi in
      production — is the existence proof at specimen-relevant scale. Long context stops being
      one GPU&rsquo;s problem and becomes a cluster-scheduling problem.</p>`),
    researchItem('YaRN-family context extension', '2023', 'deployed', `
      <p>The standard recipe behind nearly every headline context number: interpolate RoPE
      positions (PI), rescale per frequency band so fast, local-detail dials are spared
      (NTK-aware), add an attention-temperature correction, and fine-tune briefly (YaRN);
      successors (LongRoPE and kin) push past 2M positions with searched per-dimension scales.
      Deployed across the open-model ecosystem — with the standing caveat that position
      <em>robustness</em> is not comprehension, as the lost-in-the-middle results keep showing.</p>`),

    novelIdea('Learned per-head cache budgets', `
      <p>Stop hand-picking the hybrid ratio; make it a trained variable. Give every head in
      every layer a memory dial spanning the continuum this chapter walked — constant state at
      one end, windowed cache in the middle, full cache at the other — and let training allocate
      a global byte budget across heads via a differentiable relaxation (temperature-annealed
      gates, hard-thresholded at inference). The 3:1 folklore becomes a learned, depth- and
      head-specific allocation, and post-hoc you get a map of <em>where exact recall actually
      lives</em> in a transformer — interpretability for free. The failure mode to test first:
      under a pure language-modeling loss the budget will collapse toward recency-dominated
      cheap heads (perplexity barely rewards rare exact recall), so the training mix must
      include dense long-range retrieval supervision, and the budget term needs to price bytes
      at their true serving cost. Speculative — per-layer static variants exist in the sparse
      literature, but end-to-end learned per-head budgets across the full state-to-cache
      continuum do not, to our knowledge.</p>`),
  );
}
