/* Frontier — chapter 11 (beyond text).
   Why today's multimodality is expensive and shallow, what the field is
   doing about it, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>Vision tokens are information-sparse and budget-hungry at the same time.</strong>
      A screenshot costs ~1,000 tokens of context to communicate what a human would summarize as
      "a login page" — the patch grid spends its budget uniformly on wallpaper and on the one
      formula that matters. Meanwhile the alignment is shallower than the demos suggest: even in
      "aligned" spaces, image embeddings and text embeddings occupy measurably separate cones
      (the <em>modality gap</em>), and cross-modal transfer — knowledge learned in text improving
      perception, or vice versa — remains weaker than same-modality scaling. The data situation
      compounds it: the paired multimodal web is orders of magnitude smaller and noisier than the
      text web, so encoders are trained on captions that undersell what images contain. Evaluation
      is scarce too — multimodal benchmarks saturate quickly or leak into training sets, making
      progress hard to measure honestly. And the temporal modalities lag furthest: streaming audio
      still fights latency budgets, and video models mostly recognize <em>what</em> is in frames
      while fumbling <em>what happened between them</em>.</p>`),

    researchItem('Native early-fusion omni-models', '2024', 'deployed', `
      <p>Skip the bolt-on encoder era: train one transformer on text and discrete image tokens
      from scratch, one vocabulary and one next-token loss for all modalities (Chameleon 2024;
      the Gemini line was multimodal from its first pretraining token). Removes the projector
      bottleneck and the two-stage alignment dance, at the cost of harder training stability —
      Chameleon's authors document the tricks needed to keep mixed-modal training from
      diverging.</p>`),
    researchItem('Dynamic resolution & token merging', '2024', 'deployed', `
      <p>Attack the token bill directly. Qwen2-VL's "naive dynamic resolution" lets each image
      produce however many tokens its actual size warrants instead of a fixed square budget;
      token-merging and pruning lines (ToMe 2022 onward) collapse near-duplicate patch tokens
      inside the encoder. Shipped widely — most production VLMs now spend variable, much smaller
      budgets per image than their 2023 ancestors.</p>`),
    researchItem('Unified discrete tokenization for any-to-any generation', '2024', 'research', `
      <p>Emu3 (2024) pushes the discrete philosophy to its conclusion: images, text, and video all
      quantized into one token stream, one autoregressive loss, no diffusion model anywhere —
      understanding and generation from the same weights. Competitive with specialist baselines
      at research scale; whether pure next-token prediction matches dedicated diffusion decoders
      at frontier fidelity is still open.</p>`),
    researchItem('Real-time speech-native models', '2024', 'deployed', `
      <p>Codec tokens made voice a first-class modality rather than a transcription pipeline:
      GPT-4o-style systems take audio in and generate audio out with a single model, and Moshi
      (2024) runs <em>full-duplex</em> — listening and speaking simultaneously on parallel token
      streams at ~200 ms latency, modeling interruptions and backchannels. The remaining gap is
      depth: speech-native models still reason less well than their text twins on hard tasks.</p>`),
    researchItem('World-model pretraining from video', '2024', 'contested', `
      <p>The V-JEPA line (2024–25) bets that predicting <em>representations</em> of masked
      video regions — not pixels, not tokens — teaches intuitive physics and object permanence
      that captioned stills never will, echoing the argument that next-frame prediction is to
      vision what next-token was to language. Evidence so far: strong probing results on motion
      and physics tasks, but no demonstration yet that it transfers into frontier assistants —
      whether video prediction is the "missing objective" or a detour is genuinely contested.</p>`),

    novelIdea('Content-adaptive token budgets: a saliency router for perception', `
      <p>Chapter 05's lesson was that uniform compute per token is wasteful, and routing fixed it.
      Perception has the same disease: a patch of blank wallpaper and a patch of dense formula
      each cost one token. The proposal: make the <em>image-side token budget</em> a routing
      decision. A small learned saliency router scores each region of the encoder's feature map,
      and a differentiable pooling stage allocates soft tokens proportionally — 16 tokens for the
      wallpaper, 512 for the formula screenshot — trained end-to-end with a load-balancing-style
      budget penalty (the MoE auxiliary loss, transplanted) plus the downstream language loss, so
      "salient" is defined by <em>what the LLM needed</em>, not by hand-crafted heuristics.
      Failure modes to test first: the router optimizing for caption-style supervision and
      starving regions that only matter for rare downstream questions ("what does the fine print
      say?"); training instability from the budget term fighting the task term, as in early MoE
      routers; and a subtle evaluation trap — adaptive budgets make per-image cost unpredictable,
      which serving stacks (chapter 09's batching) actively dislike. A cheap first experiment:
      freeze everything, train only the router on OCR-heavy vs. photo-heavy mixtures, and check
      whether allocation entropy tracks human saliency maps at all.</p>`),
  );
}
