/* Why sequences were hard. The last foundation chapter: the problem statement
   that attention is an answer to. Spine only — the scene, the two scroll
   figures, and the cost widget live in their own files. */

import { chapter, chapterHead, prose, term, mathAside, takeaway, claimFig, chRef, figRef } from '../../core/components.js';
import { K3 } from '../../../data/k3.js';
import { subhead, eqLine, sci, sciFromLog10, CORPUS, CORPUS_LABEL, GAMMA } from './shared.js';
import { explosionFigure } from './fig-explosion.js';
import { threeWaysScene } from './scene-three-ways.js';
import { vanishingFigure } from './fig-vanishing.js';
import { parallelWidget } from './widget-parallel.js';

const V = K3.vocab;
const VSTR = V.toLocaleString('en-US');
const TRIG = V ** 3;
const CTX_DIGITS = Math.round(K3.contextWindow * Math.log10(V));

export function render({ id, num, title }) {
  const head = [
    chapterHead(num, 'The problem attention solved', title),
    prose(
      `Everything so far has been machinery without an architecture. You have the objective (${chRef('objective')}), vectors and dot products (${chRef('vectors')}), layers of neurons (${chRef('networks')}), gradients (${chRef('learning')}), and a way to turn scores into calibrated probabilities (${chRef('probability')}). What is still missing is the shape of the thing: how a fixed pile of weights consumes a history that has no fixed length.`,
      `That mismatch is the whole story of this chapter. Predicting token <em>t</em> means conditioning on tokens 1 through <em>t</em>−1 — a sequence that is three tokens long at the start of a sentence and a million tokens long at the far end of ${K3.name}'s context. But a weight matrix has a shape, decided before training and unchanged afterwards. A matrix that takes 3 inputs cannot take 1,000,000, and a model that allocates separate weights for every possible history has no weights left over to learn anything general.`,
      `Three answers have been given, in order. Cut the history down to a fixed window and count. Compress the history into a fixed-size state and carry it forward. Or look at the entire history at once, in parallel. This chapter is the first two — how far they go, and precisely where each one breaks.`),
  ];

  const ngrams = [
    subhead('Answer one: cut the history down and count'),
    prose(
      `The oldest working language model makes an assumption of stunning crudeness and stunning usefulness: pretend the next token depends only on the last few. Under this <strong>Markov assumption</strong>, p(xₜ | x₁…xₜ₋₁) is approximated by p(xₜ | xₜ₋ₙ₊₁…xₜ₋₁), and that quantity can be estimated without any learning at all — count how often that window appeared in a corpus, count how often each token followed it, divide.`,
      `It works better than it has any right to. A trigram model trained on a few gigabytes of text produces fluent-sounding local English, and until roughly 2010 essentially every deployed speech recognizer and machine translation system had one at its core. The failure is not in what it can do; it is in what it can never do, and the reason is arithmetic.`),
    term('Markov assumption', 'n.', 'the claim that the future is conditionally independent of the distant past given the recent past — here, that only the last <em>n</em>−1 tokens matter'),
    term('n-gram model', 'n.', 'a table of conditional next-token probabilities, one row per distinct (<em>n</em>−1)-token window, estimated by counting occurrences in a corpus'),
    mathAside('the Markov approximation, and the size of the table', `
      <p>The exact factorization from ${chRef('objective')} is a product of conditionals, each one depending on the entire prefix:</p>
      <div class="eq">p(x₁,…,x_T) = ∏ₜ p(xₜ | x₁,…,xₜ₋₁)</div>
      <p>The n-gram model truncates every conditional to a fixed window and estimates it by maximum likelihood, which for a multinomial is exactly the count ratio:</p>
      <div class="eq">p(xₜ | x&lt;ₜ) ≈ p(xₜ | xₜ₋ₙ₊₁,…,xₜ₋₁) = count(xₜ₋ₙ₊₁…xₜ) / count(xₜ₋ₙ₊₁…xₜ₋₁)</div>
      <p>Now count the storage. There are V possible tokens in each of the n slots, so the table has Vⁿ cells — and as a set of conditional distributions it carries Vⁿ⁻¹(V−1) free parameters, one fewer per row because each row must sum to 1. With ${K3.name}'s vocabulary of V = ${VSTR}, a trigram table needs ${sci(TRIG)} cells. Set that against the evidence available to fill it: ${CORPUS_LABEL} supplies ${sci(CORPUS)} training positions and therefore at most that many trigram observations — fewer than one observation for every ${Math.round(TRIG / CORPUS).toLocaleString('en-US')} cells. Extending the window to ${K3.name}'s full context of ${K3.contextWindow.toLocaleString('en-US')} tokens would require a table whose size is a number ${CTX_DIGITS.toLocaleString('en-US')} digits long.</p>`),
    explosionFigure(),
    prose(
      `Read ${figRef('sequences', 'explosion')} as a statement about evidence rather than storage. Even if the table fit in memory, the corpus could not fill it: past the crossing point, the number of cells exceeds the number of tokens ever observed, so the overwhelming majority of entries hold a count of exactly zero. The model then assigns probability zero to a perfectly ordinary sentence, and cross-entropy (${chRef('probability')}) punishes a confident zero with infinite loss. Every practical n-gram system is wrapped in smoothing and backoff schemes whose entire job is to invent plausible mass for things never seen — patching the arithmetic without supplying the missing knowledge.`,
      `The deepest problem is subtler than sparsity, and worth dwelling on, because it is the one embeddings were invented to fix. Suppose the corpus contains &ldquo;the cat sat&rdquo; ten thousand times and &ldquo;the wombat sat&rdquo; never. A human generalizes instantly: a wombat is an animal, animals sit, the phrase is fine. The count table cannot make that inference even in principle, because to it &ldquo;cat&rdquo; and &ldquo;wombat&rdquo; are two distinct integers with no relationship whatsoever — two different cells, no more similar than &ldquo;cat&rdquo; and &ldquo;semicolon&rdquo;. Every window is an atomic symbol, statistical strength is never shared, and the model learns each phrase separately or not at all.`,
      `This is exactly why ${chRef('tokens')} spends its second half on embeddings. Representing a token as a dense vector rather than an index means similar tokens sit near each other, a function that fires for one fires nearly as hard for the other, and evidence gathered about one becomes evidence about the other. Generalization is not a bonus feature of learned representations — it is the reason they exist.`),
  ];

  const rnn = [
    subhead('Answer two: carry a state'),
    prose(
      `The recurrent neural network takes the opposite approach: instead of shortening the history, compress it. Keep one fixed-size vector — the <strong>hidden state</strong> — that is supposed to summarize everything read so far. At each position, combine the state with the current token's embedding and produce the next state:`),
    eqLine('hₜ = σ(W_h hₜ₋₁ + W_x xₜ)      then      p(xₜ₊₁ | x≤ₜ) = softmax(W_o hₜ)'),
    prose(
      `Two matrices, applied at every position, whatever the length. The shape mismatch that opened this chapter is gone: W_h and W_x do not know or care whether they are on step 3 or step 30,000, so a single set of weights handles sequences of any length, and every position's training signal updates the same parameters. And because h is a learned dense vector built out of learned dense embeddings, the wombat problem dissolves — a state that has just absorbed &ldquo;cat&rdquo; and one that has just absorbed &ldquo;wombat&rdquo; land in nearby regions, so whatever the network does next it does for both.`,
      `In principle the state can hold anything: the subject of the sentence, whether a quotation is open, the fact that this is a recipe. In practice, getting it to hold anything for long is where the trouble starts. Scroll through the same six-token sentence handled three ways — counted, threaded, then differentiated — followed by a preview of the thing that replaced all three.`),
    term('hidden state', 'n.', 'a fixed-size vector that a recurrent model updates as it reads, intended to summarize the entire prefix in a form the next step can use'),
    term('recurrence', 'n.', 'defining a value at step <em>t</em> in terms of the same function applied at step <em>t</em>−1 — one set of weights, unrolled over the sequence'),
  ];

  const sceneNum = claimFig('threeways');
  const scene = threeWaysScene();
  const sceneCap = prose(
    `<em>Fig. ${sceneNum} — the same sentence counted, threaded, differentiated, and finally compared all-pairs. Steps 3 and 4 are the two halves of the rest of this chapter.</em>`);

  const gradients = [
    subhead('Failure one: the gradient that never arrives'),
    prose(
      `Training an RNN means unrolling it — writing out the T copies of the same computation as one long feed-forward graph — and running backpropagation through it, which is why the procedure is called backpropagation through time. Nothing new is required; it is the chain rule of ${chRef('learning')}, applied along the chain.`,
      `That is precisely the problem. To learn that a verb at position 200 must agree with a subject at position 40, the gradient has to travel 160 steps backwards, and at every step it is multiplied by the same Jacobian. Products of matrices with norm slightly below 1 shrink geometrically; products with norm slightly above 1 grow geometrically. There is no third option, and the crossover is a knife edge that no learned matrix balances on.`),
    term('vanishing gradient', 'n.', 'the geometric decay of the training signal with distance, when backpropagation multiplies it by many Jacobians whose norms are below 1 — long-range dependencies become unlearnable, not merely hard'),
    mathAside('the product of Jacobians', `
      <p>Differentiate the recurrence once. With σ applied elementwise and D_t = diag(σ′(·)) the diagonal matrix of its derivatives at step t:</p>
      <div class="eq">∂hₜ / ∂hₜ₋₁ = D_t W_h</div>
      <p>The chain rule composes those single-step Jacobians into a product over every step in between:</p>
      <div class="eq">∂h_T / ∂h_t = ∏ₖ₌ₜ₊₁ᵀ D_k W_h ,   so   ‖∂h_T/∂h_t‖ ≤ (‖W_h‖ · maxₖ‖D_k‖)^(T−t) = γ^(T−t)</div>
      <p>Write γ for that per-step factor. The gradient reaching t decays or grows as γ raised to the distance. For tanh, σ′ ≤ 1; for the logistic sigmoid, σ′ ≤ 1/4 — so unless ‖W_h‖ is pushed large, γ &lt; 1 and the signal vanishes; push it large and γ &gt; 1 and the signal explodes. Gradient clipping tames the explosion cheaply, because a huge gradient is easy to detect. Nothing detects a gradient that arrived at ${sci(GAMMA ** 100)} of its true size — that is γ = ${GAMMA} carried over a hundred steps — it simply looks like zero, and the dependency is never learned.</p>`),
    vanishingFigure(),
    prose(
      `The engineering fix, and it was a real one, was to change what happens between steps. The LSTM (1997) and the GRU (2014) add a cell state that is carried forward by <em>addition</em> rather than by a matrix multiply, with learned gates deciding what to write and what to erase. Along that additive path the per-step Jacobian is close to the identity, so γ sits near 1 by construction and the signal survives far longer. If that sounds familiar, it should: it is the same structural trick as the residual stream of ${chRef('residual')} — give the gradient a highway that skips the transformation instead of passing through it.`,
      `Gates bought perhaps an order of magnitude in usable range, and gated RNNs held the state of the art in translation and speech until 2017. They did not remove the wall. They also did nothing at all about the second problem, which turned out to be the fatal one.`),
  ];

  const wall = [
    subhead('Failure two: the parallelism wall'),
    prose(
      `Look at the recurrence again and notice what it forbids. hₜ is a function of hₜ₋₁. You cannot compute step 500 until step 499 exists, and step 499 waits on 498. A sequence of length T is a dependency chain of length T, and a chain has no shortcuts: the wall-clock time to process it is T sequential steps <em>no matter how much hardware you own</em>. Adding a thousand GPUs to a recurrence buys you a thousand sequences processed at once; it does not make one sequence finish any sooner.`,
      `Set that against what the hardware actually is. A modern accelerator is a machine for performing enormous matrix multiplications, tens of thousands of arithmetic units firing simultaneously, and it is starved by any workload that hands it one small dependent operation at a time. Through the 2010s the compute available per dollar grew relentlessly, and the recurrent architecture had no way to spend it. Training time scaled with sequence length rather than with the machine.`),
    term('parallelism', 'n.', 'the number of operations a computation permits to be executed simultaneously; a computation\'s wall-clock floor is the length of its longest dependency chain, not its total work'),
    prose(
      `The trade this chapter is building towards is easiest to feel with numbers in front of you. Drag T and drag the hardware.`),
  ];

  const widgetNum = claimFig('cost');
  const costWidget = parallelWidget();
  const widgetCap = prose(
    `<em>Fig. ${widgetNum} — a recurrence's clock is its chain; attention's clock is its work divided by the machine. Break-even sits exactly at one compute unit per token, which is why the same trade looks brilliant for a paragraph and ruinous for a million-token context.</em>`);

  const close = [
    prose(
      `So here is the question the field arrived at by 2017. Recurrence solved variable length and it solved generalization, and it paid for both with a sequential chain that neither gradients nor GPUs can traverse. What if there were no chain? What if every position could consult every other position <em>simultaneously</em> — not by passing a state hand to hand, but by comparing all pairs at once, as a single large matrix multiplication?`,
      `That is attention, and ${chRef('attention')} builds it in five stages. Note what it costs: the sequential dependency of length T becomes a parallel computation of size T², and the longest dependency chain inside a layer drops to one step. When T is a few thousand and you own a machine full of idle arithmetic units, that is one of the great bargains in computing. When T is ${K3.contextWindow.toLocaleString('en-US')}, a square of side T is ${sciFromLog10(2 * Math.log10(K3.contextWindow))} pairs, and the bargain looks considerably worse.`,
      `Which is why the pendulum has swung back. ${chRef('attention-scale', { cap: true, word: 'Chapter' })} covers linear attention and the return of a constant-size recurrent state at the frontier — including inside ${K3.name}, whose ${K3.attention} keeps a compressed running state for most of its layers and reserves full all-pairs attention for a few. The recurrent idea was not wrong. It was early, and it was missing the additive path and the parallel training procedure that the transformer supplied.`),
    takeaway(
      `A language model must condition on a history of unbounded length using a finite, fixed-shape set of weights. Counting fixed windows fails on combinatorics and on the atomicity of symbols; a recurrent state fixes both, then fails on the geometry of repeated multiplication and on the geometry of the machine. Attention is the answer to the second failure specifically — parallel where recurrence was sequential — and the chapters that follow build the machine around it: ${chRef('tokens')} turns text into vectors, ${chRef('residual')} gives those vectors a highway to travel along, and ${chRef('attention')} lets them read each other.`),
  ];

  return chapter(id,
    head,
    ngrams,
    rnn,
    scene,
    sceneCap,
    gradients,
    wall,
    costWidget,
    widgetCap,
    close);
}
