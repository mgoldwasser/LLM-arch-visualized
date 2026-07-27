/* Inference — two serving regimes with opposite bottlenecks, the KV cache
   that makes decode affordable, and sampling as a serving-time policy.
   Spine only: prose, terms, the math aside. The scene, the figure and the
   widget live beside this file and claim their numbers in call order:

     scene-serving.js   key 'phases'   — prefill / decode / KV cache (scene)
     fig-kv-growth.js   key 'kv'       — cache growth by attention variant
     widget-sampling.js key 'sampling' — live softmax(z/T) + top-p           */

import { chapter, chapterHead, prose, term, mathAside, takeaway, chRef, figRef } from '../../core/components.js';
import { si, fmtBytes } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { servingScene } from './scene-serving.js';
import { kvGrowthFigure } from './fig-kv-growth.js';
import { samplingWidget } from './widget-sampling.js';

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'Serving', title),
    prose(
      `Serving a trained model splits into two regimes with opposite bottlenecks. <strong>Prefill</strong> processes the whole prompt in one parallel pass — thousands of tokens' worth of matrix multiplies, compute-bound, and the phase you experience as time-to-first-token. <strong>Decode</strong> then generates one token at a time — and each step must stream all ~${si(K3.activeParams)} active parameters from memory to produce a single token, so it is bandwidth-bound: the GPU's arithmetic units mostly idle while weights stream past. Most serving-stack engineering (batching many users, splitting prefill from decode onto different nodes) exists to feed those idle units.`),
    term('rule of thumb', 'serving', 'one user at a time, every token requires reading all the active weights once, so the speed ceiling is how fast memory can be read divided by how much there is to read. Those weights occupy about 25 GB at 4 bits each; the GPU&rsquo;s memory delivers roughly 3 terabytes a second. Three terabytes divided by 25 gigabytes is about 120, so a single stream tops out in the low hundreds of tokens per second &mdash; and batching many users into the same read of the weights is how that ceiling gets beaten'),

    servingScene(),                      // its caption is the prose below
    prose(
      `Decode is only affordable because of the <strong>KV cache</strong>. Attention needs every previous token's keys and values. Recomputing them from scratch at every step would mean the work of producing one token grows with the number of tokens already on the page &mdash; the thousandth token costing a thousand times the first, which is ${chRef('attention-scale')}'s arithmetic all over again. Instead they're computed once and cached — turning generation into: compute q, k, v for the new token only, attend against the cache, append. The price is memory that grows linearly with context, and at 1M tokens that price is the whole ballgame — the direct motivation for ${chRef('attention')}'s variant zoo.`),
    term('KV cache', 'n.', 'stored K,V tensors for all past tokens, all layers; the reason long chats cost memory even while “idle”'),
    kvGrowthFigure(),

    prose(
      `Finally, the choice ${chRef('objective')} deferred — and the machinery ${chRef('probability')} already built: softmax turns logits into a distribution, and dividing the logits by a <strong>temperature</strong> T first sharpens it (T&lt;1) or flattens it (T&gt;1) without ever changing which token ranks highest. What is new here is <em>where</em> that dial lives. The weights are frozen; picking from the distribution is <strong>sampling policy</strong>, chosen per request at serving time. Always taking the single highest-scoring token &mdash; <em>greedy</em> decoding, or picking the argument that maximizes, <em>argmax</em> &mdash; returns the same answer every time and slides into repetition loops. Temperature buys variety back while keeping it faithful to what the model actually believed: a token the model rated twice as likely still comes up about twice as often. And <strong>top-p</strong> (nucleus) sampling — the serving-time addition — truncates to the smallest set of tokens whose probabilities sum to p, cutting off the long tail of individually-unlikely junk that pure temperature sampling would occasionally emit.`),
    mathAside('softmax with temperature', `
      <div class="eq">pᵢ = e^(zᵢ/T) / Σⱼ e^(zⱼ/T)</div>
      <p>T→0 recovers argmax; T=1 the learned distribution. Dividing all logits by the same T preserves their order — temperature never changes <em>which</em> token is most likely, only how much the distribution concentrates on it.</p>`),
    samplingWidget(),                    // its caption is the prose below
    prose(
      `<em>${figRef('inference', 'sampling')} — one distribution, three temperatures. “Randomness” in LLM output is a serving-time dial, not a property of the weights.</em>`,
      `Weight precision is the last big lever. Every trained weight is a number, and you choose how many bits to spend storing it. Spend fewer and each weight has to be rounded to the nearest value on a coarser grid — that rounding is <strong>quantization</strong>, and it is how a model is made to fit in less memory and stream faster. Done at the end, on a model trained at full precision, it costs some accuracy: you are serving something slightly different from what you trained. K3 ships in <strong>${K3.weightsFormat.split(' ')[0]}</strong> — ~4 bits per parameter, ~${fmtBytes(K3.totalParams * 0.5)} total — and pays no such price, because the coarse grid was in place during training itself, from the SFT stage onward. There is nothing to convert at the end; the low-precision model <em>is</em> the model.`),
    takeaway(
      `Together with KDA's constant-size state, that is what makes million-token serving of a ${si(K3.totalParams)}-parameter model an engineering exercise rather than an impossibility.`));
}
