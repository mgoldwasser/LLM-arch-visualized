/* The objective. One task: predict the next token.
   Spine only — the sticky autoregressive-loop scene lives in scene-loop.js. */

import { chapter, chapterHead, prose, term, mathAside, specTable, claimFig, chRef } from '../../core/components.js';
import { K3 } from '../../../data/k3.js';
import { sceneLoop } from './scene-loop.js';

export function render({ id, num, title }) {
  const head = [
    chapterHead(num, 'The objective', title),
    prose(
      `Strip away the chat interface and an LLM is a single deterministic function. It takes a sequence of <strong>tokens</strong> — integer IDs standing for chunks of text, defined properly in ${chRef('tokens')} — and returns one probability distribution over its entire vocabulary: given everything so far, how likely is each possible next token? That is the whole interface. There is no lookup database, no retrieval step, no grammar engine inside. One function, applied over and over.`,
      `Generation is a loop around that function: score all candidate next tokens, pick one (how you pick is a genuine design decision — ${chRef('inference')}), append it to the input, and run again. Because each output token is fed back as input, the model is called <strong>autoregressive</strong>. Chat, code completion, chain-of-thought reasoning, tool use — every behavior you have seen from an LLM is this loop, executed at a few dozen tokens per second.`),
    term('autoregressive', 'adj.', 'predicting element <em>t</em> from elements 1…<em>t</em>−1 of the same sequence, then consuming its own prediction'),
  ];

  // The scene's caption lives in the prose paragraph that follows it.
  const loopFig = claimFig('loop');
  const scene = sceneLoop();

  const middle = [
    prose(
      `<em>Fig. ${loopFig} — the entire external interface of an LLM: token IDs in, one distribution out, sampled and fed back.</em>`,
      `Why does such a narrow objective produce such broad ability? Because guessing the next token <em>well</em> — across trillions of tokens of things people actually wrote — is not a narrow job at all. To do better than picking a common word after <code>"the integral of x² is"</code>, you need calculus. To guess the next move in a chess transcript, you need to understand chess. Every pattern the model fails to learn is a pattern it keeps getting wrong, and getting it wrong is the one thing training punishes. So grammar, facts, how code behaves, multi-step reasoning — nobody added those as separate parts. They are what you end up with when the only way to guess better is to understand more.`,
      `The objective also has a decisive practical property: it is <strong>self-supervised</strong>. Every position in every document is a labeled training example — the label is simply the token that actually came next. No annotation pipeline, no human raters. That is what lets training corpora reach tens of trillions of tokens, and it is why the field's scaling story (${chRef('pretraining')}) was possible at all.`),
    term('self-supervised', 'adj.', 'the training signal is derived from the data itself rather than from external labels'),
    mathAside('the objective, precisely', `
      <p>Any distribution over sequences factorizes exactly, by the chain rule of probability, into next-token conditionals:</p>
      <div class="eq">p(x₁,…,x_T) = ∏ₜ p(xₜ | x₁,…,xₜ₋₁)</div>
      <p>The model p<sub>θ</sub> approximates each conditional, and training minimizes the negative log-likelihood — equivalently the cross-entropy, built up from scratch in ${chRef('probability')} — averaged over positions: L(θ) = −Σₜ log p<sub>θ</sub>(xₜ | x&lt;ₜ). Minimizing L is the same as minimizing the KL divergence from the data distribution to the model, and (by the source-coding theorem) the same as minimizing the number of bits needed to encode the corpus. “Language modeling is compression” is a theorem, not a slogan.</p>`),
    prose(
      `Our specimen throughout is <strong>${K3.name}</strong>, released by ${K3.vendor} on ${K3.released} — the first open-weight model in the 3-trillion-parameter class. It is an extreme but representative member of the current frontier family: a decoder-only transformer with mixture-of-experts feed-forward layers, in the same architectural lineage as DeepSeek-V3 and Kimi K2. Where Moonshot has not yet disclosed a number, the spec sheet says so.`),
  ];

  // The spec sheet is captioned like a figure, so it claims a number too.
  const specFig = claimFig('spec');
  const spec = specTable(`Specimen: ${K3.name}`, `${K3.vendor} · July 2026 · open weights`, [
    ['total parameters', '≈ 2.8 T'],
    ['attention', K3.attention],
    ['active per token', '≈ 50 B <span style="color:var(--mut)">(3rd-party est.)</span>'],
    ['context window', '1,000,000 tokens'],
    ['experts (MoE)', `${K3.experts.routed} routed · ${K3.experts.active} active`],
    ['weights format', K3.weightsFormat],
    ['MoE framework', K3.moeFramework],
    ['layers / d_model', 'not yet disclosed'],
  ]);

  return chapter(id,
    head,
    scene,
    middle,
    spec,
    prose(
      `<em>Fig. ${specFig} — where a figure needs undisclosed K3 internals, this article substitutes Kimi K2's published blueprint (${K3.blueprint.layers} layers, d_model ${K3.blueprint.dModel}) and labels it illustrative.</em>`));
}
