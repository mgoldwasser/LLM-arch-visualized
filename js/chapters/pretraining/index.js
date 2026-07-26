/* Pretraining: the loop that costs millions. The mechanics of loss, gradients
   and descent are already in hand from Part I — this chapter is what happens
   when that loop is run for weeks on tens of thousands of accelerators. */

import { chapter, chapterHead, prose, term, mathAside, claimFig, chRef, figRef } from '../../core/components.js';
import { si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { trainStepScene } from './scene-train-step.js';
import { computeFigure } from './fig-compute.js';
import { parallelismFigure } from './fig-parallelism.js';

const TRILLION = si(K3.totalParams).replace('T', '');   // '2.8'

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
    term('perplexity', 'n.', `e<sup>loss</sup>, from ${chRef('probability')} — the effective number of tokens the model is torn between; at this scale it is simply the number on the dashboard everyone watches fall for weeks`),

    prose(
      `The economics compress into one folk formula: training compute ≈ <strong>6 × N × D</strong> floating-point operations, with N the active parameters and D the tokens seen (2 FLOPs per parameter per token forward, ~4 backward). Plug in MoE-scale numbers — N ≈ ${si(K3.activeParams)} active, D ≈ 15T — and you get ~4.5×10²⁴ FLOPs: months on tens of thousands of accelerators, and the entire reason MoE exists. A dense ${si(K3.totalParams)} model would cost ~56× more per token; sparsity buys trillion-scale capacity at ${si(K3.activeParams)}-scale compute. This is also why scaling laws matter: loss falls as a smooth power law in N and D, so labs fit the curve on small runs and choose N, D, and the data mixture before committing the budget — the Chinchilla result (train longer on a smaller model) reshaped the field&rsquo;s ratios in exactly this way.`),
    computeFigure(),
    term('scaling law', 'n.', 'an empirical power law relating loss to parameters N and tokens D — fit on cheap small runs, then used to choose N, D, and the data mixture before the real budget is committed'),

    prose(
      `No single device holds any of this, so the model is cut along every available axis at once: <strong>data parallelism</strong> (replicate weights or shard them ZeRO-style, split the batch), <strong>tensor parallelism</strong> (split individual matrices across GPUs), <strong>pipeline parallelism</strong> (split the layer stack into stages), and MoE&rsquo;s own <strong>expert parallelism</strong> from ${chRef('moe')}. A frontier training job is as much a distributed-systems artifact as a statistical one — K3&rsquo;s headline innovations (Quantile Balancing, static-shape expert dispatch, Attention Residuals&rsquo; 25% training-efficiency gain) are all attacks on this layer of the problem.`),
    parallelismFigure(),

    mathAside('what the chain rule costs at this scale', `
      <p>Cross-entropy comes from ${chRef('probability')} and backprop from ${chRef('learning')}; nothing about them changes here, so this aside is only about the bill. Per position, with predicted distribution p and true next token y: L = −log&nbsp;p(y), averaged over every position in the batch. For any weight matrix W computing z = Wx somewhere in the stack, the chain rule gives</p>
      <div class="eq">∂L/∂W = (∂L/∂z) xᵀ      ∂L/∂x = Wᵀ (∂L/∂z)</div>
      <p>— the outer product updates the weights, the transpose product passes the error signal to earlier layers. The consequence at frontier scale is memory, not math: every matrix in all ~${K3.blueprint.layers} layers must keep its forward-pass x until the backward wave reaches it, which is why training&rsquo;s activation memory dwarfs the weights themselves — and why &ldquo;gradient checkpointing&rdquo; (recomputing activations during backward instead of storing them) is standard practice.</p>`),
    mathAside('Adam, and the memory bill it runs up', `
      <p>The descent rule of ${chRef('learning')} is never run bare at this scale. Adam keeps exponential moving averages of the gradient (m) and its square (v) for every parameter, updating θ ← θ − η·m̂/(√v̂ + ε). Two extra fp32 tensors per parameter, plus fp32 master weights in mixed-precision training: ≈ <strong>16 bytes of optimizer/gradient state per parameter</strong>, against 2 for the bf16 weight itself. Full fine-tuning a 7B model therefore wants ~112 GB before a single activation is allocated — the arithmetic behind ${chRef('adaptation')}. Muon departs from per-coordinate scaling: it treats each weight matrix as the unit and orthogonalizes its update (via Newton–Schulz iterations), which Moonshot found markedly more compute-efficient at scale; ${K3.optimizer} in K3 applies the treatment per attention head.</p>`));
}
