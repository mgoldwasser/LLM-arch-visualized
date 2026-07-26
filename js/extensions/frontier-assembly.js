/* Frontier — the `assembly` chapter (parameter arithmetic — where knowledge lives).
   Why weights are a write-once knowledge store nobody can audit, what the
   field is doing about it, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>A write-once, read-forever knowledge store.</strong> The arithmetic above says
      the experts are effectively all of the model — but consider what kind of memory that is.
      Everything pretraining learned is smeared across matrix weights that cannot be selectively
      updated (the cutoff date is frozen in), cannot be audited (no query returns "what does
      this model believe about X, and from where?"), and cannot be attributed (no register of
      which parameters hold which fact). The store is entangled by construction: the same MLP
      weights superpose thousands of associations, so editing one perturbs its neighbors in
      ways nobody can bound. And the trillions exist largely <em>because</em> recall must be
      parametric — the forward pass has no native "look it up" operation, so every retrievable
      fact must be pre-baked into weights that are then carried, at terabyte scale, through
      every single token. Capacity is over-provisioned blindly: since no one can say which
      parameters are load-bearing, the only safe amount of knowledge storage is "more".</p>`),

    researchItem('ROME & MEMIT: locate-and-edit', '2022', 'research', `
      <p>The existence proof that facts are findable: causal tracing localizes a factual
      association ("the Eiffel Tower is in <em>Paris</em>") to specific mid-layer MLPs, and a
      closed-form rank-one update rewrites it — the model then treats the edit as true,
      generalizing across phrasings. MEMIT scaled this to thousands of simultaneous edits.
      Equally important is where it breaks: sequential edits accumulate damage, ripple effects
      leave logically-entailed facts un-updated (edit the Tower to Rome and the model may still
      say you fly to Paris to see it), and the locality assumption itself is contested —
      editing <em>works</em> at locations that attribution says shouldn't matter. A tool that
      edits facts, and in doing so revealed how poorly we understand their storage.</p>`),
    researchItem('Knowledge circuits & attribution', '2024', 'research', `
      <p>The knowledge-scarcity problem attacked directly: circuit-style analyses trace which
      attention heads and MLP paths cooperate to recall a fact class, and training-data
      attribution methods (influence-function scaling, token-level tracing back to the corpus)
      ask which documents taught it. Results so far are real but narrow — recall circuits for
      specific relation types, influence estimates that remain approximations at frontier
      scale. Nothing resembling a parameter-to-fact index exists; this is the least mature line
      cited in this section, which is itself the finding: attribution lags storage by years.</p>`),
    researchItem('Memory layers at scale', '2024', 'research', `
      <p>If most parameters are a key-value store wearing a matmul costume, build the store
      honestly: Meta's memory layers replace some MLPs with trainable key-value memories —
      millions of slots, product-key lookup selecting a few per token — scaled to 128B memory
      parameters. At fixed compute, memory-augmented models beat dense baselines on factual
      tasks, since lookup touches a handful of slots instead of every weight. Sparse reads and
      writes are, in principle, individually addressable — a step toward knowledge you could
      someday edit by slot. The caveat: slots are still learned, distributed representations,
      not a legible database; addressability is necessary for auditability, not sufficient.</p>`),
    researchItem('Retrieval-augmented generation', '2020', 'deployed', `
      <p>The architectural relief valve, deployed everywhere: keep knowledge in an external
      index, retrieve at inference, and the store becomes updatable (re-index), attributable
      (cite the chunk), and auditable — everything parameters are not. But as a
      <em>substitute</em> for parametric knowledge it is contested: retrieval quality caps
      answer quality, long contexts of pasted evidence are reasoned over less reliably than
      internalized knowledge, and the model needs broad parametric competence just to know what
      to retrieve and whether to trust it. In practice RAG shifts the knowledge boundary
      outward; it has not shrunk the parameter counts of the models it augments.</p>`),
    researchItem('Model merging & task arithmetic', '2022', 'deployed', `
      <p>Treat weight-space as an algebra: subtracting a base checkpoint from a fine-tuned one
      yields a <em>task vector</em>, and these can be added, negated, and combined — merging
      recipes (task arithmetic, TIES, DARE) are standard practice in the open-source ecosystem,
      composing capabilities from separately trained models without any gradient step. That
      linear arithmetic on parameters works at all is striking evidence of structure in how
      knowledge is stored. Its limits mirror the entanglement story: merges interfere
      unpredictably as task count grows, and nobody can predict from the vectors alone which
      combinations will collide.</p>`),

    novelIdea('A write-ahead ledger for pretraining knowledge', `
      <p>Every fix above is retrofitted onto a store that was never designed for updates. The
      speculative alternative: make knowledge addressable <em>at write time</em>. Pretrain with
      a memory-layer store (as in Meta's line) plus an auxiliary objective that deliberately
      steers factual recall into memory slots and away from MLP weights — e.g. periodically
      fine-grained-dropout the MLPs on fact-recall probes so the loss is only satisfiable via
      memory lookups — while logging, during training itself, which slots each document's
      gradient touched. The log is a <em>write-ahead ledger</em>: a slot-to-source index built
      when the information is written, not reverse-engineered afterward. Editing a fact becomes
      updating slots the ledger names; auditing becomes querying it; deprecating a source
      becomes decaying its slots. Failure modes, named honestly: facts and skills may not
      separate — "Paris is the capital of France" is also grammar, geography, and association,
      and forcing recall through memory could starve the MLPs of structure they need, taxing
      the language-modeling loss; the ledger for a trillion-token corpus is enormous and
      gradient-touch is a noisy proxy for semantic responsibility (a slot touched by millions
      of documents attributes nothing); the model can cheat, memorizing in whatever pathway the
      auxiliary loss fails to police — superposition re-emerging inside the memory itself; and
      slot-level edits inherit MEMIT's ripple problem, since entailed facts live in other
      slots. Falsifiable first step: at 1B scale, measure what fraction of closed-book QA
      performance survives ablating the memory — if recall refuses to concentrate there, the
      premise fails early and cheaply.</p>`),
  );
}
