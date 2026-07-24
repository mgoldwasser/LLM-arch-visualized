/* Post-training — from document engine to assistant.
   Spine only: prose, terms, the math aside. The three figures live beside
   this file and claim their own numbers, in the order they are called here.

     fig-pipeline.js      key 'pipeline' — base → SFT → RLHF/RLVR → assistant
     fig-chat-template.js key 'chat'     — the chat template as raw tokens
     fig-grpo.js          key 'grpo'     — GRPO on one prompt                */

import { chapter, chapterHead, prose, term, mathAside, chRef } from '../../core/components.js';
import { pipelineFigure } from './fig-pipeline.js';
import { chatTemplateFigure } from './fig-chat-template.js';
import { grpoFigure } from './fig-grpo.js';

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'Alignment', title),
    prose(
      `What pretraining produces — the <strong>base model</strong> — is a document continuator, not an assistant. Prompt it with &ldquo;What is the capital of France?&rdquo; and a perfectly calibrated continuation might be <em>another quiz question</em>, because that's how such text often continues on the web. The knowledge is in there; the behavior isn't. Post-training is a short, cheap sequence of stages (a sliver of pretraining's compute) that reshapes behavior without re-teaching content.`),
    pipelineFigure(),

    prose(
      `<strong>Stage one — supervised fine-tuning (SFT).</strong> Continue next-token training, but on curated conversations rendered through a <strong>chat template</strong> — special tokens delimiting system, user, and assistant turns (the &ldquo;raw&rdquo; view of every chat you've had). Loss is computed only on the assistant's tokens: the model learns to produce answers, not to imitate users. SFT is imitation learning; it can only make the model sound like its demonstrations.`),
    term('chat template', 'n.', 'e.g. <code>&lt;|im_start|&gt;user … &lt;|im_end|&gt;&lt;|im_start|&gt;assistant …</code> — plain tokens; &ldquo;turns&rdquo; are a formatting convention the model learns, not an API feature'),
    chatTemplateFigure(),

    prose(
      `<strong>Stage two — RL from human feedback (RLHF).</strong> Imitation caps quality at the demonstrator's level, and many properties (helpfulness, honesty, tone) are easier to judge than to demonstrate. So: collect human rankings between candidate answers, fit a <strong>reward model</strong> that predicts those judgments, then optimize the LLM by reinforcement learning to score highly — while a KL-divergence penalty tethers it to its SFT starting point so it can't wander into reward-hacking gibberish.`,
      `<strong>Stage three — RL with verifiable rewards (RLVR).</strong> The engine of the 2025–26 reasoning wave, and the setting for ${chRef('adaptation')}'s punchline. For math, code, and logic, you don't need a learned judge: check the final answer, run the tests — reward is 1 or 0, and it cannot be flattered. The dominant algorithm is <strong>GRPO</strong>: sample a group of, say, 16 attempts per problem; score each; use each attempt's standing relative to its own group as the learning signal (no separate value network needed). Long chains of thought emerge because thinking longer wins more reward — K3's &ldquo;always-on thinking&rdquo; is this, productized.`),
    term('GRPO', 'n.', `Group Relative Policy Optimization: advantage of attempt i = (rᵢ − mean(r)) / std(r) within its prompt&rsquo;s group; reinforce tokens of above-average attempts`),
    grpoFigure(),

    mathAside('the RLHF objective, Bradley–Terry, GRPO', `
      <p>The reward model is trained on preference pairs via the Bradley–Terry likelihood: p(y⁺ ≻ y⁻) = σ(r(x,y⁺) − r(x,y⁻)). The policy then maximizes</p>
      <div class="eq">E_y∼π [ r(x, y) ] − β · KL( π ‖ π_ref )</div>
      <p>with π_ref the frozen SFT model. PPO optimizes this with a clipped policy-gradient step; GRPO replaces PPO's learned value baseline with the group mean — for group rewards r₁…r_G, advantage Âᵢ = (rᵢ − r̄)/σ_r, applied to every token of attempt i. Cheaper (no value network), and notably robust in the tiny-update regime — a property ${chRef('adaptation')} turns into a headline.</p>`));
}
