/* Frontier — the `posttraining` chapter (post-training).
   The reward is the weakest link — how the field is shoring it up,
   and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>Every stage of this pipeline optimizes a proxy for what we actually want — and
      the proxy is the weakest link.</strong> Human preference data is noisy (annotators disagree
      with each other and with themselves), expensive to collect, and caps quality at demonstrator
      level: SFT can only imitate, and rankers can't reliably prefer answers they couldn't judge.
      The learned reward model inherits those flaws and adds its own exploitable regularities —
      policies discover that sycophancy, confident tone, length, and format flourishes raise
      reward without raising quality — which is why the KL tether exists, and the tether cuts both
      ways: it bounds how far optimization can push <em>toward</em> genuinely better behavior too.
      RLVR escapes the learned judge but only where a verifier exists; math and code are covered,
      while the subjective majority of real use — advice, writing, judgment — has no oracle that
      returns 1 or 0. Credit assignment is brutal: one scalar at the end of a ten-thousand-token
      chain of thought must be smeared across every token, and GRPO's group baseline, elegant as
      it is, tells a winning attempt nothing about <em>which</em> of its steps mattered. And the
      whole stage can silently tax what it doesn't measure: entropy collapse, shrinking output
      diversity, and capability regressions on unmeasured axes — the alignment tax — show up only
      if you thought to build the eval.</p>`),

    researchItem('Process reward models ("Let’s Verify Step by Step")', '2023', 'research', `
      <p>OpenAI's PRM work trained reward models on <em>step-level</em> human labels (the PRM800K
      dataset) and showed process supervision beats outcome-only supervision at selecting correct
      math solutions — a direct attack on the sparse-credit problem, since each reasoning step
      gets its own signal. The follow-on literature automates the labels via Monte-Carlo rollouts
      from intermediate steps. The catch, repeatedly documented since: PRMs are themselves learned
      judges, and optimizing against them online reintroduces the hacking problem one level down —
      most production use is therefore reranking and data selection rather than direct RL reward.</p>`),
    researchItem('GRPO refinements: DAPO, GSPO', '2025', 'research', `
      <p>Long-chain RL at scale exposed failure modes in vanilla GRPO: entropy collapse,
      degenerate groups (all-correct or all-wrong prompts contribute zero gradient), length
      biases, and — highlighted by Qwen's GSPO — high-variance token-level importance ratios that
      destabilize MoE training. DAPO (2025) ships fixes as an open recipe: decoupled clip ranges,
      dynamic sampling to filter zero-signal groups, token-level loss aggregation. GSPO (2025)
      moves importance weighting to the sequence level, matching the granularity of the reward.
      These are the stabilizers behind the reasoning wave's long chains of thought — engineering
      corrections to exactly the credit-assignment sparseness the bottleneck describes.</p>`),
    researchItem('RLAIF & Constitutional AI', '2022–23', 'deployed', `
      <p>Anthropic's Constitutional AI replaces much of the human preference labeling with AI
      feedback steered by an explicit list of principles: the model critiques and revises its own
      outputs, and an AI judge generates the preference pairs. This makes feedback cheap and
      scalable and makes the optimization target legible — you can read the constitution — at the
      cost of importing the judge model's biases wholesale. RLAIF is now standard practice across
      labs; it widens the data bottleneck without solving the deeper problem that the judge still
      caps at the judge's competence.</p>`),
    researchItem('Scalable oversight: debate & weak-to-strong', '2023–24', 'research', `
      <p>Two lines attack the "graders weaker than the graded" endgame. Empirical debate results
      (2023–24) show non-expert judges reach better verdicts when two models argue opposing sides
      — accuracy of oversight can exceed accuracy of the overseer. OpenAI's weak-to-strong
      generalization work (2023) fine-tuned GPT-4 on labels from a GPT-2-class supervisor and
      recovered much of the strong model's capability, framing alignment of superhuman systems as
      an empirical ML problem. Both are proofs of concept on toy-to-moderate settings; neither
      has been shown to carry a frontier post-training pipeline.</p>`),
    researchItem('Reward-hacking measurement & mitigation', '2023–25', 'contested', `
      <p>Gao et al.'s overoptimization scaling laws (2023) quantified the core pathology: push a
      policy hard enough against any fixed reward model and true quality peaks, then falls, while
      proxy reward keeps climbing. Mitigations under active study — reward-model ensembles with
      disagreement penalties, explicit length debiasing, hack-detection probes on policy
      internals, and 2025 results showing RL on <em>spurious</em> rewards can still move
      benchmarks (muddying what "the reward taught it" even means). Contested because the
      measurements themselves depend on gameable evals: the field lacks a hack-proof way to
      measure hacking.</p>`),

    novelIdea('Reward escrow: banking only the reward that survives re-judging', `
      <p>Reward hacking is an overfitting phenomenon: the policy fits the quirks of one frozen
      judge. Proposal: split reward into <em>provisional</em> and <em>banked</em>. During RL, the
      policy trains on provisional reward from the current judge as usual — but a rotating,
      held-out ensemble of judges (different base models, different rubric phrasings, including
      judges <em>trained after</em> the trajectories were generated, so the policy cannot have
      co-adapted to them) re-scores a sample of past trajectories on a delay. Reward that the
      escrow ensemble refuses to confirm is clawed back as a correction term, teaching the policy
      that judge-specific exploits have negative expected value while genuinely better answers
      survive every re-scoring. Speculative, and the failure modes are real: it multiplies judging
      cost; the delayed correction worsens the very credit-assignment sparseness it rides on
      (clawbacks arrive epochs late); correlated blind spots across the ensemble — likely, since
      all judges descend from similar pretraining corpora — leave shared exploits unbilled; and an
      adaptive policy may simply learn the meta-feature "answers that look robust to rubric
      variation," which is sycophancy toward the ensemble rather than quality. Whether the escrow
      gap (provisional minus banked) at least works as a <em>hacking detector</em> is the
      cheapest first experiment.</p>`),
  );
}
