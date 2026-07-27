/* The objective. One task: predict the next token.
   Spine only — the sticky autoregressive-loop scene lives in scene-loop.js. */

import { chapter, chapterHead, prose, term, mathAside, goDeeper, specTable, claimFig, chRef } from '../../core/components.js';
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
    goDeeper('why guessing the next token is the same problem as compressing the text', `
      <p><strong>First, is one token at a time a limitation?</strong> It sounds like a severe one — surely a writer plans a paragraph before starting it. But no generality is lost in the rewriting. The chance of a whole document is exactly the chance of its first token, times the chance of the second given the first, times the chance of the third given the first two, and so on to the end. That is an identity, true of any text from any source, not an approximation anyone chose. A model that answered &ldquo;what comes next&rdquo; perfectly would be a perfect model of documents. The narrow question is the whole question, asked one piece at a time.</p>
      <p><strong>Second, and stranger: a model that predicts text well <em>is</em> a compression program for that text.</strong> Not an analogy. The training loss is not a stand-in for how well the model compresses — converted into bits, it <em>is</em> the compressed size.</p>
      <p><strong>Here is why.</strong> Suppose you and a friend each own the same copy of the model, and you want to send her a book down a slow line. You do not have to send the words. At every position you both run the model and both see the identical list of candidates with identical probabilities, so all you must send is enough to say which candidate it actually was. Shannon&rsquo;s source-coding theorem fixes that price: an outcome the model gave probability p costs log₂(1/p) bits, and no coding scheme can beat that on average. A token the model was 50% sure of costs one bit. One it gave a 1-in-1000 chance costs about ten. A token it was already certain of costs almost nothing — you send nearly nothing, because she can work it out herself.</p>
      <p>Now add that bill up over a whole corpus. You are adding −log p at every position, which is exactly the quantity ${chRef('probability')} builds as the training loss, in different units. <strong>Pushing the loss down and shrinking the file are the same act.</strong> That is the sense in which &ldquo;language modeling is compression&rdquo; is a theorem and not a slogan — the aside below states it formally, and ${chRef('probability')} sketches the proof.</p>
      <p><strong>Two things it does not claim.</strong> The bill above is for the <em>message</em>, assuming both ends already hold the model; a fair accounting has to count the model too, which is the rule in the Hutter Prize, a long-running competition to compress a fixed slice of Wikipedia into the smallest self-contained program. And it is a separate claim from the looser sense in which the finished weights hold a compressed copy of what they were trained on — that one is ${chRef('base-model')}&rsquo;s subject, and it comes with its own caveats.</p>`),

    mathAside('the objective, precisely', `
      <p>Any distribution over sequences factorizes exactly, by the chain rule of probability, into next-token conditionals:</p>
      <div class="eq">p(x₁,…,x_T) = ∏ₜ p(xₜ | x₁,…,xₜ₋₁)</div>
      <p>The model p<sub>θ</sub> approximates each conditional, and training minimizes the negative log-likelihood — equivalently the cross-entropy, built up from scratch in ${chRef('probability')} — averaged over positions: L(θ) = −Σₜ log p<sub>θ</sub>(xₜ | x&lt;ₜ). Minimizing L is the same as minimizing the KL divergence from the data distribution to the model, and (by the source-coding theorem) the same as minimizing the number of bits needed to encode the corpus.</p>`),
    prose(
      `Our specimen throughout is <strong>${K3.name}</strong>, released by ${K3.vendor} on ${K3.released} — the first open-weight model in the 3-trillion-parameter class. It is an extreme example of an entirely ordinary design, and the design has two halves worth naming now even though neither is built until much later.`,
      `The first half: every token is allowed to look back at the tokens before it and never forward, because the only job is to extend the text, not to fill a gap in the middle of it. A model built that way is called <strong>decoder-only</strong>, and ${chRef('attention')} builds the looking-back mechanism from nothing. The second half: instead of pushing every token through one enormous block of arithmetic, the model keeps hundreds of smaller specialist blocks and sends each token to a handful of them. That arrangement is a <strong>mixture of experts</strong>, and ${chRef('moe')} builds it. Stack those two operations, in that order, several dozen times over, and the stack is a <strong>transformer</strong> — the design ${chRef('residual')} assembles layer by layer.`,
      `Nothing in that outline is unique to K3. The other frontier models of its generation are built to the same plan, Kimi K2 among them — the model whose published blueprint this article borrows wherever K3&rsquo;s own numbers are missing. K3 is a much larger instance of the plan rather than a departure from it. Where Moonshot has not yet disclosed a number, the spec sheet says so.`),
  ];

  // The spec sheet is captioned like a figure, so it claims a number too.
  // Every row carries a forward reference, because on page one the sheet is a
  // size chart to come back to, not something to be parsed.
  const specFig = claimFig('spec');
  const to = (chapterId) => `<span style="color:var(--mut)"> · ${chRef(chapterId, { word: 'ch.' })}</span>`;
  const spec = specTable(`Specimen: ${K3.name}`, `${K3.vendor} · July 2026 · open weights`, [
    ['total parameters', `≈ 2.8 T${to('assembly')}`],
    ['attention', `${K3.attention}${to('attention')}`],
    ['active per token', `≈ 50 B <span style="color:var(--mut)">(3rd-party est.)</span>${to('moe')}`],
    ['context window', `1,000,000 tokens${to('attention-scale')}`],
    ['experts (MoE)', `${K3.experts.routed} routed · ${K3.experts.active} active${to('moe')}`],
    ['weights format', `${K3.weightsFormat}${to('inference')}`],
    ['MoE framework', `${K3.moeFramework}${to('moe')}`],
    ['layers / width', `not yet disclosed${to('assembly')}`],
  ]);

  return chapter(id,
    head,
    scene,
    middle,
    prose(
      `The sheet below is a reference to come back to, not a thing to read now. Almost every line on it names a piece of machinery this book has not built yet, so the names will mean nothing on a first pass — that is expected, and the chapter link at the end of each row is where that line gets taken apart. Read it today as a size chart: an object of this scale, with roughly this much of it in each place.`),
    spec,
    prose(
      `<em>Fig. ${specFig} — where a figure needs undisclosed K3 internals, this article substitutes Kimi K2's published blueprint — ${K3.blueprint.layers} layers, each token carried as a list of ${K3.blueprint.dModel.toLocaleString('en-US')} numbers (its <em>d_model</em>) — and labels it illustrative.</em>`));
}
