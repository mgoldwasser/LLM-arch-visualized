/* Beyond text — how images, audio, and video enter a machine we have so far fed
   nothing but token IDs. The punchline: they enter the same way text does — as
   a sequence of d_model vectors — because the residual stream never asked where
   its vectors came from.

   Spine only: prose, terms, math asides, and the order the page appears in.
   Every figure lives in its own module beside this one. */

import { chapter, chapterHead, prose, term, mathAside, takeaway, chRef, chNum, figRef } from '../../core/components.js';
import { si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

import { convergeFigure } from './fig-converge.js';
import { vitScene } from './scene-vit.js';
import { patchifyWidget } from './widget-patchify.js';
import { stagesFigure } from './fig-stages.js';
import { codebookFigure } from './fig-codebook.js';
import { audioFigure } from './fig-audio.js';
import { videoFigure } from './fig-video.js';

export function render({ id, num, title }) {
  // token-budget arithmetic quoted in prose — computed, not typed
  const bigPatches = Math.floor(1024 / 14) ** 2;   // 1024px image, patch 14

  return chapter(id,
    chapterHead(num, 'Beyond text', title),
    prose(
      `Every chapter so far has fed the model exactly one thing: token IDs standing for text. Yet the same family of models now reads screenshots, describes photographs, transcribes speech, and answers questions about hour-long videos. The natural guess is that seeing required new machinery inside the model. It mostly didn't — and the reason is a fact you already know. ${chRef('residual', { cap: true })}'s residual stream is just a sequence of d_model-dimensional vectors, and <strong>nothing in a transformer layer checks where a vector came from</strong>. Attention will route between any vectors; the MLPs will transform any vector. Text only ever entered through one narrow door — the embedding lookup of ${chRef('tokens')}, which turned an integer into a vector. Build a different door that turns <em>pixels</em> or <em>waveform samples</em> into residual-stream-shaped vectors, and the rest of the machine works unchanged.`,
      `So the whole subject reduces to one engineering question with two competing answers. <strong>Route one — continuous:</strong> train an <em>encoder</em> that maps an image (or a second of audio) to a short sequence of vectors, and splice those vectors into the input sequence as <strong>soft tokens</strong> — embeddings that correspond to no vocabulary entry and were computed rather than looked up. <strong>Route two — discrete:</strong> train a <em>quantizer</em> that compresses the signal into integer IDs from a new, learned vocabulary — at which point images literally <em>are</em> tokens, and ${chRef('objective')}'s next-token objective applies verbatim. Everything in this chapter is one of these two philosophies wearing different clothes.`),

    convergeFigure(),

    prose(
      `Start with route one and the modality that drove it: images. The recipe — the <strong>vision transformer</strong> (ViT, 2020) — is almost embarrassingly direct. There is no edge detector, no convolutional pyramid of classical computer vision. Slice the image into a grid of small square <strong>patches</strong>, typically 14 or 16 pixels on a side. Flatten each patch into its raw pixel numbers, multiply by one learned matrix, and you have a vector per patch. Then run a transformer over the patch sequence — with one crucial difference from everything since ${chRef('attention')}: <em>no causal mask</em>. An image has no reading order, so every patch attends to every patch, and position becomes a 2-D coordinate rather than an index in time.`),
    term('patch embedding', 'n.', 'the vector a flattened image patch becomes after one learned linear projection — the visual analogue of a token embedding row, except <em>computed from pixels</em> rather than looked up by ID'),

    vitScene(),
    prose(
      `<em>${figRef('multimodal', 'vit')} — the ViT pipeline: patchify, project, encode, splice. The stack downstream is unmodified.</em>`,
      `The catch is arithmetic. Token count grows with the <em>square</em> of resolution: a 1024 × 1024 screenshot at patch size 14 is ${Math.floor(1024 / 14)} × ${Math.floor(1024 / 14)} = ${bigPatches.toLocaleString('en-US')} patches — over five thousand sequence positions for one image, before a single word of the conversation. Production systems therefore tile large images into crops, downsample, or pool neighboring patch tokens, and land on a budget of roughly <strong>256–1024 tokens per image</strong>. Drag the sliders below and watch the square law do its work.`),

    patchifyWidget(),
    prose(
      `<em>${figRef('multimodal', 'patchify')} — tokens = (resolution / patch)², computed live. At patch 8 on a 1024 px image the single picture costs more context than a novella chapter.</em>`),

    prose(
      `Where does the encoder itself come from? Not from the LLM — and this ordering is the deep trick of the modern recipe. Vision encoders are pretrained separately by <strong>contrastive learning</strong>, CLIP (2021) being the canonical version: an image tower and a text tower are trained on hundreds of millions of image–caption pairs so that matched pairs land close in a shared embedding space and mismatched pairs land far apart. No pixel is ever predicted; the objective is purely relational. The result is an encoder whose vector space is already organized by <em>meaning</em> — photos of cats cluster near the caption "a cat" — before the language model ever enters the picture.`,
      `Bolting that encoder onto an LLM is then startlingly cheap — the LLaVA (2023) recipe is the standard template. <strong>Stage 2:</strong> freeze both the LLM and the encoder; train only a small projector (an MLP of a few million parameters) on image–caption data, teaching it to translate encoder outputs into vectors the frozen LLM finds intelligible. <strong>Stage 3:</strong> unfreeze and jointly tune on multimodal instruction data — image-grounded conversations, charts, OCR, UI screenshots. In ${chRef('adaptation')}'s color grammar: almost everything stays amber for most of the process; the green blocks are small and late.`),
    term('contrastive learning', 'n.', 'training on pairs rather than labels: pull representations of matched pairs together and push mismatched pairs apart — the encoder learns a semantically organized space without predicting a single pixel'),

    stagesFigure(),

    mathAside('the InfoNCE contrastive loss, precisely', `
      <p>Take a batch of N image–caption pairs. Encode images to vectors vᵢ and captions to tᵢ, ℓ₂-normalized, and let sim(v,t) = vᵀt (cosine similarity). With temperature τ, each image must pick out <em>its own</em> caption from the batch via a softmax over similarities:</p>
      <div class="eq">L_img = −(1/N) Σᵢ log [ exp(sim(vᵢ,tᵢ)/τ) / Σⱼ exp(sim(vᵢ,tⱼ)/τ) ]</div>
      <p>A symmetric term L_txt makes each caption pick out its own image, and the loss is (L_img + L_txt)/2. Structurally this is ${chRef('objective')}'s cross-entropy in disguise — a softmax classification where the "vocabulary" is the other side of the batch, so every batch of N pairs supplies N-way supervision in both directions. The learned τ sharpens the softmax as training proceeds. CLIP trained this at N in the tens of thousands, which is why the batch — not the model — was the engineering story.</p>`),

    prose(
      `Now route two, the discrete philosophy. A <strong>VQ-VAE</strong> (2017; VQGAN, 2021, is the sharper modern variant) learns three things jointly: a convolutional encoder that maps an image to a small grid of latent vectors, a <strong>codebook</strong> of, say, 8,192 learnable vectors, and a decoder that reconstructs pixels. Each latent is snapped to its <em>nearest codebook entry</em>, so the image becomes a grid of integers — a 256 × 256 photo compresses to a 32 × 32 grid of code IDs. Those integers can be appended to the text vocabulary, and then everything in this article applies with no modification at all: ${chRef('objective')}'s next-token loss trains image understanding and image <em>generation</em> in the same breath, since generating a picture is just predicting 1,024 image tokens and running the decoder. Two 2024 releases, Chameleon and Emu3, are built exactly this way. It is also, historically, how a whole family of image generators worked, until they were displaced by <strong>diffusion</strong> — a different method that starts from a rectangle of pure noise and removes a little of it at a time, steered by the text, until a picture is what remains.`),
    term('vector quantization', 'n.', 'snapping a continuous vector to the nearest entry of a finite learned codebook, so a signal becomes a sequence of integer indices — a <em>learned tokenizer</em> for pixels or audio'),

    codebookFigure(),

    mathAside('training through an argmax: the straight-through estimator', `
      <p>Quantization picks the nearest code, k = argminⱼ ‖z_e − eⱼ‖, and outputs z_q = e_k. The argmin has zero gradient almost everywhere, so backpropagation would stop dead at the quantizer. The <strong>straight-through estimator</strong> simply copies the gradient across the gap — ∂L/∂z_e := ∂L/∂z_q — pretending the snap was the identity. Two auxiliary terms then keep the fiction honest:</p>
      <div class="eq">L = L_recon + ‖sg[z_e] − e_k‖² + β·‖z_e − sg[e_k]‖²</div>
      <p>where sg[·] is stop-gradient. The middle term drags the chosen codebook entry toward the encoder's output (training the vocabulary); the last — the <em>commitment loss</em>, β ≈ 0.25 — drags the encoder toward the code it snapped to, so encoder and codebook do not drift apart. It is a hack, it is biased, and it works; a decade of attempts to replace it (Gumbel-softmax relaxations, FSQ's fixed grids) have mostly rediscovered how strong the baseline is.</p>`),

    prose(
      `The honest scorecard between the two routes: discrete buys a <em>unified objective</em> — one loss, one vocabulary, and generation for free — but quantization discards detail, and reconstructions cap the fidelity of anything downstream. Continuous soft tokens preserve more information per position and consistently win at <em>understanding</em> benchmarks — reading a chart, OCR-ing a receipt — but the model can only consume images, not emit them; generation needs a separate mechanism. Which is why the shipping frontier is, unglamorously, a hybrid: <strong>continuous encoders on the way in, and a diffusion model or discrete-token head on the way out</strong>.`),

    prose(
      `Audio walks the same fork with one preliminary step: sound arrives as a waveform, ~16,000 samples per second — far too raw to patchify directly. The near-universal move is to render it as a <strong>mel spectrogram</strong>: a frequency-by-time intensity map, quite literally an image of sound. From there the ViT playbook resumes — convolutional downsampling in time, then a transformer encoder. Whisper (2022) is the template, and the budget lands around <strong>25–50 tokens per second of audio</strong>. The discrete route exists here too, and it matters more than for images: neural audio codecs (SoundStream 2021, EnCodec 2022) use residual vector quantization — a stack of codebooks, each quantizing what the previous one missed — to compress speech into a few hundred discrete tokens per second. A model that generates <em>those</em> tokens can speak. And because they stream — a fraction of a second of audio per token, generated at ${chRef('inference')}'s decode rate — codec tokens are what make real-time, full-duplex voice models possible at all.`),

    audioFigure(),

    prose(
      `Video is not a new modality so much as a multiplication: images × time. Sample frames — 1–2 per second is typical, since adjacent frames are nearly identical — patchify each one, and add a temporal coordinate to the position information. The budgets are where it gets serious.`),

    videoFigure(),

    prose(
      `<em>${figRef('multimodal', 'video')}'s arithmetic is the punchline of ${chRef('attention-scale')} rearriving from the outside: an hour of modestly-sampled video, at a modest 256 tokens per frame, nearly fills a ${si(K3.contextWindow)} context on its own.</em> Long-context machinery and multimodality are not separate features — the second is the main customer of the first. And even a million tokens is not enough without compression, so video pipelines pool ruthlessly: merging tokens across neighboring frames, selecting keyframes, collapsing static scenes — often down to 16–64 tokens per frame.`,
      `Finally, how is the assembled system trained? The pretraining substrate of choice is <strong>interleaved image–text web documents</strong> — pages kept in their natural order, images embedded mid-sentence where they originally appeared — because that is the only data that teaches a model to reason <em>across</em> the boundary, not just caption. But look at any frontier data mixture and text still dominates, usually overwhelmingly. This is scarcity, not preference: the paired multimodal web is orders of magnitude smaller than the text web, its captions are noisier than its prose, and — ${chRef('pretraining')}'s lesson — data quality is destiny. The reasoning depth of every multimodal model you have used was still learned mostly from text; the other modalities are taught to <em>meet</em> that reasoning in the residual stream.`,
      `A closing honesty note about our specimen. Moonshot's spec sheet for ${K3.name} discloses no modality details, and this article will not invent them — everything above is the frontier recipe, not a K3 teardown. What is public is the lineage: Kimi-VL (2025) is an open MoE vision-language model from the same lab — an efficient MoE language model behind a native-resolution vision encoder, trained on exactly the staged recipe of ${figRef('multimodal', 'stages')} — and the frontier's direction is unambiguous: the encoders keep shrinking as a fraction of the system, and the stack keeps not caring where its vectors came from.`),

    takeaway(
      `<strong>The transformer never learned to see.</strong> The stack still does exactly what chapters ${chNum('residual')}–${chNum('moe')} said: route and transform vectors. What changed is upstream — an encoder learned to speak vector, translating pixels and waveforms into the residual stream's native tongue. Multimodality is a story about doors, not about the room.`));
}
