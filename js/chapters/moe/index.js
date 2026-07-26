/* Mixture of experts — the dense SwiGLU block replaced by 896 small experts
   behind a router, a click-the-token routing widget, and the rich-get-richer
   collapse that balancing schemes exist to stop. */

import { chapter, chapterHead, prose, term, mathAside, claimFig, chRef, figRef } from '../../core/components.js';
import { si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { swapScene } from './scene-swap.js';
import { routerWidget } from './widget-router.js';
import { collapseFigure } from './fig-collapse.js';

const E = K3.experts;          // { routed: 896, active: 16, shared: 1 }

export function render({ id, num, title }) {
  /* Two of this chapter's figures carry their captions in the prose beneath
     them, so they claim their numbers here — in the order they appear. */
  claimFig('swap');
  const scene = swapScene();
  claimFig('router');
  const router = routerWidget();

  return chapter(id,
    chapterHead(num, 'Sparsity', `${title}: ${si(K3.totalParams).replace('T', '')} trillion parameters, mostly asleep`),

    scene,
    prose(`<em>${figRef('moe', 'swap')} — the MoE swap: one enormous gated MLP becomes ${E.routed} small experts behind a learned router, plus one shared expert that never switches off.</em>`),

    term('router', 'n.', 'a linear map from the token&rsquo;s stream vector to one affinity score per expert; the top-<em>k</em> scorers process the token, weighted by their (normalized) scores'),
    prose(
      `One refinement, inherited from DeepSeek and Kimi K2: a <strong>shared expert</strong> that processes every token unconditionally, alongside the routed winners. It soaks up the patterns all tokens need — basic syntax, common composition — freeing the routed experts to specialize. Watch the router work:`),

    router,
    prose(`<em>${figRef('moe', 'router')} — illustrative routing. Note tokens of the same flavor (&ldquo;Py&rdquo;/&ldquo;Torch&rdquo;, math symbols) light up overlapping expert clusters — specialization is emergent, never programmed.</em>`),

    prose(
      `The catch is that routing is a learned decision feeding back into its own training data. Left alone, routers collapse: a few early-lucky experts get all the traffic, get all the gradient, get better, get more traffic — while the rest atrophy. Classic MoEs fight this with an auxiliary load-balancing loss and a hand-tuned coefficient; too weak and you collapse, too strong and routing quality suffers. K3&rsquo;s <strong>Quantile Balancing</strong> instead derives expert allocation directly from the router-score quantiles, eliminating that hyperparameter entirely — one of the things its ${K3.moeFramework} framework names.`),
    collapseFigure(),

    prose(
      `Balance also matters for a blunt hardware reason: ${E.routed} experts don&rsquo;t fit on one GPU, so they are sharded across many (<strong>expert parallelism</strong>, one of the slicing axes in ${chRef('pretraining')}), and every MoE layer becomes an all-to-all network exchange — tokens physically travel to whichever GPUs hold their winning experts and back. A hot expert means a hot GPU that every other device waits on. Moonshot reports training K3 with a fully balanced expert-parallel scheme — static tensor shapes, no host synchronization on the critical path — and recommends serving it on supernodes of 64+ accelerators.`),

    mathAside('routing and the balancing problem', `
      <p>With router weights W_r ∈ ℝ^(E×d), scores s = W_r x and gate values g = normalize(top-k(s)):</p>
      <div class="eq">y = E_shared(x) + Σ_{i ∈ top-k(s)} gᵢ · Eᵢ(x)</div>
      <p>Top-k is non-differentiable, but gradients still reach the router through the gᵢ weighting of selected experts. The classic auxiliary loss (Switch Transformer) is L_aux = α·E·Σᵢ fᵢ·Pᵢ, where fᵢ is the fraction of tokens dispatched to expert i and Pᵢ its mean router probability — minimized when traffic is uniform. DeepSeek-V3 dropped the loss for a per-expert bias adjusted online; K3&rsquo;s Quantile Balancing goes further, computing allocation from score quantiles with no tuned coefficient.</p>`),

    mathAside('none needed — what do experts actually specialize in?', `
      <p>Rarely the clean human categories you&rsquo;d hope for (&ldquo;the chemistry expert&rdquo;). Analyses of open MoEs find specialization is mostly at the token/pattern level — punctuation, numbers, code identifiers, particular languages, whitespace regimes — and varies by depth. The shared expert is one reason cleaner division of labor emerges at all: with common patterns handled unconditionally, routed experts stop duplicating them. Routing is decided per token per layer: the same word can visit ${E.active} different experts at layer 3 and layer 40.</p>`));
}
