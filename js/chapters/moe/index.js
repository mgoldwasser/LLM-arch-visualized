/* Mixture of experts — the dense SwiGLU block replaced by 896 small experts
   behind a router, a click-the-token routing widget, and the rich-get-richer
   collapse that balancing schemes exist to stop. */

import { chapter, chapterHead, prose, term, mathAside, goDeeper, claimFig, chRef, figRef } from '../../core/components.js';
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
      `The catch is that routing is a learned decision feeding back into its own training data. Left alone, routers collapse: a few early-lucky experts get all the traffic, get all the gradient, get better, get more traffic — while the rest atrophy. Classic MoEs fight this by adding a second penalty to the loss, one that punishes lopsided traffic, scaled by a number somebody has to pick by hand; too weak and you collapse, too strong and routing quality suffers.`,
      `K3&rsquo;s answer is to stop tuning and start sorting. Take the scores one expert hands out across a whole batch of tokens, put them in order, and read off the cut point above which that expert would be taking exactly its fair share of the traffic — a cut point in a sorted list is a <em>quantile</em>, and that is the whole of the idea. Every expert&rsquo;s cut point is computed the same way, so the shares come out even by construction. There is no hand-picked number left in the scheme to get wrong. K3 calls this <strong>Quantile Balancing</strong>.`),
    collapseFigure(),

    prose(
      `Balance also matters for a blunt hardware reason: ${E.routed} experts don&rsquo;t fit on one GPU, so they are sharded across many (<strong>expert parallelism</strong>, one of the slicing axes in ${chRef('pretraining')}), and every MoE layer becomes an all-to-all network exchange — tokens physically travel to whichever GPUs hold their winning experts and back. A hot expert means a hot GPU that every other device waits on. Moonshot reports training K3 with the traffic split evenly by design rather than by penalty: every GPU is handed the same number of tokens on every step, so the amount of work each one does is fixed before the step begins and none of them sits idle waiting for a straggler. For serving, they recommend at least 64 accelerators wired together tightly enough to behave like a single machine.`),

    goDeeper('how a router learns, when picking an expert is all-or-nothing', `
      <p><strong>The awkwardness in one sentence.</strong> The router is trained by gradient descent like everything else, but the thing it does is <em>choose</em> &mdash; and a choice is not the kind of quantity gradient descent can work with. Nudge one expert&rsquo;s score by a hair and almost always nothing happens at all; nudge it a hair further and an expert flips from unused to used. ${chRef('learning', { cap: true })}&rsquo;s machinery needs an output that responds a little to a small change, and an all-or-nothing pick does not.</p>
      <p><strong>The way around it.</strong> The winners&rsquo; scores are not thrown away once the choice is made. Each winning expert&rsquo;s output is multiplied by its own score on the way back into the stream &mdash; the score doubles as a volume knob. That knob <em>is</em> a smooth quantity, so the gradient can reach it. If turning expert&nbsp;12 up would have made the next-token prediction better, 12&rsquo;s score rises for tokens like this one; if it would have made it worse, the score falls. Over enough tokens, an expert&rsquo;s score becomes a learned statement about which tokens it is good at.</p>
      <p><strong>The catch, and why routers collapse.</strong> Notice which experts learn nothing from this: the ones that were not picked. They contributed no part of the answer, so there is no evidence about whether picking them would have helped. Only winners get feedback. That single fact is the whole of the collapse described above &mdash; an expert that wins slightly more traffic early receives slightly more gradient, gets slightly better, and wins slightly more traffic; an expert that loses early is never picked, never improves, and stays unpicked. The loop is not a training accident to be debugged. It is what learning-only-through-the-winners does, every time, which is why balance has to be imposed from outside rather than waited for.</p>`),

    mathAside('routing and the balancing problem', `
      <p>With router weights W_r ∈ ℝ^(E×d), scores s = W_r x and gate values g = normalize(top-k(s)):</p>
      <div class="eq">y = E_shared(x) + Σ_{i ∈ top-k(s)} gᵢ · Eᵢ(x)</div>
      <p>Top-k is non-differentiable; the gradient path to the router runs through the gᵢ factor on the selected experts. The classic auxiliary loss (Switch Transformer) is L_aux = α·E·Σᵢ fᵢ·Pᵢ, where fᵢ is the fraction of tokens dispatched to expert i and Pᵢ its mean router probability — minimized when traffic is uniform. DeepSeek-V3 dropped the loss for a per-expert bias adjusted online; K3&rsquo;s Quantile Balancing goes further, computing allocation from score quantiles with no tuned coefficient.</p>`),

    goDeeper('what do experts actually specialize in?', `
      <p><strong>The short answer: not the categories you would hope for.</strong> It is tempting to picture the finished model as a staffed building &mdash; expert&nbsp;12 handles chemistry, expert&nbsp;340 does French poetry. No one has found a model that works that way, and there is no reason it should. Nowhere in training does anyone write down a list of subjects; nothing rewards a division of labour that a person would find legible. The router is optimized for one thing only, which is next-token loss.</p>
      <p><strong>What is actually found.</strong> When mixture-of-experts models that anyone can inspect are taken apart, the divisions that show up are lower-level and more mechanical than topic: one expert takes much of the punctuation, another the numerals, another identifiers in code, another the tokens of a particular language, another the whitespace that indents things. The picture also changes with depth &mdash; whatever the experts are dividing at layer&nbsp;3, it is not what they are dividing at layer&nbsp;40. Two hedges are worth keeping: these are findings on the open models, and frontier models are not open enough to check; and &ldquo;mostly&rdquo; is doing real work &mdash; the tendencies are statistical, not clean partitions.</p>
      <p><strong>Why the shared expert helps at all.</strong> Suppose every routed expert also had to handle the ordinary business of grammar. Every token needs that, so every expert would end up learning its own copy, and the experts would differ from each other only at the margins. Giving that universal work to one expert that sees every token removes it from the competition, and what is left for the routed experts to learn is precisely the part that varies. Specialization is partly just the shared work having been taken away.</p>
      <p><strong>And it is not a word that gets assigned, it is one token at one layer.</strong> The choice is remade from scratch in every MoE layer. The same word can go to ${E.active} experts at layer&nbsp;3 and ${E.active} entirely different ones at layer&nbsp;40 &mdash; and to different ones again in another sentence, because the router reads the token&rsquo;s stream vector, which by then has been reshaped by everything around it. So &ldquo;which expert handles X&rdquo; has no stable answer even for a single word, and you cannot lift out &ldquo;the chemistry experts&rdquo; and ship them as a small chemistry model. The specialization is real, and it is not stored in a form that can be cut along topics.</p>`));
}
