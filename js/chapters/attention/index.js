/* Attention, step by step — the site's centerpiece. Sticky scene: one attention
   head assembling itself in five stages, then shape bookkeeping, a hand-checkable
   worked example, a pronoun-resolution widget, RoPE clock hands, and the variant
   zoo. This file is the chapter's outline; each figure lives in its own module.

   No number appears here: chapter numbers come from the registry via chRef(),
   figure numbers are claimed in call order by figure()/claimFig(). */

import { chapter, chapterHead, prose, term, mathAside, chRef, figRef } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { K3 } from '../../../data/k3.js';
import { BP, subhead, eqLine, claimed } from './shared.js';
import { attentionScene } from './scene-five-stages.js';
import { averagingScene } from './scene-averaging.js';
import { ladderScene } from './scene-ladder.js';
import { shapesFigure } from './fig-shapes.js';
import { workedExample } from './fig-worked-example.js';
import { removalFigure } from './fig-removal.js';
import { scalingFigure } from './fig-scaling.js';
import { coreferenceWidget } from './widget-coreference.js';
import { graphFigure } from './fig-graph.js';
import { permutationFigure } from './fig-permutation.js';
import { ropeFigure } from './fig-rope.js';
import { variantsFigure } from './fig-variants.js';

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'The mechanism', title),
    prose(
      `The word &ldquo;sat&rdquo; means something different in &ldquo;the cat sat&rdquo; than in &ldquo;the verdict sat poorly&rdquo;. A token&rsquo;s stream vector must therefore be updated using the other tokens — and <strong>self-attention</strong> is the machinery. The 2017 insight (&ldquo;Attention Is All You Need&rdquo;) was that this one mechanism could replace recurrence entirely: every token consults every earlier token <em>simultaneously</em>, as a batch of matrix multiplications, which is exactly the workload GPUs are built for.`,
      `The mechanism is a <strong>soft key–value lookup</strong>. From its stream vector, each token derives three small vectors through learned projection matrices: a <strong>query</strong> (what am I looking for?), a <strong>key</strong> (what do I advertise?), and a <strong>value</strong> (what content do I hand over if selected?). Scroll through the five stages.`),
    eqLine('q = W_Q x,  k = W_K x,  v = W_V x — three learned matrices, applied to every token independently'),

    /* The scene is a numbered figure; its caption is the prose right below it. */
    claimed('five-stages', createScene({
      id: 'attention-steps',
      figure: attentionScene,
      steps: [
        { n: 'STEP 1 / 5 — PROJECT', html: `<p>Every token multiplies its stream vector by W_Q, W_K, W_V. Note the sizes: queries and keys land in a small comparison space (d_head, typically 64–128 dims), not the full d_model. The projections are the learnable part — training shapes what kinds of relationships get looked up.</p>` },
        { n: 'STEP 2 / 5 — SCORE', html: `<p>Token i&rsquo;s query is dotted against every token j&rsquo;s key: one similarity score per pair, forming a T×T matrix in a single multiply, S&nbsp;=&nbsp;QKᵀ. Scores are then divided by √d_head. Without that division the scores grow larger the wider the head is, and the softmax in the next step reacts by putting nearly all of a row&rsquo;s weight on one token and nearly none anywhere else — a state it cannot learn its way out of. ${figRef(id, 'scaling')} takes that apart properly later in the chapter.</p><p>The upper triangle is erased with −∞: the <strong>causal mask</strong>. No token may see its future — otherwise next-token training would be trivially cheatable, and one forward pass could no longer train all T positions at once.</p>` },
        { n: 'STEP 3 / 5 — NORMALIZE', html: `<p>Each row of scores passes through <strong>softmax</strong>: exponentiate every entry, divide by the row sum. Out come attention weights — non-negative, summing to 1. A masked −∞ becomes exactly 0.</p><p>This is the &ldquo;soft&rdquo; in soft lookup: instead of retrieving the single best match, the token takes a weighted blend of all of them — which keeps the whole operation differentiable, so it can be trained by gradient descent.</p>` },
        { n: 'STEP 4 / 5 — GATHER', html: `<p>Each token&rsquo;s output is the weight-averaged sum of the value vectors of the tokens it attends to. An output projection W_O maps the result back to d_model and adds it into the residual stream. Net effect: information moved between positions — attention transports, the MLP transforms.</p>` },
        { n: 'STEP 5 / 5 — MULTI-HEAD', html: `<p>One softmax per row can only express one mixing pattern — so run the whole thing h times in parallel with independent, smaller projections. Each head (${BP.heads} of them in K2) learns its own relation: some track adjacent tokens, some resolve pronouns, some find matching brackets in code.</p><p>Heads&rsquo; outputs are concatenated and mixed by W_O. Total cost per layer stays the same as one full-width head.</p>` },
      ],
    })),
    prose(`<em>${figRef(id, 'five-stages')} — one attention head in five stages: project into q/k/v, score every pair, mask and normalize, gather a weighted blend, then ×${BP.heads} heads in parallel.</em>`),

    subhead('Where the weighted average comes from'),
    prose(
      `Presented finished, attention looks like a design — five stages that someone had to think of. It is easier to trust, and much harder to forget, as a <em>derivation</em>: begin with the dullest possible way of letting a token see its own past, then delete the arbitrary parts one at a time until nothing arbitrary is left. What remains is attention, and there is nowhere along the way where a choice was smuggled in.`,
      `The whole construction fits in a 3&times;3 matrix. Every number in the next two figures is computed in the browser by the same <code>matmul</code> and <code>softmax</code> that produce ${figRef(id, 'worked')}; nothing is transcribed. They are meant to be checked.`),
    claimed('averaging', averagingScene()),
    prose(`<em>${figRef(id, 'averaging')} — the averaging trick. A 3&times;3 weight matrix multiplied into three value vectors, one product at a time. Ones give column totals; a lower triangle gives running sums, because the zeroed terms drop out of the sum; dividing each row by its own total gives running averages; and softmaxed q&middot;k affinities give attention. The mask is not an <code>if</code> — it is a zero.</em>`),
    claimed('ladder', ladderScene()),
    prose(`<em>${figRef(id, 'ladder')} — the same average written three ways. The badges show the largest elementwise difference between neighboring outputs, computed each time the figure redraws: the first two read <em>identical</em> because that comparison came back at the level of floating-point rounding, not because the word was typed there. The last step changes only where the affinities come from, and the badge breaks on its own.</em>`),

    subhead('The shapes, end to end'),
    prose(
      `The five stages compress into one line of shape bookkeeping — worth internalizing, because every attention variant in ${figRef(id, 'variants')} is just an edit to these dimensions. With K2&rsquo;s numbers (d&nbsp;=&nbsp;${BP.dModel}, d_head&nbsp;=&nbsp;${BP.dHead}, ${BP.heads} heads) and a T-token context, per head:`),
    shapesFigure(),

    subhead('Attention with actual numbers'),
    prose(
      `Shapes tell you what&rsquo;s legal; numbers tell you what&rsquo;s happening. Here is the entire mechanism for four tokens at d_head&nbsp;=&nbsp;2 — small enough to check by hand, and structurally identical to the real thing at ${BP.dHead}. Follow the highlighted row: token 3 (&ldquo;sat&rdquo;) building its output.`),
    workedExample(),

    subhead('What each part is for'),
    prose(
      `A mechanism is easiest to read at the moment it breaks. Everything so far has been additive — one more stage, one more term. The next figure runs the other way: it starts from the finished attention matrix and <em>removes</em> machinery, so you can see what each piece was holding up.`,
      `Take the softmax away first. What is left underneath are the raw affinities q&middot;k&nbsp;/&nbsp;&radic;d_head, which run negative as well as positive and do not total anything in particular per row. They cannot be mixing weights; the softmax is what converts a set of scores into an average. Then take the causal mask away, and the upper triangle fills in: every one of those cells is a token reading a token that has not been written yet.`),
    removalFigure(),

    subhead('Why the scores are divided by √d_head'),
    prose(
      `Step 2 divided the scores by &radic;d_head and moved on. It is worth stopping, because the reason is not a tuning detail — it is the difference between a head that can learn and one that cannot.`,
      `A dot product of two vectors of d independent, unit-variance coordinates is a sum of d independent terms, so its variance is d. Softmax has no notion of scale; it only cares how far apart the scores are. Push the same relative pattern up by a factor of &radic;d and the row sharpens toward one-hot — an artifact of the dimension, not of the data. At initialization, that means every token would attend almost entirely to a single other token, in a region where the softmax gradient is nearly zero and nothing can move. Dividing by &radic;d_head cancels the growth exactly.`),
    scalingFigure(),

    prose(
      `Here is the mechanism doing its signature trick — pronoun resolution. In &ldquo;the trophy didn&rsquo;t fit in the suitcase because <strong>it</strong> was too big&rdquo;, grammar alone cannot tell you what &ldquo;it&rdquo; refers to; world knowledge can. Click any token to see a coreference-style head&rsquo;s weights from that token.`),
    claimed('coref', coreferenceWidget()),
    prose(`<em>${figRef(id, 'coref')} — try &ldquo;it&rdquo; (trophy vs. suitcase), then &ldquo;big&rdquo;, then &ldquo;fit&rdquo;. Values are hand-set to illustrate one coreference-style head; real models spread this across many heads and layers.</em>`),

    subhead('Attention as communication on a graph'),
    prose(
      `Strip the matrices away and attention is a communication rule on a directed graph. Each token is a node; an edge from node <em>i</em> to node <em>j</em> means &ldquo;i is allowed to read j&rdquo;. The mask is the adjacency rule, the softmax decides how loudly each permitted edge speaks, and nothing else in the mechanism knows anything about sequences at all.`,
      `Seeing it that way collapses a family of architectures into one picture. Keep the rule <em>j&nbsp;&le;&nbsp;i</em> and you have the decoder every language model uses. Delete the masking line and every node talks to every other — that is an <strong>encoder</strong> block, of the kind BERT-style models and the vision towers in ${chRef('multimodal')} are built from. Point the queries at a <em>different</em> set of nodes and it is <strong>cross attention</strong>, which is how a decoder reads an encoder, an image, or a retrieved document. Three architectures, one adjacency rule.`),
    graphFigure(),
    prose(
      `One more thing the graph makes visible by leaving it out. Training runs many sequences at once — the batch — and a batch of 32 is not one graph of 32&times;T nodes. It is <strong>32 separate graphs that never touch</strong>: every matrix multiply here is batched, applied independently to each sequence, and no token in one document can read a token in another. That is why the batch can be reordered, resized, or split across ${chRef('pretraining')}'s eight GPUs without changing a single output, and why a served request is unaffected by whoever else is being served alongside it. Attention is total within a sequence and blind across the batch.`),

    subhead('Where does word order come from?'),
    prose(
      `Nothing so far distinguishes &ldquo;dog bites man&rdquo; from &ldquo;man bites dog&rdquo; — attention is a set operation, blind to position. That claim is worth measuring rather than believing, so the next figure measures it: permute the input rows with positions switched off, and the output rows come back permuted the same way, to floating-point rounding. Switch positions on and the same permutation changes the answer, because the position vector is attached to the slot and stays behind when the token moves.`),
    permutationFigure(),
    prose(
      `Modern models inject order with <strong>rotary position embeddings (RoPE)</strong>: before the dot product, each query and key vector is rotated, two coordinates at a time, by angles proportional to the token&rsquo;s position — clock hands spinning at many different frequencies. Rotating both q and k by their own positions leaves the dot product depending only on the <em>difference</em> of positions, so attention scores encode relative offset — which generalizes far better than absolute position and is one of the levers behind million-token contexts.`),
    term('RoPE', 'n.', 'at position <em>m</em>, rotate each (q,k) coordinate pair by <em>m</em>·θᵢ, one frequency θᵢ per pair; ⟨q_m, k_n⟩ then depends on <em>m</em>−<em>n</em> only'),
    ropeFigure(),

    subhead('The variants you’ll actually meet'),
    prose(
      `Vanilla multi-head attention has an inference problem: every past token&rsquo;s keys and values must sit in GPU memory (the KV cache — ${chRef('inference')}), and at 1M tokens × ${BP.heads} heads that is crushing. The variant zoo is mostly a series of attacks on that cost:`,
      `<strong>MHA (2017)</strong> — Every head owns its own K and V. Maximum quality, maximum cache.`,
      `<strong>MQA / GQA</strong> — All heads (MQA) or groups of heads (GQA — the Llama-family default) share one K/V set: cache shrinks 8–64×, small quality cost.`,
      `<strong>MLA (DeepSeek, K2)</strong> — Multi-head Latent Attention: instead of storing every head&rsquo;s K and V, squeeze what a token has to offer into one short summary vector, store only that, and expand it back into keys and values when a query arrives. Near-MHA quality at a fraction of the memory.`,
      `<strong>K3: ${K3.attention}</strong> — A hybrid. Most layers run Kimi Delta Attention, which keeps no per-token store at all: it folds every token it has read into a single running summary of fixed size, so taking in the millionth token costs exactly what the first one did, and reading a whole sequence costs time in step with its length rather than with the square of its length. A minority of layers keep full (gated) MLA, which remembers each token separately and can therefore recall a distant detail precisely. Moonshot credits KDA with up to 6.3× faster decoding at 1M-token context. K3 also lets a layer read the output of <em>any</em> earlier layer, not only the one directly beneath it — a wiring change Moonshot calls Attention Residuals.`),
    variantsFigure(),

    mathAside('full attention in one expression', `
      <p>For one head with Q, K, V ∈ ℝ^(T×d_head) and causal mask M (Mᵢⱼ = 0 if j ≤ i, −∞ otherwise):</p>
      <div class="eq">Attn(Q,K,V) = softmax(QKᵀ/√d_head + M) V</div>
      <p>Multi-head: h copies with separate projections; concatenate the T×d_head outputs into T×d_model; multiply by W_O. The √d_head keeps score variance ≈ 1 when q,k entries are ≈ unit variance. The T×T matrix is why naive attention is O(T²) in time and memory — FlashAttention computes the identical result tile-by-tile without ever materializing it, and linear attention (KDA&rsquo;s family) replaces softmax with a kernel that admits a constant-size running state.</p>`));
}
