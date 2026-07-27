/* Consequence — the `inference` chapter.

   Two constraints are fixed at the instant a token is produced: the weights
   are frozen, and the pass down the stack has a fixed depth. Between them
   they account for most of what readers experience as the model being
   unreliable. Each gets a figure that lives in a sibling file:

     inference-scene-two-memories.js    key 'two-memories'
     inference-scene-compute-budget.js  key 'compute-budget'                  */

import {
  consequence, failureMode, because, workaround,
  prose, takeaway, chRef, figRef,
} from '../core/components.js';
import { si } from '../core/anim.js';
import { K3 } from '../../data/k3.js';
import { twoMemoriesScene } from './inference-scene-two-memories.js';
import { computeBudgetScene } from './inference-scene-compute-budget.js';

const L = K3.blueprint.layers;
const SRC = K3.blueprint.source.split(' (')[0];

export function render({ num }) {
  return consequence(num,
    prose(
      `This whole chapter has described one operation, repeated: a token arrives, one pass
       runs down the stack, one token comes out. Two things are fixed at that instant and
       cannot be negotiated at serving time. The weights are frozen — whatever they
       compressed during ${chRef('pretraining')} is the entire stock of recollection
       available. And the pass has a fixed <em>depth</em>: the same stack of layers whether
       the question is trivial or needs an algorithm. Nearly everything people complain
       about in these models is one of those two constraints, seen from outside.`),

    /* ---- failure 1: recollection vs. working memory ----------------------- */

    failureMode('It answers from a vague recollection when the exact text was available', `
      <p>Ask for a summary of a paper by name and you get something fluent, well-structured
      and subtly wrong: a result attributed to the wrong year, a method described as the
      thing it is usually confused with. Paste the paper in and ask the identical question,
      and the answer sharpens — quotations become verbatim, numbers become the numbers on
      the page. Same weights, same request, same sampling settings. The only thing that
      changed is where the information sat when the token was produced.</p>`),

    twoMemoriesScene(),
    prose(
      `<em>${figRef('inference', 'two-memories')} — two memories, only one of which is
       lossy. The blur is a function of how thickly the fact is attested in the training
       data; the mention counts are illustrative, the ratio is not.</em>`),

    because(`
      <p>The ${si(K3.totalParams)} parameters are a <em>compression</em> of the training
      corpus, and compression at that ratio is necessarily lossy. A fact repeated across
      millions of documents survives it redundantly; a fact mentioned three times shares
      capacity with everything else and comes back as a smear over a neighbourhood of
      plausible answers. Reading an answer out of that smear is the same operation in both
      cases — nothing in decode distinguishes a recollection that is supported from one
      that is not.</p>
      <p>The context window is a different kind of memory entirely. Text you pass in is not
      compressed at all: it is tokenized, embedded, and then present, character for
      character, in the keys and values every subsequent token attends against. The KV
      cache this chapter spent its middle on <em>is</em> that working memory, held in
      memory for the life of the request. Attending to a token that is physically there is
      retrieval; recalling one that was averaged into the weights a training run ago is
      reconstruction. That the model sounds equally sure of both is a separate mechanism,
      and it belongs to ${chRef('posttraining')}.</p>`),

    workaround(`
      <p><strong>Move the fact from the weights into the context.</strong> Paste the
      chapter, attach the file, quote the contract clause. That is also the whole point of
      tool use: a web search or a file read is not the model becoming smarter, it is a
      deliberate refusal to trust recollection when a lookup is available. Retrieval
      systems are this one move, industrialized.</p>
      <p>The price is the one this chapter already measured. Prefill is compute-bound, so a
      long paste is paid for in time-to-first-token; and the cache it leaves behind grows
      linearly with what you pasted (${figRef('inference', 'kv')}), so it is paid for again
      in memory on every remaining turn of the conversation. Pasting an entire codebase to
      ask one question is a real cost rather than a free win — but it is a cost you can
      measure, which is more than can be said for a confident smear.</p>`),

    /* ---- failure 2: fixed depth per token --------------------------------- */

    failureMode('It gets arithmetic and counting wrong — and “work through it” fixes them', `
      <p>Multiply two four-digit numbers and the answer comes back with the right magnitude
      and the middle digits wrong. Ask how many items are in a list of ninety and the count
      is off by two. Then ask the same model to work through it step by step, and it gets
      both right. Whatever failed the first time was not knowledge: the knowledge was
      evidently there the second time.</p>`),

    computeBudgetScene(),
    prose(
      `<em>${figRef('inference', 'compute-budget')} — one problem, four ways to spend a
       fixed budget. The layer stack and the required-work bars are drawn in the same unit,
       one pixel-pitch per sequential step; the ${SRC} blueprint's ${L} layers stand in for
       K3's undisclosed depth.</em>`),

    because(`
      <p>Decode gives every token exactly one forward pass. One pass is ${L} layers of
      transformation — no loops, no re-entry, no asking for more time. That budget is
      identical for the easiest and the hardest token the model will ever produce, and it
      is spent whether or not the computation it was meant to carry has finished.</p>
      <p>Some problems have an irreducibly <em>sequential</em> depth: long multiplication
      cannot do the carries in parallel, counting cannot reach item n before item n−1. When
      that depth exceeds the layer count, the work cannot complete inside one token — and a
      token is emitted anyway, because emitting is what decode does. Sampling draws from a
      distribution that exists whether or not the answer underneath it was ever computed;
      the temperature dial from earlier in this chapter changes how sharply that draw
      concentrates, never whether there was a finished computation behind it.</p>
      <p>Chain of thought follows immediately from this: it converts <em>depth</em> into
      <em>length</em>. Twelve intermediate tokens are twelve fresh passes through the same
      ${L} layers, and each one's partial result is written into the context window, where
      the next pass reads it back through the KV cache. The scratchpad is not a metaphor —
      it is the cache this chapter described. It is also what the models of ${chRef('rl')}
      were trained to discover on their own.</p>`),

    workaround(`
      <p><strong>Do not demand the answer first.</strong> “Give me only the number” forbids
      exactly the intermediate tokens the problem needs; a model told to think first and
      answer second is not being indulged, it is being handed more budget. Where the work
      is arithmetic, counting, sorting, or date manipulation, skip the chain of thought and
      <strong>ask for code</strong>: writing <code>a*b</code> costs a handful of sequential
      steps, the multiplication then runs somewhere with no ceiling, and the exact result
      arrives back as text in the context window — the previous failure's fix, applied to
      computation instead of facts.</p>
      <p>This has a price too, and it is the decode economics from the top of the chapter.
      Twelve tokens of reasoning are twelve steps, each streaming all
      ~${si(K3.activeParams)} active parameters from memory, so latency scales with how much
      thinking you asked for. Reasoning models are expensive for a mechanical reason rather
      than a commercial one.</p>`),

    takeaway(`
      Both failures are one piece of accounting, seen from its two sides. At the moment a
      token is emitted the model has exactly two resources: what it can read exactly — the
      context window, whose price is memory — and how deep it can think before it must
      speak — one pass, whose price is a decode step. Reading a chapter into the context
      window and asking a model to think out loud are not tricks. They are the two ways to
      pay for something the architecture does not give away.`));
}
