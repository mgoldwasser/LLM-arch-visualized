/* Tokens & embeddings. From text to vectors the model can touch.
   Spine only — the BPE scene lives in scene-bpe.js, the embedding-lookup
   figure in fig-embedding.js. */

import { chapter, chapterHead, prose, term, mathAside, claimFig, chRef, figRef } from '../../core/components.js';
import { si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { sceneBpe } from './scene-bpe.js';
import { figEmbedding } from './fig-embedding.js';

export function render({ id, num, title }) {
  const d = K3.blueprint.dModel;

  const head = [
    chapterHead(num, 'Tokens & embeddings', title),
    prose(
      `A transformer never sees characters or words. Text is first segmented into <strong>tokens</strong> by a tokenizer — a fixed, deterministic preprocessing step trained separately from the model, almost always some variant of <strong>byte-pair encoding</strong>. BPE is a greedy compression scheme: start with an alphabet of the 256 possible bytes, count which adjacent pair of symbols occurs most often in a reference corpus, merge that pair into a new symbol, and repeat until you hit a vocabulary budget — around ${si(K3.vocab)} entries for the Kimi family. Frequent strings (<code>the</code>, <code>&nbsp;of</code>, <code>tion</code>, <code>import numpy</code>) end up as single tokens; rare ones decompose into pieces, bottoming out at raw bytes, so no input is ever <em>out of vocabulary</em>.`),
    term('byte-pair encoding', 'n.', 'iteratively replace the most frequent adjacent symbol pair with a new symbol; the learned merge list is then applied greedily at inference'),
  ];

  // The scene's caption lives in the prose paragraph that follows it.
  const bpeFig = claimFig('bpe');
  const scene = sceneBpe();

  const middle = prose(
    `<em>Fig. ${bpeFig} — BPE in action. The merge list is learned once from corpus statistics; token IDs are arbitrary indices.</em>`,
    `Token IDs are meaningless integers — 517 is not “close to” 518. The first learned component of the model gives them geometry: the <strong>embedding matrix</strong> E, with one row per vocabulary entry. Looking up token 517 means taking row 517 of E: a dense vector of dimension d_model — ${d.toLocaleString('en-US')} in Kimi K2, undisclosed but similar in K3. That width is the model’s chief internal dimension; nearly every activation you’ll meet from here on is a vector in ℝ<sup>d_model</sup>.`,
    `E starts as random noise and is trained by gradient descent like every other weight. Structure emerges because tokens used in similar contexts receive similar gradient updates: synonyms drift together, and some semantic relationships become roughly linear directions in the space. At the output end a mirror-image <strong>unembedding matrix</strong> (the “LM head”) maps the final d_model-dimensional vector back to one score per vocabulary entry — the logits that become ${figRef('objective', 'loop')}’s distribution.`);

  return chapter(id,
    head,
    scene,
    middle,
    figEmbedding(),
    mathAside('Why subwords? The case against characters and words', `
      <p><strong>Characters/bytes:</strong> sequences get ~4× longer, and self-attention cost grows quadratically in sequence length (${chRef('attention')}) — you pay ~16× compute for the same text, and long-range structure gets harder to learn. <strong>Whole words:</strong> the vocabulary explodes (morphology, names, typos, code identifiers, other languages), and anything unseen at training time becomes an unrepresentable out-of-vocabulary hole.</p>
      <p>Subwords interpolate: common strings are cheap single tokens, everything else decomposes gracefully. The cost is quirks — arithmetic on digit-chunks, “how many r’s in strawberry” — that live in the tokenizer, not the transformer.</p>`),
    mathAside('lookup as matrix multiply, tied unembedding', `
      <p>Writing token t as a one-hot vector eₜ ∈ ℝ<sup>V</sup>, the lookup is a matrix product that never gets materialized as one:</p>
      <div class="eq">x = eₜᵀ E</div>
      <p>The unembedding computes logits z = W<sub>U</sub> h_final with W<sub>U</sub> ∈ ℝ^(V×d); some models <em>tie</em> W<sub>U</sub> = E to save parameters, larger ones usually keep them separate. Softmax over z (${chRef('probability')} defines it) yields the output distribution. Embedding + unembedding ≈ 2·V·d parameters — ~${si(2 * K3.vocab * d)} at K2 scale, a rounding error against ${si(K3.totalParams)}.</p>`));
}
