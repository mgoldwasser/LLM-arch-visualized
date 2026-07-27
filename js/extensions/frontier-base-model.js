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
      question anyone actually wants to ask about it is currently unanswerable.</strong></p>

      <p>Start with the one the chapter ends on. Reciting and inventing are not two modes the
      artifact switches between; they are the same operation. The same pass through the layers, the
      same softmax, the same draw produces a verbatim encyclopedia lead and a confidently attributed
      fabrication, and nothing in the output tells them apart. A model that is unsure of a fact and
      a model that is sure of a fiction look identical at the token level, because in both cases the
      probability is simply sitting where the corpus left it.</p>

      <p>That has a sharper consequence than it first appears. Memorization and generalization are
      not even separable concepts here. Predicting the next token from the weights is one act; when
      the corpus repeated a passage often enough, that act lands on the original words, and when it
      did not, the same act lands on something merely typical of writing like it. There is no
      second mechanism doing the reciting. So there is no component to remove, no dial to turn down
      that would suppress verbatim reproduction and leave the rest of the model intact.</p>

      <p>Nor can anyone list what is in there. A ${CKPT} checkpoint has no index and no query
      interface, and there is no way to ask "is this in there" short of prompting it and hoping.
      That cuts both ways, legally and practically: the same opacity that stops a lab from
      certifying that a copyrighted document is <em>not</em> recoverable stops anyone from
      certifying that a needed fact <em>is</em>.</p>

      <p>Two further gaps sit on top of that. Because the crawl has a closing date, a permanent and
      invisible fraction of every base model's output is generated from genre alone, delivered with
      the fluency of the parts that had evidence behind them. And nobody knows how much of a
      finished assistant is <em>already in here</em> — whether post-training installs new capability
      or merely picks out a persona that pretraining had already built. Until that is settled,
      nobody can price the alignment stage against the pretraining stage, or say what releasing the
      raw file actually hands to whoever downloads it.</p>`),

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
      <p>Four incompatible accounts are live, and only the first has a mechanism anyone has been
      able to point at inside a real model.</p>

      <p>Olsson et al. (Anthropic, 2022) found what they called <strong>induction heads</strong>:
      attention heads that do one specific thing. Given the token the model is currently looking at,
      the head searches back through the context for an earlier place where that same token appeared,
      and copies whatever came directly after it. That is most of what continuing a repeated pattern
      takes: faced with the column in ${figRef('base-model', 'icl')}, a head of this kind can find the
      earlier arrows and read off what sort of thing followed each one. These heads appear
      abruptly during training, at a point where the loss curve visibly kinks, and in-context
      learning appears at the same moment. That coincidence is the strongest evidence anyone has
      that the two are the same thing.</p>

      <p>The other three are shorter to state. Xie et al. (2021) argue the prompt is not teaching
      anything at all — it is evidence about <em>what kind of document this is</em>, and the model,
      which could already write documents of many kinds, simply narrows down to the right one. Von
      Oswald et al. (2023) and Dai et al. (2022) argue the forward pass can carry out, internally,
      the same sort of adjustment a small learner would have made from those examples — an elegant
      result, demonstrated in stripped-down settings built for the purpose, and not shown to be what
      large models do on real prompts. Against all three, Min et al. (2022) found that replacing the
      answers in the examples with <em>random</em> ones barely hurts performance, which suggests the
      examples often tell the model what task and what format rather than teaching it a mapping.</p>

      <p>Contested is the honest label: the phenomenon in ${figRef('base-model', 'icl')} is reliable and its
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
      becomes reconstruction. That boundary is invisible to the reader. It is <em>not</em> invisible
      to the lab that did the training, because the lab still has the corpus. Take any run of words
      the model has just emitted and you can look it up in the training data and count the hits —
      exactly, not approximately. The right index makes that lookup fast even over trillions of
      tokens.</p>

      <p>So the corpus can grade the model's output for free, and that grading can be used to teach
      something small to predict what the corpus would have said. The proposal: while the base model
      runs, watch the numbers moving along its residual stream, and fit the simplest possible
      readout on top of them — a weighted sum, one weight per number — trained to guess, for each
      token as it comes out, how many times the passage being emitted appeared in the training data.
      No human labels anyone. Nothing new is trained into the base model itself: the readout only
      watches, changes no weight, and is cheap enough to run alongside normal decoding.</p>

      <p>If it works, the serving stack gets a per-token channel the model itself never had — a
      running signal that the current sentence is being rebuilt from documents that merely look like
      this one, rather than recalled from documents that actually said this. That is the honest
      input to a hedge.</p>

      <p>The failure modes are the interesting part. Matching against the corpus is a stand-in for
      memorization and is not memorization: a faithful paraphrase of a memorized fact would be
      scored as invention, and five words that happen to coincide with something in the crawl would
      be scored as recall. The readout may well pick up <em>register</em> — the confident
      encyclopedic voice — rather than where the text came from, in which case it fires hardest on
      exactly the fluent fabrications it exists to catch, and its mistakes would line up with the
      failure instead of being independent of it. Counting occurrences across trillions of tokens is
      expensive enough that producing the labels is a data-engineering project in its own right. And
      the readout is fitted to the base model's internals, which post-training then moves.</p>

      <p>The cheapest way to kill the idea: set aside a slice of the corpus before training, and see
      whether the readout can tell continuations of documents the model saw from continuations of
      documents it did not. It has to beat the free alternative — how spread out the model's own
      next-token distribution is at that moment, which is already a rough measure of how undecided
      it is. If it cannot beat that, there is nothing here.</p>`),
  );
}
