/* The base model — what the run of the previous chapter actually hands you.
   Not an assistant: a simulator of internet documents, sampled one token at a
   time out of a lossy compression of the crawl.

   Spine only. Each figure lives beside this file and claims its own number,
   in the order it is called here.

     scene-continuation.js  key 'continuation'  — prefix → distribution → sample
     fig-worlds.js          key 'worlds'        — one prompt, three draws
     fig-compression.js     key 'compression'   — the lossy zip, and its unevenness
     fig-drift.js           key 'drift'         — recite, then invent
     fig-icl.js             key 'icl'           — learning from the prefix alone
     fig-transcript.js      key 'transcript'    — an assistant, by prompt       */

import { chapter, chapterHead, prose, term, mathAside, takeaway, claimFig, chRef, figRef } from '../../core/components.js';
import { K3 } from '../../../data/k3.js';

import { continuationScene } from './scene-continuation.js';
import { worldsFigure } from './fig-worlds.js';
import { compressionFigure } from './fig-compression.js';
import { driftFigure } from './fig-drift.js';
import { iclFigure } from './fig-icl.js';
import { transcriptFigure } from './fig-transcript.js';

export function render({ id, num, title }) {
  /* The scene's caption sits in the prose beneath it, so it claims its number
     here — ahead of every figure further down the page. */
  claimFig('continuation');
  const scene = continuationScene();

  return chapter(id,
    chapterHead(num, 'What falls out', title),
    prose(
      `${chRef('pretraining', { cap: true })} spent months of cluster time and finished. What came off the end of it is a file of numbers — a <strong>base model</strong> — and it is worth being precise about what that file can do, because almost every intuition people carry about chatbots belongs to the next chapter rather than this one.`,
      `A base model answers exactly one question, the one from ${chRef('objective')}: <em>given this prefix, what token comes next?</em> It was never shown an instruction and never scored on being useful. It was scored, some fifteen trillion tokens in a row, on predicting documents. So what you have is a document simulator: hand it any string and it will extend that string into something the internet plausibly contains. Ask it a question and it does not answer — it continues.`),

    scene,
    prose(
      `<em>${figRef('base-model', 'continuation')} — the base model's entire operation: one distribution over the vocabulary, one sampled token, appended, repeat. The token <code>4</code> is present and correctly weighted; it is not what a worksheet does next.</em>`),
    term('base model', 'n.', `the direct output of pretraining: a next-token predictor over documents, with no notion of a user, a turn, an instruction, or a refusal. Occasionally released on its own — GPT-2 (OpenAI, 2019), Llama&nbsp;3.1&nbsp;405B base (Meta, 2024), OLMo&nbsp;2 (AI2, 2024–25) — and increasingly not`),

    prose(
      `That is not a bug and it is not a refusal. Nothing in the objective ever mentioned answering; the model is doing precisely the job it was optimized for, and doing it well. The distance between &ldquo;predicts documents accurately&rdquo; and &ldquo;does what I asked&rdquo; is the entire subject of ${chRef('posttraining')}.`,

      `<strong>It is stochastic, not a lookup.</strong> Because the last step is a <em>draw</em> from a distribution rather than a maximum over it, the same prefix run three times gives three different documents. That matters more than it sounds. A lookup table with no entry for your query returns nothing; a sampler always returns something, and the something is shaped by whatever the distribution had mass on. Run a prompt about a moderately obscure fact three times and you get three fluent, self-assured, mutually incompatible worlds.`),

    worldsFigure(),
    term('sampling', 'n.', `drawing the next token from the predicted distribution instead of taking its maximum. Temperature rescales the logits before the softmax of ${chRef('probability')}; top-k and top-p truncate the tail first. Greedy decoding removes the variation between runs and not the invention — see ${chRef('inference')}`),

    prose(
      `<strong>Where the answers come from: a lossy zip of the crawl.</strong> The loss falls during training because the weights come to encode regularities in the corpus, and past a certain point the cheapest way to predict a document is to have absorbed some of its content. So the checkpoint is, in a loose but useful sense, a compression of the training set. It is worth doing the arithmetic on that, and then worth being careful about it.`),

    compressionFigure(),

    prose(
      `Two things follow from that curve, and they are one fact seen from both ends. At the right-hand end sits text the crawl saw over and over — encyclopedia leads, licence headers, famous poems, popular code snippets — much of it deliberately upsampled during the data mix of ${chRef('data', { word: 'ch.' })} because it is high quality. Prompt the model with the beginning of one and it will reproduce a long stretch of it. Then, at some point and with no warning, it stops reproducing and starts inventing, in the same voice, at the same speed.`),

    driftFigure(),

    prose(
      `At the left-hand end sits everything seen once, or never. A page the filters dropped, a paper published the week after the crawl closed, an event that has not happened yet — the model has no mass there, and no mechanism for noticing that it has none. This is the sharp edge of the <strong>knowledge cutoff</strong>. It is not a wall the model bumps into and reports; it is the point past which the distribution stops being informed by evidence and starts being informed by the shape of documents like the one being written. Prompt ${K3.name} about something that happened after its crawl closed and you get a plausible parallel world, delivered with exactly the fluency of the parts it knows. The mechanism here is the mechanism of hallucination: ${chRef('posttraining')} can teach a model to hedge, and cannot make the missing mass appear.`),
    term('knowledge cutoff', 'n.', `the date the training crawl closed. Not a boundary the model can perceive — beyond it, ${chRef('data', { word: 'ch.' })}&rsquo;s pipeline supplied nothing, so generation proceeds from genre and style alone`),

    mathAside('why the same prefix gives different documents', `
      <p>The stack emits logits z ∈ ℝ<sup>V</sup> over the ${K3.vocab.toLocaleString('en-US')}-token vocabulary, and ${chRef('probability')}&rsquo;s softmax turns them into a distribution. Decoding is a choice about what to do with it:</p>
      <div class="eq">p_i = exp(z_i / T) / Σ_j exp(z_j / T)

T → 0   ⇒  argmax — greedy, deterministic
T = 1   ⇒  the model's own distribution, unmodified</div>
      <p>Temperature T rescales before normalizing: T &lt; 1 sharpens, T &gt; 1 flattens. Top-k keeps the k largest entries and renormalizes; top-p (nucleus) keeps the shortest prefix of the sorted distribution whose mass exceeds p. All the variation across runs is this draw — the weights are frozen and the forward pass is deterministic, so two different continuations are two different sequences of uniform random numbers and nothing else. Note what temperature does <em>not</em> fix. At T&nbsp;=&nbsp;0 a model asked about something it never saw still emits its most likely completion, which is still a guess, and now a reproducible one. Sampling creates the visible disagreement between runs; it does not create the underlying absence.</p>`),

    prose(
      `<strong>And then there is the property nobody put in.</strong> Write a column of pairs — a word, an arrow, its translation — four times over, then write a fifth word and stop. The base model completes the fifth line correctly. No weight moved, no gradient was computed, and the mapping was never a training objective. The rule was inferred from the forty tokens sitting in the context window, at inference time, by the same attention machinery of ${chRef('attention')} that resolves a pronoun.`),

    iclFigure(),
    term('in-context learning', 'n.', 'inferring a task from examples in the prompt and applying it, with the weights frozen. Found as a side effect of scale — the GPT-3 paper (2020) is titled <em>Language Models are Few-Shot Learners</em> — rather than designed, and still not fully explained'),

    prose(
      `It is worth sitting with how odd this is. The training objective mentions nothing about tasks, examples, or generalizing from a handful of cases. It says: predict the next token. And a large enough model trained that way acquires the ability to pick up a rule it has never seen, hold it, and apply it — because a corpus of human documents is full of documents that set up a pattern and then continue it, and predicting those well <em>requires</em> inferring patterns on the fly. The capability is what the data's structure looks like once there is enough capacity to model it. It is also why prompting works at all, and part of why ${chRef('adaptation')} can travel so far on so few changed parameters.`,

      `<strong>Which leads to the trick.</strong> If a base model continues whatever genre it is handed, and it has read a great many transcripts of people helping each other, then you can obtain an assistant without training anything. Write the top of the conversation yourself — a framing line, one worked exchange, then a question and a bare <code>Assistant:</code> — and hand it over. It continues in character.`),

    transcriptFigure(),

    prose(
      `This worked well enough that it was, briefly, how everyone used these models, and it has three problems no amount of prompt-writing fixes. The persona is a costume rather than a commitment: reword the framing and the character changes. Quality caps out at whatever the corpus's helpful-transcript genre contains, which is not the same thing as being correct. And the model has no notion that a turn ends, because in a document it never does — so it answers, then writes your next question, then answers that one, until something outside the model cuts it off.`,
      `Every one of those is a behavior problem rather than a knowledge problem. The knowledge is already in the file, and ${chRef('pretraining')} paid for it. What is missing is a reliable way to make the model take the helpful role, stop when it is finished, and decline when it should — and installing that turns out to be far cheaper than acquiring knowledge was. ${chRef('posttraining', { cap: true })} installs it.`),

    takeaway(
      `A base model is an <strong>internet-document simulator</strong>: a lossy, unevenly reliable compression of the crawl, read out one sampled token at a time. It does not answer, it continues; it does not look up, it draws; it recites what it saw often and invents what it did not, in the same voice and with no marker between the two. It also, for nothing, learns from its own prompt. Everything the next chapter does is an attempt to aim that machine at a person — and every failure people attribute to chatbots is visible here first, in the raw artifact, before any alignment has been attempted.`),
  );
}
