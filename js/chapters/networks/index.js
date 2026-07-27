/* From one neuron to a network.

   The chapter answers the question the previous one leaves open: if composing
   linear maps only ever gives another linear map, what makes depth worth
   anything? Spine here; the sticky build-up scene, the steerable boundary
   widget, and the two tracked figures live in sibling files. */

import {
  chapter, chapterHead, prose, term, mathAside, goDeeper, widget, takeaway,
  claimFig, chRef, figRef,
} from '../../core/components.js';
import { sceneBuild } from './scene-build.js';
import { boundaryWidget } from './widget-boundary.js';
import { approxFigure } from './fig-approx.js';
import { actsFigure } from './fig-acts.js';

export function render({ id, num, title }) {
  // The scene is captioned by the prose that follows it, so it claims its
  // number here — before any figure() call further down the page.
  const buildFig = claimFig('build');
  const scene = sceneBuild();

  return chapter(id,
    chapterHead(num, 'Depth and nonlinearity', title),

    prose(
      `${chRef('vectors', { cap: true })} closed on a result that ought to look like bad news. If <em>y</em>&nbsp;=&nbsp;<em>xW</em>₁ and then <em>z</em>&nbsp;=&nbsp;<em>yW</em>₂, the composite is <em>z</em>&nbsp;=&nbsp;<em>x</em>(<em>W</em>₁<em>W</em>₂): a single matrix. Chain a hundred of them and the chain is still one matrix — one linear map, computable in one multiplication. A frontier language model is, structurally, a stack of matrix multiplications about a hundred layers deep. If that stack collapsed the way the theorem says it should, the whole enterprise would be an elaborate way to write down a single matrix.`,
      `It does not collapse, and the reason is almost insultingly small: between the matrices sits one fixed function, applied to one number at a time. Everything in this chapter follows from that — why the function has to be nonlinear, what its presence lets depth do that width alone cannot, and how much of the mythology around &ldquo;neural networks can learn anything&rdquo; survives contact with the actual theorem.`),

    /* ---- 1 · one neuron ---------------------------------------------------- */
    prose(
      `<strong>One neuron.</strong> The smallest unit in the machine takes a vector <strong>x</strong> and returns a single number. It holds a weight vector <strong>w</strong> of the same length and a scalar bias <em>b</em>, both learned, and it computes σ(<strong>w</strong>·<strong>x</strong>&nbsp;+&nbsp;<em>b</em>): one dot product, one addition, one fixed nonlinear function. The dot product is the entire arithmetic content — the machinery from the previous chapter, unchanged. What is new is σ, and σ has no parameters at all. It is chosen by the architect and never trained.`,
      `The dot product already carries a geometric reading, and it is worth taking seriously because it is what a neuron <em>is</em>. The set of points where <strong>w</strong>·<strong>x</strong>&nbsp;+&nbsp;<em>b</em>&nbsp;=&nbsp;0 is a flat sheet through space: a line in two dimensions, a plane in three, a <em>hyperplane</em> in <em>d</em>. The vector <strong>w</strong> points perpendicular to that sheet, and <em>b</em> slides the sheet off the origin. So the pre-activation number the neuron computes answers two questions in one: which side of my sheet is <strong>x</strong> on (the sign), and how far from it (the magnitude). A neuron is a question about position, asked in a direction it chose for itself.`),

    term('neuron', 'n.', 'the smallest computational unit of a network: σ(<strong>w</strong>·<strong>x</strong> + b) — one learned weight vector, one learned bias, one fixed nonlinearity, one scalar out'),

    goDeeper('what the bias does, and what the size of the weights does', `
      <p><strong>A neuron holds three separate dials, and they do not overlap.</strong> Picture the two-dimensional case, where the neuron&rsquo;s sheet really is a line on a page. Every input gets a score before σ ever sees it: positive on one side of the line, negative on the other, exactly zero on the line itself.</p>
      <p><strong>The direction of the weight vector chooses what the question is about.</strong> <strong>w</strong> points straight across the line, at right angles to it. Turn the arrow and the line turns with it, and the neuron is now asking about something else entirely.</p>
      <p><strong>The bias b slides the line without turning it.</strong> Same question, different threshold — like moving a pass mark from 50 to 65 while still grading the same exam.</p>
      <p><strong>The size of the weights sets how sharp the answer is, and moves the line not at all.</strong> This is the one that surprises people. Double every number in <strong>w</strong> and every score doubles — but the place where the score was zero has not moved, because twice zero is still zero. What changed is how fast the score climbs as you walk away from the line. σ makes its swing from one extreme to the other over a fixed range of scores, so if the scores climb twice as fast, the swing is over in half the distance. Large weights give a neuron that flips almost instantly from &ldquo;no&rdquo; to &ldquo;yes&rdquo;: a hard step. Small weights give a gentle ramp, still undecided a long way out on either side.</p>
      <p>That last fact is worth carrying forward, because it comes back twice. Training changes not only where a network&rsquo;s neurons draw their lines but how decisively they commit to them — and nothing in the architecture sets that, only the sizes the weights happen to settle on. It is also why the choice of σ is discussed later in terms of its <em>slope</em> rather than its shape.</p>`),

    mathAside('the hyperplane, and what scaling w does to it', `
      <p>Write the pre-activation as u(<strong>x</strong>) = <strong>w</strong>·<strong>x</strong> + b. Its zero set is the hyperplane</p>
      <div class="eq">H = { <strong>x</strong> ∈ ℝᵈ : <strong>w</strong>·<strong>x</strong> + b = 0 }</div>
      <p>and for any point the signed perpendicular distance to H is u(<strong>x</strong>) / ‖<strong>w</strong>‖. So H depends only on the <em>direction</em> of <strong>w</strong> and on the ratio b/‖<strong>w</strong>‖: the plane sits at distance −b/‖<strong>w</strong>‖ from the origin along <strong>w</strong>. Replacing <strong>w</strong> by k<strong>w</strong> and b by kb therefore leaves H exactly where it was while multiplying u everywhere by k, so σ traverses its whole range across a strip 1/k as wide.</p>`),

    /* ---- 2 · a layer is the matrix product, plus σ -------------------------- */
    prose(
      `<strong>A layer is not a new idea.</strong> Put <em>k</em> neurons side by side, all reading the same input <strong>x</strong>. Each contributes one dot product, so the layer produces <em>k</em> numbers — and <em>k</em> dot products against <em>k</em> weight vectors is precisely the matrix product from the previous chapter. Stack the weight vectors as the columns of a matrix <em>W</em>, collect the biases into a vector <strong>b</strong>, and the layer is <em>h</em>&nbsp;=&nbsp;σ(<em>xW</em>&nbsp;+&nbsp;<strong>b</strong>), with σ applied to each coordinate independently. The inside of that expression — multiply by a matrix, then add a fixed offset vector — is the previous chapter&rsquo;s linear map with a constant added, and it has its own name: an <strong>affine</strong> map. Every layer in this book is one affine map with one elementwise function on the end. The linear algebra is identical to what you already have; the layer adds exactly one thing, that function on the way out. Every &ldquo;neural network&rdquo; diagram of circles and arrows you have ever seen is this expression, drawn the long way.`,
      `That elementwise qualifier is doing real work. σ never mixes coordinates — coordinate 3 of the output depends on coordinate 3 of <em>xW</em>&nbsp;+&nbsp;<strong>b</strong> and nothing else. All the mixing lives in the matrix; all the bending lives in σ. Keeping those two jobs separate is what makes the whole stack analyzable, and it is why the transformer block you will meet later is still describable as a short list of matrices with a couple of fixed functions between them.`),

    term('hidden layer', 'n.', 'a layer that is neither the network&rsquo;s input nor its final output — its values exist only to be read by the next layer, which is why nobody specifies what they should mean'),
    term('activation function', 'n.', 'the fixed, elementwise, nonlinear function applied after an affine map; the only part of a layer with no learned parameters, and the only reason depth is not decorative'),

    scene,

    prose(
      `<em>Fig. ${buildFig} — one neuron becomes a layer becomes a two-layer network; when σ is dissolved into the identity the decision boundary flattens to a single straight line, and restoring σ bends it back around the data.</em>`,
      `Step three is the load-bearing moment of the chapter, so it is worth writing out. Remove σ and the two layers are two affine maps in sequence. The first sends <strong>x</strong> to <em>xW</em>₁&nbsp;+&nbsp;<strong>b</strong>₁; the second multiplies that by <em>W</em>₂ and adds <strong>b</strong>₂. Expand it and the parentheses do all the damage: the result is <em>x</em>(<em>W</em>₁<em>W</em>₂)&nbsp;+&nbsp;(<strong>b</strong>₁<em>W</em>₂&nbsp;+&nbsp;<strong>b</strong>₂), which is one matrix and one bias vector. Not approximately one — exactly one, for every input, forever. The hidden layer has no effect that a single layer could not have had, and its parameters are pure redundancy.`,
      `A single affine map ending in a threshold can carve space exactly one way: with one flat cut. The four clusters in the figure are the standard counterexample — two classes arranged so that no straight line has one class on each side. This is not a hard problem in any interesting sense; it is the <em>easiest</em> problem a straight line cannot solve, and a linear model of any depth fails it completely.`),

    term('decision boundary', 'n.', 'the set of inputs on which a classifier is exactly undecided: every point where its score comes out at exactly zero. Picture the score as a landscape over the input space — the boundary is the single contour line at sea level. An affine map can only ever draw that line straight'),

    mathAside('the collapse, in one line of algebra', `
      <p>Two layers, no activation function, using the row-vector convention from the previous chapter:</p>
      <div class="eq">h = xW₁ + b₁
z = hW₂ + b₂
  = (xW₁ + b₁)W₂ + b₂
  = x(W₁W₂) + (b₁W₂ + b₂)
  = xM + c</div>
      <p>with M = W₁W₂ a single matrix and c a single vector. The argument chains: L layers collapse to M = W₁W₂⋯W_L. Note also the rank ceiling — if the layers have widths d₀, d₁, …, d_L then rank(M) ≤ min(d₀, …, d_L), so a narrow layer in the middle permanently caps what the whole stack can express, activation or no activation. Insert any function that is not affine between the multiplications and the third line stops being available: (σ(xW₁ + b₁))W₂ cannot be redistributed, and the composite is genuinely new.</p>`),

    /* ---- 3 · the widget ---------------------------------------------------- */
    prose(
      `The widget below is the smallest network that can show all of this: two inputs, two hidden neurons, one output unit whose weights are held fixed so that the only thing you steer is where the two hidden hyperplanes sit. The forward pass runs live on a grid of forty by forty sample points and the field you see is what it returns. Find a setting that reaches 100%, then switch σ off without touching anything else.`),

    widget('the two-neuron boundary',
      'six sliders · one toggle · live forward pass',
      boundaryWidget()),

    prose(
      `With σ off, no arrangement of the six sliders produces a bent boundary. You can move the straight line, tilt it, push it out of the frame — but every setting gives the same family of parallel straight contours, because every setting computes the same kind of function. The nonlinearity is not a performance tweak or a training trick. It is the difference between a model class that contains the answer and one that does not.`),

    /* ---- 4 · what depth buys ---------------------------------------------- */
    prose(
      `<strong>What depth buys, once σ is present.</strong> The first layer&rsquo;s neurons ask questions directly about the input: which side of this hyperplane, how far past that one. The second layer&rsquo;s neurons never see the input at all. They see the first layer&rsquo;s answers, and they ask questions about <em>those</em> — combinations of combinations. In the figure, three first-layer thresholds along one direction become, after the second layer reads them, a band: a region bounded on both sides, which no single threshold could ever describe.`,
      `Iterate that and you get the picture the rest of this book relies on. Early layers detect small, local, generic structure; middle layers assemble those detections into larger objects; late layers commit to a conclusion. Each layer refines a representation it received rather than starting over — which is why a deep model can be read as performing a sequence of small edits to a running belief, and why ${chRef('residual')} builds the transformer around exactly that idea. The multi-layer perceptron sublayer inside every transformer block is the construction from this chapter, unmodified: an affine map up to a wider space, an elementwise nonlinearity, an affine map back down — applied to one token&rsquo;s vector at a time.`),

    /* ---- 5 · universal approximation, honestly ----------------------------- */
    prose(
      `<strong>The theorem everyone quotes.</strong> A single hidden layer, made wide enough, can approximate any continuous function on a bounded region to any accuracy you name. The construction is easy to see once you have the hyperplane picture. One sigmoid neuron gives a soft step. Subtract a second step shifted slightly along, and the difference is a bump — nonzero on a narrow interval and near zero everywhere else. Scale each bump by the height the target function has there, add up enough of them, and you have tiled the target. Scroll the figure and watch it happen.`),

    approxFigure(),

    prose(
      `Now the honest reading, because this theorem is quoted far past what it says. It is an <strong>existence</strong> result. It promises that some setting of the weights achieves the approximation; it says nothing about how many neurons that setting needs, and the count can explode — the naive bump construction needs a number of units growing exponentially in the input dimension, which for a model reading thousands-dimensional vectors is not a plan. It also says nothing about whether the training procedure of ${chRef('learning')} will ever <em>find</em> those weights; approximation theory and optimization are separate subjects, and a function being representable is no guarantee it is reachable by gradient descent from a random start.`,
      `And it is silent on the question that actually decides architectures: depth versus width. There are function families that a depth-<em>k</em> network represents with a modest number of units and that any depth-(<em>k</em>−1) network needs exponentially many units to match — composition is cheap, and emulating composition by brute-force tiling is not. Empirically the gap is decisive: nobody builds the wide shallow network the theorem describes, because deep stacks predict just as well — the same score on the one quantity training measures, how wrong the model&rsquo;s predictions are, which ${chRef('learning')} defines as its <strong>loss</strong> — with orders of magnitude fewer parameters. Universal approximation tells you the hypothesis space is not the obstacle. It does not tell you how to build anything.`),

    /* ---- 6 · which nonlinearity ------------------------------------------- */
    prose(
      `<strong>Which function, then?</strong> Less than you might expect rides on the choice, as long as it is not affine. The historical default was the <strong>sigmoid</strong>, σ(z)&nbsp;=&nbsp;1/(1&nbsp;+&nbsp;e⁻ᶻ), which squashes any real number into (0,&nbsp;1) and reads naturally as a soft yes-or-no. Its defect shows up only when you ask about its slope: the derivative peaks at ¼ and falls off exponentially, so a neuron driven to either extreme is <em>saturated</em> — its output barely responds to its input, and the learning signal that has to travel back through it is multiplied by something near zero. Stack a few dozen of those and the signal reaching the early layers is negligible.`,
      `<strong>ReLU</strong>, max(0,&nbsp;z), is the workhorse that replaced it, and its virtue is entirely in the slope: exactly 1 wherever the unit is active, exactly 0 where it is not. Nothing is attenuated on the way back. The cost is that a unit pushed permanently negative contributes nothing and receives nothing — a dead unit. ReLU is also the reason the boundaries in this chapter&rsquo;s figures are made of straight segments rather than smooth curves: a ReLU network computes a piecewise-linear function, folding space along one crease per unit, and enough creases approximate any curve you like.`),

    actsFigure(),

    prose(
      `Production models use neither in its plain form. The modern block splits the hidden layer into two parallel projections and lets one multiplicatively gate the other, with a smoothed relative of ReLU in the gate — the SwiGLU family. That is a genuine architectural change rather than a different curve, and ${chRef('anatomy')} takes it apart properly. For this chapter the point stands as stated: a nonlinearity is mandatory, its exact shape is a second-order decision, and its effect on the gradient is the property that actually decided the argument.`,
      `One thing has been assumed throughout and is still owed. Every weight and bias here was handed to you already set — chosen so the band would land in the right place. Nothing in this chapter explains where those numbers come from, and no one chooses them by hand: a frontier model has trillions of them. ${chRef('learning', { cap: true })} is about the procedure that finds them, and the reason it works is the same reason the slopes in the figure above mattered.`),

    takeaway(
      `A neuron is a dot product against a learned direction, offset by a learned bias, pushed through a fixed nonlinear function — a question about which side of a hyperplane you are on. A layer is many of those in parallel, which is the matrix product you already knew plus one elementwise function. That function is not a detail: without it, any stack of layers multiplies out into a single matrix whose decision boundary is one flat cut, and depth buys literally nothing. With it, each layer composes features out of the previous layer&rsquo;s features, and a stack becomes a sequence of refinements. A wide enough single layer can approximate anything in principle; depth is what makes it affordable in practice. ` +
      `Everything from here on — attention included — is this construction, arranged more cleverly (${figRef('networks', 'build')}).`));
}
