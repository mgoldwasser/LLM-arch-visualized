/* Frontier — the `tokens` chapter (tokens & embeddings).
   Why a frozen BPE tokenizer is the model's weakest interface, what the
   field is doing about it, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';
import { si } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>A frozen, greedy compressor chosen before training and never revisited.</strong>
      The tokenizer is the only part of the pipeline that is not learned end-to-end: its merge
      list fossilizes the statistics of some reference corpus into the model's permanent
      interface. The quirks compound. Digits chunk arbitrarily ("2024" one token, "2025" maybe
      two), sabotaging arithmetic; character-level structure is invisible, so "how many r's in
      strawberry" asks the model about objects it literally cannot see; low-resource languages —
      underrepresented when the merges were counted — pay 3–10× more tokens for the same content,
      which is simultaneously an API-cost tax and a context-window tax on exactly the users with
      the least leverage. Rare merges that survived training with almost no gradient become
      <em>glitch tokens</em> — vocabulary entries with near-untrained embeddings that produce
      bizarre, occasionally exploitable behavior. And the vocabulary size itself is a blunt
      hyperparameter: it trades sequence length against embedding parameters and softmax cost,
      it interacts with model scale, and nobody can afford to ablate it at frontier scale — so
      it is set once, by convention, and everything downstream inherits the choice.</p>`),

    researchItem('Byte Latent Transformer', '2024', 'research', `
      <p>Meta's BLT deletes the tokenizer entirely: a small byte-level model estimates the
      entropy of the next byte, and the stream is segmented into <em>patches</em> at entropy
      spikes — long patches through predictable stretches, short ones where text gets hard. A
      lightweight encoder pools bytes into patch vectors for the large latent transformer, and a
      decoder unpools on the way out. Compute is spent where the signal is, not where whitespace
      happens to fall, and in flop-controlled comparisons up to 8B parameters BLT matched
      tokenizer-based baselines while being robust to spelling-level perturbations that break BPE
      models. Frontier-scale parity is unproven.</p>`),
    researchItem('ByT5 and the byte-level lines', '2021', 'research', `
      <p>The direct approach — feed raw bytes, no merges at all — was tried early (ByT5, CANINE,
      Charformer). It works, and it is markedly more robust to noise, typos, and morphologically
      rich languages. The reason it lost: sequences grow ~4×, attention cost grows with the
      square of that, and per-byte inference is punishingly slow. Byte-level modeling didn't fail
      on quality; it failed on economics — which is exactly the constraint the patching
      approaches above are engineered to remove.</p>`),
    researchItem('SuperBPE', '2025', 'research', `
      <p>BPE's whitespace pretokenization forbids merges across word boundaries, so "by the way"
      can never become one token despite being a single unit of meaning. SuperBPE lifts the
      restriction in a second training phase, learning <em>superword</em> tokens that cross
      spaces. Same vocabulary budget, substantially fewer tokens per document — and an 8B model
      trained on it outperformed its ordinary-BPE twin on downstream tasks at fixed compute.
      Evidence that even within the BPE paradigm, the standard recipe is leaving compression on
      the table.</p>`),
    researchItem('Vocabulary scaling laws', '2024', 'research', `
      <p>Treating vocabulary size as a scaling-law variable rather than folklore: fitting
      compute-optimal curves shows the best vocabulary grows with model scale, and that most
      deployed LLMs are trained with vocabularies <em>smaller</em> than optimal for their size
      ("larger models deserve larger vocabularies"). A first-principles answer to a hyperparameter
      that had been set by convention — though the fits are at research scale, and extrapolating
      them to ${si(K3.totalParams)}-parameter models is still extrapolation.</p>`),
    researchItem('Tokenizer transplants & vocabulary adaptation', '2023', 'research', `
      <p>If the tokenizer is frozen, can it at least be swapped after the fact? A line of work
      (WECHSEL, FOCUS, and successors) initializes embeddings for a <em>new</em> vocabulary from
      the old one — mapping new tokens to weighted combinations of semantically or
      orthographically overlapping old tokens — then heals the model with a short continued
      pretraining run. Used in practice to extend English-centric models to other languages and
      to specialize vocabularies for code or medicine. It works, with a real but recoverable
      quality dip; the deeper limitation is that the model's internal features were shaped by the
      old segmentation and only partially transfer.</p>`),

    novelIdea('A contextual retokenizer inside the model', `
      <p>Keep bytes at the interface, but let the <em>model</em> decide the segmentation — per
      input, in context. Insert a thin learned layer after the byte embeddings that scores each
      boundary and merges spans into variable-length groups (pooled by a tiny attention head),
      trained end-to-end with the language-modeling loss through a straight-through estimator.
      Unlike BPE the grouping could then be conditional: "2024" pools into one unit inside prose
      but stays digit-separated inside arithmetic; a rare name segments differently on its second
      mention than its first, because the context has changed. This is BLT's patching idea pushed
      one step further — segmentation conditioned on <em>semantics</em>, not just on local byte
      entropy. The failure modes are concrete: discrete merge decisions make gradients biased and
      high-variance (straight-through and Gumbel relaxations are notoriously finicky at scale);
      variable-length pooling breaks the static tensor shapes that batched training and serving
      depend on; the layer could collapse to a trivial fixed segmentation, reinventing BPE
      expensively; and during generation, a boundary decision that shifts mid-sequence would
      invalidate cached state, so the KV cache would need patch-level versioning. A honest first
      test is small: does a 1B-parameter contextual retokenizer beat entropy-based patching at
      equal flops, on arithmetic and cross-lingual benchmarks specifically?</p>`),
  );
}
