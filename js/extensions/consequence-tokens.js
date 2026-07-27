/* Consequence — the `tokens` chapter. The reader-facing failure that this
   chapter's own machinery predicts: a model that was never shown letters
   cannot be asked about letters. Everything invoked here — the greedy merge
   list, the integer IDs, the embedding row — was taught above. */

import { consequence, failureMode, because, workaround, chRef, figRef } from '../core/components.js';
import { frag } from '../core/dom.js';
import { spellingWidget } from '../chapters/tokens/widget-spelling.js';

export function render({ num }) {
  return frag(consequence(num,
    failureMode('It cannot spell', `
      <p>Ask a language model how many <em>r</em>s are in “strawberry” and, for most of the
      period covered by this book, it answered <strong>two</strong> — fluently, immediately, and
      without any of the hedging it produces when it is uncertain about a fact. The same shape of
      request fails the same way: print every third character of a word, reverse a string, produce
      an acrostic, count the letters in a sentence, write exactly fifty words. The answers come
      back the right <em>type</em> and the wrong <em>value</em>, which is the signature of a system
      answering from recollection rather than inspection.</p>
      <p><strong>Dated, deliberately.</strong> These specific prompts were reliable failures through
      roughly 2024 and into 2025, and several have since been patched. “Strawberry” in particular
      now appears in enough training data, evaluation suites and system prompts that most frontier
      models answer it correctly, and reasoning models often get there by writing the word out one
      letter at a time before counting — which works, as you will see below, precisely because it
      changes the tokenization. What was patched is a set of famous examples and a habit of
      spelling things out. The blindness underneath is unchanged: ask about a word nobody wrote a
      blog post about, ask for the eleventh character of a random string, or ask in a script the
      tokenizer chops finely, and the behaviour returns.</p>`),

    because(`
      <p><strong>The text is gone before the model starts.</strong> The tokenizer is a separate,
      frozen preprocessing step: it runs to completion, and only then does the first layer execute.
      What it hands over is what the ladder ended on — a short row of integers. “Strawberry” is not
      ten characters to the model. It is two or three opaque blocks, and which blocks depends on a
      merge list counted from a corpus years ago.</p>
      <p><strong>An integer is not a spelling.</strong> Each of those integers selects one row of
      the embedding matrix (${figRef('tokens', 'embedding')}) — a vector of d_model numbers, trained
      by gradient descent to be useful for predicting text. Nothing in that training ever said
      “character 3 of this token is <em>r</em>”. Whatever the row knows about the letters it stands
      for was absorbed indirectly, from documents that happened to discuss spelling. That is
      knowledge <em>about</em> the string, not access <em>to</em> it — and it degrades exactly the
      way second-hand knowledge degrades, gracefully on famous words and badly on rare ones.</p>
      <p><strong>There is no operation that opens a token.</strong> Everything the machine does from
      here on moves and mixes these row-vectors. None of them indexes into the characters a vector
      stands for, because after the lookup there are no characters left to index. Asking the model
      to count letters is asking it about objects that are not present in its input. It answers
      anyway, because producing a plausible continuation is the only thing it does.</p>`),

    spellingWidget(),

    workaround(`
      <p><strong>Hand character work to something whose job is characters.</strong> A code
      interpreter counts letters by looking at them: <code>sum(1 for c in w if c == "r")</code> is
      exact, costs nothing, is auditable, and — the part that matters — does not degrade on an
      unfamiliar word. The general move is to stop asking the model to <em>be</em> the tool and let
      it <em>call</em> the tool; ${chRef('inference')} takes up why that division of labour is the
      single most reliable way to buy accuracy.</p>
      <p><strong>Or change the tokenization on purpose.</strong> Writing
      <code>s-t-r-a-w-b-e-r-r-y</code>, or one letter per line, forces the merge list to emit close
      to one token per character — and the letters become addressable positions again. This is the
      diagnosis confirming itself: nothing about the model changed, only the segmentation. It is a
      real technique and a limited one, since it costs tokens, it is brittle inside longer prompts,
      and it does not survive being buried in a paragraph the model wrote itself.</p>
      <p><strong>Then design around it.</strong> Keep character-level and digit-level operations off
      the critical path unless a tool is doing them: letter counts, string indexing and reversal,
      rhyme and meter, exact word counts, fixed-width or ASCII-art layout, and arithmetic on long
      numbers — which fails for the same reason, since digits chunk into tokens by frequency rather
      than by place value. Treat a correct answer to any of these as luck about a familiar string,
      not as a capability you can rely on.</p>`),
  ));
}
