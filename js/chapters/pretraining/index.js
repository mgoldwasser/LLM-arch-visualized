/* Pretraining: the loop that costs millions. The mechanics of loss, gradients
   and descent are already in hand from Part I — this chapter is what happens
   when that loop is run for weeks on tens of thousands of accelerators. */

import { chapter, chapterHead, prose, term, mathAside, claimFig, chRef, figRef } from '../../core/components.js';
import { si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { trainStepScene } from './scene-train-step.js';
import { chunkExamplesFigure, BLOCK } from './fig-chunk-examples.js';
import { bigramBaselineFigure } from './fig-bigram-baseline.js';
import { computeFigure } from './fig-compute.js';
import { parallelismFigure } from './fig-parallelism.js';
import { watchingRunScene, lossAt, CHECKPOINTS } from './scene-watching-run.js';
import { overfitFigure } from './fig-overfit.js';

const TRILLION = si(K3.totalParams).replace('T', '');   // '2.8'
const VOCAB = K3.vocab.toLocaleString('en-US');
const UNIFORM = Math.log(K3.vocab).toFixed(2);          // −ln(1/V), the free loss

export function render({ id, num, title }) {
  /* The scene's caption lives in the prose beneath it, so it claims its
     number here — before any figure further down the page. */
  claimFig('step');
  const scene = trainStepScene();

  return chapter(id,
    chapterHead(num, 'Learning', title),
    prose(
      `Training is a search problem: among all possible settings of the ${TRILLION} trillion weights, find one that makes the corpus likely. The corpus itself is a product — web crawl, code, books, papers, increasingly multimodal data, pushed through aggressive deduplication, quality filtering, and mixture tuning (Kimi K2.5&rsquo;s pretraining run used ~15 trillion tokens). The search algorithm is the gradient descent of ${chRef('learning')}, unchanged; what is different here is the industrial machinery wrapped around its four repeating beats. Scroll.`),

    scene,
    prose(
      `<em>${figRef('pretraining', 'step')} — one training step: batch → forward (T predictions per sequence), loss (−log p of the actual next token), backward (∂L/∂θ for all ${si(K3.totalParams)} weights), update θ (${K3.optimizer}) — repeated ~10⁶–10⁷ times.</em>`),

    prose(
      `One line in that first beat did more work than its length suggests: a single sequence yields as many training examples as it has tokens. It is worth watching that happen at a size you can count on your fingers. Take a chunk of ${BLOCK + 1} tokens sampled out of the corpus of ${chRef('data')}. That is not one training example; it is ${BLOCK}. The first token predicting the second is one, the first two predicting the third is another, and so on up to the whole prefix predicting the last. All ${BLOCK} are scored in the same forward pass, because the causal mask guarantees no position&rsquo;s prediction can depend on anything to its right.`),
    chunkExamplesFigure(),
    term('block size', 'n.', 'the number of tokens one sampled training chunk predicts — and therefore the number of training examples the chunk contains, since every prefix of it is supervised in the same pass'),
    prose(
      `That is also the answer to a question a reader might not have known to ask: how can a model trained on documents thousands of tokens long continue sensibly from a prompt of two words? Because it was never trained on documents. It was trained on every prefix of every document — context length one, then two, then three, up to the block size, in exactly the proportion those lengths occur. A short prompt is not an unusual request. It is the case the model saw first, and saw once per chunk, for the entire run.`),

    term('perplexity', 'n.', `e<sup>loss</sup>, from ${chRef('probability')} — the effective number of tokens the model is torn between; at this scale it is simply the number on the dashboard everyone watches fall for weeks`),
    prose(
      `Which leaves the number itself. The 2.3 nats in that second beat meant nothing to you when it appeared, and it should not have: a cross-entropy is interpretable only against what the same quantity would be for a model that knows nothing at all. That baseline is exact, and it is free. Predict every token uniformly over a vocabulary of V and the loss is −ln(1/V) = ln&nbsp;V, which for K3&rsquo;s ${VOCAB} tokens is ${UNIFORM} nats. One rung below it sits the cheapest model that knows anything — a bigram table, which knows the previous token and nothing else, and which you could build with a counter and one pass over the corpus. Everything between that rung and a trained transformer is what the machine of Part II is for, and it is worth seeing the two distances drawn to the same scale before spending a datacenter on the second one.`),
    bigramBaselineFigure(),

    prose(
      `The economics compress into one folk formula: training compute ≈ <strong>6 × N × D</strong> floating-point operations, with N the active parameters and D the tokens seen (2 FLOPs per parameter per token forward, ~4 backward). Plug in MoE-scale numbers — N ≈ ${si(K3.activeParams)} active, D ≈ 15T — and you get ~4.5×10²⁴ FLOPs: months on tens of thousands of accelerators, and the entire reason MoE exists. A dense ${si(K3.totalParams)} model would cost ~56× more per token; sparsity buys trillion-scale capacity at ${si(K3.activeParams)}-scale compute. This is also why scaling laws matter: loss falls as a smooth power law in N and D, so labs fit the curve on small runs and choose N, D, and the data mixture before committing the budget — the Chinchilla result (train longer on a smaller model) reshaped the field&rsquo;s ratios in exactly this way.`),
    computeFigure(),
    term('scaling law', 'n.', 'an empirical power law relating loss to parameters N and tokens D — fit on cheap small runs, then used to choose N, D, and the data mixture before the real budget is committed'),

    prose(
      `No single device holds any of this, so the model is cut along every available axis at once: <strong>data parallelism</strong> (give every GPU a copy of the weights, or split the weights so each holds a slice, and hand each a different part of the batch), <strong>tensor parallelism</strong> (split individual matrices across GPUs), <strong>pipeline parallelism</strong> (split the layer stack into stages), and MoE&rsquo;s own <strong>expert parallelism</strong> from ${chRef('moe')}. A frontier training job is as much a distributed-systems artifact as a statistical one — K3&rsquo;s headline changes are all attacks on this layer of the problem: an expert-routing rule with no hand-tuned number in it, a dispatch scheme that gives every GPU an identically-sized share so none waits on a straggler, and a rewiring of the layer stack that Moonshot reports reaching a given loss for materially less compute.`),
    parallelismFigure(),

    prose(
      `All of that machinery — the formula, the fleet, the four cuts through one model — buys exactly one thing, and it is worth being concrete about what buying it feels like. A frontier run is weeks of wall-clock during which the interesting events are rare and the entire visible state of the enterprise is one scalar. Every so often somebody samples the model with a fixed prompt to see what the money has produced so far.`),
    watchingRunScene(),
    prose(
      `<em>${figRef('pretraining', 'run')} — one run, three checkpoints, the same prompt at each. The loss series is generated from a power law in the step count, anchored at ln&nbsp;V (the free loss of ${figRef('pretraining', 'baseline')}) and decaying toward a floor; the noise band is seeded, so the figure renders identically on every load. The sample texts are fixtures, chosen to be representative of what a run of this shape produces at those losses.</em>`,
      `The middle frame is the one worth staring at. Between the first two checkpoints the model crosses from token soup into text with the <em>shape</em> of English and none of its content, and to a reader that transition feels like the beginning of understanding. It is not. It is the loss falling from ${lossAt(CHECKPOINTS[0]).toFixed(1)} nats to ${lossAt(CHECKPOINTS[1]).toFixed(1)}: the model has learned which tokens are common, which ones tend to follow which, and roughly how long a word is. Everything a reader would actually call understanding arrives later, more slowly, and for a great deal more money — and the researcher spends that stretch watching a single number, which is why knowing what the number should be doing is most of the skill.`),

    prose(
      `One instrument on that dashboard does something the loss alone structurally cannot. Before training starts, hold back a slice of the corpus that the optimizer will never see, and measure the loss on it periodically. The reason is a distinction the training loss cannot make. What you want from the run is a model that produces text <em>like</em> the corpus. What gradient descent will happily hand you instead, given enough passes, is a model that reproduces the corpus — and from the inside those two are indistinguishable, because both drive the training loss down. Only data the model has never been shown can separate them, because only that data is impossible to have memorized.`),
    overfitFigure(),
    term('overfitting', 'n.', `the regime past the mark in ${figRef('pretraining', 'holdout')} — where more training keeps improving the loss on the data being trained on while worsening it on data the model has never seen; detectable only because a slice was held back`),
    prose(
      `Pretraining at frontier scale is unusual in reaching that mark rarely: with ~15 trillion tokens and roughly one pass over them, most tokens are seen exactly once and there is little to memorize by repetition. The behavior does not vanish, though — it concentrates on whatever the corpus repeats, which is why a base model will recite a famous poem or a widely-mirrored software licence close to verbatim while paraphrasing everything else, the behavior ${chRef('base-model')} takes apart. Fine-tuning inverts the ratio: many passes over a small dataset, where the divergence above shows up on the first afternoon (${chRef('adaptation')}).`),

    mathAside('what the chain rule costs at this scale', `
      <p>Cross-entropy comes from ${chRef('probability')} and backprop from ${chRef('learning')}; nothing about them changes here, so this aside is only about the bill. Per position, with predicted distribution p and true next token y: L = −log&nbsp;p(y), averaged over every position in the batch. For any weight matrix W computing z = Wx somewhere in the stack, the chain rule gives</p>
      <div class="eq">∂L/∂W = (∂L/∂z) xᵀ      ∂L/∂x = Wᵀ (∂L/∂z)</div>
      <p>— the outer product updates the weights, the transpose product passes the error signal to earlier layers. The consequence at frontier scale is memory, not math: every matrix in all ~${K3.blueprint.layers} layers must keep its forward-pass x until the backward wave reaches it, which is why training&rsquo;s activation memory dwarfs the weights themselves — and why &ldquo;gradient checkpointing&rdquo; (recomputing activations during backward instead of storing them) is standard practice.</p>`),
    mathAside('Adam, and the memory bill it runs up', `
      <p>The descent rule of ${chRef('learning')} is never run bare at this scale. Adam keeps exponential moving averages of the gradient (m) and its square (v) for every parameter, updating θ ← θ − η·m̂/(√v̂ + ε). Two extra fp32 tensors per parameter, plus fp32 master weights in mixed-precision training: ≈ <strong>16 bytes of optimizer/gradient state per parameter</strong>, against 2 for the bf16 weight itself. Full fine-tuning a 7B model therefore wants ~112 GB before a single activation is allocated — the arithmetic behind ${chRef('adaptation')}. Muon departs from per-coordinate scaling: it treats each weight matrix as the unit and orthogonalizes its update (via Newton–Schulz iterations), which Moonshot found markedly more compute-efficient at scale; ${K3.optimizer} in K3 applies the treatment per attention head.</p>`));
}
