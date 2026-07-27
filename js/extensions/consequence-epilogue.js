/* Consequence — the epilogue, and the book's last word.
   The one failure with no clean mechanical story, kept honest about that.
   The figure lives in ./fig-swiss-cheese.js. */

import { consequence, failureMode, because, workaround, chRef } from '../core/components.js';
import { swissCheeseFigure } from './fig-swiss-cheese.js';

export function render({ num }) {
  return consequence(num,
    failureMode('Jagged intelligence', `
      <p>The same model, the same session, the same settings: a clean derivation of something a
      physics graduate student would give an afternoon to, a correct proof of an Olympiad geometry
      problem — and then, asked whether 9.11 is bigger than 9.9, the wrong answer, delivered with the
      identical composure. Not a harder version of the question. That one. Count the letters in a
      word, keep a tally across a list, compare two version numbers: somewhere in the vicinity of
      what it just did effortlessly, there is a hole.</p>
      <p>The jaggedness is the part that matters, more than any individual example. In a person,
      competence falls off roughly with difficulty, so a few questions tell you where the edge is. A
      model's surface is close to flat across an enormous range and then, at no visible landmark,
      absent — and it gives no warning at the boundary, because the register of a wrong answer is the
      register of a right one. You find the voids by stepping in them.</p>`),

    swissCheeseFigure(),

    because(`
      <p><strong>Every other failure in this book had a mechanism, and this one does not.</strong>
      That is worth stating plainly rather than papering over. Spelling failures follow from what
      ${chRef('tokens')} does to characters. The arithmetic and counting failures follow from the
      fixed compute a single forward pass can spend, in ${chRef('inference')}. Confident invention
      follows from a demonstration set in which nobody ever declined, in ${chRef('posttraining')}.
      Each of those is a derivation: given the mechanism, the failure is what you would predict.
      Jaggedness is not. There is no account here that would have let you predict, before testing,
      that this model fails on this comparison.</p>
      <p>The most-cited clue is interpretability work on exactly the 9.11 case: features associated
      with chapter-and-verse strings — Bible verses, software version numbers, the kinds of text
      where 9.11 does come after 9.9 — activating on the comparison. It is a real finding, and it is
      not an explanation. It does not say why that reading wins over the arithmetic the same weights
      perform correctly a line earlier; it was found after the fact, for one prompt, by people who
      already knew the answer; and it predicts no other hole. A clue, not a theory.</p>
      <p>What can be said from mechanism is weaker and more general, and it is the honest limit of
      this book. Nothing in the objective ever asked for uniformity. The pretraining loss is an
      average over an enormous corpus, and an average is indifferent to where its errors sit —
      spending capacity on a common pattern at the cost of a rare one is a good trade by that
      measure. Post-training reshapes behavior on the distribution of prompts someone thought to
      collect. Capability assembled that way is a patchwork of what was in the data, weighted by how
      often, with no term anywhere rewarding a smooth frontier. A surface built like that has no
      reason to be continuous. That explains why holes <em>exist</em>. It does not locate one.</p>`),

    workaround(`
      <p><strong>Treat it as a tool with a jagged edge, which is a working habit rather than an
      attitude.</strong> Prefer tasks where checking the output is cheaper than producing it —
      running the code, following the derivation, opening the citation. Spend the checking effort on
      the small, mechanical steps rather than the impressive ones, because that is where the voids
      have been found so far, and difficulty is not the axis they lie along. When something has to be
      exactly right, make the model produce it in a form a machine can verify. And keep your own map:
      the holes you have hit in your own work are better evidence about your next prompt than any
      benchmark, and they move with every release.</p>
      <p>What does not follow is distrust of the mechanism. Nothing in the preceding chapters was
      wrong, and nothing about the machine is hidden from you now: the tokenizer, the residual
      stream, the attention pattern, the router, the optimizer, the reward. It is doing exactly what
      it was built to do. What you have learned is not enough to predict where it will fail, and
      after everything, that is the honest ending — you now know precisely how it works, and it will
      still surprise you. Keep it where its work can be checked, and it remains the most useful
      instrument in the room.</p>`),
  );
}
