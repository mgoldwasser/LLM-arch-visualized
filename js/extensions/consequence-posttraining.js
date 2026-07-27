/* Consequence — the `posttraining` chapter.
   What this chapter's machinery predicts: a model that has learned the STYLE
   of a confident answer, from a demonstration set in which every answer was
   confident. The figure lives in ./fig-hallucination.js. */

import { consequence, failureMode, because, workaround, chRef, figRef } from '../core/components.js';
import { hallucinationFigure } from './fig-hallucination.js';

export function render({ num }) {
  return consequence(num,
    failureMode('Hallucination', `
      <p>Ask about a person, a paper, a court case or an API method that does not exist, and the
      answer arrives in exactly the register of an answer that is correct: fluent, specific, dated,
      the right length. Ask again in a fresh session and you may get a different person, equally
      specific and equally dated. Nothing in the text marks the difference. The fabricated answer is
      not hedged, not shorter, not vaguer, not stylistically distinct in any way you could filter
      on — which is what makes it expensive, because the reader's usual cue for &ldquo;this source is
      unsure&rdquo; has been trained out of the channel.</p>
      <p>${figRef('posttraining', 'hallucination')} runs the demonstration: one prompt, three
      samples, three mutually contradictory biographies of a man who does not exist.</p>`),

    hallucinationFigure(),

    because(`
      <p><strong>SFT is imitation learning, and imitation copies form as readily as content.</strong>
      The demonstrations are conversations rendered through the chat template, with loss computed on
      the assistant's tokens — so what the model fits is the mapping from a question to the
      <em>shape</em> of a good answer. Now consider what a biography question looks like in that set.
      Every &ldquo;who is X&rdquo; pair was written about someone the labeler could look up, and
      answered confidently, because an evasive demonstration would be a bad demonstration. There is
      no example of the assistant declining. So the pattern available to be learned is: a question of
      this form is followed by a fluent, particular, self-assured paragraph. Nothing in that pattern
      is conditioned on whether the model has the facts. Presented with a name it has never seen, it
      produces the only continuation it has ever been shown — and the base model underneath
      (${chRef('base-model')}), a document continuator to the end, is entirely capable of inventing a
      plausible one.</p>
      <p>The uncomfortable part: the network may well represent its own uncertainty. Probing work
      keeps finding internal signals that track whether a model knows an entity, sitting there while
      the model confabulates anyway. If that is right, the failure is not that the information is
      missing but that <em>nothing in training ever wired it to the output</em>. Refusal is a
      behavior, and behaviors come from post-training; a behavior that appears in zero demonstrations
      has no route into the weights. The reward stages do not rescue it either — a confident answer
      and a hedge look much the same to a ranker who does not know the answer, and confidence tends
      to win. The RLVR stage above would catch it — a verifier cannot be flattered —
      but there is no verifier that returns 1 or 0 for &ldquo;who is this person&rdquo;.</p>`),

    workaround(`
      <p><strong>The training-side fix is the one the figure shows, and it is a data fix, not an
      architectural one.</strong> Interrogate the model against facts you can check — generate
      questions from a known corpus, sample answers several times, score them automatically — and use
      the disagreement to map where knowledge ends. Then add training examples whose correct
      completion is a refusal, so &ldquo;I don't know&rdquo; becomes a demonstrated behavior with a
      gradient behind it rather than an absent one. Meta describe this procedure as
      <em>factuality</em> in the Llama 3 paper; the coverage of the resulting model is exactly the
      coverage of the interrogation set, which is why a model can refuse gracefully on the entity
      types someone thought to probe and confabulate on the ones they did not.</p>
      <p><strong>Reader-side, the cheapest detector is the figure itself.</strong> Ask the same
      question in three independent sessions at a non-zero temperature. Facts that were retrieved are
      stable across samples; facts that were generated to fit the shape of an answer are not. Three
      answers that agree on a specific are worth provisionally believing; three that disagree are
      diagnostic, and one answer alone tells you nothing at all. Treat every unverifiable
      particular — a citation, a version number, a date, a quoted line — as a claim to check rather
      than a fact to copy.</p>
      <p>Name the model and the date when you report one of these. The Falcon-7B-Instruct
      demonstration is from early 2025; a lab that reads it patches those names, and a claim that
      &ldquo;models hallucinate biographies&rdquo; ages into a claim about one checkpoint. What does
      not age is the mechanism: as long as refusal is a behavior that has to be demonstrated, a model
      is confident wherever nobody demonstrated otherwise.</p>`),
  );
}
