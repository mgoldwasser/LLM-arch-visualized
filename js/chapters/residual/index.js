/* The residual stream and one layer of the stack.
   Spine only — the one-layer scene lives in scene-layer.js, the y = xW atom
   in fig-atom.js, and the to-scale weight map in fig-scale.js. */

import { chapter, chapterHead, prose, term, mathAside, claimFig, chRef } from '../../core/components.js';
import { K3 } from '../../../data/k3.js';
import { sceneLayer } from './scene-layer.js';
import { figAtom } from './fig-atom.js';
import { figScale } from './fig-scale.js';

export function render({ id, num, title }) {
  const L = K3.blueprint.layers;

  const head = [
    chapterHead(num, 'The building block', title),
    prose(
      `Everything between embedding and unembedding is a stack of identical <strong>transformer layers</strong>. The cleanest way to read the stack is to follow each token’s vector as it flows upward — a highway called the <strong>residual stream</strong>. No sublayer ever replaces this vector; each one <em>reads</em> it, computes a delta, and <em>adds</em> the delta back. Scroll — the diagram builds up one full layer.`),
    term('residual connection', 'n.', 'output = input + f(input); the sublayer learns a <em>correction</em>, not a replacement'),
  ];

  // The scene's caption lives in the prose paragraph that follows it.
  const layerFig = claimFig('layer');
  const scene = sceneLayer();

  const afterScene = prose(
    `<em>Fig. ${layerFig} — one transformer layer. Each token’s residual stream runs bottom to top; attention mixes across streams, the MLP works on each stream alone, and both add their deltas back. Zoom out and the same block repeats ~${L} times.</em>`,
    `<strong>What a weight actually does.</strong> Before stacking anything higher, take the vector–matrix product from ${chRef('vectors')} and give its two halves their transformer names — this is the same atom, seen from inside the machine. The model has exactly two kinds of numbers. <strong>Weights</strong> are the ${(K3.totalParams / 1e12).toFixed(1)} trillion learned constants, frozen at inference, organized almost entirely into matrices. <strong>Activations</strong> are the transient values computed per input — the residual stream vectors flowing through those matrices. Every sublayer you’ve met reduces to the same primitive: a vector–matrix product y = xW, plus a cheap elementwise nonlinearity. And each output dimension of that product is just one dot product — the token’s vector against one learned column.`);

  return chapter(id,
    head,
    scene,
    afterScene,
    figAtom(),
    prose(
      `Two readings of the same operation are worth holding simultaneously. <em>Per output:</em> each column of W is a learned feature detector, and y_j measures how strongly the token expresses feature j. <em>Per input:</em> y is a weighted combination of W’s rows — the matrix re-mixes the token’s coordinates into a new basis. A d×k matrix is nothing more than a learned linear map ℝ<sup>d</sup> → ℝ<sup>k</sup>; the entire transformer is a long composition of such maps, with just enough nonlinearity (softmax, gated activations) in between to keep the composition from collapsing into one matrix.`,
      `<strong>One layer’s weights, drawn to scale.</strong> So what does one layer of a trillion-parameter model actually <em>hold</em>? Below, every weight matrix in a single K2-blueprint layer, with area proportional to parameter count. The four attention projections that ${chRef('attention')} spends five stages on are the small squares in the corner. The expert MLPs are the field.`),
    figScale(),
    prose(
      `Hold onto this picture. When ${chRef('attention')} walks through attention’s five stages, remember its machinery is the amber corner — attention decides where information flows, cheaply; the teal field is where the model’s knowledge sits, expensively. It is also ${chRef('adaptation')}’s map: fine-tuning methods are strategies for touching as little of this picture as possible.`),
    mathAside('one layer, in two lines', `
      <p>With hₗ the stream entering layer ℓ (one row per token):</p>
      <div class="eq">a     = hₗ + Attn(RMSNorm(hₗ))
hₗ₊₁  = a  + MLP(RMSNorm(a))</div>
      <p>RMSNorm(x) = x / √(mean(x²) + ε) ⊙ g, with learned gain g ∈ ℝ<sup>d</sup>. Normalizing <em>before</em> each sublayer (“pre-norm”) rather than after is what lets very deep stacks train without careful warm-up — the residual path stays an unmodified identity.</p>`));
}
