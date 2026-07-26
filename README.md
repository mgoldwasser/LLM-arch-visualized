# How a Trillion-Parameter Model Actually Works

**→ Read it: [mgoldwasser.github.io/LLM-arch-visualized](https://mgoldwasser.github.io/LLM-arch-visualized/)**

An interactive, **scroll-driven visual explainer** of how large language models
work — from the dot product up to a 2.8-trillion-parameter mixture-of-experts
model, and back down to a fine-tune that changes **13 numbers**.

Written for visual and kinesthetic learners, and written to be *complete*: it
starts at vectors and dot products and does not skip a step. If you have had
one linear-algebra course, you have everything you need. Every mechanism is
animated, and the scroll position *is* the timeline — scrub backwards and the
machine disassembles again. The target arc runs from "bright STEM
undergraduate" to "can follow a frontier-lab tech report", traced throughout
by **Kimi K3**, a 2.8-trillion-parameter open-weight MoE model.

## Running it

The published site is served by GitHub Pages from `main` at the repository
root, so a merge to `main` deploys it — there is no build step or workflow to
wait on.

To run it locally: it's a fully static site — no build step, no dependencies.
ES modules require http(s), so serve the directory:

```sh
python3 -m http.server 8080     # or: npx http-server -p 8080
# open http://localhost:8080
```

Deploys anywhere static files go (GitHub Pages, Netlify, S3, …) by copying the
repo as-is.

## What's inside

Chapters are numbered programmatically from registry order, so the numbers
below are deliberately omitted — see `js/registry.js` for the running order.

**Part I — the task and the tools**

| Chapter | Mechanism | Signature visual |
|---|---|---|
| One task: predict the next token | The autoregressive objective | The generation loop, animated end-to-end |
| Vectors, matrices, and the dot product | The one operation everything is built from | The dot product built geometrically, then coordinate-wise |
| From one neuron to a network | Nonlinearity and depth | A decision boundary collapsing to a line when σ is deleted |
| How a machine learns | Loss, gradients, backprop, SGD | One training step with real numbers; descent you can steer |
| Probability, softmax, and surprise | The objective, precisely | Cross-entropy collapsing to a single −log p term |
| Why sequences were hard | n-grams, RNNs, the parallelism wall | One sentence processed three ways |

**Part II — the machine**

| Chapter | Mechanism | Signature visual |
|---|---|---|
| Tokens and embeddings | BPE and the embedding matrix | Merges collapsing "unbelievability" into 3 tokens |
| The residual stream and one layer | The transformer block | One layer assembling itself; a layer's weights drawn to scale |
| Inside the layer | The component catalog | Pre/post-norm gradient flow; the block, 2017 vs 2026 |
| Attention, step by step | Self-attention | Five stages; a hand-checkable worked example; "who is *it*?" |
| Attention at scale | Long context and the memory wall | FlashAttention tiling, MLA latent math, the delta rule |
| Mixture of experts | Sparsity | Click a token, watch 16 of 896 experts fire |
| Assembling K3 | Parameter arithmetic | Build-your-own-trillion-parameter-model calculator |

**Part III — making one**

| Chapter | Mechanism | Signature visual |
|---|---|---|
| Pretraining | The training loop and its economics | The 6·N·D bars; four axes of parallelism |
| Post-training | SFT → RLHF → RLVR | GRPO scoring a group of 16 attempts |

**Part IV — using one**

| Chapter | Mechanism | Signature visual |
|---|---|---|
| Inference | Prefill, decode, the KV cache | KV-cache growth; a live temperature/top-p sampler |
| Adaptation | Fine-tuning → LoRA → 13 parameters | The same matrix under three philosophies |
| Beyond text | Images, audio, video | Patchify widget; CLIP → adapter recipe; token budgets |

Every chapter in Parts II–IV ends with a **Frontier** section — what makes that
component inefficient or knowledge-scarce, the cutting-edge research attacking
it (with deployed / research / contested status), and a clearly-badged
speculative proposal. Part I is exempt: it teaches settled mathematics.

## Architecture

```
index.html            entry — loads css + js/main.js
css/
  tokens.css          design tokens (both themes, color semantics)
  base.css            typography, layout, chrome
  components.css      figures, widgets, scroll-scenes, cards
js/
  main.js             boot: chrome, TOC, minimap, lazily mounts chapters
  registry.js         THE table of contents — one line per chapter; its ORDER
                      is the only place numbering is decided
  core/
    numbering.js      chapter/figure numbers + cross-references, all derived
    scroll.js         one rAF-driven scroll engine for the whole page
    scene.js          sticky-figure + step-cards scrollytelling component
    dom.js            hyperscript helpers (el / svg / svgRoot)
    anim.js           progress windows, easing, seeded rng, formatting
    mathtools.js      softmax, matmul, real attention numerics
    components.js     chapter building blocks (prose, terms, figures, widgets)
  chapters/<slug>/    one directory per chapter — index.js is the spine,
                      one file per figure / scene / widget
  extensions/         content inserted INTO chapters without editing them
                      (registry.js + one module per insertion; every Part II–IV
                      chapter's "Frontier" research section lives here)
data/
  k3.js               the Kimi K3 spec sheet; single source of truth
docs/
  AUTHORING.md        how to add or edit a chapter (start here to extend)
```

**Extending:** create `js/chapters/<slug>/index.js` exporting `render()`, add
one line to `js/registry.js`. Everything else — numbering, cross-references,
TOC, minimap, progress bar, lazy loading, error isolation — is automatic. See
[docs/AUTHORING.md](docs/AUTHORING.md) for the component library, the
scroll-scene API, and the color grammar.

## Design principles

- **Scroll is the timeline.** Figures are pure functions of scroll progress —
  deterministic, scrubbable, replayable. No fire-and-forget animations for
  load-bearing content.
- **Nothing is numbered by hand.** Chapter numbers, figure numbers, and every
  cross-reference derive from registry order, so inserting a chapter can't
  desynchronize the book from itself.
- **Color is grammar.** Amber = learned weights, cyan = activations, violet =
  attention, teal = experts, red-orange = loss/gradients, green = trainable.
  Learned once in the foundations, readable in every figure after.
- **Real numerics.** Worked examples (attention rows, softmax temperatures,
  gradients, parameter counts) are computed live, not hard-coded pictures.
- **Honest labeling.** Where Moonshot hasn't disclosed a K3 number, figures
  use Kimi K2's published blueprint and say so.
