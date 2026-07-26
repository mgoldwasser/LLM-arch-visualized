/* Chapter 02 — vectors, matrices, and the one operation everything is made of.
   Figure: one vector three ways. Scene: the dot product, built geometrically.
   Widget: the dial. Figure: y = xW as k independent dot products.          */

import { chapter, chapterHead, prose, term, mathAside, takeaway, claimFig, chRef, figRef } from '../../core/components.js';
import { K3 } from '../../../data/k3.js';
import { spaceFigure } from './fig-space.js';
import { dotScene } from './scene-dot.js';
import { dialWidget } from './widget-dial.js';
import { matvecFigure } from './fig-matvec.js';

export function render({ id, num, title }) {
  const d = K3.blueprint.dModel.toLocaleString('en-US');

  /* Figure numbers are claimed in call order — build the numbered pieces in
     the order they appear on the page, then assemble. */
  const figSpace = spaceFigure();
  claimFig('dotscene');
  const scene = dotScene();
  claimFig('dial');
  const dial = dialWidget();
  const figMatvec = matvecFigure();

  return chapter(id,
    chapterHead(num, 'The one operation', title),

    prose(
      `The previous chapter reduced a language model to a single function. This chapter reduces that function to a single <em>operation</em>. Everything the model holds — the vector standing for a token, every column of every weight matrix, the internal state at every layer — is a list of real numbers. And nearly every arithmetic step it performs is the same primitive applied to a pair of those lists. Understand the primitive properly and the rest of this book becomes bookkeeping: which lists, in what order, how many.`,
      `A <strong>vector</strong> of dimension d is an ordered list of d real numbers, written x = (x₁,&nbsp;…,&nbsp;x_d), an element of the space ℝᵈ. It is also — and this is the same statement, not an analogy — a point in d-dimensional space, or the arrow from the origin to that point. Two coordinates you can draw. Three you can imagine. The ${d} coordinates of one token's vector in a frontier-scale model you cannot, and this is the place to be firm about it: you are not meant to. Every operation below is defined coordinate by coordinate, and every property we rely on follows from that definition rather than from the picture. The picture is a mnemonic. The coordinates are what runs.`,
      `Two colours carry meaning in every figure in this book, and this is where they are fixed. <strong style="color:var(--fig-act)">Cyan is an activation</strong>: data in flight, computed fresh for each input, discarded when the forward pass ends. <strong style="color:var(--fig-weight)">Amber is a weight</strong>: a number fixed by training and frozen ever after. Almost every event inside a running model is one cyan vector meeting one amber vector.`),

    figSpace,

    prose(
      `Two operations come free with the definition, both coordinate-wise. <strong>Addition</strong>: (a&nbsp;+&nbsp;b)ᵢ&nbsp;=&nbsp;aᵢ&nbsp;+&nbsp;bᵢ, which lays the second arrow tip-to-tail on the first. <strong>Scalar multiplication</strong>: (c·a)ᵢ&nbsp;=&nbsp;c·aᵢ, which stretches an arrow, and flips it when c&nbsp;&lt;&nbsp;0. That is the whole structure of a vector space, and throughout this book <em>linear</em> will mean exactly “built from those two moves and nothing else”.`,
      `What neither move does is <em>compare</em> two vectors and return a verdict. Yet comparison is what the model spends its life doing, in different costumes. Does this token's vector match the pattern this attention head is hunting for? Does it match what this expert handles? Which of ${(K3.vocab / 1000).toFixed(0)},000 possible next words does it point toward? Every one of those is the same question — how much do two vectors agree? — and every one is answered by the same arithmetic: multiply matching coordinates, add up the results, report one number.`),

    term('dot product', 'n.', 'a·b = Σᵢ aᵢbᵢ — multiply matching coordinates and sum. Takes two vectors of the same dimension, returns one number (a <em>scalar</em>), which measures how much the two agree in direction'),

    prose(
      `That definition is a recipe with no evident meaning. The meaning is geometric, the two are provably identical, and the equivalence is the single most useful fact in this book. Scroll through the construction.`),

    scene,

    prose(
      `<em>${figRef('vectors', 'dotscene')} — the dot product two ways: the length of a's shadow cast by b, and the coordinate sum that computes it without ever mentioning an angle. Both numbers on the panel are computed live from the coordinates on screen.</em>`),

    mathAside('why |a||b| cos θ equals Σ aᵢbᵢ', `
      <p>Start from the law of cosines applied to the triangle with sides a, b and a&nbsp;−&nbsp;b:</p>
      <div class="eq">|a − b|²  =  |a|² + |b|² − 2|a||b| cos θ</div>
      <p>Now expand the left side purely in coordinates, using |v|² = Σᵢ vᵢ²:</p>
      <div class="eq">|a − b|²  =  Σᵢ (aᵢ − bᵢ)²
          =  Σᵢ aᵢ² − 2 Σᵢ aᵢbᵢ + Σᵢ bᵢ²
          =  |a|² − 2 Σᵢ aᵢbᵢ + |b|²</div>
      <p>Set the two expressions equal. The |a|² and |b|² terms cancel on both sides, leaving −2|a||b|&nbsp;cos&nbsp;θ = −2&nbsp;Σᵢ&nbsp;aᵢbᵢ, hence</p>
      <div class="eq">Σᵢ aᵢbᵢ  =  |a| |b| cos θ</div>
      <p>Nothing in the argument mentions the dimension, because in any dimension the two vectors span at most a 2-plane and θ is measured inside it. The identity holds in ℝ², in ℝ³, and in ℝ<sup>${d}</sup> alike — which is why intuition trained on the plane keeps working where the picture fails.</p>`),

    prose(
      `The construction used |a| without defining it. The <strong>norm</strong> of a vector is its Pythagorean length: |a|&nbsp;=&nbsp;√(Σᵢ&nbsp;aᵢ²), which is √(a·a) — the dot product of a vector with itself is its squared length, since cos&nbsp;0&nbsp;=&nbsp;1. Divide any nonzero vector by its own norm and you get a <strong>unit vector</strong>, â&nbsp;=&nbsp;a/|a|, pointing the same way with the magnitude thrown away: pure direction.`),

    term('norm', 'n.', '|a| = √(Σᵢ aᵢ²) — the length of the arrow. A <strong>unit vector</strong> has |a| = 1; â = a/|a| is a’s direction with its magnitude discarded'),
    term('cosine similarity', 'n.', 'a·b / (|a||b|) = â·b̂ = cos θ — the dot product with both magnitudes divided out, always in [−1, +1]; a comparison of direction alone'),

    prose(
      `Divide both magnitudes out of a·b and what remains is cos&nbsp;θ itself, bounded in [−1,&nbsp;+1]: <strong>cosine similarity</strong>, the dot product of the two unit vectors. Why prefer it? Because inside a model the <em>length</em> of a vector is contaminated by things that have little to do with meaning — how often the token appeared in training, how many layers have already added their contributions to it, how the numerics happened to scale. Direction survives all of that; magnitude drifts. This is why normalization layers rescale vectors before every sublayer, and why the practical question “are these two representations about the same thing?” is nearly always answered with cosine rather than a raw dot product. Below, rotate and stretch b and watch which of the two quantities cares.`),

    dial,

    prose(
      `<em>${figRef('vectors', 'dial')} — the two forms are the same number, always. Stretching b scales the dot product and leaves the cosine untouched; rotating b past 90° drives both through zero and negative.</em>`,
      `The sign is the part worth internalizing, because the model has no richer vocabulary for “related” than this. Positive means the two vectors point the same general way; the larger the value, the more strongly. Zero means <strong>orthogonal</strong> — one is invisible to the other, contributing nothing. Negative means they oppose, which a model uses as actively as it uses agreement: a feature can be suppressed as well as detected. There is also a fact about high dimensions worth carrying forward: pick two directions at random in ℝ<sup>${d}</sup> and their cosine similarity is almost certainly close to zero. Nearly everything is nearly orthogonal to nearly everything else, which is precisely what gives a space of that width room to hold an enormous number of mutually distinguishable meanings — the subject of ${chRef('tokens')}.`),

    prose(
      `One dot product answers one question. A model asks thousands at the same moment, so the questions are stacked side by side into a <strong>matrix</strong>. Let W be a d×k matrix: read it as k separate column vectors, each of length d, each a direction in the same space x lives in. Then the product y&nbsp;=&nbsp;xW is defined entry-by-entry as yⱼ&nbsp;=&nbsp;Σᵢ&nbsp;xᵢWᵢⱼ — which is exactly the dot product of x with column j. A matrix–vector product is k independent dot products and nothing else. No column ever sees another column.`),

    figMatvec,

    prose(
      `Two readings of that picture are worth holding at once, because different parts of the machine invite different ones. <strong>Per output:</strong> each column of W is a learned feature detector — a direction that training chose — and yⱼ measures how strongly x points along it. Under this reading the output is a list of measurements, one per learned feature. <strong>Per input:</strong> y is a weighted sum of W's <em>rows</em>, with x's coordinates as the weights, so the matrix re-expresses x in a new basis: k new coordinates, each a specific blend of the old d. Same arithmetic, two vantage points; a d×k matrix simply <em>is</em> a learned linear map from ℝᵈ to ℝᵏ.`),

    term('linear map', 'n.', 'a function f with f(a + b) = f(a) + f(b) and f(c·a) = c·f(a). Every such map ℝᵈ → ℝᵏ is multiplication by some d×k matrix, and every d×k matrix is one — the two notions are the same object'),

    prose(
      `Which brings us to the fact that shapes the whole architecture, and it is a limitation. Feed the output of one linear map into another and you have not built anything new: (xW₁)W₂&nbsp;=&nbsp;x(W₁W₂), and W₁W₂ is itself a matrix. Two linear layers collapse into one. So do a hundred. A network of pure matrix multiplications, however wide and however deep, is exactly equivalent to a single matrix — the same computation you could have written on one line, with the same severely limited repertoire. Depth would buy literally nothing.`),

    mathAside('composition, and why depth alone is free of charge', `
      <p>Let f(x) = xW₁ with W₁ of shape d×m, and g(z) = zW₂ with W₂ of shape m×k. Then for every x</p>
      <div class="eq">g(f(x))  =  (xW₁)W₂  =  x(W₁W₂)  =  xW₃,     W₃ = W₁W₂  ∈  ℝ^(d×k)</div>
      <p>The middle equality is associativity of matrix multiplication, which holds because every entry on both sides is the same sum Σᵢ Σₗ xᵢ (W₁)ᵢₗ (W₂)ₗⱼ, merely summed in a different order. So the composition of two linear maps is a linear map, realized by a single matrix you could precompute once and store.</p>
      <p>The consequence: stacking linear layers adds parameters and arithmetic while adding <em>no</em> expressive power. Whatever a deep stack of them computes, one d×k matrix computes too. Escaping this requires something that is not linear between the layers — the subject that opens the next chapter.</p>`),

    prose(
      `Everything the rest of this book calls “depth”, then, depends on breaking linearity — inserting a cheap, elementwise, non-linear function between the matrix multiplications so that the composition can no longer be flattened. That single insertion is what turns a pile of matrices into a network, and it is where ${chRef('networks')} begins.`,
      `One last question, easy to skip and worth asking: why is the machine built out of <em>this</em> operation rather than some more expressive one? Partly because the dot product is the natural measure of agreement in a vector space. Mostly because of silicon. A matrix multiply is a very large number of dot products that all reuse the same operands, so each value fetched from memory feeds many multiply-accumulates — the one shape of computation that modern accelerators execute at extraordinary rates, on the order of 10¹⁵ multiply-adds per second in low precision on a single flagship chip. Operations without that structure are bandwidth-starved by comparison. The transformer is not the architecture that best expresses language in the abstract; it is the architecture that expresses language <em>well enough</em> using the operation hardware can do at absurd throughput. That trade — the subject of ${chRef('attention')}, where a dot product becomes the entire mechanism for deciding what a token pays attention to — is the reason the field looks the way it does.`),

    takeaway(
      `Everything ahead is dot products in costume. An attention score is a dot product between one token's query and another's key. A router score is a dot product between a token and an expert's learned direction. A logit is a dot product between the final vector and one row of the output matrix. A layer is a few enormous piles of them, executed at once as matrix multiplies. Direction carries the meaning, sign carries the verdict, and a weight matrix is nothing more than a warehouse of learned directions to be compared against.`));
}
