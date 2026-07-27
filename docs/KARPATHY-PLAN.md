# Plan: what the Karpathy lectures teach, and what we owe the reader

Source material read in full:

- **Deep Dive into LLMs like ChatGPT** (~2,070 lines, 41k words) — the whole
  pipeline, general audience, heavy on *LLM psychology*.
- **Let's build GPT: from scratch, in code, spelled out** (~1,135 lines, 21k
  words) — one decoder-only Transformer built up in four provable versions.

This document is the analysis and the build plan. It is deliberately concrete:
every proposed animation names its mechanic and its test.

---

## 1. How Karpathy actually teaches

The content is not the interesting part — most of it is in our book already.
The *delivery* is what makes it land. Thirteen devices, in rough order of how
much we should steal them.

| # | Device | Example from the lectures | Do we do this? |
|---|---|---|---|
| 1 | **One organizing analogy for the whole pipeline** | School: exposition = pretraining, worked solutions = SFT, practice problems = RL | **No.** We have no spine metaphor. |
| 2 | **Two memories** | Parameters = "something you read a month ago"; context window = working memory you can read off directly | **No.** Biggest single gap. |
| 3 | **Live failure demos** | Falcon-7B invents three different Orson Kovats; 9.11 > 9.9; strawberry; counting dots | **No.** We only show things working. |
| 4 | **"Pause and decide which is better"** | Two correct answers to the apples problem — one teaches the model to fail | **No.** We never ask the reader to commit. |
| 5 | **Provable refactor ladder** | v1 loops → v2 matmul → v3 softmax → v4 self-attention, each `torch.allclose` to the last until the last | **No.** We present attention finished. |
| 6 | **The hand-checkable toy matrix** | 3×3 lower-triangular ones @ 3×2 — causal attention you can do on paper | Partly — attention has a worked example. |
| 7 | **Re-representation chain with a stated trade** | text → bits → bytes → BPE, each step trading vocabulary size against sequence length | Partly — BPE merges, not the ladder. |
| 8 | **Numeric anchors with a physical comparison** | 44 TB "fits on one hard drive"; $40,000 in 2019 → $600 today; $3/GPU/hour | Partly — we have 6·N·D and cost bars. |
| 9 | **Naming what is *absent*** | "no notion of space", "no memory, it's stateless", "no persistent self" | **No.** |
| 10 | **Progressive disclosure by removal** | Deletes the mask and the softmax to show raw affinities, then puts them back | **No.** We only ever add. |
| 11 | **Physical metaphors for math** | Gradient "superhighway"; "fork off the residual pathway and project back"; Q = "what am I looking for", K = "what do I contain", V = "if you find me interesting, here's what I'll tell you" | **Yes** — this we already do well. |
| 12 | **Analogy, then immediate retraction** | "synthetic brain tissue — but I would caution you not to think of it like neurons" | Partly. |
| 13 | **Honest uncertainty** | "I don't know why RLHF works; my best guess is the discriminator–generator gap" | **Yes** — the `frontier` sections do this. |

**Conclusion:** our figures are strong and our physical metaphors are strong.
What we lack is (a) a spine metaphor, (b) the psychology of the trained
artifact, and (c) any depiction of the model *failing*. A reader finishes our
book knowing how a transformer works and with no idea why ChatGPT can't count
the r's in strawberry.

---

## 2. Coverage audit

Verified by grep against `js/` — counts are files containing the term.

### Already covered well — leave alone

Next-token objective and the generation loop · dot products and matmul ·
neurons, nonlinearity, depth · loss/gradients/backprop/SGD · softmax and
cross-entropy · n-grams, RNNs, the parallelism wall · BPE merges · the residual
stream · **gradient flow through the identity path** (`norm-placement` covers
pre/post-norm as a gradient-flow problem — this is exactly Karpathy's
superhighway, done better) · Q/K/V semantics · multi-head as parallel channels ·
MoE routing · KV cache · prefill/decode · temperature and top-p · LoRA ·
multimodality as "just more tokens" · scaling laws · GRPO.

### Partial — needs a section, not a chapter

| Concept | What's missing |
|---|---|
| Tokenization trade-off | We show BPE merges but never the **bits → bytes → tokens ladder** or the vocabulary-size ↔ sequence-length curve |
| Scaled attention | `√d_head` appears in 6 files as a formula; never *why* — that softmax sharpens toward one-hot if the variance grows with head size |
| Communication ↔ computation | 3 files mention it; never made the organizing idea of the block |
| Verifiable vs unverifiable domains | 2 files; not the axis it deserves to be |
| Reward hacking | 1 file; no depiction |
| Chain of thought | 2 files; never connected to compute-per-token |

### Missing entirely — grep returns zero

`hallucination` · `Swiss cheese` / `jagged` · `working memory` · `system prompt`
· `web search` · `code interpreter` · `AlphaGo` / `move 37` · `in-context
learning` / `few-shot` · `regurgitation` · `knowledge cutoff` · `labeler` ·
`directed graph` · `cross-attention` · `encoder block` · `bigram` ·
`train/validation split` · `discriminator–generator gap`.

Note `validation` returns **zero files**. We never mention overfitting or a
held-out split anywhere in a book about training.

---

## 3. What to build

Three new chapters, one new Part, and eight sections inserted into existing
chapters. Numbering stays automatic — everything below is a registry insert.

### 3.1 New chapter — *Where the knowledge comes from* (Part III, before Pretraining)

Karpathy spends fifteen minutes on data and we spend none. The reader currently
believes knowledge arrives by magic.

Covers: CommonCrawl → the FineWeb filter cascade (URL blocklist, text
extraction from raw HTML, language ID, dedup, PII removal) → 44 TB → 15 T
tokens; why the filter choices *are* product decisions (drop Spanish, get a
model bad at Spanish); knowledge cutoff as a consequence of a dated crawl.

### 3.2 New chapter — *The base model* (Part III, after Pretraining)

The single biggest conceptual hole. We go straight from "training loop" to
"assistant" without ever showing what falls out of pretraining.

Covers: an internet-document simulator, not an assistant; the same prompt
sampled three times giving three different worlds; regurgitation (recites
Wikipedia verbatim, then drifts); hallucinating past the knowledge cutoff;
in-context learning via a few-shot prompt; the trick of prompting a base model
into an assistant by writing a fake transcript.

### 3.3 New chapter — *Practice problems: RL and the emergence of thinking* (Part III)

Post-training currently compresses SFT, RLHF and RLVR into one chapter. RL
deserves its own, built on the school analogy.

Covers: guess-and-check over thousands of rollouts; why *we* can't label the
ideal reasoning trace (our cognition isn't the model's); R1's response length
climbing as accuracy climbs; the "wait — let me reconsider" trace as an
*emergent* property nobody wrote down; AlphaGo's supervised curve plateauing at
human level while the RL curve walks past it; move 37; verifiable vs
unverifiable; the reward model as a lossy human simulator; reward hacking and
why you crop the run; the discriminator–generator gap as the best guess for why
RLHF helps at all.

### 3.4 The failure modes — as chapter payoffs, not a separate Part

Karpathy calls this "LLM psychology" and spends lines 785–1245 on it, ~22% of
the Deep Dive — more than he spends on attention. It has to be in the book.

An earlier draft of this plan filed it as a new Part V. That was wrong, and
worth recording why: **none of it is a new subject.** Every failure is a direct
mechanical consequence of a chapter we already have. Collecting them in their
own Part turns "here is what this mechanism costs you" into a detached list of
quirks, and severs each failure from the mechanism that explains it — which is
the only thing that makes it more than trivia.

So each lands as the closing section of the chapter that sets it up, in the
slot where Part II–IV chapters already carry their `frontier` section:

| Failure | Mechanical cause | Home |
|---|---|---|
| Can't spell; "strawberry" has two r's | BPE merges characters into opaque tokens; the model never sees letters | `tokens` |
| Can't count; needs chain of thought | Fixed compute per token — ~100 layers, one forward pass, no more | `inference` |
| Hallucinates confidently | Every "who is X" in the SFT set is confidently answered, so the *style* is learned even when the knowledge isn't | `posttraining` |
| Summarizes better if you paste the text | Weights are lossy compression; context is not. Parameters = vague recollection, context = working memory | `inference` |
| Tool use (web search, code interpreter) | The same distinction, exploited deliberately: refresh working memory rather than trust recollection | `inference` |
| Thinks it's ChatGPT | Nothing in training labelled its identity; a system prompt or 240 hard-coded conversations do | `posttraining` |
| Jagged: Olympiad problems and 9.11 > 9.9 | No single cause — this is the honest one | `epilogue` |

Jagged intelligence goes to the epilogue on purpose. It's the one item with no
clean mechanical story (the leading finding — Bible-verse-like activations
firing on version-number strings — is a finding, not an explanation), and it is
the right last word for a book that has spent sixteen chapters taking the
machine apart: you now know exactly how it works, and it will still surprise
you.

### 3.5 Sections inserted into existing chapters

| Target | Insert |
|---|---|
| `tokens` | The bits → bytes → BPE ladder; vocabulary ↔ sequence-length trade |
| `attention` | Attention as communication on a directed graph; no notion of space; no communication across the batch; encoder vs decoder as *one deleted line*; self vs cross attention |
| `attention` | Why `/√d_head` — softmax sharpening |
| `residual` | Communication ↔ computation as the block's organizing rhythm |
| `anatomy` | LayerNorm vs BatchNorm — normalize rows, not columns |
| `pretraining` | Train/validation split and overfitting; a chunk of 9 tokens is 8 training examples |
| `pretraining` | The bigram baseline and the loss you should expect: −ln(1/V) |
| `posttraining` | Where SFT data comes from: labelers, labeling instructions, "you are talking to a simulation of a labeler" |

---

## 4. Animation catalog

House rules apply to every one: a pure function of scroll progress `p`, set
idempotently via `seg(p, a, b)`, seeded `rng`, real numerics, existing color
grammar (amber = weights, cyan = activations, violet = attention, teal =
experts, red-orange = loss/gradients, green = trainable).

Twenty figures. Each lists the mechanic and how we prove it works.

---

### A. The spine metaphor

**A1 — The three stages as one schoolroom** (`pin`, Part III opener)
A textbook page fills the frame. Scrubbing sweeps a highlight down it: first
the body prose lights amber and a "knowledge" reservoir fills (pretraining);
then a worked solution lights cyan and a second reservoir fills (SFT); then a
practice problem lights green, and instead of filling, *many* faint attempt
paths fan out from it, most fading, a few surviving (RL). Ends with the three
reservoirs labelled with real numbers: months/thousands of GPUs, ~3 hours,
ongoing.
*Test:* at `p=0.33` exactly one region carries the highlight class; reservoir
fill heights are monotonic non-decreasing across a forward sweep; the fan-out
path count equals the seeded constant.

**A2 — Two memories** (scene → `inference`)
Left: a dense amber cloud labelled "parameters — 405 billion numbers, read once
a month ago", deliberately blurry (SVG `feGaussianBlur` whose `stdDeviation` is
a function of how rare the fact is). Right: a crisp cyan strip labelled
"context window — working memory". Step 1 asks a common question: the amber
cloud resolves sharply, answer correct. Step 2 asks a rare one: the cloud stays
blurred, the answer that emerges is wrong and red. Step 3 fires a `search` tool
call; retrieved text slides into the cyan strip; the same question now resolves
crisply off the strip.
*Test:* blur `stdDeviation` at step 2 > step 1; after step 3 the number of
context-strip lines with non-zero opacity increases, and the answer node's fill
changes from `PAL.loss` to `PAL.act`; a full reverse sweep restores both
exactly. (Assert on *opacity*, not `children.length` — creating DOM mid-sweep
would violate the idempotence rule, so retrieved lines are pre-created and
faded in.)

---

### B. Data

**B1 — The filter cascade** (`pin`)
2.7 billion crawled pages enter as a dense particle column at the top. Six
labelled sieves — URL blocklist, text extraction, language ID, dedup, PII,
quality — each removing a measured fraction, with the surviving count and the
byte total (44 TB) counting down beside it. Ends at 15 T tokens.
*Test:* the surviving-particle count is strictly decreasing across sieves; the
final count equals the published FineWeb figure held in `data/`; the counter
text at `p=1` matches the constant, not a hard-coded string.

**B2 — Zoom out on the corpus** (`pin`)
Karpathy's move, directly: start on one readable paragraph of real crawled
text, then scale continuously down until it becomes a texture, then a single
pixel-row in a 15-trillion-token bar. Pure transform on a `<g>`, so it's cheap
and perfectly reversible.
*Test:* the `scale` transform is a strictly monotonic function of `p`; text is
`aria-hidden` past the legibility threshold; DOM node count is constant
throughout (nothing is created mid-sweep).

---

### C. Tokenization

**C1 — The representation ladder** (scene, 4 steps)
One sentence, four encodings, each row morphing into the next: characters →
bits (a long binary ribbon) → bytes (256 colored cells) → BPE tokens (~100k
vocabulary, a short row of wide cells). A live two-axis readout shows the trade:
sequence length falling, vocabulary size rising. Karpathy's emoji framing gets
a beat — byte 116 is not "one hundred sixteen", it's a symbol.
*Test:* sequence length at each step equals the value computed by the real
encoder in `mathtools`, not a constant; the product/curve readout recomputes
from those values; reverse sweep restores every cell width.

**C2 — Why it can't spell** (widget)
Type any word. It renders twice: as the reader sees it (letters), and as the
model sees it (2–3 token blocks). Ask for "every third character" and watch the
letter view answer it trivially while the token view has no letter boundaries
to index. Strawberry ships as the default.
*Test:* unit-test the tokenizer boundary map against a fixture table; assert
the rendered block count equals `encode(word).length`; keyboard-accessible
input; `aria-label` present.

---

### D. Attention, rebuilt Karpathy's way

**D1 — The averaging trick** (scene, 4 steps — *the* figure)
This is the best five minutes in either lecture and we don't have it. A 3×3
lower-triangular matrix of ones beside a 3×2 matrix of small integers, and the
product computed cell by cell, by hand, on screen.
Step 1: all-ones @ B → every output row is the same column sum. Step 2: apply
`tril` → outputs become running sums, because the zeros drop terms. Step 3:
normalize the rows to sum to 1 → running *averages*. Step 4: replace the
uniform weights with data-dependent affinities → this is attention.
Every number is computed live by `matmul` from `mathtools`.
*Test:* strongest assertions in the whole plan. Assert the rendered matrix
equals `matmul(A, B)` elementwise; assert the mask is zero strictly above the
diagonal; assert each normalized row sums to 1 ± 1e-9; assert step 3's output
equals a reference cumulative-mean implementation.

**D2 — The provable refactor ladder** (scene, 4 steps)
Karpathy's v1→v4, with the equality made visible. Three panels side by side:
a `for`-loop average, a matmul, a softmax-of-masked-zeros. A green "identical"
badge sits between them for v1–v3 and *breaks* at v4, where affinities become
data-dependent and the outputs genuinely diverge.
*Test:* compute all three paths in JS and assert v1 ≈ v2 ≈ v3 to 1e-9; assert
v4 differs by more than 1e-3; assert the badge's state is derived from that
comparison rather than hard-coded — the badge must break if someone breaks the
math.

**D3 — Progressive disclosure by removal** (`pin`)
Start from the finished attention heatmap. Scrubbing *removes* machinery: peel
off the softmax to reveal raw dot-product affinities ranging negative to
positive; peel off the mask to reveal the future leaking in, with the violated
cells flashing red. Then reassemble. Teaches what each piece is *for* by
showing the damage when it's gone.
*Test:* with the mask removed, assert cells above the diagonal are non-zero;
with it restored, assert they are exactly zero; assert row sums equal 1 only in
the softmax-present state; assert the p=0 and p=1 snapshots are identical.

**D4 — Attention as a directed graph** (`pin`)
Eight nodes on a ring. Edges appear following the causal rule — node 1 points
only to itself, node 8 to all predecessors. Then the same eight nodes with the
mask deleted: a fully connected graph, labelled *encoder block*. The caption
carries the punchline: the difference between an encoder and a decoder is one
deleted line of code. A third beat introduces a second node set off to the side
and draws queries from the first into keys/values from the second — cross
attention.
*Test:* edge count at the causal state equals n(n+1)/2 = 36; at the encoder
state equals n² = 64; cross-attention state has zero intra-set edges; every
edge's endpoints are derived from the adjacency rule, not enumerated by hand.

**D5 — Why √d_head** (`pin`)
Two softmax rows side by side, fed by dot products of random vectors whose
dimension the scrub increases from 4 to 256. Unscaled: the distribution visibly
sharpens toward one-hot as dimension grows. Scaled by `1/√d`: it stays diffuse.
A variance readout under each, computed live.
*Test:* assert the unscaled variance grows ≈ linearly in `d` (fit slope > 0.5);
assert the scaled variance stays within [0.8, 1.2] across the whole range;
assert both rows sum to 1 at every sampled `p`.

**D6 — No notion of space** (`pin`)
Shuffle the input tokens. The attention output permutes with them — identically.
Then add positional embeddings and shuffle again: now the output changes.
Demonstrates that attention operates over a *set*, and that position is
something we bolt on.
*Test:* compute attention over a permuted input and assert the output is the
same permutation of the original (to 1e-9) with positions off, and assert it is
*not* with positions on. This is a real property test — it would catch a
positional-embedding regression.

---

### E. Training, honestly

**E1 — One chunk, eight examples** (`pin`)
A 9-token window. Scrubbing walks a bracket left to right; at each stop the
context (cyan) and its target (amber) light up, and a counter tallies examples
1…8. Lands Karpathy's point that this is also why the model can generate from a
one-token prompt.
*Test:* example count at `p=1` equals `blockSize`; the target index equals
context end + 1 at every stop; reverse sweep re-hides every bracket.

**E2 — The bigram baseline** (`pin`)
Loss axis with a marked line at −ln(1/V) — "what you get for knowing nothing" —
and a second at the bigram model's loss. The gap between them is labelled
*everything a transformer buys you*. Real numbers for our vocabulary.
*Test:* the uniform line's value equals `Math.log(V)` computed from the actual
vocabulary constant; the axis scale is derived, not hard-coded.

**E3 — Watching a run** (scene, 3 steps)
A live training loop rendered as Karpathy experienced it: loss ticking down
step by step on the left, and on the right the *same* sample prompt regenerated
at step 20 (noise), step 400 (locally coherent gibberish), step 32,000 (fluent).
Text is pre-computed and seeded; the scrub selects a checkpoint.
*Test:* loss series strictly decreasing; sample text at each checkpoint matches
the fixture; the checkpoint index is a pure function of `p`.

**E4 — Train/validation divergence** (`pin`)
Two curves descending together, then separating — the moment overfitting
starts, marked. Currently the book never mentions this at all.
*Test:* assert the curves are equal within tolerance before the divergence
point and separated after; assert the marker's x-position is computed from the
data, not placed by hand.

---

### F. Reinforcement learning

**F1 — Fifteen rollouts** (scene, 4 steps)
One prompt at the top. Fifteen solution paths fan downward, each a token
sequence. Four reach the right answer (green), eleven don't (red). The best is
selected and the model updates toward it. Then the whole thing repeats with the
green fraction visibly higher — the update *worked*.
*Test:* path count and green count equal the seeded constants; the selected
path is the one the selection rule picks (assert against a JS reimplementation
of the rule); round 2's green fraction > round 1's.

**F2 — Response length and the aha moment** (`pin`)
R1's two curves: accuracy climbing, average response length climbing with it.
At the crossover a callout expands one real trace showing "wait — let me
re-evaluate this step by step". Caption states plainly that no human wrote that
behavior; it fell out of the optimization.
*Test:* both series monotonic; the callout's text comes from a data constant;
the callout is `aria-live` off and reachable in DOM order.

**F3 — AlphaGo: imitation has a ceiling** (`pin`)
The paper's plot, rebuilt: the supervised curve rises and flattens *below* the
Lee Sedol line; the RL curve rises through it and keeps going. Then move 37 —
a board, a stone placed at a point marked "1 in 10,000 chance a human plays
here", and the note that it was, in retrospect, brilliant.
*Test:* assert the SL curve's asymptote is below the human line and the RL
curve crosses it, both computed from the data series; assert the crossing index
is derived.

**F4 — Reward hacking** (scene, 3 steps)
Joke quality climbing for a few hundred updates, then the reward model's score
*continuing* to climb while actual quality falls off a cliff. The top-scoring
output resolves to "the the the the". Step 3: patch that example, and a new
adversarial input appears — the game is unwinnable, so you crop the run.
*Test:* the two series diverge after the marked step; the divergence point is
computed; the "patch" step increments an adversarial-example counter and the
new example differs from the previous one.

**F5 — Verifiable vs unverifiable** (`pin`)
Two columns. Left: a math answer dropping into a box that snaps green or red —
a clean, ungameable check. Right: a joke dropping into a *neural network* shaped
scorer that emits 0.83, with a wobble on it. The caption: one you can run
forever, the other you crop.
*Test:* the left checker is a pure equality function (assert both branches); the
right emits a value from the seeded rng and is reproducible across reloads.

---

### G. Failure

**G1 — Hallucination, three samples** (`pin`)
The same prompt — "Who is Orson Kovats?" — sampled three times, three confident
and mutually contradictory biographies, side by side. Below, the mechanism: the
training set contains only confidently-answered "who is X" pairs, so the style
is learned even when the knowledge isn't. Then the fix: interrogate, find the
boundary, add "I don't know" as a *label*.
*Test:* the three answers come from a fixture and are pairwise distinct; the
"after mitigation" state renders the refusal from the same fixture.

**G2 — Finite compute per token** (scene, 4 steps → `inference`)
The most important figure in this group. A token being generated sits under a stack
of ~100 layer bars — a fixed budget, drawn to scale. Step 1: an easy problem
fits inside the budget. Step 2: answer-first on a hard problem — the required
work bar overflows the budget, glows red, and the emitted answer is wrong. Step
3: the same problem spread across twelve intermediate tokens, each comfortably
inside budget, arriving correct. Step 4: the same thing handed to a code tool,
budget irrelevant.
*Test:* the "required work" bar height is a function of the problem constant;
assert it exceeds the budget height in step 2 and is below it for every token
in step 3; assert the answer node's fill is `PAL.loss` in step 2 and `PAL.act`
in step 3.

**G3 — Swiss cheese** (`pin` → `epilogue`)
A capability surface with holes. Scrubbing moves a probe across it: PhD physics
— solid. Olympiad geometry — solid. "Is 9.11 bigger than 9.9?" — the probe
drops through a hole. The caption is honest that the leading explanation
(Bible-verse-like activations firing on version-number strings) is a finding,
not a settled account.
*Test:* hole positions come from a seeded rng so the surface is identical on
every load; the probe's y-position is a pure function of `p`; assert the probe
enters exactly one hole over a full sweep.

---

## 5. How we test the animations

Ad-hoc browser poking doesn't scale to twenty more figures. Build a harness
first — `test/scenes.mjs`, run under Playwright against the local server.

### 5.1 Universal invariants — every scene and pin, automatically

Derived from the registry, so a new figure is covered the moment it's
registered. No per-figure code needed for any of these.

1. **Idempotence.** Set `p = x`, snapshot every animated attribute; set some
   other `p`; set `p = x` again; snapshot must be byte-identical. Catches state
   held outside the update function — the single most common bug in this
   codebase's style.
2. **Reversibility.** Sweep `p` 0→1 in 40 steps recording snapshots, then 1→0,
   and compare at matched `p`. Scrubbing backwards must rewind exactly.
3. **Endpoint stability.** The `p=0` snapshot must equal the pre-scroll initial
   render — a figure must not "jump" when the reader first reaches it.
4. **No NaN / no `undefined`.** Scan every numeric SVG attribute at all 40
   steps. Catches divide-by-zero in a `seg` window, the classic failure when
   `a === b`.
5. **No layout escape.** Nothing renders outside its `viewBox`; text nodes stay
   inside their canvas.
6. **Accessibility.** Every `svgRoot` has `role="img"` and a non-empty
   `aria-label`; every widget control is a real `<button>` or `<input>`.
7. **Determinism across loads.** Render twice in fresh contexts; seeded figures
   must produce identical DOM. Catches an unseeded `Math.random` slipping in.
8. **Layout invariants** (generalizing what I wrote by hand this week): at no
   scroll position does a visible step card overlap the pinned figure; the
   worst-frame "best card presence" score stays above a floor; every scene has
   a minimum scrub range. Run at 375×667, 393×852, 950×870, 1440×900.

### 5.2 Per-figure assertions — the part that actually catches wrong math

The universal checks prove a figure is *well-behaved*. They cannot prove it is
*correct*. Every figure that renders a number or a shape derived from math
carries a small assertion block naming checkpoints:

```js
export const checks = {
  'attn-averaging': [
    { p: 0.25, assert: (svg) => rowsEqual(readMatrix(svg, '#out'), matmul(tril(ones(3)), B)) },
    { p: 0.50, assert: (svg) => readMatrix(svg, '#w').every(r => close(sum(r), 1)) },
    { p: 0.75, assert: (svg) => maskedAboveDiagonalIsZero(readMatrix(svg, '#w')) },
  ],
};
```

The rule that makes this worth doing: **assert against a reference computation,
never against a transcribed constant.** `expect(cell).toBe(5.5)` passes forever
even after someone breaks `matmul`. `expect(cell).toBe(reference(A, B)[1][0])`
fails the moment the figure and the math disagree — which is the only failure
mode we care about.

### 5.3 Content checks

- Every `chRef`/`figRef` resolves — no `??` placeholders survive render (we
  have this ad hoc; make it a test).
- No hard-coded chapter or figure number appears in any chapter source
  (`/\bFig\. \d/`, `/\bchapter \d/` → fail).
- Every K3 number in prose traces to `data/k3.js`.
- Every `researchItem` has a year and one of the three status values.

### 5.4 What we deliberately don't test

Visual appearance. No screenshot diffing — it would fail on every font tweak
and teach us to ignore it. Correctness of *numbers* and *behavior* is testable
and worth it; beauty stays a human judgment.

---

## 6. Build sequence

Each phase ships standalone and leaves the book coherent.

| Phase | Contents | Why first |
|---|---|---|
| **0** | The test harness (§5.1) + layout invariants | Everything after is safer, and it retro-covers the 17 existing scenes |
| **1** | Failure-mode payoffs (§3.4) — figures A2, C2, G1, G2, G3 appended to `tokens`, `inference`, `posttraining`, `epilogue` | Biggest reader value per unit work, and it's additive: four existing chapters gain a closing section, nothing is restructured |
| **2** | Attention rebuild (D1–D6) inserted into `attention` | D1 and D2 are the best figures in the plan |
| **3** | *The base model* + *Where the knowledge comes from* (B1, B2, E1–E4) | Closes the pretraining → assistant gap |
| **4** | *Practice problems* — RL chapter (A1, F1–F5), post-training split | Largest new writing effort; A1 retro-frames Part III |
| **5** | The eight inserted sections (§3.5) | Cleanup pass |

Phase 0 is a prerequisite, not a nicety: twenty new scroll-driven figures
without idempotence and reversibility tests will rot.

---

## 7. Judgment calls I'd flag before we start

1. **Does a failure section need its own component?** Each Part II–IV chapter
   already ends with `frontier` (bottleneck → research → speculation), which is
   about where the *field* is stuck. A failure payoff is a different thing —
   where the *reader* will get bitten — and putting both in one slot may
   overload the end of a chapter. Options: reuse `frontier`'s bottleneck card,
   or add a sibling component. Decide when writing the first one (C2, in
   `tokens`), not before.
2. **Two lectures, one voice.** The from-scratch lecture is code-first; ours is
   figure-first with no code on screen. D2's "provable refactor ladder" is the
   one place where showing the equivalence *is* the lesson. I'd render it as
   three computed panels rather than three code blocks — keeps the no-code
   discipline and loses nothing.
3. **Scale of the writing.** Three new chapters plus roughly a dozen inserted
   sections is a ~30% increase in the book. Worth doing in phases, and phase 1
   alone — which adds no chapters at all — would materially change what a
   reader takes away.
4. **Sourcing.** Karpathy's specifics (Falcon-7B's three Orson Kovats answers,
   R1's trace, move 37, the FineWeb funnel) are real and citable, and I'd cite
   them rather than reproduce them as if we ran the experiments. Where we show
   a model failing, the caption should name the model and the date — these get
   fixed, and a figure claiming "LLMs can't count r's" ages badly.
