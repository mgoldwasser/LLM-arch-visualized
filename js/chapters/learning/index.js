/* learning — where the weights come from. Loss as a function of θ, the
   gradient as its steepest direction, backpropagation as the mechanism that
   gets it, and stochastic gradient descent as the affordable version. */

import {
  chapter, chapterHead, prose, term, mathAside, goDeeper, widget, takeaway,
  claimFig, chRef, figRef,
} from '../../core/components.js';
import { sceneStep } from './scene-step.js';
import { figGraph } from './fig-graph.js';
import { figSgd } from './fig-sgd.js';
import { descentWidget } from './widget-descent.js';
import { ETA, f2 } from './net.js';

export function render({ id, num, title }) {
  const head = [
    chapterHead(num, 'Optimization', title),
    prose(
      `${chRef('networks', { cap: true })} built a network and left one question open: the weights. A layer computes y = xW + b, and every number in W was assumed to be sitting there already, correct. Nobody chose them by hand. This chapter is how they get chosen.`,
      `Start with a change of viewpoint that is easy to state and takes a while to absorb. A network is a function of two arguments, not one: f(x; θ), the input x and the parameter vector θ holding every weight and bias stacked into a single list. Until now we have varied x and held θ fixed — that is what using a model means. Training does the opposite. Fix a dataset, and the model's total wrongness on that fixed data becomes a function of θ alone. Call it the <strong>loss</strong>, L(θ). It is a single real number. Feed it a setting of every weight in the network and it answers with one scalar.`,
      `So the network you have been reading left to right is, for this chapter, a landscape: one point for every conceivable setting of θ, one height given by L. Training is the search for a low point. Nobody has ever seen this landscape — it has one horizontal direction per parameter, which for a frontier model is a trillion of them — but nearly every practical fact about training is a statement about its local geometry.`),
    term('loss function', 'n.',
      'a single scalar L(θ) measuring how wrong the model is on a fixed dataset; the only quantity the training procedure is allowed to look at'),
    prose(
      `We will use the simplest honest loss, squared error on one output: L = ½(ŷ − y)², where ŷ is the prediction and y the label. The ½ is there purely so the derivative comes out clean. Language models minimize cross-entropy over a vocabulary instead — built up properly in ${chRef('probability')} — but nothing in this chapter changes when you substitute it. Only the very first line of the backward pass differs; every line after it is identical.`,
      `Now the search. We need a way to move θ downhill without ever seeing the landscape, using only what we can compute at the point we are standing on. Calculus supplies exactly that. For a single weight w, the partial derivative ∂L/∂w is the slope of L along the w-axis: raise w by a hair and L changes at that rate. Collect the partial derivative with respect to every parameter into one vector of the same length as θ, and you have the <strong>gradient</strong> ∇L(θ) — a complete first-order description of the landscape at your feet.`,
      `The gradient points in the direction of steepest <em>ascent</em>. Uphill. That is a theorem, not a convention — the asides below give the reason in words and then in symbols. Since we want to go down, we step the other way — <strong>θ ← θ − η ∇L(θ)</strong>, with η a small positive number called the learning rate.`,
      `Read that componentwise and the sign takes care of itself. If ∂L/∂w₇ is positive, then increasing w₇ increases the loss, so we want w₇ smaller — and subtracting a positive number does exactly that. If it is negative, we subtract a negative and w₇ grows. Every parameter is corrected in its own direction by its own amount, in one simultaneous move. That single line, iterated, is <strong>gradient descent</strong>, and it is the entire optimization story of deep learning.`),
    term('gradient', 'n.',
      'the direction in which the loss climbs fastest — one number per parameter, each saying how much that parameter pushes the loss up. Written ∇L, and built from the partial derivatives ∂L/∂θᵢ. Training walks the opposite way'),
    goDeeper('why the steepest direction is the gradient', `
      <p><strong>The claim is that out of every direction you could step, the one the gradient points along raises the loss fastest.</strong> It needs nothing beyond the dot product of ${chRef('vectors')}.</p>
      <p>Stand somewhere on the landscape and choose a direction to walk. Fix your stride length, so that the directions are being compared fairly. The gradient is a list with one entry per parameter, each saying how fast the loss rises if that parameter alone goes up. Ask how fast the loss rises as you walk in your chosen direction, and the answer is exactly the dot product of those two lists: multiply matching coordinates, add up the results.</p>
      <p>And a dot product between two arrows of fixed length is largest when they point the same way. That is the entire argument. A direction that disagrees with the gradient anywhere is spending part of your stride going sideways along the hill; pointing straight along the gradient wastes none of it. Turn around and you have the fastest way <em>down</em>, which is the direction training walks.</p>
      <p><strong>Two things the theorem does not say.</strong> First, it describes an infinitely small step. The gradient is the best direction in which to <em>begin</em> moving; once you have travelled a finite distance η the hill has bent underneath you, and your direction may no longer be the best one available. Everything about the learning rate below lives in that gap.</p>
      <p>Second, and easier to miss: <strong>&ldquo;steepest&rdquo; quietly depends on how you measure distance.</strong> Comparing directions of the same stride length assumes the parameters are measured in comparable units, and there is no reason on earth why they should be. Stretch one parameter&rsquo;s axis — express it in different units — and a different direction becomes the steepest one. This is not a defect in the theorem; it is a door. Adam and every other preconditioned optimizer walks through it deliberately, rescaling each parameter&rsquo;s axis before choosing where to step.</p>`),

    mathAside('the directional derivative, and Cauchy–Schwarz', `
      <p>Stand at θ and pick a direction: a unit vector u. The rate at which L changes as you move along u is the <em>directional derivative</em>, and the chain rule evaluates it as a dot product:</p>
      <div class="eq">D<sub>u</sub>L(θ) = lim<sub>h→0</sub> [L(θ + hu) − L(θ)] / h = ∇L(θ) · u</div>
      <p>Maximizing that over unit u is exactly Cauchy–Schwarz: ∇L·u ≤ ‖∇L‖·‖u‖ = ‖∇L‖, with equality precisely when u points along ∇L. So ∇L is the maximizer, −∇L the minimizer, and the magnitude ‖∇L‖ is the steepest slope itself.</p>
      <p>Note where the choice of norm enters. Both &ldquo;unit vector&rdquo; and the inequality are stated in the Euclidean norm. Impose a different inner product ⟨u, v⟩<sub>A</sub> = uᵀAv instead, with A symmetric positive definite, and the same maximization returns A⁻¹∇L. That vector, not ∇L, is the steepest direction under that metric — which is precisely what a preconditioned optimizer computes, Adam using a diagonal A built from a running average of squared gradients.</p>`),
  ];

  /* the widget's caption lives in the prose paragraph after it */
  const descentNum = claimFig('descent');
  const descentW = widget(
    'Gradient descent, at four learning rates',
    'pick a preset or drag η — the path is computed from the real gradient at every point',
    descentWidget());

  const middle = [
    prose(
      `Everything now hinges on η, the <strong>learning rate</strong>: how far to move along the direction the gradient picked out. It is a single positive number, it is not learned, and it is the most consequential thing a practitioner sets. Too small and the model crawls, burning compute to travel almost nowhere. Too large and each step overshoots the bottom and lands further up the far wall than it started — the loss rises, then rises faster, and the run is dead within a few dozen steps. The window between those failures is narrower than it sounds, and it is set by how sharply the landscape bends — its <strong>curvature</strong> — which nobody knows in advance. A gently bending direction tolerates a long step; a sharply bending one turns the same step into an overshoot.`),
    term('learning rate', 'n.',
      'how far to step along the gradient — written η, and the single number in θ ← θ − η∇L that decides how fast training moves. Too small and it crawls; too large and it overshoots and never settles. The ceiling is set by the most sharply bending direction of the loss surface'),
    descentW,
    prose(
      `<em>Fig. ${descentNum} — a loss surface over two parameters, ten times steeper in one direction than the other. Watch what η buys you: at 0.02 the path barely leaves the corner; at 0.09 it drops into the valley and slides along the floor; at 0.17 it overshoots the steep direction on every step and crosses the valley repeatedly, still converging; at 0.21 it is past the stability threshold and the steps grow without bound. Only the last of these is obviously broken. The interesting failure is the first one, which looks like it is working.</em>`,
      `Notice that the difficulty was not the direction — the gradient was correct at every point — but the mismatch between two curvatures in the same surface. The steepest direction caps how large η may be; the shallowest then decides how long convergence takes. In two dimensions the ratio here is 10. In a real network it can be many orders of magnitude, which is why learning-rate schedules, warmup, and adaptive per-parameter step sizes exist at all.`),
  ];

  const graph = figGraph();

  const backprop = [
    prose(
      `That leaves the one genuinely hard question in this chapter: how do you actually <em>get</em> ∇L? The naive method is to nudge each weight in turn, re-run the model, and see how the loss moved. For d parameters that is d + 1 forward passes per step. At d = 10¹² it is not a slow algorithm, it is an impossible one.`,
      `<strong>Backpropagation</strong> gets all d partial derivatives in a single backward sweep costing roughly twice one forward pass — regardless of how many parameters there are. It is not a special trick of neural networks; it is the chain rule, applied to a graph, in the efficient order. The picture to hold is ${figRef('learning', 'graph')}: every arithmetic operation in the model is a node, values flow forward along the edges, and each edge carries one <em>local derivative</em> — how much its output moves when its input moves, and nothing more. A node does not know what network it is in.`,
      `The backward pass then starts at the loss with the trivial seed ∂L/∂L = 1 and walks the graph in reverse. Each node takes the gradient handed to it from its output side, multiplies by its own local derivative, and hands the result to its inputs. Where several paths reach the same node, their contributions add. Follow any parameter's path back to the loss and its gradient is the product of the local derivatives along the way — which is why long chains of small derivatives make gradients vanish, the problem ${chRef('residual')} is built to solve.`),
    graph,
    term('backpropagation', 'n.',
      'the chain rule run backwards through a network: one backward sweep yields ∂L/∂θ for every parameter at once, at roughly twice the cost of a forward pass (its formal name is reverse-mode automatic differentiation)'),
    mathAside('the chain rule, and the only two matrix rules you need', `
      <p>Scalar form: if L depends on w only through an intermediate u, then dL/dw = (dL/du)(du/dw). If w reaches L through several intermediates u₁…u<sub>k</sub>, the contributions add — sum over paths:</p>
      <div class="eq">∂L/∂w = Σᵢ (∂L/∂uᵢ)(∂uᵢ/∂w)</div>
      <p>Now one layer. Let x ∈ ℝⁿ, W ∈ ℝ<sup>m×n</sup>, z = Wx + b ∈ ℝᵐ, and let L depend on z. Write δ = ∂L/∂z, the gradient already computed for this layer's output. Since zᵢ = Σⱼ Wᵢⱼxⱼ, the local derivatives are ∂zᵢ/∂Wᵢⱼ = xⱼ and ∂zᵢ/∂xⱼ = Wᵢⱼ. Summing over paths gives the two rules that do all the work:</p>
      <div class="eq">∂L/∂W = δ xᵀ        ∂L/∂x = Wᵀ δ</div>
      <p>The first is an outer product, m×n — the same shape as W, one number per weight, ready to be subtracted. The second is an n-vector: the error signal handed back to the previous layer, routed through the transposed weights. An elementwise nonlinearity a = φ(z) sits between them and contributes ∂L/∂z = ∂L/∂a ⊙ φ′(z); for ReLU, φ′ is 1 where z &gt; 0 and 0 elsewhere, so it simply gates the gradient through the units that were active.</p>
      <p>Two layers, in full. With z⁽¹⁾ = W⁽¹⁾x + b⁽¹⁾, a = φ(z⁽¹⁾), z⁽²⁾ = W⁽²⁾a + b⁽²⁾, L = ℓ(z⁽²⁾):</p>
      <div class="eq">δ⁽²⁾ = ℓ′(z⁽²⁾)
∂L/∂W⁽²⁾ = δ⁽²⁾ aᵀ        ∂L/∂b⁽²⁾ = δ⁽²⁾
δ⁽¹⁾ = (W⁽²⁾ᵀ δ⁽²⁾) ⊙ φ′(z⁽¹⁾)
∂L/∂W⁽¹⁾ = δ⁽¹⁾ xᵀ        ∂L/∂b⁽¹⁾ = δ⁽¹⁾</div>
      <p>Six lines. A hundred-layer network is these six lines a hundred times and nothing else. Look at what each rule consumes: the outer product needs that layer's <em>input</em>, and the ReLU gate needs its <em>pre-activation</em>. Both are forward-pass quantities. They must therefore be kept in memory from the forward pass until the backward pass reaches them — which is the origin of training's activation-memory bill, and the reason a model that fits comfortably in memory for inference may not fit for training at all (${chRef('pretraining')}).</p>`),
  ];

  const stepNum = claimFig('step');
  const scene = sceneStep();

  const tail = [
    prose(
      `<em>Fig. ${stepNum} — one training step through a 2 → 2 → 1 network with η = ${f2(ETA)}. Every value shown is computed live: forward pass in cyan, the loss scalar, the backward pass in red-orange with each node's gradient, the update in green, and then the same four beats repeated while the loss falls. The numbers are small enough to check on paper, and they are the same numbers the aside above produces.</em>`,
      `One accounting detail from that scene deserves emphasis, because it becomes an expensive fact later. The backward pass could not have run without the values the forward pass computed — x, the pre-activations, the activations. Those had to be held in memory the entire time, for every layer, for every example in the batch. Inference throws each layer's output away as soon as the next layer has consumed it; training cannot. At frontier scale the stored activations often outweigh the weights themselves, and the standard countermeasure — discard them and recompute during the backward pass — is a deliberate trade of extra arithmetic for memory (${chRef('pretraining')}).`,
      `The last gap between this and how models are really trained is the word "dataset". L(θ) was defined as the model's wrongness over the whole training set, so ∇L is a sum over every example in it. For a corpus of ten trillion tokens, computing one exact gradient means one pass over ten trillion tokens — to take a single step, of which we need millions. That is not a large cost, it is an infinite one.`),
    term('stochastic gradient descent', 'n.',
      'descent that uses the gradient of a small random subset of the data as an estimate of the full-dataset gradient: unbiased, vastly cheaper, and noisy on purpose'),
    prose(
      `<strong>Stochastic gradient descent</strong> resolves this by refusing to be exact. Sample a random handful of examples — a <em>minibatch</em> — compute the gradient of the loss on just those, and step. Because the batch is drawn at random, its gradient is an <em>unbiased</em> estimate of the true one: it is wrong on any given step, but wrong in a direction that averages to zero. Descent with a noisy gradient still descends, provided the steps are small enough that the noise averages out over many of them. Trading exactness for a thousand-fold increase in the number of steps you can afford is overwhelmingly the right trade, and it is not close.`),
    figSgd(),
    prose(
      `The noise is not purely a tax, either. A noiseless method comes to rest anywhere the gradient happens to vanish, including shallow dips and flat shelves that are nowhere near the bottom. A stochastic path does not sit still at such a point: the next batch disagrees slightly, and the disagreement pushes it back out. Practitioners talk about batch size as a compute-efficiency knob, but it is also a noise knob — and models trained with more noise often do better on text they were never trained on, an effect still argued about.`,
      `Two refinements are then near-universal and both fit in a sentence. <em>Momentum</em> accumulates a running average of past gradients and steps along that instead, damping the zigzag you watched in the widget. <em>Adam</em> goes further, keeping a running average of each parameter's gradient and of its squared gradient, and scaling every parameter's step by its own recent gradient size: a parameter whose gradient has been large lately gets a smaller step, and one whose gradient has been small gets a larger one. Every parameter ends up with its own learning rate, set by its own recent history rather than by the single η you chose. Both cost memory proportional to the number of parameters, and at frontier scale that bookkeeping becomes one of the dominant costs of training; ${chRef('pretraining')} does that arithmetic, along with Muon, the newer alternative that treats a whole weight matrix rather than a single coordinate as the unit of update.`),
    prose(
      `A closing honesty. Everything above is exact — the gradient really is the steepest direction, backpropagation really does compute it — but the guarantee people usually want does not exist. L(θ) for a real network is not a single smooth bowl with one bottom, the shape for which descent can be proved to work; the technical word for that shape is <em>convex</em>, and real loss surfaces are not. Two things go wrong. Wherever one direction bends upward and another bends downward, there is a point that is a low spot along one axis and a high spot along the other. The gradient vanishes there without anything being solved. These are <strong>saddle points</strong>, named for the shape of a saddle — rising front to back, falling side to side — and a real network has them everywhere. And low points are not unique: swap two hidden units, carrying their incoming and outgoing weights with them, and you have an entirely different θ that computes exactly the same function and scores exactly the same loss. Every minimum therefore arrives with an astronomical number of identical twins. Gradient descent offers no promise of reaching the lowest point anywhere on the surface, and on a surface this shape it offers no clean promise about merely-local low points either. It is a local rule applied repeatedly, and that is all it claims to be.`,
      `In practice this matters far less than it should, and the honest summary of why is that nobody fully knows. Some partial answers hold up. In very high dimension, most points where the gradient vanishes are saddles rather than minima — a minimum requires every one of a trillion directions to curve upward, which is a demanding coincidence — and minibatch noise slides the path off them. Networks carrying far more parameters than the data strictly requires — which is every model in this book — appear to have low ground shaped like a plateau rather than like a field of separate pits: wide connected regions you can wander a long way across while the loss barely moves. If that is the shape, then where on the low ground you happen to stop matters much less than the theory suggests. And empirically, runs from different random initializations reach very different parameters and very similar loss. The gap between how well this works and how well anyone can explain that it works is real, and it is worth knowing that what you are being handed here is an engineering practice with excellent evidence behind it rather than a theorem.`),
    takeaway(
      `Every chapter after this one argues about what f should be — which layers, which connections, which form of attention. The learning procedure underneath does not change: define a loss, obtain its gradient by the chain rule in one backward sweep, take a small step against it, repeat on a fresh random batch. ${chRef('pretraining', { cap: true })} is this exact loop with a datacenter bolted to it.`),
  ];

  return chapter(id, head, middle, backprop, scene, tail);
}
