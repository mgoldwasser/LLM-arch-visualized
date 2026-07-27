/* Post-training — from document engine to assistant.
   Spine only: prose, terms, the math aside. The three figures live beside
   this file and claim their own numbers, in the order they are called here.

     fig-pipeline.js      key 'pipeline'   — base → SFT → RLHF/RLVR → assistant
     fig-chat-template.js key 'chat'       — the chat template as raw tokens
     fig-provenance.js    key 'provenance' — who wrote the demonstrations
     fig-grpo.js          key 'grpo'       — GRPO on one prompt              */

import { chapter, chapterHead, prose, term, mathAside, chRef, figRef } from '../../core/components.js';
import { pipelineFigure } from './fig-pipeline.js';
import { chatTemplateFigure } from './fig-chat-template.js';
import { provenanceFigure } from './fig-provenance.js';
import { grpoFigure } from './fig-grpo.js';

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'Alignment', title),
    prose(
      `${chRef('base-model', { cap: true })} left us with a document continuator that has read the internet and will not answer a question. The knowledge is in there; the behavior isn't. Post-training is a short, cheap sequence of stages — a sliver of pretraining's compute — that reshapes behavior without re-teaching content.`),
    pipelineFigure(),

    prose(
      `<strong>Stage one — supervised fine-tuning (SFT).</strong> Continue next-token training, but on curated conversations rendered through a <strong>chat template</strong> — special tokens delimiting system, user, and assistant turns (the &ldquo;raw&rdquo; view of every chat you've had). Loss is computed only on the assistant's tokens: the model learns to produce answers, not to imitate users. SFT is imitation learning; it can only make the model sound like its demonstrations.`),
    term('chat template', 'n.', 'e.g. <code>&lt;|im_start|&gt;user … &lt;|im_end|&gt;&lt;|im_start|&gt;assistant …</code> — plain tokens; &ldquo;turns&rdquo; are a formatting convention the model learns, not an API feature'),
    chatTemplateFigure(),

    prose(
      `<strong>Where those conversations come from.</strong> Not from the internet, and not from the model. They are written to order. OpenAI's InstructGPT paper (2022) documents the arrangement plainly: a screened team of around forty contractors was asked both to invent prompts and to write the ideal assistant response to them, working against a labeling document supplied by the company. The paper reproduces excerpts of those instructions, whose high-level demand was that the assistant be helpful, truthful and harmless; the pages beneath that spell out what those words mean where they conflict. Karpathy's 2025 walkthrough of the pipeline describes documents of this kind running to hundreds of pages, studied the way any professional studies a specification. For technical prompts the people hired are educated specialists, which is a large part of why the answers are good.`,
      `<strong>That was 2022, and the practice has moved.</strong> It is now rare for a person to write an assistant reply from scratch. Self-Instruct (Wang et al., 2022) showed that a model could be prompted to generate its own instruction data; Anthropic's Constitutional AI (2022) replaced human harmlessness feedback with model-written critiques against a stated set of principles; Meta's Llama 3 report (2024) describes a fine-tuning mix dominated by the model's own writing — have it produce many candidate answers to a prompt, throw away every one that fails a check, and keep the survivors — together with other text a model wrote rather than a person (<em>synthetic</em> data), with human effort concentrated on prompts, editing and filtering; NVIDIA's Nemotron-4 340B report (2024) puts the synthetic share of its alignment data above 98%. Datasets now run to millions of conversations. What has not changed is the seed and the standard: the pipeline is bootstrapped from human-curated examples, and the labeling document is still where the assistant's character is decided.`),
    term('labeling instructions', 'n.', 'the document a lab writes to define what a good assistant reply is — register, structure, when to refuse, how to resolve a conflict between being helpful and being safe. Unpublished for most deployed systems, and the closest thing the assistant has to a written specification of its character'),
    provenanceFigure(),

    prose(
      `<strong>Which is what you are talking to.</strong> The model underneath remains a document continuator (${chRef('base-model')}); SFT does not install an intelligence on top of it. It fits that continuator to a corpus of demonstrations produced under one specification, so what answers you is a statistical simulation of a labeler following those instructions — an average over everyone who wrote to that document, in the register the document asked for. When a reply comes back neatly organized, restating your question, breaking into three points and closing on a caveat, that is not a personality and it is not caution. It is house style: written down by a company, and learned by imitation. Stated that way it sounds diminishing, and it should not — an artifact with a paper trail is more interesting than a magical one, and considerably more accountable.`,
      `Where your exact question sits inside the fine-tuning data, the answer will closely resemble what some labeler submitted. Where it does not, which is most of the time, the model interpolates: it assembles what it has from pretraining and delivers it in the labeler's voice. ${figRef('posttraining', 'provenance')} puts both cases side by side, and the second is the one to hold onto, because the voice is identical whether or not there is knowledge behind it. Every &ldquo;who is X&rdquo; in a demonstration set is answered confidently, so confidence is what gets learned — including where the model has nothing to be confident about. That is hallucination, and this chapter's closing section, <em>What this costs you</em>, takes the mechanism apart; ${figRef('posttraining', 'hallucination')} runs the demonstration.`),

    prose(
      `<strong>Stage two — RL from human feedback (RLHF).</strong> Imitation caps quality at the demonstrator's level, and many properties (helpfulness, honesty, tone) are easier to judge than to demonstrate. So the method changes shape. Show a person several candidate answers to the same prompt and have them rank the answers against each other, and collect a great many of those rankings. Then fit a second network — a <strong>reward model</strong> — whose only job is to predict which answer a person would have put on top, and to report that prediction as a score. Then improve the LLM by having it write answers, scoring each one with that stand-in judge, and reinforcing whatever it did on the answers that scored well — learning by trying things and keeping what works, which is what <strong>reinforcement learning</strong> means and what ${chRef('rl')} takes apart. One safeguard runs the whole time: every update is held close to the SFT model it started from. Without it the LLM drifts until it is writing whatever the judge happens to rate highest, which is often not language at all — a failure ${chRef('rl')} takes apart in detail.`,
      `<strong>Stage three — RL with verifiable rewards (RLVR).</strong> The engine of the 2025–26 reasoning wave, and the setting for ${chRef('adaptation')}'s punchline. For math, code, and logic, you don't need a learned judge: check the final answer, run the tests — reward is 1 or 0, and it cannot be flattered. The dominant algorithm is <strong>GRPO</strong>. Sample a group of, say, 16 attempts at the same problem, and score each one. Then judge every attempt only against the others in its own group: the ones that beat the group's average get their tokens reinforced, and the ones below it get pushed down. That comparison is the whole learning signal. Earlier methods had to train a second network alongside the first to guess, before an attempt was made, how well it was likely to score — a <strong>value network</strong> — and then measure each result against that guess. The group's own average does the same job for nothing. Long chains of thought emerge because thinking longer wins more reward — K3's &ldquo;always-on thinking&rdquo; is this, productized.`),
    term('GRPO', 'n.', `Group Relative Policy Optimization. Score every attempt in a group, subtract the group&rsquo;s average score, then divide by how widely the group&rsquo;s scores were spread. What is left is how far above or below its own peers an attempt landed &mdash; its <em>advantage</em>. Reinforce every token of the attempts with a positive advantage; discourage the rest`),
    grpoFigure(),

    mathAside('the RLHF objective, Bradley–Terry, GRPO', `
      <p>The reward model is trained on preference pairs via the Bradley–Terry likelihood: p(y⁺ ≻ y⁻) = σ(r(x,y⁺) − r(x,y⁻)). The policy then maximizes</p>
      <div class="eq">E_y∼π [ r(x, y) ] − β · KL( π ‖ π_ref )</div>
      <p>with π_ref the frozen SFT model. PPO optimizes this with a clipped policy-gradient step; GRPO replaces PPO's learned value baseline with the group mean — for group rewards r₁…r_G, advantage Âᵢ = (rᵢ − r̄)/σ_r, applied to every token of attempt i. Cheaper (no value network), and notably robust in the tiny-update regime — a property ${chRef('adaptation')} turns into a headline.</p>`));
}
