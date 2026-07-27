/* Tokens & embeddings. From text to vectors the model can touch.
   Spine only — the representation ladder lives in scene-ladder.js, the BPE
   scene in scene-bpe.js, the embedding-lookup figure in fig-embedding.js. */

import { chapter, chapterHead, prose, term, mathAside, goDeeper, claimFig, chRef, figRef } from '../../core/components.js';
import { si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { sceneLadder } from './scene-ladder.js';
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

  // Each scene's caption lives in the prose paragraph that follows it, so the
  // number is claimed here, in the order the reader meets it.
  const ladderFig = claimFig('ladder');
  const ladder = sceneLadder();

  const afterLadder = prose(
    `<em>Fig. ${ladderFig} — the representation ladder. Sequence lengths are measured from the sentence itself; the token row is segmented by a miniature illustrative merge list rather than a production ${si(K3.vocab)}-entry one.</em>`,
    `Read the ladder as a single trade, made once and then frozen for the life of the model. Bits give you a two-symbol alphabet and a sequence eight times longer than the byte string. Bytes give you 256 symbols and one position per byte. Merges buy positions back by spending vocabulary — and the two currencies are not exchanged at the same rate. Vocabulary is paid for once, in embedding rows and in the width of the output softmax (${figRef('tokens', 'embedding')}); sequence length is paid for on every token of every request, and attention makes that cost quadratic (${chRef('attention')}). BPE sits where it sits because of that asymmetry, and the rest of this chapter is what living with the compromise does to the model.`);

  const bpeFig = claimFig('bpe');
  const scene = sceneBpe();

  const middle = prose(
    `<em>Fig. ${bpeFig} — BPE in action. The merge list is learned once from corpus statistics; token IDs are arbitrary indices.</em>`,
    `Token IDs are meaningless integers — 517 is not “close to” 518. The first learned component of the model gives them geometry: the <strong>embedding matrix</strong> E, with one row per vocabulary entry. Looking up token 517 means taking row 517 of E: a dense vector of dimension d_model — ${d.toLocaleString('en-US')} in Kimi K2, undisclosed but similar in K3. That width is the model’s chief internal dimension; nearly every activation you’ll meet from here on is a vector in ℝ<sup>d_model</sup>.`,
    `E starts as random noise and is trained by gradient descent like every other weight. Structure emerges because tokens used in similar contexts receive similar gradient updates: synonyms drift together, and some semantic relationships become roughly linear directions in the space. At the output end a mirror-image <strong>unembedding matrix</strong> (the “LM head”) maps the final d_model-dimensional vector back to one score per vocabulary entry — the logits that become ${figRef('objective', 'loop')}’s distribution.`);

  return chapter(id,
    head,
    ladder,
    afterLadder,
    scene,
    middle,
    figEmbedding(),
    goDeeper('Why subwords? The case against characters and words', `
      <p><strong>The one-sentence version.</strong> There are two obvious ways to cut text into pieces &mdash; one piece per character, or one piece per word &mdash; and each fails badly, in opposite directions. Subwords are what you get by refusing both failures.</p>
      <p><strong>Why not one piece per character?</strong> English runs to roughly four characters per token, so a character-level model reads about four times as many pieces for the same page of text. That would be merely annoying if the cost rose in step with the length. It does not. Attention compares every token against every earlier one (${chRef('attention')}), so four times the pieces is something like sixteen times the comparisons &mdash; the same paragraph, for sixteen times the work. And the pieces themselves carry less: whatever relates <code>cat</code> to <code>dog</code> now has to be reassembled from six separate letters, and any pattern that spans a paragraph now spans four times as many positions.</p>
      <p><strong>Why not one piece per word?</strong> Because the list never closes. You need entries for <code>run</code>, <code>runs</code>, <code>running</code>, <code>runner</code> and <code>rerun</code>; for every surname, brand and typo; for <code>getUserById</code> and every other identifier a programmer has ever invented; and then again for every language that is not English. The size is survivable. What is not survivable is the edge: a word the tokenizer never met while it was being built has no entry at all, so there is simply nothing to hand the model. That hole has a name &mdash; the word is <strong>out of vocabulary</strong> &mdash; and it is not a rare event, because ordinary text invents words constantly.</p>
      <p><strong>What subwords buy.</strong> A merge list counted from real text spends its entries where they pay. <code>the</code>, <code>tion</code> and <code>import numpy</code> each earn a slot because they turn up relentlessly; an unusual surname does not, and gets spelled out of smaller pieces instead. Common text stays short, unusual text gets longer but is always writable, and because the pieces bottom out at raw bytes, nothing is ever unrepresentable. Nothing is out of vocabulary. Some things are just expensive.</p>
      <p><strong>What it costs.</strong> The compromise does have a bill, and it arrives in one specific place: the model never sees inside a piece. <code>strawberry</code> is two or three opaque blocks, not ten letters, and a long number is chopped up by which digit strings are common rather than by place value. Those are the tokenizer&rsquo;s failures, not the transformer&rsquo;s &mdash; and the end of this chapter is what they look like from the outside.</p>`),
    mathAside('lookup as matrix multiply, tied unembedding', `
      <p>Writing token t as a one-hot vector eₜ ∈ ℝ<sup>V</sup>, the lookup is a matrix product that never gets materialized as one:</p>
      <div class="eq">x = eₜᵀ E</div>
      <p>The unembedding computes logits z = W<sub>U</sub> h_final with W<sub>U</sub> ∈ ℝ^(V×d); some models <em>tie</em> W<sub>U</sub> = E to save parameters, larger ones usually keep them separate. Softmax over z (${chRef('probability')} defines it) yields the output distribution. Embedding + unembedding ≈ 2·V·d parameters — ~${si(2 * K3.vocab * d)} at K2 scale, a rounding error against ${si(K3.totalParams)}.</p>`));
}
