/* Assembling K3: where 2.8 trillion parameters live. Centerpiece is a live
   parameter calculator — sliders in, arithmetic out. */

import { chapter, chapterHead, prose, takeaway, claimFig, chRef, figRef } from '../../core/components.js';
import { K3 } from '../../../data/k3.js';
import { calculatorWidget } from './widget-calculator.js';

export function render({ id, num, title }) {
  const bp = K3.blueprint;

  /* The calculator's caption lives in the prose beneath it, so it claims the
     chapter's first figure number here. */
  claimFig('calculator');
  const calculator = calculatorWidget();

  return chapter(id,
    chapterHead(num, 'The whole machine', title),
    prose(
      `You now have every part: an embedding matrix, a stack of layers each holding an attention sublayer and a MoE sublayer, a final norm, an unembedding. &ldquo;2.8 trillion&rdquo; stops being mystical the moment you multiply it out — it is just (matrix dimensions) × (layer count), dominated overwhelmingly by the expert MLPs. The calculator below builds a model from the same recipe; the defaults approximate ${K3.name} where disclosed (${K3.experts.routed} experts, ${K3.experts.active} active) and borrow K2&rsquo;s blueprint where not (${bp.layers} layers, d&nbsp;=&nbsp;${bp.dModel.toLocaleString('en-US')}).`),

    calculator,
    prose(
      `<em>${figRef('assembly', 'calculator')} — simplified accounting: standard attention (4d² per layer, no MLA compression), SwiGLU-style experts (3·d·d_ff each, +1 shared), untied embeddings; norms and router weights are negligible. The presets switch to K2 or DeepSeek-V3 dimensions.</em>`),

    prose(
      `Three readings worth taking from the bar. <strong>The expert MLPs are effectively all of the model</strong> — which is why the fine-tuning methods of ${chRef('adaptation')} target these matrices, and why &ldquo;where does the knowledge live&rdquo; has a one-word answer. The <strong>activation ratio</strong> is the whole MoE bargain in one number: ${K3.name} runs each token through ~2% of itself. And the <strong>memory line</strong> explains deployment reality: at 4-bit, 2.8T parameters is ~1.4&nbsp;TB of weights — beyond any single accelerator, hence supernodes and the parallelism schemes of ${chRef('pretraining')}.`),

    takeaway(
      `<strong>The expert MLPs are effectively all of the model.</strong> The bar is one teal block with two slivers: the knowledge lives in the experts, each token rents ~2% of them, and the terabyte they weigh at 4-bit is what the serving hardware has to carry.`));
}
