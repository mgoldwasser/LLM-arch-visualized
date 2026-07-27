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
      `<em>${figRef('assembly', 'calculator')} — simplified accounting, and each simplification is worth naming. Attention is counted the plain way: four square matrices per layer — the query, key, value and output projections, each taking d numbers in and putting d numbers out, so d&nbsp;×&nbsp;d apiece and 4d² per layer — with none of the compression ${chRef('attention')} adds. Each expert is three d&nbsp;×&nbsp;d_ff matrices — the SwiGLU shape — and one shared expert rides alongside the routed ones. The input embedding table and the output unembedding are counted as two separate matrices rather than one table used at both ends (&ldquo;untied&rdquo;), so the vocabulary is paid for twice. Norms and router weights are small enough to ignore. The presets switch to K2 or DeepSeek-V3 dimensions.</em>`),

    prose(
      `Three readings worth taking from the bar. <strong>The expert MLPs are effectively all of the model</strong> — which is why the fine-tuning methods of ${chRef('adaptation')} target these matrices, and why &ldquo;where does the knowledge live&rdquo; has a one-word answer. The <strong>activation ratio</strong> is the whole MoE bargain in one number: ${K3.name} runs each token through ~2% of itself. And the <strong>memory rows</strong> explain deployment reality, once you know what a parameter physically is. Each one is a number, and a number has to be written down in some chosen quantity of bits — that choice is a real dial, and the two rows are its two settings. Spend four bits on each parameter, half a byte, and 2.8 trillion of them come to roughly 1.4&nbsp;TB. Spend sixteen bits each and it is four times that. Either figure is far beyond what a single accelerator holds, which is why a model this size is served on many chips wired together, split up along the same axes as in ${chRef('pretraining')}. How few bits you can get away with is ${chRef('inference')}&rsquo;s subject.`),

    takeaway(
      `<strong>The expert MLPs are effectively all of the model.</strong> The bar is one teal block with two slivers: the knowledge lives in the experts, each token rents ~2% of them, and the terabyte they weigh at four bits apiece is what the serving hardware has to carry.`));
}
