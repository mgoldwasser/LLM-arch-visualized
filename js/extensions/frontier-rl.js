/* Frontier — the `rl` chapter (practice problems).
   Post-training's frontier asks what is wrong with the reward. This one asks
   what is wrong with the practice: where the problems come from, whether the
   thing learned on checkable problems is worth anything on the rest, and what
   happens when the supply of checkable problems runs out. */

import { frontier, bottleneck, researchItem, novelIdea, chRef } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>The loop only runs where a verifier exists, and most of what people ask a model
      for cannot be verified.</strong> Mathematics with a numeric answer, code with tests, formal
      proofs, and a thin band of puzzle-like tasks are the whole of the ungameable territory;
      advice, analysis, writing, judgment, and taste — the majority of real use — have no oracle
      that returns 1 or 0, and the substitute for one is a learned judge with the failure mode
      this chapter closes on. Whether reasoning trained on the checkable slice <em>transfers</em>
      to the rest is the field's largest open empirical question, and the honest state of the
      evidence is: partly, unevenly, and nobody can predict where.</p>
      <p>Inside the verifiable slice the constraints are still severe. The economics invert
      pretraining's: a single update needs tens of rollouts per prompt, each potentially tens of
      thousands of tokens, so RL compute is dominated by <em>generation</em> rather than by the
      gradient step — the trainer spends most of its life doing inference. The supply of practice
      problems is finite and, worse, the useful ones are a moving band: a prompt whose group all
      succeeds or all fails contributes nothing, so a run continuously exhausts its own curriculum
      and must be re-stocked at the model's advancing edge. And outcome supervision cannot tell a
      right answer from a right answer reached by a wrong method — reward the final number and you
      reward lucky arithmetic, unjustified guesses, and short-answer formats gameable by
      elimination. (Process supervision, the direct attack on that, and the robustness of learned
      reward models both sit in ${chRef('posttraining')}'s frontier; the questions here are the
      ones downstream of them.)</p>`),

    researchItem('DeepSeek-R1 and R1-Zero', '2025', 'deployed', `
      <p>The result that made this chapter's argument public. R1-Zero applied large-scale RL with
      rule-based, verifiable rewards directly to a base model, with no supervised warm start, and
      reported both the accuracy climb on AIME and the accompanying growth in response length —
      plus traces in which the model spontaneously stops and re-evaluates a step. R1 added a small
      cold-start SFT stage for readability and language consistency. The paper also showed the
      behavior distils: fine-tuning smaller dense models on R1's traces transfers much of the
      reasoning without running RL on them. Together those are the strongest public evidence that
      the strategies are learned from the optimization rather than copied from labels — and that,
      once learned, they can be imitated.</p>`),
    researchItem('RLVR as a named recipe (Tülu 3)', '2024–25', 'deployed', `
      <p>AI2's Tülu 3 post-training recipe factored out "reinforcement learning with verifiable
      rewards" as a stage in its own right: for any prompt with a checkable answer, replace the
      reward model with the checker. It is the ordinary practice now across open recipes, and its
      importance is as much operational as scientific — it turns reward engineering into dataset
      engineering, where the work is assembling problems with reliable answers and airtight
      extraction of the model's final answer from its prose. Most reported RLVR failures trace to
      the extractor or to wrong answer keys rather than to the algorithm.</p>`),
    researchItem('Scaling RL compute: OpenAI o1', '2024', 'deployed', `
      <p>The o1 release reported that performance improved with both more RL training compute and
      more thinking time at inference — two scaling axes distinct from the pretraining law of
      ${chRef('pretraining')}. That reframes RL from a cheap finishing stage into a second budget
      to be scaled, and reframes an "answer" as something with a variable price. The public
      evidence is a vendor's chart without the run details, so the shape is credible and the
      constants are not checkable; how far either axis extends before it flattens is unpublished
      and, in open replications, contested.</p>`),
    researchItem('Does RL create reasoning, or sharpen it? (Yue et al.)', '2025', 'contested', `
      <p>A pointed empirical challenge: measure the base model and its RLVR-trained descendant at
      large k under pass@k. RLVR reliably wins at k = 1 — and in several settings the base model
      catches up or passes it at large k, suggesting the RL model's solutions were already inside
      the base model's sampling distribution and that RL mostly concentrated probability on them
      rather than adding new capability. Contested on method (pass@k at large k rewards a
      diversity the RL model deliberately trades away; the benchmarks may be saturated;
      distillation results point the other way), but it is the sharpest available statement of the
      question, and it lines up with this chapter's own arithmetic: a prompt teaches only when the
      model can already sometimes solve it.</p>`),
    researchItem('Prover–Verifier Games', '2024', 'research', `
      <p>OpenAI's work on legibility trains a strong "prover" against a much weaker "verifier"
      model, rewarding solutions the weak verifier can actually check. Optimizing only for
      correctness produced solutions that got steadily harder for people to follow; adding the
      weak-verifier game recovered legibility at a modest accuracy cost, and made a sneaky prover's
      wrong answers easier for humans to catch. This is the most direct handle anyone has on the
      unverifiable half of the problem: rather than judging the answer, reward the property that a
      cheap, independent checker can re-derive the reasoning — which is a reward that gets harder
      to game as the checker is rotated.</p>`),
    researchItem('Self-play: AlphaGo Zero and AlphaZero', '2017', 'deployed', `
      <p>The endpoint of the argument this chapter's Go figure starts: AlphaGo Zero removed human
      games entirely and exceeded every earlier version from self-play alone; AlphaZero repeated it
      in chess and shogi from the rules. What makes it work is precisely what language lacks — an
      opponent that supplies unlimited fresh problems at exactly the right difficulty, and a rule
      that declares a winner for free. Attempts to port the pattern (self-generated problem
      curricula, model-versus-model debate, adversarial prompt generation) all founder on the same
      spot: without a ground-truth referee, the generator and the solver can agree on a delusion
      and both keep scoring well.</p>`),

    novelIdea('Practice problems priced by disagreement', `
      <p>A run exhausts its own curriculum: every prompt whose group comes back all-correct or
      all-wrong contributes nothing, and the band of informative problems moves as the model
      improves. Existing recipes handle this by <em>filtering</em> — DAPO's dynamic sampling drops
      zero-signal groups after paying to generate them. Proposal: make the price a signal and put a
      generator inside the loop. Maintain a small population of problem <em>families</em>
      (templates with parameters, difficulty knobs, and a programmatic answer key). After each
      batch, score every family by measured group variance per rollout spent — its realized
      information per unit of generation cost — and let a bandit allocate the next batch's rollout
      budget across families, while a cheap mutation operator proposes new family variants near the
      ones currently scoring highest. The curriculum then tracks the model's edge automatically
      instead of being re-stocked by hand, and the budget stops being spent on problems whose
      outcome is already known.</p>
      <p>Failure modes, which are not incidental. High group variance is not the same as
      instructive: ambiguous wording, a wrong answer key, and a flaky extractor all produce
      beautifully mixed groups, so the bandit will happily spend its whole budget on broken
      problems unless variance is combined with an independent validity check. A generator co-trained
      against the policy drifts toward whatever the policy currently fails at, which can be a
      narrow syntactic quirk rather than a capability. And because the policy's own behavior sets
      the difficulty, there is a degenerate equilibrium in which failing more attracts more budget —
      a mild version of the model steering its own curriculum. The cheapest falsifying experiment
      needs no generator at all: on a fixed prompt pool, measure per-prompt success rates once,
      then train on only the 0.2–0.8 band and compare against a random subsample at equal rollout
      budget. If band-restricted training does not beat the random subsample, the pricing idea is
      dead before anything is built on it.</p>`),
  );
}
