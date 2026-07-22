/* Frontier — chapter 10 (adaptation).
   Adaptation is still alchemy — the shrinking-update trendline, its missing
   theory, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>The field can shrink an update nine orders of magnitude and still can't tell you
      how big it needed to be.</strong> Full fine-tuning is maximally expressive and
      catastrophically forgetful — new gradients overwrite old circuits with no mechanism
      protecting what the base model knew. LoRA-family methods trade capacity for safety, but
      there is no theory of <em>where</em> that tradeoff sits: the chapter's 13-parameter result
      works, and nobody fully knows why — nor why Qwen models absorb tiny updates roughly 10×
      more readily than Llama, a gap between model families that no measurement currently
      predicts. The knobs are folklore: rank, α, target modules, and learning rate are chosen by
      community lore and sweep budgets, not by any principled estimate of the task's demands.
      Adapters that work alone interfere when composed — merge two LoRAs and their deltas
      collide in shared subspaces with no calculus for predicting the damage. On-policy data
      demonstrably helps (the chapter's SFT-vs-RL asymmetry), but per-user RL — a verifier, a
      group sampler, and a training loop for every customer — is operationally absurd. The
      missing science is capacity: the field cannot yet <em>predict</em>, for a given behavioral
      delta on a given model, how many trainable parameters it needs. Until it can, every
      adaptation is an experiment run on the customer.</p>`),

    researchItem('Activation steering / representation engineering', '2023–25', 'research', `
      <p>The logical endpoint of the shrinking-update trendline: change zero weights. Steering
      vectors (ActAdd 2023, inference-time intervention 2023, representation engineering 2023,
      and the 2025 persona-vector line) add a direction to the residual stream at inference —
      computed from as little as a pair of contrastive prompts — and reliably move truthfulness,
      refusal, sentiment, or persona. If 13 trained parameters suggest adaptation is
      <em>selection</em> of existing circuits, steering is selection with the training loop
      deleted. Limits: effects are coarse and dose-sensitive (too much steering degrades
      fluency), composition of multiple vectors is poorly understood, and reliability across
      prompts remains well below what fine-tuning delivers — which is why it ships as a research
      tool and safety probe, not yet as a product surface.</p>`),
    researchItem('Task vectors & model merging: TIES, DARE', '2023–24', 'deployed', `
      <p>Task arithmetic (2022–23) showed that θ_finetuned − θ_base behaves like a vector:
      add it to transfer a skill, negate it to unlearn, sum several to multi-task. TIES-Merging
      (2023) attacks the interference problem — trim low-magnitude deltas, resolve sign conflicts
      by majority, merge what agrees; DARE (2023–24) shows most deltas can be randomly dropped
      and rescaled with little loss, which says the deltas were mostly redundant all along —
      indirect evidence for the low-capacity thesis. Deployed at scale in the open-source
      ecosystem (mergekit powers a large fraction of leaderboard models), still without a theory
      of when merging works: composition remains empirical alchemy with better folklore.</p>`),
    researchItem('DoRA / QDoRA and LoRA-variant refinements', '2024', 'deployed', `
      <p>DoRA decomposes each weight update into magnitude and direction and trains them
      separately, after analysis showed LoRA's updates are biased toward coupled
      magnitude-direction changes unlike full fine-tuning's; it consistently outperforms LoRA at
      equal rank, especially low rank, and QDoRA composes the trick with a 4-bit frozen base.
      Now integrated in mainstream fine-tuning stacks. Worth reading as evidence about the
      capacity question: <em>how</em> you parameterize a tiny update matters as much as its size
      — some of LoRA's folklore hyperparameter sensitivity was parameterization artifact, not
      task difficulty.</p>`),
    researchItem('Memory-based adaptation: retrieval and KV cartridges', '2025', 'research', `
      <p>A different answer entirely: put the delta in memory, not in weights. Retrieval-augmented
      generation is the deployed baseline; the research edge (the 2025 "cartridges" line) is to
      <em>pre-train a compressed KV cache</em> — self-distilled offline from a large corpus so it
      behaves as if the model had read the whole thing — then load it at inference like a
      cartridge, at a fraction of the memory of the raw-context cache. Adaptation becomes an
      artifact you swap in, with zero forgetting, instant rollback, and composition by
      concatenation. Open questions: cartridges compete with chapter 09's KV memory economics,
      offline distillation cost is nontrivial, and skill-like (rather than knowledge-like)
      deltas may not be expressible as cache contents at all.</p>`),
    researchItem('Continual learning at scale: replay & parameter isolation', '2023–25', 'contested', `
      <p>The classic remedies for catastrophic forgetting — replay a slice of the original data
      mixture while fine-tuning, or isolate new knowledge in dedicated parameters (added experts,
      frozen backbones, EWC-style penalties) — demonstrably reduce forgetting in controlled LLM
      studies, and replay is quietly standard in industrial post-training. Contested because the
      accounting is unsettled: measured forgetting varies wildly with eval choice, replay
      requires access to a data mixture most adapters don't have, isolation methods grow the
      model without bounding interference, and no method yet delivers the actual goal — a model
      that accumulates skills across many sequential adaptations without regression — beyond a
      handful of steps.</p>`),

    novelIdea('Adaptation capacity curves: measure bits-per-parameter before you tune', `
      <p>The chapter's open question — how much capacity does a behavioral delta need? — looks
      measurable with tools that already exist. TinyLoRA's trainable count n is a clean dial, so:
      for a battery of tasks and base models, sweep n from 1 upward and record performance
      recovered vs. full fine-tuning, giving each (task, model) pair an <em>adaptation capacity
      curve</em> and a scalar summary — the n needed for 90% recovery, a minimum-description
      length of the behavioral delta in trainable parameters. The speculative bet is that these
      curves are lawful the way scaling laws are: that the 90%-recovery n correlates with
      measurable properties of task and model (probe-based representation quality for the task in
      the frozen base; RL-vs-SFT regime; base model scale) well enough to <em>predict</em>
      required capacity before tuning — turning "Qwen absorbs tiny updates, Llama doesn't" from
      folklore into a number computable from probes, and telling a practitioner whether their
      delta is a 13-parameter selection problem or a full-rank absorption problem. Failure modes,
      named: the curves may be optimizer- and parameterization-dependent rather than
      task-intrinsic (the paper's own fp32-vs-bf16 oddity is a warning that this regime is
      strange), so the "capacity" measured is TinyLoRA's, not the task's; eval noise near the
      recovery threshold can swamp the signal, demanding expensive repeated runs; selection-style
      and absorption-style deltas may follow different laws with no single scalar bridging them;
      and a predictor trained on today's (task, model) pairs may transfer across model families
      exactly as badly as the folklore it replaces — the Qwen/Llama gap is the test it must pass,
      not a nuisance to average over.</p>`),
  );
}
