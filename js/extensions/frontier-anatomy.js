/* Frontier — chapter 03B (the component catalog).
   Why architecture design is knowledge-scarce at frontier scale, what the
   field does about it, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>Architecture design is the most knowledge-scarce activity at the frontier.</strong>
      A proper ablation — train the full model twice, once with and once without the component —
      costs millions of dollars per data point, so almost nobody runs one. The field substitutes
      two proxies, both leaky: folklore (a change ships in one strong model and is copied into
      every config that follows, evidence unexamined) and small-scale experiments, whose verdicts
      routinely fail to transfer — a trick that wins at 1B can be neutral or harmful at 1T, and
      vice versa. Worse, this chapter's components do not act independently: norm placement,
      initialization, optimizer, and learning-rate schedule form one coupled system, so when a
      run improves, credit assignment across the block's parts is close to impossible — was it
      the gated activation, or the LR retune it permitted? The honest summary: the modern block
      is <em>locally</em> optimal at best, a ridge the field walked up one cheap step at a time,
      and nobody can afford the counterfactuals that would say how far the global optimum sits
      from it.</p>`),

    researchItem('µP / µTransfer', '2021', 'deployed', `
      <p>Yang &amp; Hu's Tensor Programs line: parameterize initialization and per-layer learning
      rates so that the optimal hyperparameters become <em>invariant across model width</em>. Tune
      exhaustively on a small proxy, transfer the config to the big run, train once. This converts
      a slice of the unaffordable-ablation problem into an affordable one, and variants are in
      production at several labs (Cerebras-GPT documented it end-to-end; µP-style scaling rules
      appear throughout recent open training reports). Limits: transfer is proven across width,
      weaker across depth and data scale, and it tunes optimization knobs — not discrete choices
      like "SwiGLU vs GELU".</p>`),
    researchItem('Stability-trick consolidation (QK-norm, z-loss, soft-capping)', '2022–24', 'deployed', `
      <p>A quiet consolidation of fixes for training blow-ups, each born in one model's postmortem
      and now default equipment: QK-norm (ViT-22B, then Gemma-lineage LLMs) bounds attention
      logits; PaLM's z-loss keeps the softmax normalizer from drifting; Gemma 2 soft-caps logits.
      Individually tiny, together they define the difference between a config that trains at 1T
      scale and one that loss-spikes at step 300k. Notably, all three are <em>norm-shaped</em> —
      the block's remaining instabilities keep getting solved by bounding something.</p>`),
    researchItem('Scaling-law-guided design', '2022', 'research', `
      <p>Extend the Chinchilla methodology from "how many tokens per parameter" to architecture
      itself: fit loss curves across a ladder of small runs for each design choice — depth-width
      ratios, MoE expert count and granularity (DeepSeekMoE published such sweeps), vocabulary
      size — and extrapolate to the target budget. Works well for smooth knobs; remains unreliable
      for discrete swaps, whose ladders sometimes <em>cross</em> as scale grows — exactly the case
      where extrapolation is needed most.</p>`),
    researchItem('Neural architecture search at LLM scale', '2017–', 'contested', `
      <p>The automated version of this chapter keeps being proposed and keeps not paying off.
      Evolved-search results like Primer (2021) found real block-level tweaks (e.g. squared-ReLU)
      at small scale, but no frontier model's block was discovered by search: the compute needed
      to evaluate candidates honestly at scale is the same compute the search was meant to save,
      and cheap proxy evaluations reintroduce the transfer problem NAS was supposed to solve.
      Whether LLM-assisted architecture proposal changes this economics is an open bet.</p>`),
    researchItem('Cross-layer wiring: hyper-connections → K3 Attention Residuals', '2024–26', 'research', `
      <p>The first at-scale challenge to a part this chapter treated as untouchable: the single
      residual highway. Hyper-connections (2024) widen the stream into multiple learned-weighted
      lanes between layers; K3's Attention Residuals (per Moonshot's description) let a layer pull
      representations from <em>arbitrary earlier layers</em> rather than only the one below.
      Whether the gains survive independent ablation at scale is exactly the kind of question
      this section's bottleneck says is hard to answer.</p>`),

    novelIdea('Differential ablation inside one training run', `
      <p>If dedicated ablation runs are unaffordable, amortize them: attach a learned scalar gate
      α ∈ [0,1] to each candidate component (each bias vector, QK-norm, the gate path of SwiGLU,
      each norm's mean-centering term), stochastically drop components in proportion to 1−α
      during training, and let the gradient set the gates. At convergence the gate values and the
      loss's measured sensitivity to each dropout <em>are</em> an ablation table — one training
      run, every component priced. The confounds are real and worth stating: a low gate means
      "removable given everything else in this config at this scale", not "useless" — co-adapted
      components can shadow each other, the gates themselves perturb the optimization they are
      measuring, and pairwise interactions stay invisible to marginal scores (a factorial dropout
      scheme fights this at the cost of variance). At minimum it would replace folklore with
      per-run evidence — a continuously updated deletion list like Fig. 3B.2, generated as a
      byproduct of training. Speculative: nobody has shown the gates stay calibrated at frontier
      scale, and the post-norm story is a warning that some components matter only through their
      interactions.</p>`),
  );
}
