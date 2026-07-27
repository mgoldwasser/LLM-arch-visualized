/* Inside the layer: the component catalog. The previous chapter followed one
   token's vector through a layer; this one opens the hood on every small design
   decision inside that layer.

   Spine only: prose, terms, math asides, and the order the page appears in.
   The scene, the widget and the two tracked figures live beside this file. */

import { chapter, chapterHead, prose, term, mathAside, takeaway, chRef, figRef } from '../../core/components.js';
import { K3 } from '../../../data/k3.js';

import { normScene } from './scene-norm.js';
import { axesFigure } from './fig-axes.js';
import { activationWidget } from './widget-activations.js';
import { deletionsFigure } from './fig-deletions.js';
import { blockCompareFigure } from './fig-block-compare.js';

const BP = K3.blueprint; // illustrative K2 dims: 61 layers, d 7168, 64 heads × 128

export function render({ id, num, title }) {
  const dff = 4 * BP.dModel;
  const activeWidth = (K3.experts.active + K3.experts.shared) * BP.expertHidden;

  return chapter(id,
    chapterHead(num, 'The component catalog', title),
    prose(
      `${chRef('residual', { cap: true })} followed one token&rsquo;s vector through a layer without stopping to ask why the layer looks the way it does. This chapter opens the hood. A modern block is a short parts list — a normalizer, an attention sublayer, an MLP, and a set of conventions about where everything sits — and every entry on that list is the survivor of a nine-year attrition. Nothing in the 2026 block is there by default; each part either displaced a predecessor or watched its neighbors get deleted. If you build deep models, this catalog is the difference between copying a config and understanding one.`,
      `The pattern to watch for: almost every change is a <em>simplification that scaled better</em>, not a clever addition. The block got emptier, not fuller.`),

    /* ---- 1 · normalization ---- */
    prose(
      `<strong>Normalization: what, and — more important — where.</strong> The original transformer used <strong>LayerNorm</strong>: subtract the vector&rsquo;s mean, divide by its standard deviation, then apply a learned per-dimension gain and bias. RMSNorm keeps only the division — by the root-mean-square — and the gain. Dropping mean-centering and the bias removes a reduction pass and a parameter vector, and across every published head-to-head the loss curves are indistinguishable. That settled the <em>what</em>. The <em>where</em> mattered far more. The 2017 block applied the norm <em>after</em> each residual addition — on the highway itself. Every gradient travelling back down from the loss to the embedding therefore has to pass through every one of those norms, and each one rescales it on the way. Deep post-norm stacks train at all only if the learning rate starts near zero and is raised over the first few thousand steps, a ritual called <em>warmup</em>; past a few dozen layers the loss blows up regardless. Moving the norm <em>inside</em> the sublayer branch — pre-norm — leaves the identity path untouched from loss to input. Scroll: the gradient tells the story.`),
    term('RMSNorm', 'n.', 'rescale each vector to a standard size, then let the model stretch each dimension by a learned amount — nothing else. Written x / √(mean(x²) + ε) ⊙ g. It is LayerNorm with the centering and the offset removed'),

    normScene(),
    prose(
      `<em>${figRef('anatomy', 'norm')} — norm placement as a gradient-flow problem: post-norm rescales the gradient at every layer; pre-norm gives it an untouched identity path (schematic magnitudes).</em>`),

    /* ---- 1b · which axis does a norm normalize along? ---- */
    prose(
      `<strong>Which axis? Rows, not columns.</strong> The description above — subtract a mean, divide by a standard deviation — left out the one detail the name encodes: <em>which</em> numbers the mean is taken over. Lay one batch of activations out as a grid, one row per example, one column per feature. <strong>BatchNorm</strong>, the layer that defined deep learning for the five years before transformers, normalizes each <em>column</em>: it collects feature j&rsquo;s value from every example in the batch and normalizes those together. <strong>LayerNorm</strong> normalizes each <em>row</em>: it collects one example&rsquo;s own features and normalizes those. Identical arithmetic, perpendicular axes — and that is the entire difference between the two layers.`),
    term('BatchNorm', 'n.', 'normalize each feature <em>across the examples in a batch</em> — the column-wise sibling of LayerNorm, and the layer transformers replaced'),

    axesFigure(),
    prose(
      `Every practical property follows from the axis. LayerNorm&rsquo;s computation never crosses between examples, so it needs no running statistics — there is nothing to accumulate across a training run and replay later, because each example carries everything the layer needs. It therefore behaves identically in training and at inference, where BatchNorm has to switch between batch statistics and stored ones. And it is indifferent to batch size, down to a batch of one. BatchNorm has none of this: an example&rsquo;s output depends on which other examples happened to share its batch — a peculiar property for a model whose sequences all have different lengths and which is served one conversation at a time. That is why the transformer line normalizes rows, first with LayerNorm and now with RMSNorm, while the convolutional vision models BatchNorm was designed for went on normalizing columns.`),

    /* ---- 2 · activations & gating ---- */
    prose(
      `<strong>Activations: from switch to gate.</strong> The nonlinearity is the only part of the MLP that is not a matrix, and it went through three generations. <strong>ReLU</strong> — max(0,&nbsp;x) — is a hard switch: cheap, but its gradient is exactly zero for half its domain, and a unit pushed there stops learning. <strong>GELU</strong> rounds that corner off: instead of cutting x to zero, it multiplies x by a factor that climbs smoothly from 0 to 1 as x rises — the fraction of a bell curve lying below x — so values near the corner are faded rather than chopped. It was the GPT-era default. <strong>SiLU</strong> — x·σ(x) — is the same idea with a sigmoid, marginally cheaper and now standard. The real jump, though, was structural: modern blocks don&rsquo;t apply the activation to the hidden vector directly. They compute <em>two</em> parallel projections and let one multiplicatively gate the other — <strong>SwiGLU</strong>: down(SiLU(gate(x))&nbsp;⊙&nbsp;up(x)). The up path proposes a value for each hidden dimension; the gate path decides, per dimension, how much of it passes. K3 ships an in-house variant of this family called SiTU (${chRef('moe', { word: 'ch.' })} draws the full expert). Play with the widget until gating stops being a formula and starts being a switch.`),
    term('SwiGLU', 'n.', 'an MLP with a gate: one path computes a value, a second computes how much of that value to let through, and the two are multiplied dimension by dimension. Three matrices where the classic MLP had two — down(SiLU(W_gate·x) ⊙ (W_up·x))'),

    activationWidget(),
    prose(
      `<em>${figRef('anatomy', 'activations')} — the three activation curves, and gating as a per-dimension soft switch: SiLU(g) decides how much of the up-path value u survives the multiply.</em>`),

    mathAside('RMSNorm and SwiGLU, precisely', `
      <p>The two definitions this chapter turns on:</p>
      <div class="eq">RMSNorm(x) = x / √(mean(x²) + ε) ⊙ g          g ∈ ℝᵈ
SwiGLU(x)  = W_down( SiLU(W_gate x) ⊙ (W_up x) )</div>
      <p>with SiLU(x) = x·σ(x). Parameter bookkeeping: the classic two-matrix MLP costs 2·d·d_ff with d_ff = 4d. The gated block has <em>three</em> matrices — 3·d·d_ff — so to hold parameters constant, d_ff shrinks to ⅔·4d = <strong>8/3·d</strong>. That is why gated configs quote odd-looking hidden sizes: they are 4d budgets re-divided across three matrices. (In K3&rsquo;s MoE the convention breaks entirely — each expert&rsquo;s hidden width is ${BP.expertHidden.toLocaleString('en-US')} ≈ 0.29·d, and the pool makes up the difference.)</p>`),

    /* ---- 3 · the disappearing parts ---- */
    prose(
      `<strong>The disappearing parts.</strong> Several 2017 fixtures are simply gone. Biases on the linear layers: dropped — at billions of parameters per matrix, a d-length additive vector measurably changes nothing, and training runs are more stable without them. <strong>Dropout</strong>: dropped. It worked by switching off a random fraction of a layer&rsquo;s units on every training step, so the network could never come to lean on any single one of them — a deliberate handicap, imposed to stop a model memorizing its training set instead of learning from it. Handicaps of that kind are called <em>regularization</em>, and pretraining does not need one: it makes roughly one pass over tens of trillions of tokens, so the model meets most of them once and never again, and memorization barely has an opportunity to start. A model that has not yet extracted everything its data has to teach is in no danger of over-learning it, and the handicap only slows it down. Embedding tying — sharing one matrix between the input embedding and the output unembedding — made sense when vocab×d was a large fraction of a small model; at frontier scale it is a rounding error of the parameter budget, and untying the two matrices (they do different jobs: one encodes, one classifies) buys quality for free.`),

    deletionsFigure(),

    /* ---- 4 · positional machinery placement ---- */
    prose(
      `<strong>Positional machinery: where it lives now.</strong> One deletion above deserves its footnote. The table of learned position vectors was not swapped for a better table: position information left the embedding altogether and moved into attention, which is the one place in the block where the distance between two tokens is actually used. The mechanism that carries it there is called <strong>RoPE</strong>, and ${chRef('attention', { word: 'ch.' })} builds it from scratch. What the frontier still argues over is the dose rather than the address — how much of each comparison should be told the position outright, and how much the model should be left to infer from context, which experiments suggest it can partly do unaided. How that dial interacts with million-token context is ${chRef('attention-scale', { word: 'ch.' })}&rsquo;s subject.`),

    /* ---- 5 · width vs depth & the shape of a block ---- */
    prose(
      `<strong>The shape of a block.</strong> Two proportions defined the 2017 recipe, and neither was ever derived. The MLP&rsquo;s hidden layer was four times the width of the stream — ${(dff).toLocaleString('en-US')} for K2&rsquo;s d&nbsp;=&nbsp;${BP.dModel.toLocaleString('en-US')} — the width configs call d_ff. The second proportion governed attention, which does its work in several parallel slices called <em>heads</em> (${chRef('attention', { word: 'ch.' })}): the convention fixed each slice&rsquo;s width, and then the number of slices was not a decision at all — it was the stream width divided by the slice width. Both survived a decade as folklore more than derivation, and MoE finally broke the first one: instead of a single 4d hidden layer, K3&rsquo;s block holds ${K3.experts.routed} experts of hidden width ${BP.expertHidden.toLocaleString('en-US')} (≈&nbsp;0.29·d each, illustrative) and activates ${K3.experts.active}&nbsp;+&nbsp;${K3.experts.shared}&nbsp;shared — about ${(activeWidth / BP.dModel).toFixed(1)}·d of <em>active</em> hidden width, a dense-sized compute budget drawn from a pool ~${Math.round(K3.experts.routed * BP.expertHidden / activeWidth)}× larger. The head convention bends too: K2&rsquo;s ${BP.heads}&nbsp;slices of ${BP.dHead}&nbsp;dimensions come to ${(BP.heads * BP.dHead).toLocaleString('en-US')}, deliberately wider than the stream they read from, where the old rule would have made the two match exactly.`,
      `What do the two axes actually buy? <em>Depth</em> buys iterative refinement: ${chRef('residual', { word: 'ch.' })}&rsquo;s logit-lens picture — early layers resolving syntax, middle layers assembling entities, late layers converging on the answer — is a computation that needs sequential steps, and more layers are more steps. <em>Width</em> buys capacity per step: more features detected in parallel, more room in the stream for sublayers to write without collisions. Frontier configs hold the ratio in a broad sweet band (d/L in the low hundreds) because both extremes fail — a wide-shallow model can&rsquo;t compose, a narrow-deep one starves each step. Here is the whole chapter in one picture: the block, nine years apart.`),

    blockCompareFigure(),

    prose(
      `Read the amber and you have the modern design brief: keep the residual highway sacred, normalize going into each branch (with the cheapest norm that works), gate the MLP, compress attention&rsquo;s memory traffic, spend the parameter budget on a routed expert pool, and delete every part that cannot prove it moves the loss. The unhighlighted parts are just as informative — the two-sublayer rhythm and the add-don&rsquo;t-replace contract of ${chRef('residual', { word: 'ch.' })} have not moved since 2017.`),

    takeaway(
      `The 2026 block is the 2017 block edited by <strong>deletion and relocation</strong>, not addition: the norm moved off the highway and lost its mean and bias; the activation became a per-dimension gate; positions moved into attention; biases, dropout, and tying vanished; and the 4d MLP shattered into an expert pool. Every survivor earned its place the same way — equal or better loss at scale, with one less thing to break.`),
  );
}
