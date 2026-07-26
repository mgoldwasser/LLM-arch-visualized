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
import { shapesFigure } from './fig-shapes.js';
import { workedExample } from './fig-worked-example.js';
import { coreferenceWidget } from './widget-coreference.js';
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
        { n: 'STEP 2 / 5 — SCORE', html: `<p>Token i&rsquo;s query is dotted against every token j&rsquo;s key: one similarity score per pair, forming a T×T matrix in a single multiply, S&nbsp;=&nbsp;QKᵀ. Scores are divided by √d_head — without this, dot products grow with dimension and softmax saturates into one-hot spikes with vanishing gradients.</p><p>The upper triangle is erased with −∞: the <strong>causal mask</strong>. No token may see its future — otherwise next-token training would be trivially cheatable, and one forward pass could no longer train all T positions at once.</p>` },
        { n: 'STEP 3 / 5 — NORMALIZE', html: `<p>Each row of scores passes through <strong>softmax</strong>: exponentiate every entry, divide by the row sum. Out come attention weights — non-negative, summing to 1. A masked −∞ becomes exactly 0.</p><p>This is the &ldquo;soft&rdquo; in soft lookup: instead of retrieving the single best match, the token takes a weighted blend of all of them — which keeps the whole operation differentiable, so it can be trained by gradient descent.</p>` },
        { n: 'STEP 4 / 5 — GATHER', html: `<p>Each token&rsquo;s output is the weight-averaged sum of the value vectors of the tokens it attends to. An output projection W_O maps the result back to d_model and adds it into the residual stream. Net effect: information moved between positions — attention transports, the MLP transforms.</p>` },
        { n: 'STEP 5 / 5 — MULTI-HEAD', html: `<p>One softmax per row can only express one mixing pattern — so run the whole thing h times in parallel with independent, smaller projections. Each head (${BP.heads} of them in K2) learns its own relation: some track adjacent tokens, some resolve pronouns, some find matching brackets in code.</p><p>Heads&rsquo; outputs are concatenated and mixed by W_O. Total cost per layer stays the same as one full-width head.</p>` },
      ],
    })),
    prose(`<em>${figRef(id, 'five-stages')} — one attention head in five stages: project into q/k/v, score every pair, mask and normalize, gather a weighted blend, then ×${BP.heads} heads in parallel.</em>`),

    subhead('The shapes, end to end'),
    prose(
      `The five stages compress into one line of shape bookkeeping — worth internalizing, because every attention variant in ${figRef(id, 'variants')} is just an edit to these dimensions. With K2&rsquo;s numbers (d&nbsp;=&nbsp;${BP.dModel}, d_head&nbsp;=&nbsp;${BP.dHead}, ${BP.heads} heads) and a T-token context, per head:`),
    shapesFigure(),

    subhead('Attention with actual numbers'),
    prose(
      `Shapes tell you what&rsquo;s legal; numbers tell you what&rsquo;s happening. Here is the entire mechanism for four tokens at d_head&nbsp;=&nbsp;2 — small enough to check by hand, and structurally identical to the real thing at ${BP.dHead}. Follow the highlighted row: token 3 (&ldquo;sat&rdquo;) building its output.`),
    workedExample(),

    prose(
      `Here is the mechanism doing its signature trick — pronoun resolution. In &ldquo;the trophy didn&rsquo;t fit in the suitcase because <strong>it</strong> was too big&rdquo;, grammar alone cannot tell you what &ldquo;it&rdquo; refers to; world knowledge can. Click any token to see a coreference-style head&rsquo;s weights from that token.`),
    claimed('coref', coreferenceWidget()),
    prose(`<em>${figRef(id, 'coref')} — try &ldquo;it&rdquo; (trophy vs. suitcase), then &ldquo;big&rdquo;, then &ldquo;fit&rdquo;. Values are hand-set to illustrate one coreference-style head; real models spread this across many heads and layers.</em>`),

    subhead('Where does word order come from?'),
    prose(
      `Nothing so far distinguishes &ldquo;dog bites man&rdquo; from &ldquo;man bites dog&rdquo; — attention is a set operation, blind to position. Modern models inject order with <strong>rotary position embeddings (RoPE)</strong>: before the dot product, each query and key vector is rotated, two coordinates at a time, by angles proportional to the token&rsquo;s position — clock hands spinning at many different frequencies. Rotating both q and k by their own positions leaves the dot product depending only on the <em>difference</em> of positions, so attention scores encode relative offset — which generalizes far better than absolute position and is one of the levers behind million-token contexts.`),
    term('RoPE', 'n.', 'at position <em>m</em>, rotate each (q,k) coordinate pair by <em>m</em>·θᵢ, one frequency θᵢ per pair; ⟨q_m, k_n⟩ then depends on <em>m</em>−<em>n</em> only'),
    ropeFigure(),

    subhead('The variants you’ll actually meet'),
    prose(
      `Vanilla multi-head attention has an inference problem: every past token&rsquo;s keys and values must sit in GPU memory (the KV cache — ${chRef('inference')}), and at 1M tokens × ${BP.heads} heads that is crushing. The variant zoo is mostly a series of attacks on that cost:`,
      `<strong>MHA (2017)</strong> — Every head owns its own K and V. Maximum quality, maximum cache.`,
      `<strong>MQA / GQA</strong> — All heads (MQA) or groups of heads (GQA — the Llama-family default) share one K/V set: cache shrinks 8–64×, small quality cost.`,
      `<strong>MLA (DeepSeek, K2)</strong> — Multi-head Latent Attention: cache one low-rank compressed latent per token instead of full K/V, decompress on the fly. Near-MHA quality at a fraction of the memory.`,
      `<strong>K3: ${K3.attention}</strong> — A hybrid: most layers run Kimi Delta Attention — a linear-attention form whose running state is constant-size, making cost O(T) rather than O(T²) — while a subset of layers keeps full (gated) MLA for precise long-range recall. Moonshot credits KDA with up to 6.3× faster decoding at 1M-token context. K3&rsquo;s Attention Residuals additionally let a layer pull representations from arbitrary earlier layers, not just the one below.`),
    variantsFigure(),

    mathAside('full attention in one expression', `
      <p>For one head with Q, K, V ∈ ℝ^(T×d_head) and causal mask M (Mᵢⱼ = 0 if j ≤ i, −∞ otherwise):</p>
      <div class="eq">Attn(Q,K,V) = softmax(QKᵀ/√d_head + M) V</div>
      <p>Multi-head: h copies with separate projections; concatenate the T×d_head outputs into T×d_model; multiply by W_O. The √d_head keeps score variance ≈ 1 when q,k entries are ≈ unit variance. The T×T matrix is why naive attention is O(T²) in time and memory — FlashAttention computes the identical result tile-by-tile without ever materializing it, and linear attention (KDA&rsquo;s family) replaces softmax with a kernel that admits a constant-size running state.</p>`));
}
