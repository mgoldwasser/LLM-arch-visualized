/* Probability, softmax, and surprise — the loss the whole book runs on.
   Logits become a distribution; the distribution meets the truth; what is
   left is one number, −log p(correct token). Spine only: the sticky scene,
   the surprise curve and the loss widget live in their own files. */

import { chapter, chapterHead, prose, term, mathAside, goDeeper, takeaway, claimFig, chRef, figRef } from '../../core/components.js';
import { K3 } from '../../../data/k3.js';
import { softmaxScene, SCENE, CONTEXT } from './scene-softmax.js';
import { surpriseFigure } from './fig-surprise.js';
import { lossWidget } from './widget-loss.js';

const V = K3.vocab;
const VS = V.toLocaleString('en-US');
const LN_V = Math.log(V);                       // surprise of a uniform guess, nats
const LOG2_V = LN_V / Math.LN2;                 // …and in bits
const PPL2 = Math.exp(2);                       // what a loss of 2.0 nats means

export function render({ id, num, title }) {
  /* Figure numbers are claimed in the order the figures appear below. */
  claimFig('softmax');
  const scene = softmaxScene();
  const surprise = surpriseFigure();
  claimFig('loss');
  const lossW = lossWidget();

  return chapter(id,
    chapterHead(num, 'The objective, precisely', title),

    prose(
      `${chRef('learning', { cap: true })} trained a network by squaring the gap between its output and a target number. That works when the target <em>is</em> a number. Here the target is a token — one of the ${VS} entries of the vocabulary — and there is no meaningful squared distance between <code>table</code> and <code>chair</code>. Token identities are labels, not quantities; any arithmetic on their IDs is nonsense.`,
      `So the network is never asked for a token. It is asked for a <strong>distribution</strong> over the finite set of possible tokens: a list of V = ${VS} numbers p₁ … p_V with exactly two properties — every pᵢ ≥ 0, and Σᵢ pᵢ = 1. That is the whole definition. pᵢ is the model's credence that entry i comes next, and the two constraints are what make it possible to score the model afterwards against what actually happened.`,
      `A network's final layer does not naturally produce such a list. It produces one real number per vocabulary entry: unbounded above and below, frequently negative, summing to nothing in particular. These raw scores are the <strong>logits</strong>. Everything in this chapter is the machinery for turning ${VS} arbitrary reals into a distribution, and then for measuring what that distribution cost.`),

    term('logits', 'n.', `the raw real-valued scores the last layer emits — one per vocabulary entry, unnormalized and of arbitrary scale; ${VS} of them at every position`),

    scene,
    prose(
      `<em>${figRef('probability', 'softmax')} — logits to a distribution to a loss, with six candidates standing in for ${VS}. Every number is computed live from the six logits shown.</em>`,
      `The map you just watched is <strong>softmax</strong>: pᵢ = e^(zᵢ) / Σⱼ e^(zⱼ). Read it as two independent jobs. The numerator e^(zᵢ) forces positivity — the exponential is strictly positive for every real input, so the first constraint is satisfied by construction rather than by clipping. It also converts <em>differences</em> into <em>ratios</em>: pᵢ/pⱼ = e^(zᵢ−zⱼ), so a logit gap of 1 always means a factor of e ≈ 2.718 in relative weight, no matter where on the number line the two logits sit. The denominator then divides by the total, which is the cheapest possible way to satisfy the second constraint. Normalization changes the units, not the shape.`,
      `Two properties are worth having explicitly, because implementations and intuitions both depend on them. First, softmax is <strong>shift-invariant</strong>: adding the same constant to every logit leaves the output identical, which is why the absolute value of a logit means nothing and only gaps carry information — and why every real implementation subtracts the maximum logit before exponentiating. Second, softmax <strong>preserves order</strong>: zᵢ &gt; zⱼ implies pᵢ &gt; pⱼ, always. That is the whole of softmax. It rewrites scores as probabilities without disturbing which score beat which, and it does so smoothly — nudge one logit a little and every probability moves a little, never in a jump. It adds no information and makes no decision. The same function, applied to attention scores instead of vocabulary scores, is what makes attention a weighted average — ${chRef('attention')}.`),

    term('softmax', 'n.', 'turns a list of raw scores into probabilities that are all positive and add to one, pᵢ = e^(zᵢ)/Σⱼ e^(zⱼ); positive by construction, normalized by division, and order-preserving — a higher score always comes out as a higher probability'),

    mathAside('what softmax ignores, and what it does not', `
      <p>Shift-invariance, in one line. For any constant c:</p>
      <div class="eq">softmax(z + c·1)ᵢ = e^(zᵢ+c) / Σⱼ e^(zⱼ+c)
                  = (e^c · e^(zᵢ)) / (e^c · Σⱼ e^(zⱼ))
                  = softmax(z)ᵢ</div>
      <p>The e^c cancels. This is not a curiosity: logits routinely reach magnitudes where e^(zᵢ) overflows a 32-bit float (e^89 already does), so every implementation chooses c = −maxⱼ zⱼ. Then the largest exponent is exactly 0, every term lies in (0, 1], overflow is impossible, and by the identity above the answer is unchanged. Look at <code>softmax()</code> in <code>core/mathtools.js</code>: that subtraction is the first thing it does.</p>
      <p>Order preservation is equally quick. exp is strictly increasing and the denominator is one positive constant shared by every entry, so zᵢ &gt; zⱼ ⟺ e^(zᵢ) &gt; e^(zⱼ) ⟺ pᵢ &gt; pⱼ. The ranking of the logits is exactly the ranking of the probabilities.</p>
      <p><strong>Temperature</strong> is the one-parameter family pᵢ = e^(zᵢ/T) / Σⱼ e^(zⱼ/T). Since T &gt; 0, dividing by it is also monotone, so temperature cannot reorder anything either. As T → 0 the ratio between the top two entries, e^((z₁−z₂)/T), diverges, and p collapses onto a one-hot vector at the argmax. At T = 1 you have the distribution the model actually learned. As T grows, every exponent → 0 and p flattens toward the uniform distribution, 1/${VS} everywhere. Training always uses T = 1; temperature is a serving-time dial, and the sampling policies built on it belong to ${chRef('inference')}.</p>`),

    prose(
      `Now the other half of the chapter. We have a distribution; we need a number that says how good it was, given what actually came next. Start with a single outcome and ask what a sensible measure of <strong>surprise</strong> would have to satisfy. An event you were certain of should surprise you not at all: S(1) = 0. A rarer event should surprise you more: S should decrease as p increases. And surprise should be <strong>additive</strong> over independent events: two unrelated observations should carry the information of one plus the information of the other. Since independent events have probability p·q, that requirement reads S(p·q) = S(p) + S(q) — any other choice would make information depend on whether you counted it in one batch or two.`,
      `Those three requirements do not merely permit −log p. They force it. Up to the choice of a positive constant — which is nothing but a choice of units — S(p) = −log p is the <em>unique</em> function with those properties. Base e gives <strong>nats</strong>, base 2 gives <strong>bits</strong>, and the conversion is a fixed factor: 1 nat = 1/ln 2 ≈ ${(1 / Math.LN2).toFixed(4)} bits. Machine learning reports nats because e is the natural base for differentiation; information theory reports bits because they count yes/no questions.`),

    goDeeper('why a logarithm, and nothing else', `
      <p><strong>The question is not what a logarithm does. It is why a measure of surprise has to be one at all</strong> — why 1&nbsp;−&nbsp;p, or 1/p, or any other curve that rises as p falls, will not do the job.</p>
      <p>The answer is the third requirement above: surprise has to <strong>add up</strong>. Learn two unrelated facts and the information you gained ought to be the information in the first plus the information in the second. It cannot possibly matter whether you were told them together or a week apart.</p>
      <p><strong>But probabilities do not add. They multiply.</strong> Flip a fair coin and heads has probability ½. Flip it again and two heads has probability ¼, because ½&nbsp;×&nbsp;½&nbsp;=&nbsp;¼. So what we need is a function that takes multiplication on the way in and hands back addition on the way out. That is not a wish list, it is the definition of a logarithm. Turning products into sums is the one thing logarithms are for, and no other family of curves does it.</p>
      <p><strong>Check it on the coin.</strong> Count in halvings — that is base 2, and the unit is the <strong>bit</strong>. One head costs 1 bit of surprise, because the probability has been halved once. Two heads costs 2 bits, and ¼ is indeed two halvings down from 1. Something that happens once in a thousand times costs about 10 bits, because you have to halve roughly ten times to get from 1 down to 1/1000. Read that way, surprise is simply <em>the number of halvings between certainty and what actually happened</em> — and a count of anything obviously adds.</p>
      <p><strong>What is left free is only a choice of units.</strong> Counting in halvings gives bits; counting in factors of e, as this book does, gives nats; you could count in thirds and get a unit nobody has bothered to name. That is the same freedom as measuring a room in feet or in metres — the walls do not move, only the numbers on the tape. Nothing else is negotiable: once you have insisted on additivity, the shape of the curve is settled and only the ruler markings are yours.</p>
      <p><strong>One honest caveat.</strong> Additivity by itself is not quite the whole proof. There are monstrous functions that add correctly and yet jump about wildly everywhere — mathematical pathologies, not measures of anything. Ruling them out takes the second requirement, that surprise never doubles back: a rarer event is always at least as surprising as a commoner one. With that in hand the logarithm is the last function standing, and the aside below runs that argument in symbols.</p>`),

    mathAside('the uniqueness proof, via Cauchy’s functional equation', `
      <p>Let S: (0, 1] → [0, ∞) be monotone decreasing with S(1) = 0 and S(pq) = S(p) + S(q) for all p, q. Substitute p = e^(−x), q = e^(−y) with x, y ≥ 0, and define f(x) = S(e^(−x)). The multiplicative condition becomes additive:</p>
      <div class="eq">f(x + y) = f(x) + f(y),   f monotone,   f(0) = 0</div>
      <p>This is Cauchy's functional equation. Its only monotone solutions are the linear ones, f(x) = kx: additivity forces f(nx) = n·f(x) for integer n, hence f(x) = x·f(1) on the rationals, and monotonicity extends that to all reals (a non-linear solution would have to be dense in the plane, which no monotone function is). Undo the substitution with x = −log p:</p>
      <div class="eq">S(p) = f(−log p) = −k log p,   k &gt; 0</div>
      <p>k only sets the units: k = 1 with a natural log gives nats, k = 1/ln 2 gives bits. There is no other candidate, in any base, of any shape.</p>`),

    surprise,

    prose(
      `Surprise is defined per outcome. The natural summary of a whole distribution is its <em>expected</em> surprise — how surprised you should expect to be, on average, by a draw from it. That is the <strong>entropy</strong>:`,
      `H(p) = −Σᵢ pᵢ log pᵢ. Read the sum aloud and it is exactly the average just described: take each outcome's surprise, −log pᵢ, weight it by how likely that outcome is, pᵢ, and add the results up. A one-hot distribution has H = 0: you already know what will happen, so nothing can surprise you. The uniform distribution over n outcomes has the maximum possible entropy, log n — over the full ${VS}-token vocabulary that is ln ${VS} ≈ ${LN_V.toFixed(2)} nats, or ${LOG2_V.toFixed(2)} bits — which is precisely the number of yes/no questions a binary search would need to pin down one entry out of ${VS}. Entropy is a property of the model's own beliefs; it needs no ground truth, and you can watch it move in the widget below as you sharpen or flatten the logits.`),

    term('entropy', 'n.', 'the expected surprise of a distribution, H(p) = −Σ pᵢ log pᵢ; zero for a certainty, maximal (log n) for the uniform distribution over n outcomes'),

    prose(
      `The training loss is one step further. Encode the token that actually came next as a one-hot vector y over the vocabulary — 1 at the true entry, 0 everywhere else — and score the model by the <strong>cross-entropy</strong> between truth and prediction:`,
      `L = −Σᵢ yᵢ log pᵢ. This looks like a sum over ${VS} terms, and formally it is. But y is zero at every entry except one, so ${(V - 1).toLocaleString('en-US')} of those terms are a number multiplied by zero. The sum collapses, exactly and with nothing lost, to a single term:`,
      `<strong>L = −log p(the token that actually came next)</strong>. That is the loss of every language model in this book — the surprise the model expressed at reality. It is what ${chRef('learning')}'s gradients descend, averaged over every position in every document in the corpus. And its shape is the curve above: the penalty for assigning 50% to the right token is 0.69 nats, for 10% it is 2.30, for 1% it is 4.61, and as p → 0 it grows without bound. There is no upper limit on the cost of confident wrongness, and that asymmetry is the mechanism behind calibration: a model that hedges 60/40 when it is right 60% of the time scores better, in the long run, than one that says 99% and is occasionally wrong.`),

    term('cross-entropy', 'n.', 'how surprised the model was by the right answer, as one number. Confident and right scores near zero; confident and wrong scores enormously, without limit. Written −Σᵢ yᵢ log pᵢ, which collapses to −log p(correct token) whenever the truth is a single token'),

    prose(
      `One dial in the widget below has not been introduced yet. Divide every logit by a positive number T before running softmax — pᵢ = e^(zᵢ/T) / Σⱼ e^(zⱼ/T) — and you have a single knob on how sharply the model commits. Dividing by a number below 1 spreads the logits further apart and pushes the distribution toward its top entry. Dividing by a number above 1 pulls the logits together and flattens the distribution toward uniform. T = 1 leaves them alone, which is the distribution the model was actually trained to produce. Dividing by a positive number cannot change which logit is largest, so this knob never reorders anything; it only changes how much weight the leaders take from the rest. T is called the <strong>temperature</strong>, by analogy with physics. Training always uses T = 1 — it is a serving-time dial, and ${chRef('inference')} is where it earns its keep.`),

    lossW,
    prose(
      `<em>${figRef('probability', 'loss')} — the loss, as an instrument. Nothing here is sampled: no token is drawn and no tail is truncated. The logits are yours to set, the token that “actually occurred” is yours to choose, and every readout — entropy, surprise, loss, perplexity — is recomputed from softmax(z/T).</em>`,
      `A loss in nats is hard to feel. <strong>Perplexity</strong> fixes that by undoing the logarithm: PPL = e^L. For a single prediction this is exactly 1/p(correct token), and in general it is the effective number of equally likely options the model was torn between. A loss of 2.0 nats means perplexity e² ≈ ${PPL2.toFixed(2)}: the model was as uncertain as someone choosing uniformly among about ${PPL2.toFixed(1)} tokens. A model that had learned nothing at all — uniform over the vocabulary — would score ${LN_V.toFixed(2)} nats and a perplexity of ${VS}. The scene above scored ${SCENE.loss.toFixed(3)} nats on “${CONTEXT} ${SCENE.truth}”, a perplexity of ${SCENE.ppl.toFixed(2)}.`,
      `Perplexity is the number practitioners quote, with one caveat worth stating loudly: it depends on the tokenizer. Perplexities are only comparable between models that share a vocabulary, because a model with longer tokens is being asked to predict more text per guess. Within a family, the drop in perplexity across training runs is the cleanest single measure of progress there is — ${chRef('pretraining')} plots it against compute.`),

    goDeeper('why this loss, and why it never reaches zero', `
      <p><strong>Why not just measure how far off the guess was?</strong> ${chRef('learning', { cap: true })} trained with squared error, and on a probability that has come through softmax it goes nearly flat at the extremes. A model sitting at 0.001 on the right answer would feel almost no pull to move, and would stay confidently wrong. Cross-entropy behaves the opposite way: work the algebra through and the correction handed back is simply <em>the prediction minus the truth</em>. Predict 0.001 where the answer was 1 and the push is 0.999, nearly the largest it can be. The worse the model is, the harder this loss shoves it — and that is not luck, it is what softmax and cross-entropy were built as a pair to do.</p>
      <p><strong>Why the name.</strong> Entropy, in information theory, is the smallest average number of bits needed to send messages from a source: a weather station reporting on a place that is sunny 99&nbsp;days in 100 needs almost none. <em>Cross</em>-entropy is what you pay when you build your code around the wrong assumptions — design for a 50/50 climate, deploy in a 99/1 one, and you waste bits every day. That waste is exactly the gap between the model's beliefs and reality, which is why minimizing it is the same as closing that gap.</p>
      <p><strong>Why it has a floor.</strong> Language is genuinely uncertain. After &ldquo;the capital of France is&rdquo; almost any model should say Paris; after &ldquo;she opened the door and&rdquo; a great many continuations are legitimate. That share of the surprise belongs to the data, not the model, and no amount of training removes it. So a training loss heading for zero is not a triumph — it means the model has begun memorizing the corpus instead of learning its shape, which is what ${chRef('base-model')} is about.</p>`),

    term('perplexity', 'n.', 'e^L, the exponential of the cross-entropy loss; the effective number of equally likely tokens the model is choosing between, and exactly 1/p for a single prediction'),

    mathAside('cross-entropy = entropy + KL — and the gradient that falls out', `
      <p>Suppose the data at some context follows a true distribution q, and the model predicts p. The cross-entropy H(q, p) = −Σᵢ qᵢ log pᵢ splits exactly:</p>
      <div class="eq">H(q, p) = −Σᵢ qᵢ log pᵢ
        = −Σᵢ qᵢ log qᵢ  +  Σᵢ qᵢ log(qᵢ/pᵢ)
        = H(q) + D(q ‖ p)</div>
      <p>The second term is the <strong>Kullback–Leibler divergence</strong>, and by Jensen's inequality D(q ‖ p) ≥ 0 with equality only when p = q. Read in bits, it is the number of <em>extra</em> bits you pay per symbol for encoding data that really came from q using a code built for p — the price of a wrong belief, never negative.</p>
      <p>H(q) belongs to the data, not to the model; no choice of parameters can change it. So minimizing cross-entropy is precisely minimizing D(q ‖ p), which is precisely maximizing the likelihood the model assigns to the corpus. And by the source-coding theorem, an optimal code spends −log₂ pᵢ bits on outcome i, so the cross-entropy in bits <em>is</em> the average code length: minimizing the loss is minimizing the compressed size of the corpus. That is the theorem ${chRef('objective')} asserts, and this is its proof sketch — the same quantity wearing four hats.</p>
      <p>One practical dividend. Write the loss for true token c directly in terms of the logits, using the log-sum-exp form (numerically, the same max-subtraction trick applies):</p>
      <div class="eq">L = −log p_c = −z_c + log Σⱼ e^(zⱼ)</div>
      <p>Differentiate with respect to any logit zᵢ. The first term contributes −1 exactly when i = c; the second contributes e^(zᵢ)/Σⱼ e^(zⱼ) = pᵢ. So:</p>
      <div class="eq">∂L/∂zᵢ = pᵢ − yᵢ</div>
      <p>The gradient entering backpropagation is the prediction minus the truth — no exponentials, no division, no special cases. Softmax and cross-entropy are paired not by convention but because the pairing makes the derivative that ${chRef('learning')} needs come out as a subtraction.</p>`),

    takeaway(
      `A language model is trained on exactly one number, computed once per token: −log p(the token that actually came next). Softmax is the machinery that makes that number well defined; surprise is what it measures; perplexity is how you say it out loud. Every architectural idea in the rest of this book — attention, experts, depth, scale — exists to push that one number down.`));
}
