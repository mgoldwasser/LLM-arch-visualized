/* Frontier — the `base-model` chapter.
   The artifact nobody can read: what it memorized, what it merely absorbed,
   how much of the finished assistant was already sitting in it, and whether
   the file should be handed out at all.                                     */

import { frontier, bottleneck, researchItem, novelIdea, chRef, figRef } from '../core/components.js';
import { fmtBytes } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

const CKPT = fmtBytes(K3.totalParams * 2);

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>The base model is the least legible object in the whole pipeline, and every
      question anyone actually wants to ask about it is currently unanswerable.</strong> Start with
      the one the chapter ends on: the artifact has no internal boundary between reciting and
      inventing. The same forward pass, the same softmax, the same draw produces a verbatim
      encyclopedia lead and a confidently attributed fabrication, and no signal in the output
      distinguishes them — a model that is uncertain about a fact and a model that is certain about
      a fiction look identical at the token level, because both are mass sitting where the
      corpus put it. Nobody can enumerate what a ${CKPT} checkpoint knows: there is no index, no
      query interface, and no way to ask "is this in there" short of prompting and hoping. That
      cuts both ways legally and practically — the same opacity that prevents a lab from certifying
      that a copyrighted document is <em>not</em> recoverable prevents anyone from certifying that
      a needed fact <em>is</em>. Memorization and generalization are not even cleanly separable
      concepts here: the mechanism that reproduces a licence header verbatim is the mechanism that
      generalizes, run at a different point on the same curve. And because the crawl has a closing
      date, a permanent and invisible fraction of every base model's output is generated from genre
      alone, with the fluency of the parts that were evidenced. Finally, nobody knows how much of a
      finished assistant is <em>already in here</em> — whether post-training installs capability or
      merely selects a persona from what pretraining built — which means nobody can price the
      alignment stage against the pretraining stage, or say what releasing the raw file actually
      hands to whoever downloads it.</p>`),

    researchItem('Memorization, extraction, and deduplication', '2021–23', 'research', `
      <p>Carlini et al.'s <em>Extracting Training Data from Large Language Models</em> (2021)
      showed that verbatim training text — including personally identifying information — can be
      pulled out of a released model by prompting alone. <em>Quantifying Memorization Across Neural
      Language Models</em> (2022) turned that into scaling laws: memorization grows with model
      capacity, with how many times a document was duplicated, and with how much context the
      prompt supplies — the same three axes as this chapter's fidelity curve. The 2023 follow-up on
      production systems demonstrated that even an aligned, deployed chat model can be pushed back
      into base-model behavior and made to emit training data. The best-established mitigation is
      upstream: Lee et al.'s <em>Deduplicating Training Data Makes Language Models Better</em>
      (2021) reported roughly an order-of-magnitude drop in emitted memorized text from
      near-duplicate removal, with perplexity slightly <em>improved</em> — which is why dedup is a
      standard stage in ${chRef('data')} rather than an optional one. What no method
      provides is a certificate: dedup reduces extraction rates without bounding them.</p>`),

    researchItem('Knowledge capacity scaling laws (Physics of Language Models)', '2024', 'research', `
      <p>Allen-Zhu and Li's controlled-synthetic-corpus line puts a number on this chapter's
      compression framing: across architectures and training budgets, models converge on storing
      roughly <strong>2 bits of knowledge per parameter</strong> once a fact has been seen enough
      times, with the rate falling sharply for facts exposed only a handful of times and improving
      when the training data is rewritten to state facts more directly. It is the cleanest existing
      account of <em>why</em> the fidelity curve has the shape it does, and it makes an uncomfortable
      prediction — capacity is finite and roughly linear in parameters, so the long tail of rare
      knowledge cannot be fixed by training longer on the same corpus. The caveat is the setting:
      these are synthetic biography-style corpora with ground-truth fact counts, which is exactly
      what makes the measurement possible and exactly what makes transfer to real web text an open
      question.</p>`),

    researchItem('What in-context learning actually is', '2022–23', 'contested', `
      <p>Four incompatible accounts are live. Olsson et al. (Anthropic, 2022) identified
      <strong>induction heads</strong> — attention circuits that find an earlier occurrence of the
      current token and copy what followed it — forming at a training phase change that coincides
      with the appearance of in-context learning; this is the mechanistic story. Xie et al. (2021)
      frame it as <strong>implicit Bayesian inference</strong>: the prompt is evidence about which
      latent document type is being generated, and the model conditions on it. Von Oswald et al.
      (2023) and Dai et al. (2022) argue transformers can implement <strong>gradient descent in the
      forward pass</strong>, constructing the update a small learner would have made from the
      examples — elegant, demonstrated in constructed linear-regression settings, and not shown to
      be what large models do on real prompts. Against all three, Min et al. (2022) found that
      replacing demonstration labels with <em>random</em> ones barely hurts performance, which
      suggests the examples often specify the task and the format rather than teaching a mapping.
      Contested is the honest label: the phenomenon in ${figRef('base-model', 'icl')} is reliable and its
      explanation is not.</p>`),

    researchItem('How much of the assistant was already there (LIMA, URIAL)', '2023', 'contested', `
      <p>Meta's LIMA (2023) fine-tuned a 65B base model on <strong>1,000</strong> curated
      examples with no RLHF and reached competitive quality, and proposed the <em>superficial
      alignment hypothesis</em>: essentially all knowledge and capability is learned in pretraining,
      and alignment mostly teaches which subdistribution of formats to speak in. URIAL (2023)
      pushed further and dropped training entirely — a system prompt plus about three in-context
      examples recovers much of a tuned model's behavior on standard benchmarks, which is this
      chapter's closing trick, measured. Both results are contested on where they were measured:
      the gap re-opens on multi-turn dialogue, instruction-following under constraint, safety
      refusals, and above all on the RLVR-trained reasoning of ${chRef('rl')}, where the
      post-training stage plainly adds capability rather than selecting it. The current synthesis —
      style is superficial, reasoning is not — is a working guess, not a finding.</p>`),

    researchItem('Release norms for raw base weights', '2019–25', 'contested', `
      <p>OpenAI's staged release of GPT-2 (2019) was the field's first explicit argument that a
      base model is dual-use, and it was widely judged an overreaction at the time. The position
      inverted with Llama 2 and Llama 3.1 405B base (Meta, 2023–24) and with AI2's OLMo line
      (2024–25), which releases weights, data, code, and intermediate checkpoints together
      specifically so that memorization and provenance questions can be studied from outside a lab.
      The counter-position has hardened in parallel: base weights have no refusals to remove
      because none were ever installed, so safety work done in post-training is, for a released
      base model, optional from the downloader's side. Several labs now ship instruction-tuned
      weights and keep the base checkpoint internal, which resolves the safety argument by
      destroying the research access that made results like the memorization and capacity work
      above possible. There is no consensus and no measurement that would settle it.</p>`),

    novelIdea('A recital detector, supervised by the corpus itself', `
      <p>The chapter's sharpest complaint is that nothing in the output marks the moment recall
      becomes reconstruction. That boundary is invisible to the reader but it is <em>not</em>
      invisible to the training lab, which has the corpus: for any generated span, a suffix-array
      lookup answers "does this n-gram occur in the training data, and how often" exactly. Proposal:
      use that lookup as an automatic label and fit a small linear probe on the base model's own
      residual stream to predict, per token, the exposure count of the span it is currently
      emitting. No human annotation is involved and no new objective touches the base weights — the
      probe is read-only, and cheap enough to run alongside decoding. If it works, the serving stack
      gets a per-token channel the model itself never had: a signal that the current sentence is
      being reconstructed from documents of this genre rather than recalled from documents of this
      content, which is the honest input to a hedge.</p>
      <p>The failure modes are the interesting part. Corpus match is a proxy for memorization and
      not memorization: an accurate paraphrase of a memorized fact scores as invention, and a
      coincidental five-gram scores as recall. The probe may well learn <em>register</em> — the
      confident encyclopedic voice — rather than provenance, in which case it fires hardest on
      exactly the fluent fabrications it exists to catch, and its errors would be correlated with
      the failure rather than independent of it. Suffix-array lookups over trillions of tokens are
      expensive enough to make labeling a data-engineering project. And the probe is fitted to the
      base model's representation, which post-training then moves. The cheapest falsification: hold
      out a slice of the corpus before training, and test whether the probe separates continuations
      of held-in documents from continuations of held-out ones better than a token-entropy baseline
      does. If it cannot beat entropy, there is nothing here.</p>`),
  );
}
