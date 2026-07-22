# How a Trillion-Parameter Model Actually Works

An interactive, **scroll-driven visual explainer** of how large language models
work — training, attention, mixture of experts, inference, and adaptation —
traced through **Kimi K3**, a 2.8-trillion-parameter open-weight
mixture-of-experts model, all the way down to a fine-tune that changes
**13 numbers**.

Written for visual and kinesthetic learners: every mechanism is animated, and
the scroll position *is* the timeline — scrub backwards and the machine
disassembles again. The target arc runs from "data scientist who needs a math
refresher" to "can follow a frontier-lab tech report".

## Running it

It's a fully static site — no build step, no dependencies. ES modules require
http(s), so serve the directory:

```sh
python3 -m http.server 8080     # or: npx http-server -p 8080
# open http://localhost:8080
```

Deploys anywhere static files go (GitHub Pages, Netlify, S3, …) by copying the
repo as-is.

## What's inside

| Chapter | Mechanism | Signature visual |
|---|---|---|
| 01 | Next-token prediction | The autoregressive loop, animated end-to-end |
| 02 | Tokens & embeddings | BPE merges collapsing "unbelievability" into 3 tokens |
| 03 | The residual stream | One transformer layer assembling itself; a layer's weights drawn to scale |
| 04 | Attention | The five stages, a hand-checkable 4-token worked example, "who is *it*?" widget |
| 05 | Mixture of experts | Click a token, watch 16 of 896 experts fire |
| 06 | Parameter arithmetic | Build-your-own-trillion-parameter-model calculator |
| 07 | Pretraining | The training loop, the 6·N·D economics, four axes of parallelism |
| 08 | Post-training | SFT → RLHF → RLVR pipeline; GRPO group sampling |
| 09 | Inference | Prefill vs decode, KV-cache growth, live temperature/top-p sampler |
| 10 | Adaptation | Full fine-tune → LoRA → TinyLoRA's 13 parameters |

## Architecture

```
index.html            entry — loads css + js/main.js
css/
  tokens.css          design tokens (both themes, color semantics)
  base.css            typography, layout, chrome
  components.css      figures, widgets, scroll-scenes, cards
js/
  main.js             boot: chrome, TOC, minimap, mounts chapters
  registry.js         THE table of contents — one line per chapter
  core/
    scroll.js         one rAF-driven scroll engine for the whole page
    scene.js          sticky-figure + step-cards scrollytelling component
    dom.js            hyperscript helpers (el / svg / svgRoot)
    anim.js           progress windows, easing, seeded rng, formatting
    mathtools.js      softmax, matmul, real attention numerics
    components.js     chapter building blocks (prose, terms, figures, widgets)
  chapters/           one ES module per chapter — self-contained
data/
  k3.js               the Kimi K3 spec sheet; single source of truth
docs/
  AUTHORING.md        how to add or edit a chapter (start here to extend)
```

**Extending:** create `js/chapters/<nn>-<slug>.js` exporting `render()`, add
one line to `js/registry.js`. Everything else — TOC, minimap, progress bar,
error isolation — is automatic. See [docs/AUTHORING.md](docs/AUTHORING.md)
for the component library, the scroll-scene API, and the color grammar.

## Design principles

- **Scroll is the timeline.** Figures are pure functions of scroll progress —
  deterministic, scrubbable, replayable. No fire-and-forget animations for
  load-bearing content.
- **Color is grammar.** Amber = learned weights, cyan = activations, violet =
  attention, teal = experts, red-orange = loss/gradients, green = trainable.
  Learned once in chapter 03, readable in every figure after.
- **Real numerics.** Worked examples (attention rows, softmax temperatures,
  parameter counts) are computed live, not hard-coded pictures.
- **Honest labeling.** Where Moonshot hasn't disclosed a K3 number, figures
  use Kimi K2's published blueprint and say so.
