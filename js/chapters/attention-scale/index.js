/* Attention at scale. Everything about long context is a war against two
   quantities: the O(T²) score matrix (training / prefill) and the O(T) KV cache
   (decode). The attention chapter built the mechanism; the inference chapter
   shows the serving story; this one is the machinery in between — FlashAttention's
   tiling, the KV-compression lineage down to MLA's 576 dims, linear attention
   and the delta rule (KDA), hybrid layouts, and context extension.

   This file is the chapter's outline; each figure lives in its own module, and
   every number — chapter, figure, and byte — is derived, never typed in. */

import { chapter, chapterHead, prose, term, mathAside, goDeeper, takeaway, chRef, figRef } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { si } from '../../core/anim.js';
import {
  L, NH, DH, T1M, MLA_C, MLA_R, fmtBig,
  mhaAt1M, mlaPerTok, scoresOne, mhaLayerB, gqaLayerB, mlaLayerB,
  subhead, claimed,
} from './shared.js';
import { wallFigure } from './fig-wall.js';
import { flashScene } from './scene-flash.js';
import { mlaFigure } from './fig-mla.js';
import { deltaScene } from './scene-delta.js';
import { hybridFigure } from './fig-hybrid.js';
import { contextFigure } from './fig-context.js';

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'The memory wall', title),
    prose(
      `${chRef('attention', { cap: true })} ended with a variant zoo and a promise; ${chRef('inference')} will show serving splitting into a compute-bound prefill and a bandwidth-bound decode. This chapter is the war between them. Everything about long context — every kernel, every cache trick, every &ldquo;linear attention&rdquo; paper — is a campaign against exactly two quantities. The first is the <strong>T×T score matrix</strong>: training and prefill must, in principle, compare every token with every earlier token, and at T&nbsp;=&nbsp;${si(T1M)} that is 10¹² scores <em>per head, per layer</em>. The second is the <strong>KV cache</strong>: decode must hold something in memory for every past token, and whatever that something costs per token gets multiplied by a million.`,
      `Those two growth rates are the chapter&rsquo;s recurring shorthand, so it is worth saying them out loud once. The cache grows in direct step with the context: a thousand tokens in, it is a thousand times what one token cost, and that is all <strong>O(T)</strong> means. The score matrix grows with the <em>square</em> of the context: double the tokens and there are four times as many pairs to compare, ten times the tokens and a hundred times the work — <strong>O(T²)</strong>.`,
      `Put both on one axis against the only resource that exists — a GPU&rsquo;s high-bandwidth memory — and the shape of the problem is obvious: nothing fits. The rest of the chapter is the three ways out, in escalating radicalism: <em>never materialize</em> the quadratic object (FlashAttention), <em>shrink</em> what each token leaves behind (GQA&nbsp;→&nbsp;MLA), and <em>delete the per-token cache entirely</em> (linear attention&nbsp;→&nbsp;the delta rule&nbsp;→&nbsp;KDA, which runs in most of K3&rsquo;s layers).`),
    wallFigure(),

    subhead('FlashAttention: the matrix that is never built'),
    prose(
      `The crucial observation is that the T×T matrix is a <em>phantom</em>. Nothing downstream ever needs S itself — only the final weighted sum of values, one d_head-wide row per query. Naive implementations nonetheless write all of S to GPU main memory (HBM), read it back to softmax it, and write the result again. The arithmetic is nearly free on modern hardware; the <em>round-trips</em> are the cost. Attention is IO-bound, and FlashAttention (Dao et al., 2022) is the kernel that restructures it around the memory hierarchy: compute the matrix one small tile at a time in on-chip SRAM — kilobytes, but ~20× the bandwidth — and throw each tile away the moment it has contributed to the running output.`,
      `The obstacle is softmax: each row&rsquo;s normalization needs the row&rsquo;s max and sum, which you don&rsquo;t have until the sweep is over. The fix — the <strong>online softmax</strong> — is to carry running statistics and retroactively rescale. Scroll: the numbers in the panel are the real recursion, computed live.`),
    claimed('flash', createScene({
      id: 'flash-tiling',
      figure: flashScene,
      steps: [
        { n: 'STEP 1 / 4 — THE NAIVE COST', html: `<p>Materialize S = QKᵀ, write it to HBM, read it back for softmax, read it again for A·V — three round-trips through the slowest memory on the board, for an object with T² entries. At ${si(T1M)} tokens that is 10¹² scores per head per layer, ~${fmtBig(scoresOne)} each in bf16. The FLOPs were never the problem; the traffic is.</p>` },
        { n: 'STEP 2 / 4 — TILE IT', html: `<p>Split Q into row-blocks and K, V into column-blocks. Load <em>one</em> pair of K/V tiles into SRAM (a 128×${DH} bf16 tile is 32&nbsp;KB — it fits with room to spare), compute the corresponding tile of scores <em>where it lands</em>, use it, discard it. The strike-through in HBM is the whole point: S is never written anywhere.</p>` },
        { n: 'STEP 3 / 4 — ONLINE SOFTMAX', html: `<p>Softmax needs two numbers that depend on the whole row: the largest score in it, <em>m</em>, and the sum it divides by, <em>&#8467;</em>. Neither is known until the sweep has finished, so carry both as running values and correct them as you go. When a new tile turns up a larger maximum, everything accumulated so far was scaled against the old one — so multiply the running sum <em>&#8467;</em>, and the output built so far <em>O</em>, by e^(m_old &minus; m_new) to put them on the new scale, and only then add the new tile in.</p>` },
        { n: 'STEP 4 / 4 — EXACT, IO-OPTIMAL', html: `<p>The output equals naive attention <em>exactly</em> — this is a reordering of sums, not an approximation. What changes is the traffic: instead of a trip to HBM for every one of the T² scores, each tile makes one trip and is worked to death on arrival. Traffic falls from O(T²) to O(T²d²/M), where M is how much fits in SRAM at once — bigger on-chip memory, fewer trips, and that ratio is the gap in the bars. Two later versions squeeze more out of the same idea by fitting it more tightly to each new generation of GPU. Every serious stack ships one of them.</p>` },
      ],
    })),
    prose(`<em>${figRef(id, 'flash')} — the tiling dance: the T×T matrix exists only one SRAM-sized tile at a time; running (m, ℓ) statistics make the softmax exact anyway.</em>`),
    term('online softmax', 'n.', 'computing softmax in one streaming pass by carrying a running max m and denominator ℓ, rescaling previous partial results by e^(m_old−m_new) whenever the max rises'),
    mathAside('the FlashAttention update', `
      <p>Sweeping row-block i across column tiles j = 1…n, with per-tile scores Sⱼ:</p>
      <div class="eq">m⁽ʲ⁾ = max(m⁽ʲ⁻¹⁾, rowmax(Sⱼ))<br>ℓ⁽ʲ⁾ = e^(m⁽ʲ⁻¹⁾−m⁽ʲ⁾) ℓ⁽ʲ⁻¹⁾ + rowsum(e^(Sⱼ−m⁽ʲ⁾))<br>O⁽ʲ⁾ = e^(m⁽ʲ⁻¹⁾−m⁽ʲ⁾) O⁽ʲ⁻¹⁾ + e^(Sⱼ−m⁽ʲ⁾) Vⱼ</div>
      <p>and finally O = O⁽ⁿ⁾ / ℓ⁽ⁿ⁾. Expand the recursion and every score sᵢⱼ ends up weighted by exactly e^(sᵢⱼ−m)/ℓ — the softmax — so the result is exact, not approximate. The same trick makes the backward pass recomputable from (m, ℓ) alone, which is why training never stores S either.</p>`),

    subhead('Shrinking what every token leaves behind'),
    prose(
      `FlashAttention rescues prefill and training; decode&rsquo;s enemy is the other quantity. ${chRef('inference', { cap: true })} shows why: generation is bandwidth-bound, and every step must re-read the entire KV cache. So the per-token cache size is not one cost among many — it is <em>the</em> decode cost, and ten years of attention variants (sketched as bars in ${figRef('attention', 'variants')}) are attempts to shrink it. The lineage has real math worth seeing once.`,
      `<strong>GQA</strong> is arithmetic: keep all ${NH} query heads but let groups of 8 share one K/V pair. Queries stay diverse — they&rsquo;re not cached — while cached tensors shrink 8×, from ${mhaLayerB.toLocaleString('en-US')} to ${gqaLayerB.toLocaleString('en-US')} bytes per token per layer. The quality cost is small precisely because keys and values were the redundant part.`,
      `<strong>MLA</strong> (DeepSeek-V2; used by K2 and, gated, by K3) is a change of representation. Instead of caching any per-head tensors, project each token&rsquo;s stream vector down to one shared latent c<sub>t</sub>&nbsp;=&nbsp;W<sub>DKV</sub>&thinsp;x<sub>t</sub> of ${MLA_C} dims, and cache <em>that</em>. Per-head keys and values are re-derived from the latent by learned up-projection matrices at attend time — except that they never actually are. Expanding the latent and then comparing it against a query means multiplying by two matrices in a row, and two matrices in a row can be multiplied together once, ahead of time, into a single matrix. Do that and attention reads the cached latent directly; the per-head keys and values are never built at all. (Folding the up-projections into the query and output paths this way is known as the <em>absorption</em> trick.) The one thing that cannot be folded away is RoPE&rsquo;s rotation, because how far it turns depends on the token&rsquo;s position and so cannot be baked into a fixed matrix — hence a small separate ${MLA_R}-dim rotary key, cached alongside. Total: ${(MLA_C + MLA_R).toLocaleString('en-US')} values per token per layer, versus ${(2 * NH * DH).toLocaleString('en-US')} — a ${Math.round((2 * NH * DH) / (MLA_C + MLA_R))}× compression that benchmarks as <em>stronger</em> than MHA, apparently because a summary that narrow has no room for incidental detail: the same kind of deliberate handicap that dropout used to supply (${chRef('anatomy')}).`),
    mlaFigure(),
    mathAside('MLA cache arithmetic', `
      <p>Cache per token per layer, bf16:</p>
      <div class="eq">MHA:  2 · h · d_head = 2·${NH}·${DH} = ${(2 * NH * DH).toLocaleString('en-US')} values  (${mhaLayerB.toLocaleString('en-US')} B)<br>MLA:  d_c + d_rope = ${MLA_C} + ${MLA_R} = ${MLA_C + MLA_R} values  (${mlaLayerB.toLocaleString('en-US')} B)</div>
      <p>Attend-time reconstruction: kₜ⁽ʰ⁾ = W_UK⁽ʰ⁾cₜ, vₜ⁽ʰ⁾ = W_UV⁽ʰ⁾cₜ. The score is qᵀk = (W_UQ x)ᵀ W_UK c = xᵀ(W_UQᵀW_UK)c — so W_UQᵀW_UK is precomputed once and per-head keys never exist at decode; likewise W_UV is absorbed into W_O. RoPE breaks this because R_m depends on position m and sits between the two matrices — the decoupled kᴿ (rotated, cached raw, shared across heads) carries position instead. Across ${L} layers: ${fmtBig(mlaPerTok * T1M)} at ${si(T1M)} tokens, vs ${fmtBig(mhaAt1M)} for MHA.</p>`),

    subhead('Deleting the cache: linear attention and the delta rule'),
    prose(
      `The radical option: stop caching per-token data altogether. Softmax is the obstacle — remove it and attention&rsquo;s output Σⱼ&thinsp;vⱼ(kⱼᵀq) factors as (Σⱼ&thinsp;vⱼkⱼᵀ)&thinsp;q. That parenthesized sum is a single d×d matrix — a <strong>state</strong> — and folding one more token into it costs the same whether it is the second token or the millionth, O(1) per token: S&nbsp;+=&nbsp;v&thinsp;kᵀ. Memory constant in T; total time O(T) instead of O(T²). Attention becomes a recurrence again — but one made of matmuls, not the sequential bottleneck ${chRef('attention')} said transformers escaped.`,
      `The catch is that S is a <em>lossy sum</em>. Writes are never removed; similar keys overwrite each other; d² floats cannot faithfully store a million associations. Early linear attention blurred — fine at perplexity, poor at recall. The fixes arrived in two stages, and both are visible in the state matrix as you scroll: <strong>gating</strong> (decay the past), and the <strong>delta rule</strong> — before writing, ask the state what it <em>already predicts</em> for this key, and write only the error.`),
    claimed('delta', createScene({
      id: 'delta-state',
      figure: deltaScene,
      steps: [
        { n: 'STEP 1 / 5 — DROP THE SOFTMAX', html: `<p>Left: softmax attention appends (k, v) per token, forever — the strip <em>is</em> the O(T) cache. Right: without softmax the same information folds into one d×d state, S += v&thinsp;kᵀ, and a query just reads Sq. Constant memory. The frame never grows.</p>` },
        { n: 'STEP 2 / 5 — WHY IT BLURS', html: `<p>Keep feeding tokens and the state saturates: every cell is a superposition of everything ever written. When two keys point the same way (red flash), their values interfere — retrieval returns a mixture. This is the classic fast-weight/associative-memory capacity problem, and why naive linear attention lost to softmax for a decade.</p>` },
        { n: 'STEP 3 / 5 — GATE IT', html: `<p>First fix: forget. A decay α&thinsp;&lt;&thinsp;1 per step (Mamba-2, gated linear attention lineages) fades old associations so recent ones stay crisp — recency built into the dynamics. But forgetting is indiscriminate: it erases what you still need along with what you don&rsquo;t, and it still never <em>corrects</em> anything.</p>` },
        { n: 'STEP 4 / 5 — THE DELTA RULE', html: `<p>The sharper fix (DeltaNet lineage): treat S as a memory under supervision. <em>Read</em> the state&rsquo;s current prediction v̂ = Skₜ for the incoming key; compute the <em>error</em> vₜ − v̂; <em>write</em> β× the error. If the state already knows this association, nothing is written; if it holds a stale value, it is actively overwritten — S(I − βkkᵀ) erases before + βvkᵀ replaces. An error-correcting memory, not a heap.</p>` },
        { n: 'STEP 5 / 5 — KDA', html: `<p><strong>Kimi Delta Attention</strong> = the gated delta rule made fine-grained: a decay <em>per channel</em> (the teal gates), not one scalar per head — some coordinates hold information for thousands of tokens, others refresh constantly. A chunked formulation keeps it matmul-shaped for tensor cores. This runs in roughly three of every four K3 layers; Moonshot credits the hybrid with up to 6.3× faster decode at ${si(T1M)} tokens.</p>` },
      ],
    })),
    prose(`<em>${figRef(id, 'delta')} — the growing cache vs the constant state, with the delta-rule write as read&nbsp;→&nbsp;error&nbsp;→&nbsp;correction. Cell intensities are a real simulation of all three update rules on the same seeded token stream.</em>`),
    term('delta rule', 'n.', 'update a fast-weight memory by the <em>prediction error</em>: S ← S(I − βkkᵀ) + βvkᵀ — erase the state&rsquo;s current answer for key k, write the corrected one; Widrow &amp; Hoff (1960), reborn in DeltaNet'),
    goDeeper('the state is a tiny model, being trained while you read', `
      <p><strong>The claim, first.</strong> That running state is not a container that tokens get dropped into. It is a very small model, and the delta rule is not a storage convention &mdash; it is the same learning procedure ${chRef('learning')} describes, applied once per token, in the middle of the forward pass. The layer trains a little model on your prompt while it reads your prompt.</p>
      <p><strong>What the little model is asked to do.</strong> Give it a key and it should hand back the value that was filed under that key. That is a job with a right answer, so it can be graded: hand it the incoming key, look at what comes back, and compare that against the value this token actually wants stored. The difference is an error &mdash; and read, measure the error, take a small step against it is exactly the loop that trained the network in the first place. Run the algebra in the aside below and the delta rule comes out of that loop unchanged, not merely resembling it.</p>
      <p><strong>So β is a learning rate.</strong> The one free number in the update sets how big that step is. Keep it small and no single token can move the memory much, so old associations survive a long time; make it large and each token can overwrite what it finds. Because the model chooses β per token, it is deciding, as it goes, how strongly this particular token should be allowed to rewrite what it has already stored.</p>
      <p><strong>Two speeds of learning, at once.</strong> This is worth sitting with, because it is genuinely strange. The network&rsquo;s weights stopped moving when training ended; at serving time they are constants. The state matrix is the opposite &mdash; it is fitted from scratch on every request, out of that request&rsquo;s own tokens, and thrown away when the request ends. Two learning processes are running at wildly different speeds: the slow one that produced the model, and a fast one the model performs on its own input. The old name for the second, <em>fast weights</em>, comes from precisely this. Where the analogy stops: the fast learner has no freedom. It cannot change its own rule, it has one fixed-size place to put things, and the only thing it is capable of learning is an association from keys to values.</p>`),

    mathAside('the delta rule as gradient descent', `
      <p>One step of SGD on the associative loss L(S) = ½‖Sk − v‖² with step size β:</p>
      <div class="eq">S ← S − β ∇L = S − β(Sk − v)kᵀ = S(I − βkkᵀ) + βvkᵀ</div>
      <p>— identical to the delta rule. KDA refines the gated variant Sₜ = Sₜ₋₁(Diag(αₜ))(I − βₜkₜkₜᵀ) + βₜvₜkₜᵀ with αₜ ∈ (0,1)^d learned per channel, and evaluates it in chunks: within a chunk of ~64 tokens, the products unroll into dense matmuls (a WY-style representation); only the chunk-boundary state is carried recurrently. That is what &ldquo;hardware-efficient&rdquo; means here: the recurrence exists mathematically but the GPU mostly sees GEMMs.</p>`),

    subhead('Hybrids: why K3 keeps some full attention'),
    prose(
      `A constant-size state has a hard information-theoretic ceiling: d² numbers cannot support <em>exact</em> retrieval from an arbitrary million-token past, and it shows — pure linear-attention stacks degrade on needle-in-a-haystack and long-range verbatim tasks precisely where softmax attention, which keeps everything, is trivially perfect. The field&rsquo;s convergent answer is not to choose but to <em>interleave</em>: mostly-cheap layers for throughput, a lattice of full-attention layers for recall.`),
    hybridFigure(),

    subhead('Train short, serve long'),
    prose(
      `One wall remains, and it is not memory: no one pretrains at ${si(T1M)} tokens. Models train mostly at 4–32k and are <em>extended</em> — which works because RoPE (${chRef('attention')}&rsquo;s clock hands) encodes only relative offsets that can be rescaled after the fact. <strong>Position interpolation</strong> compresses unseen positions into the trained range by spinning every dial slower. That turned out to cost something: the fastest dials are the ones that tell neighboring tokens apart, and slowing them blurs exactly that local detail. The methods that followed therefore slow each frequency by a different amount — leaving the fast dials nearly alone and compressing the slow ones hardest. <strong>YaRN</strong>, the best known of them, refines this band by band and adds a small sharpening adjustment to the softmax on top, buying 10–100× extensions after a brief fine-tune. This family, plus long-context mid-training, is how every &ldquo;1M-token&rdquo; number on a spec sheet — K3&rsquo;s included — actually happens.`,
      `Two honest footnotes. Softmax rows must sum to 1, so heads with nothing to say park their attention mass somewhere — overwhelmingly on the first few tokens. These <strong>attention sinks</strong> are load-bearing: evict them from a sliding-window cache and generation collapses; keep just them plus a recent window (StreamingLLM) and a model streams indefinitely in constant memory. And capacity is not comprehension: retrieval quality sags for facts buried mid-context (&ldquo;lost in the middle&rdquo;), so a saturated needle-in-a-haystack score is a floor, not a ceiling, on what long context means.`),
    term('attention sink', 'n.', 'early tokens (often position 0) that absorb surplus attention mass because softmax must put it somewhere; keeping them is what makes sliding-window streaming stable'),
    contextFigure(),

    takeaway(
      `The memory wall never moved — ${fmtBig(mhaAt1M)} of naive cache and 10¹² scores per head were never going to fit in ${fmtBig(192e9)} of HBM. What moved is what attention <em>stores</em>: tiles instead of matrices, ${MLA_C + MLA_R} latent dims instead of ${(2 * NH * DH).toLocaleString('en-US')}, a fixed error-correcting state instead of a cache at all — and a 3:1 hybrid to keep recall exact. Compound those and you get K3&rsquo;s claim: up to 6.3× faster decode at ${si(T1M)} tokens. Not one breakthrough — three compressions deep, multiplied.`));
}
