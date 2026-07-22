/* Chapter 01 — the objective. One task: predict the next token.
   Sticky scene: the autoregressive loop, animated as you scroll. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, specTable, takeaway, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { seg, lerp, ease, clamp } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

/* ---- the sticky figure: token IDs in → one distribution out → sample → loop */

function loopFigure(canvas) {
  const W = 720, H = 470;

  const ctxTokens = ['The', 'capital', 'of', 'France', 'is'];
  const dist = [
    ['Paris', 0.87], ['the', 0.04], ['located', 0.02], ['a', 0.015], ['Lyon', 0.01],
  ];
  const dist2 = [
    ['.', 0.61], [',', 0.21], ['—', 0.07], ['and', 0.04], ['(', 0.02],
  ];

  const tokW = 86, tokH = 34, tokY = 46;
  const tokX = (i) => 34 + i * (tokW + 10);

  // input token chips (+ slot for the appended "Paris")
  const chips = ctxTokens.map((t, i) => svg('g', { transform: `translate(${tokX(i)}, ${tokY})` },
    svg('rect', { width: tokW, height: tokH, rx: 7, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
    svg('text', { x: tokW / 2, y: 22, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 14 }, t)));

  const appended = svg('g', { opacity: 0 },
    svg('rect', { width: tokW, height: tokH, rx: 7, fill: 'rgba(224,168,76,0.15)', stroke: PAL.weight, 'stroke-width': 1.2 }),
    svg('text', { x: tokW / 2, y: 22, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 14 }, 'Paris'));

  const inLabel = svg('text', { x: 34, y: 30, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'input tokens (integer IDs)');

  // arrow into the model
  const arrow1 = svg('path', { d: `M ${W / 2} ${tokY + tokH + 8} L ${W / 2} 130`, stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#arr)' });

  // the model box
  const model = svg('g', {},
    svg('rect', { x: W / 2 - 130, y: 138, width: 260, height: 64, rx: 12, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.4 }),
    svg('text', { x: W / 2, y: 165, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 15 }, 'Kimi K3'),
    svg('text', { x: W / 2, y: 186, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 11 }, 'one deterministic function'));
  const modelPulse = svg('rect', { x: W / 2 - 130, y: 138, width: 260, height: 64, rx: 12, fill: 'none', stroke: PAL.act, 'stroke-width': 2, opacity: 0 });

  const arrow2 = svg('path', { d: `M ${W / 2} 210 L ${W / 2} 246`, stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#arr)' });

  // the distribution
  const distLabel = svg('text', { x: 150, y: 268, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 },
    `one probability distribution over all ${(K3.vocab / 1000).toFixed(0)}k tokens`);
  const barX = 245, barMax = 300, rowH = 26, distY = 284;
  const rows = dist.map(([w, p], i) => {
    const y = distY + i * rowH;
    return {
      label: svg('text', { x: barX - 12, y: y + 13, 'text-anchor': 'end', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 13 }, w),
      bar: svg('rect', { x: barX, y, height: 16, width: 0, rx: 3, fill: PAL.act, opacity: 0.9 }),
      val: svg('text', { x: barX + 8, y: y + 13, fill: PAL.bg, 'font-family': 'monospace', 'font-size': 11, opacity: 0 }, p.toFixed(p < 0.02 ? 3 : 2)),
      p, w,
    };
  });
  const more = svg('text', { x: barX - 12, y: distY + 5 * rowH + 10, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 11 }, '⋮ 159,995 more');

  // sampling highlight + return path
  const samplePick = svg('rect', { x: barX - 90, y: distY - 5, width: barMax + 110, height: 26, rx: 6, fill: 'none', stroke: PAL.weight, 'stroke-width': 1.6, opacity: 0 });
  const sampleTag = svg('text', { x: barX + barMax + 16, y: distY + 12, fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, 'sampled');
  const loopPath = svg('path', {
    d: `M ${barX + barMax + 60} ${distY + 8} C ${W - 20} ${distY - 60}, ${W - 20} 90, ${tokX(5) + tokW + 10} ${tokY + tokH / 2}`,
    stroke: PAL.weight, 'stroke-width': 1.6, fill: 'none', 'stroke-dasharray': '5 5', opacity: 0, 'marker-end': 'url(#arrW)',
  });
  const loopTag = svg('text', { x: W - 26, y: 158, 'text-anchor': 'end', fill: PAL.weight, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, 'append · run again');

  const defs = svg('defs', {},
    svg('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'arrW', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.weight })));

  canvas.append(svgRoot(W, H, { role: 'img', 'aria-label': 'The autoregressive loop: token IDs go into the model, one probability distribution comes out, one token is sampled and appended, and the model runs again.' },
    defs, inLabel, chips, appended, arrow1, model, modelPulse, arrow2, distLabel, more,
    rows.map((r) => [r.label, r.bar, r.val]), samplePick, sampleTag, loopPath, loopTag));

  // per-scroll update. Windows over global progress p (4 steps):
  //  step 0: context tokens appear;  step 1: forward pass → distribution
  //  step 2: sample "Paris";         step 3: append + loop, second distribution
  return (p) => {
    const tIn = seg(p, 0.02, 0.2);
    chips.forEach((c, i) => {
      const t = seg(tIn, i / 6, (i + 2) / 6, ease.out);
      c.setAttribute('opacity', t);
      c.setAttribute('transform', `translate(${tokX(i)}, ${lerp(tokY - 14, tokY, t)})`);
    });
    arrow1.setAttribute('opacity', seg(p, 0.16, 0.24));

    const tFwd = seg(p, 0.26, 0.34);
    modelPulse.setAttribute('opacity', tFwd * (1 - tFwd) * 4);

    const useSecond = p > 0.85;
    const tDist = useSecond ? seg(p, 0.86, 0.96, ease.out) : seg(p, 0.3, 0.48, ease.out);
    const data = useSecond ? dist2 : dist;
    rows.forEach((r, i) => {
      const [w, pr] = data[i];
      const t = seg(tDist, i * 0.08, 0.6 + i * 0.08, ease.out);
      const width = Math.max(0, (barMax * pr) / 0.9 * t);
      r.bar.setAttribute('width', width);
      r.label.textContent = w;
      r.val.textContent = pr.toFixed(pr < 0.02 ? 3 : 2);
      r.val.setAttribute('opacity', t);
      r.val.setAttribute('x', barX + Math.max(width + 8, 8));
      r.val.setAttribute('fill', width > 44 ? PAL.bg : PAL.tx);
      if (width > 44) r.val.setAttribute('x', barX + width - 40), r.val.setAttribute('fill', PAL.bg);
    });

    const tPick = seg(p, 0.52, 0.62);
    samplePick.setAttribute('opacity', useSecond ? 0 : tPick);
    sampleTag.setAttribute('opacity', useSecond ? 0 : tPick);

    const tLoop = seg(p, 0.66, 0.8);
    loopPath.setAttribute('opacity', tLoop);
    loopTag.setAttribute('opacity', tLoop);
    const tApp = seg(p, 0.74, 0.85, ease.outBack);
    appended.setAttribute('opacity', tApp > 0 ? 1 : 0);
    appended.setAttribute('transform',
      `translate(${lerp(barX + barMax - 40, tokX(5) + 6, clamp(tApp))}, ${lerp(distY - 6, tokY, clamp(tApp))})`);
  };
}

/* ---- chapter assembly ---------------------------------------------------- */

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'The objective', title),
    prose(
      `Strip away the chat interface and an LLM is a single deterministic function. It takes a sequence of <strong>tokens</strong> — integer IDs standing for chunks of text, defined properly in the next chapter — and returns one probability distribution over its entire vocabulary: given everything so far, how likely is each possible next token? That is the whole interface. There is no lookup database, no retrieval step, no grammar engine inside. One function, applied over and over.`,
      `Generation is a loop around that function: score all candidate next tokens, pick one (how you pick is a genuine design decision — chapter 09), append it to the input, and run again. Because each output token is fed back as input, the model is called <strong>autoregressive</strong>. Chat, code completion, chain-of-thought reasoning, tool use — every behavior you have seen from an LLM is this loop, executed at a few dozen tokens per second.`),
    term('autoregressive', 'adj.', 'predicting element <em>t</em> from elements 1…<em>t</em>−1 of the same sequence, then consuming its own prediction'),

    createScene({
      id: 'objective-loop',
      figure: loopFigure,
      steps: [
        { n: 'The interface', html: `<p>The entire external surface of the model: a sequence of token IDs goes in. Nothing else — no parse tree, no database handle, no memory beyond the sequence itself.</p>` },
        { n: 'One forward pass', html: `<p>The function runs once and emits exactly one thing: a probability for <em>every</em> token in the 160k-entry vocabulary. Most of the mass lands on a handful of plausible continuations.</p>` },
        { n: 'Pick one', html: `<p>Something outside the model chooses a single token from that distribution — greedily, or with controlled randomness. The model itself is done; choosing is <em>sampling policy</em>, a serving-time decision (chapter 09).</p>` },
        { n: 'Append, repeat', html: `<p>The chosen token is appended to the input and the function runs again, now conditioned on its own output. That loop <em>is</em> generation — a few dozen turns of it per second, and nothing more.</p>` },
      ],
    }),
    prose(
      `<em>Fig. 1.1 — the entire external interface of an LLM: token IDs in, one distribution out, sampled and fed back.</em>`,
      `Why does such a narrow objective produce broad capability? Because predicting the next token <em>well</em>, across trillions of tokens of human output, is not a narrow task. To beat the naive frequency baseline on the token that follows <code>"the integral of x² is"</code>, you need calculus. To predict the next move in a chess transcript, you need chess. Prediction error is a compression bound: any regularity in the data that the model fails to capture shows up as residual loss. Grammar, facts, code semantics, and multi-step reasoning are not separate modules that engineers added — they are what the loss surface demands.`,
      `The objective also has a decisive practical property: it is <strong>self-supervised</strong>. Every position in every document is a labeled training example — the label is simply the token that actually came next. No annotation pipeline, no human raters. That is what lets training corpora reach tens of trillions of tokens, and it is why the field's scaling story (chapter 07) was possible at all.`),
    term('self-supervised', 'adj.', 'the training signal is derived from the data itself rather than from external labels'),
    mathAside('the objective, precisely', `
      <p>Any distribution over sequences factorizes exactly, by the chain rule of probability, into next-token conditionals:</p>
      <div class="eq">p(x₁,…,x_T) = ∏ₜ p(xₜ | x₁,…,xₜ₋₁)</div>
      <p>The model p<sub>θ</sub> approximates each conditional, and training minimizes the negative log-likelihood — equivalently the cross-entropy — averaged over positions: L(θ) = −Σₜ log p<sub>θ</sub>(xₜ | x&lt;ₜ). Minimizing L is the same as minimizing the KL divergence from the data distribution to the model, and (by the source-coding theorem) the same as minimizing the number of bits needed to encode the corpus. “Language modeling is compression” is a theorem, not a slogan.</p>`),
    prose(
      `Our specimen throughout is <strong>${K3.name}</strong>, released by ${K3.vendor} on ${K3.released} — the first open-weight model in the 3-trillion-parameter class. It is an extreme but representative member of the current frontier family: a decoder-only transformer with mixture-of-experts feed-forward layers, in the same architectural lineage as DeepSeek-V3 and Kimi K2. Where Moonshot has not yet disclosed a number, the spec sheet says so.`),
    specTable(`Specimen: ${K3.name}`, `${K3.vendor} · July 2026 · open weights`, [
      ['total parameters', '≈ 2.8 T'],
      ['attention', K3.attention],
      ['active per token', '≈ 50 B <span style="color:var(--mut)">(3rd-party est.)</span>'],
      ['context window', '1,000,000 tokens'],
      ['experts (MoE)', `${K3.experts.routed} routed · ${K3.experts.active} active`],
      ['weights format', K3.weightsFormat],
      ['MoE framework', K3.moeFramework],
      ['layers / d_model', 'not yet disclosed'],
    ]),
    prose(
      `<em>Fig. 1.2 — where a figure needs undisclosed K3 internals, this article substitutes Kimi K2's published blueprint (61 layers, d_model 7168) and labels it illustrative.</em>`));
}
