/* Adaptation — the finale: how much of the model do you actually have to
   touch? Full fine-tuning → LoRA → TinyLoRA's 13 parameters.
   Spine only: prose, terms, takeaway, the math aside. The scene and the two
   figures live beside this file and claim their numbers in call order:

     scene-shrink.js  key 'shrink'    — one matrix, three philosophies (scene)
     fig-results.js   key 'results'   — GSM8K bars
     fig-asymmetry.js key 'asymmetry' — SFT vs RL at tiny capacity            */

import { chapter, chapterHead, prose, term, mathAside, takeaway, chRef, figRef } from '../../core/components.js';
import { si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { shrinkScene } from './scene-shrink.js';
import { resultsFigure } from './fig-results.js';
import { asymmetryFigure } from './fig-asymmetry.js';

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'Adaptation', title),
    prose(
      `A pretrained-and-aligned model is a generalist. Making it excel at <em>your</em> task — your domain's vocabulary, your reasoning style, your output format — means continuing training on your data. The question that has defined the last five years of this field is embarrassingly simple: <strong>how much of the model do you actually have to touch?</strong> The answer has fallen ten orders of magnitude.`,
      `<strong>Full fine-tuning</strong> — update everything — is maximally expressive and brutally expensive. Recall ${chRef('pretraining')}'s arithmetic: gradients plus Adam state cost ~16 bytes per parameter, so even a modest 7B model wants ~112 GB before activations, and every task you tune becomes a complete multi-gigabyte copy of the model. At K3 scale it means re-provisioning the training cluster.`,
      `<strong>LoRA</strong> (2021) starts from an empirical observation: the change full fine-tuning makes to each weight matrix has low intrinsic rank — most of those trillions of deltas are redundant. So freeze W entirely and learn the update as a product of two thin matrices, ΔW = BA, through a tiny inner dimension r ≈ 8–64. The effective weight is W + BA; only B and A train — typically 0.1–1% of the model. Adapters are megabytes, hot-swappable per customer on one frozen base, and mergeable into W at deploy time for zero inference overhead. QLoRA quantizes the frozen base to 4 bits, putting 7B-scale tuning on one consumer GPU; it is the industry's default adaptation method.`),
    term('low-rank', 'adj.', 'a d×k matrix expressible as (d×r)(r×k) with r ≪ min(d,k); it has only r independent directions of action'),
    prose(
      `<strong>TinyLoRA</strong> (2026 — FAIR, Cornell, CMU; “Learning to Reason in 13 Parameters”) asks the reductio question: is even rank one necessary? Standard LoRA can't shrink below the model's width — B alone is d×1. TinyLoRA escapes that floor in three moves. First, work inside each frozen matrix's <strong>SVD subspace</strong> — its top singular directions, the axes along which it already acts — so updates need only r×r numbers between fixed factors (the LoRA-XS trick). Second, generate even those from a tiny trainable vector v pushed through a <strong>fixed random projection</strong> that is never trained. Third, <strong>weight tying</strong>: share one v across modules and layers (“tiled” across depth works best). The trainable count becomes whatever length you choose for v — down to one.`),

    shrinkScene(),                       // its caption is the prose below
    prose(
      `<em>${figRef('adaptation', 'shrink')} — the same weight matrix, three philosophies. Nine orders of magnitude between the first column and the last.</em>`,
      `The headline result: trained with GRPO (${chRef('posttraining')}) on math problems, a 13-parameter TinyLoRA takes Qwen2.5-7B-Instruct from 76% to ~91.8% on GSM8K — near full-fine-tuning territory, with an update that fits in this sentence. Across harder benchmarks (MATH500, AIME, AMC) the method recovers ~90% of the fine-tuning gains while training ~1000× fewer parameters. Even a single trained parameter buys about four points.`),
    resultsFigure(),
    prose(
      `The deeper finding is the asymmetry between training regimes: at the same tiny capacity, <strong>SFT fails where RL succeeds</strong>, needing 100–1000× larger updates to match. The interpretation is the one this whole article has been building toward.`),
    asymmetryFigure(),
    takeaway(
      `SFT must <em>absorb</em> the details of demonstrations — that takes room. RL with a verifiable reward only needs to <em>select</em>: amplify trajectories the model can already produce. Thirteen numbers cannot store the rules of algebra. They can only turn up circuits that pretraining already built. Reasoning fine-tuning, at least in this regime, is not teaching — it is <strong>activation</strong>.`),
    prose(
      `Honest caveats: the result lives where rewards are verifiable (math, code) — subjective domains may not compress this way; Qwen models respond to tiny budgets ~10× more readily than Llama for reasons nobody has pinned down; and the paper's own curiosities (fp32 beating bf16 bit-for-bit below 1 KB of update) mark this as an early map of a strange regime, not a finished theory. But the trendline is unambiguous — and it scales the right way: the bigger the base model, the fewer parameters adaptation seems to need. For a ${si(K3.totalParams)}-parameter ${K3.name}, “fine-tuning” may eventually mean a payload smaller than this paragraph.`),
    mathAside('LoRA to TinyLoRA in three equations', `
      <div class="eq">LoRA:     h = Wx + (α/r)·BAx        B ∈ ℝ^(d×r), A ∈ ℝ^(r×k), B init 0
LoRA-XS:  h = Wx + Uᵣ R Vᵣᵀ x        Uᵣ, Vᵣ = frozen top-r SVD factors of W; train R ∈ ℝ^(r×r)
TinyLoRA: h = Wx + Uᵣ mat(Pv) Vᵣᵀ x  P = fixed random projection; train v ∈ ℝⁿ</div>
      <p>B's zero-init makes ΔW = 0 at step zero — training starts from exactly the base model. In TinyLoRA, one v is shared across adapted modules (“tied”); random projections preserve enough geometry (Johnson–Lindenstrauss) for gradient signal to reach v. n is a free choice: the paper sweeps it from hundreds down to n = 1, and 13 is simply the smallest that held ~91% GSM8K on the 7–8B Qwen2.5 models.</p>`));
}
