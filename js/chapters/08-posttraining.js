/* Chapter 08 — post-training: from document engine to assistant.
   Pipeline figure, the chat template as raw tokens, and GRPO on one prompt. */

import { el, svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, figure, PAL } from '../core/components.js';
import { seg, lerp, ease, clamp, rng } from '../core/anim.js';
import { track } from '../core/scroll.js';
import { K3 } from '../../data/k3.js';

/* ---- Fig 8.1 — the post-training pipeline -------------------------------- */

function pipelineFigure() {
  const W = 720, H = 300;

  // box widths carry the emphasis: knowledge is expensive, behavior is cheap
  const boxes = [
    { x: 26, w: 218, color: PAL.weight, title: 'base model', sub: 'predicts documents', data: '~15T tokens' },
    { x: 292, w: 132, color: PAL.train, title: 'SFT', sub: 'imitate demonstrations', data: '10⁵–10⁷ dialogues' },
    { x: 468, w: 136, color: PAL.loss, title: 'RLHF / RLVR', sub: 'optimize against rewards', data: 'prompts + preference/verifier' },
    { x: 640, w: 64, color: PAL.act, title: '', sub: '', data: '' },
  ];
  const BY = 64, BH = 96;

  const boxNodes = boxes.map((b, i) => {
    const g = svg('g', { opacity: 0 });
    g.append(svg('rect', {
      x: b.x, y: BY, width: b.w, height: BH, rx: 10,
      fill: `${b.color}12`, stroke: b.color, 'stroke-width': 1.4,
    }));
    if (i < 3) {
      g.append(
        svg('text', { x: b.x + b.w / 2, y: BY + 32, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'sans-serif', 'font-size': i === 0 ? 15 : 13, 'font-weight': 650 }, b.title),
        svg('text', { x: b.x + b.w / 2, y: BY + 53, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11 }, b.sub));
      const dataLines = b.data.length > 20 ? b.data.split(' + ').map((s, j) => (j ? '+ ' : '') + s) : [b.data];
      dataLines.forEach((line, j) => g.append(
        svg('text', { x: b.x + b.w / 2, y: BY + 71 + j * 13, 'text-anchor': 'middle', fill: b.color, 'font-family': 'monospace', 'font-size': 10 }, line)));
    } else {
      g.append(
        svg('text', { x: b.x + b.w / 2, y: BY + 44, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'sans-serif', 'font-size': 11.5, 'font-weight': 650 }, 'assistant'),
        svg('text', { x: b.x + b.w / 2, y: BY + 62, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 9 }, 'deployed K3'));
    }
    return g;
  });

  const arrows = boxes.slice(0, 3).map((b, i) => svg('path', {
    d: `M ${b.x + b.w + 4} ${BY + BH / 2} L ${boxes[i + 1].x - 6} ${BY + BH / 2}`,
    stroke: PAL.mut, 'stroke-width': 1.6, fill: 'none', 'marker-end': 'url(#arr8)', opacity: 0,
  }));

  /* compute bar: pretraining dwarfs everything to its right */
  const CBX = 26, CBW = 674, CBY = 208, CBH = 22;
  const preW = CBW * 0.965;
  const compBase = svg('rect', { x: CBX, y: CBY, width: CBW, height: CBH, rx: 5, fill: 'rgba(230,237,243,0.05)', opacity: 0 });
  const compPre = svg('rect', { x: CBX, y: CBY, width: 0, height: CBH, fill: PAL.weight, opacity: 0.85 });
  const compSFT = svg('rect', { x: CBX + preW, y: CBY, width: 0, height: CBH, fill: PAL.train, opacity: 0.9 });
  const compRL = svg('rect', { x: CBX + preW + CBW * 0.015, y: CBY, width: 0, height: CBH, fill: PAL.loss, opacity: 0.9 });
  const compLabIn = svg('text', { x: CBX + 10, y: CBY + 15, fill: '#0E1116', 'font-family': 'sans-serif', 'font-size': 11, 'font-weight': 600, opacity: 0 }, 'compute: pretraining');
  const compLab = svg('text', { x: CBX, y: CBY + 48, fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 12, opacity: 0 },
    'compute: pretraining ≫ everything to its right — behavior is cheap, knowledge is expensive');

  const defs = svg('defs', {},
    svg('marker', { id: 'arr8', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The post-training pipeline: base model to SFT to RLHF or RLVR to assistant, with a compute bar below showing pretraining dwarfing every later stage.',
  }, defs, boxNodes, arrows, compBase, compPre, compSFT, compRL, compLabIn, compLab);

  const fig = figure('8.1',
    `the post-training pipeline. K3 applies quantization-aware training (${K3.weightsFormat.split(' ')[0]}) from the SFT stage onward.`,
    root, { wide: true });

  track(fig, (p) => {
    boxNodes.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.10 + i * 0.08, 0.18 + i * 0.08, ease.out)));
    arrows.forEach((a, i) => a.setAttribute('opacity', seg(p, 0.16 + i * 0.08, 0.22 + i * 0.08)));
    compBase.setAttribute('opacity', seg(p, 0.42, 0.48));
    const tBar = seg(p, 0.44, 0.58, ease.inOut);
    compPre.setAttribute('width', preW * tBar);
    const tSliver = seg(p, 0.56, 0.62);
    compSFT.setAttribute('width', CBW * 0.012 * tSliver);
    compRL.setAttribute('width', CBW * 0.018 * tSliver);
    compLabIn.setAttribute('opacity', seg(p, 0.52, 0.58));
    compLab.setAttribute('opacity', seg(p, 0.58, 0.64));
  });
  return fig;
}

/* ---- Fig 8.2 — the chat template, as raw tokens -------------------------- */

function chatTemplateFigure() {
  const W = 720, H = 210;
  const chipH = 26, fs = 11, y1 = 46, y2 = 118;

  // kind: special | nl | user | asst
  const line1 = [
    ['<|im_start|>', 'special'], ['user', 'special'], ['⏎', 'nl'],
    ['What', 'user'], [' is', 'user'], [' the', 'user'], [' capital', 'user'], [' of', 'user'], [' France', 'user'], ['?', 'user'],
    ['<|im_end|>', 'special'],
  ];
  const line2 = [
    ['<|im_start|>', 'special'], ['assistant', 'special'], ['⏎', 'nl'],
    ['The', 'asst'], [' capital', 'asst'], [' of', 'asst'], [' France', 'asst'], [' is', 'asst'], [' Paris', 'asst'], ['.', 'asst'],
    ['<|im_end|>', 'asst'],
  ];

  const chipW = (t) => Math.round(t.length * 6.6) + 12;
  function layout(tokens, y) {
    let x = 30;
    return tokens.map(([t, kind]) => {
      const w = chipW(t);
      const node = { t, kind, x, y, w };
      x += w + 5;
      return node;
    });
  }
  const chips1 = layout(line1, y1), chips2 = layout(line2, y2);
  const styleFor = (kind) => kind === 'special'
    ? { fill: 'rgba(180,140,224,0.14)', stroke: PAL.attn, text: PAL.attn }
    : kind === 'nl'
      ? { fill: 'none', stroke: PAL.mut, text: PAL.mut }
      : { fill: 'rgba(230,237,243,0.06)', stroke: 'rgba(230,237,243,0.25)', text: PAL.tx };

  const mkChip = (c) => {
    const s = styleFor(c.kind);
    return svg('g', { opacity: 0 },
      svg('rect', { x: c.x, y: c.y, width: c.w, height: chipH, rx: 5, fill: s.fill, stroke: s.stroke, 'stroke-width': 1 }),
      svg('text', { x: c.x + c.w / 2, y: c.y + 17, 'text-anchor': 'middle', fill: s.text, 'font-family': 'monospace', 'font-size': fs }, c.t));
  };
  const chipNodes1 = chips1.map(mkChip), chipNodes2 = chips2.map(mkChip);

  /* mask over everything that is not assistant output */
  const maskEnd1 = chips1[chips1.length - 1];
  const maskW1full = maskEnd1.x + maskEnd1.w - 24;
  const mask1 = svg('rect', { x: 24, y: y1 - 6, width: 0, height: chipH + 12, rx: 7, fill: 'rgba(107,118,131,0.30)', stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '4 4' });
  const roleEnd2 = chips2[2];
  const maskW2full = roleEnd2.x + roleEnd2.w - 24;
  const mask2 = svg('rect', { x: 24, y: y2 - 6, width: 0, height: chipH + 12, rx: 7, fill: 'rgba(107,118,131,0.30)', stroke: PAL.mut, 'stroke-width': 1, 'stroke-dasharray': '4 4' });
  const maskTag = svg('text', { x: 694, y: y1 + 16, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 }, 'loss masked');

  /* highlight + brace under the assistant's tokens */
  const aStart = chips2[3], aEnd = chips2[chips2.length - 1];
  const hi = svg('rect', {
    x: aStart.x - 4, y: y2 - 6, width: aEnd.x + aEnd.w - aStart.x + 8, height: chipH + 12, rx: 7,
    fill: 'rgba(240,120,80,0.10)', stroke: PAL.loss, 'stroke-width': 1.4, opacity: 0,
  });
  const braceY = y2 + chipH + 14;
  const brace = svg('path', {
    d: `M ${aStart.x - 4} ${braceY} L ${aStart.x - 4} ${braceY + 6} L ${aEnd.x + aEnd.w + 4} ${braceY + 6} L ${aEnd.x + aEnd.w + 4} ${braceY}`,
    stroke: PAL.loss, 'stroke-width': 1.2, fill: 'none', opacity: 0,
  });
  const braceTag = svg('text', {
    x: (aStart.x + aEnd.x + aEnd.w) / 2, y: braceY + 24, 'text-anchor': 'middle',
    fill: PAL.loss, 'font-family': 'sans-serif', 'font-size': 11.5, opacity: 0,
  }, 'loss computed only on these tokens');
  const legend = svg('text', { x: 694, y: 20, 'text-anchor': 'end', fill: PAL.attn, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0.9 }, '■ special (template) tokens');

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A chat rendered as raw token chips: im_start user, the question, im_end, then im_start assistant and the answer. The user turn is covered by a loss mask; only the assistant tokens are highlighted as carrying training loss.',
  }, legend, mask1, mask2, chipNodes1, chipNodes2, maskTag, hi, brace, braceTag);

  const fig = figure('8.2',
    `the raw token view of every chat you've had. &ldquo;Turns&rdquo; are a formatting convention the model learns, not an API feature — and the loss mask means the model learns to produce answers, not to imitate users.`,
    root, { wide: true });

  const all = [...chipNodes1, ...chipNodes2];
  track(fig, (p) => {
    all.forEach((g, i) => g.setAttribute('opacity', seg(p, 0.08 + i * 0.012, 0.13 + i * 0.012, ease.out)));
    const tMask = seg(p, 0.42, 0.54, ease.inOut);
    mask1.setAttribute('width', maskW1full * tMask);
    mask2.setAttribute('width', maskW2full * tMask);
    maskTag.setAttribute('opacity', seg(p, 0.50, 0.56));
    hi.setAttribute('opacity', seg(p, 0.58, 0.66));
    brace.setAttribute('opacity', seg(p, 0.62, 0.70));
    braceTag.setAttribute('opacity', seg(p, 0.64, 0.72));
  });
  return fig;
}

/* ---- Fig 8.3 — GRPO: one prompt, a group of 16 attempts ------------------ */

function grpoFigure() {
  const W = 720, H = 484;
  const G = 16;
  const rand = rng(16);
  const wins = new Set([1, 4, 6, 9, 12, 14]);       // 6/16 → r̄ = 0.375, σ ≈ 0.48
  const advWin = '+1.29', advLose = '−0.77';

  const rowY = (i) => 96 + i * 23;
  const rows = Array.from({ length: G }, (_, i) => {
    const y = rowY(i);
    const win = wins.has(i);
    const w = 120 + rand() * 210;                    // chain-of-thought length
    const bar = svg('rect', { x: 86, y, width: 0, height: 14, rx: 3, fill: 'rgba(90,200,220,0.12)', stroke: PAL.act, 'stroke-width': 0.9 });
    const idx = svg('text', { x: 78, y: y + 11, 'text-anchor': 'end', fill: PAL.mut, 'font-family': 'monospace', 'font-size': 9.5, opacity: 0 }, String(i + 1));
    const mark = win
      ? svg('g', { opacity: 0 },
          svg('circle', { cx: 445, cy: y + 7, r: 8, fill: 'rgba(125,216,127,0.15)', stroke: PAL.train, 'stroke-width': 1.2 }),
          svg('path', { d: `M 441 ${y + 7} L 444 ${y + 10} L 450 ${y + 3}`, stroke: PAL.train, 'stroke-width': 1.6, fill: 'none' }))
      : svg('g', { opacity: 0 },
          svg('circle', { cx: 445, cy: y + 7, r: 8, fill: 'rgba(240,120,80,0.12)', stroke: PAL.loss, 'stroke-width': 1.2 }),
          svg('path', { d: `M 441 ${y + 3} L 449 ${y + 11} M 449 ${y + 3} L 441 ${y + 11}`, stroke: PAL.loss, 'stroke-width': 1.6, fill: 'none' }));
    const rBar = svg('rect', { x: 470, y: y + 3, width: 0, height: 8, rx: 2, fill: win ? PAL.train : PAL.mut, opacity: win ? 0.9 : 0.5 });
    const rTxt = svg('text', { x: 536, y: y + 11, fill: win ? PAL.train : PAL.loss, 'font-family': 'monospace', 'font-size': 10, opacity: 0 }, win ? '1' : '0');
    const adv = svg('g', { opacity: 0 },
      svg('line', { x1: 596, y1: win ? y + 12 : y + 2, x2: 596, y2: win ? y + 2 : y + 12, stroke: win ? PAL.train : PAL.loss, 'stroke-width': 1.6, 'marker-end': win ? 'url(#arrUp8)' : 'url(#arrDn8)' }),
      svg('text', { x: 610, y: y + 11, fill: win ? PAL.train : PAL.loss, 'font-family': 'monospace', 'font-size': 10 }, win ? advWin : advLose));
    return { bar, idx, mark, rBar, rTxt, adv, w, win, y };
  });

  const prompt = svg('g', { opacity: 0 },
    svg('rect', { x: 30, y: 14, width: 260, height: 42, rx: 8, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.2 }),
    svg('text', { x: 42, y: 31, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 9.5 }, 'prompt'),
    svg('text', { x: 42, y: 47, fill: PAL.ink, 'font-family': 'monospace', 'font-size': 12 }, 'prove: 6 divides n³ − n'));
  const fan = svg('g', { opacity: 0 },
    svg('path', { d: 'M 290 35 L 312 35', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#arrM8)' }),
    svg('text', { x: 322, y: 39, fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5 }, `sample a group of ${G} attempts (temperature > 0)`));

  const headers = svg('g', { opacity: 0 },
    svg('text', { x: 86, y: 84, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'attempt (chain of thought)'),
    svg('text', { x: 445, y: 84, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'verifier'),
    svg('text', { x: 498, y: 84, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, 'reward r'),
    svg('text', { x: 620, y: 84, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10 }, '(rᵢ − r̄)/σ'));

  const meanX = 470 + 0.375 * 56;
  const meanLine = svg('line', { x1: meanX, y1: 90, x2: meanX, y2: rowY(G - 1) + 16, stroke: PAL.weight, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0 });
  const meanTag = svg('text', { x: meanX, y: rowY(G - 1) + 32, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 10, opacity: 0 }, 'group mean r̄ = 6/16');
  const reinforceTag = svg('text', { x: 694, y: 30, 'text-anchor': 'end', fill: PAL.train, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 }, 'above-average attempts: every token reinforced');

  const defs = svg('defs', {},
    svg('marker', { id: 'arrM8', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })),
    svg('marker', { id: 'arrUp8', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.train })),
    svg('marker', { id: 'arrDn8', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.loss })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'GRPO on one math prompt: sixteen sampled attempts, each scored one or zero by a verifier, a dashed group-mean line at 0.375, and up or down advantage arrows reinforcing attempts that beat their own group.',
  }, defs, prompt, fan, headers,
    rows.map((r) => [r.bar, r.idx, r.mark, r.rBar, r.rTxt, r.adv]),
    meanLine, meanTag, reinforceTag);

  const fig = figure('8.3',
    `GRPO on one prompt: a group of 16 attempts, a binary verifier (it cannot be flattered), and each attempt's standing <em>relative to its own group</em> as the learning signal — no value network needed. Attempt lengths illustrative, seeded.`,
    root, { wide: true });

  track(fig, (p) => {
    prompt.setAttribute('opacity', seg(p, 0.06, 0.11));
    fan.setAttribute('opacity', seg(p, 0.09, 0.14));
    headers.setAttribute('opacity', seg(p, 0.10, 0.15));
    rows.forEach((r, i) => {
      const tRow = seg(p, 0.12 + i * 0.011, 0.19 + i * 0.011, ease.out);
      r.bar.setAttribute('width', r.w * tRow);
      r.idx.setAttribute('opacity', tRow);
      const tScore = seg(p, 0.36 + i * 0.008, 0.42 + i * 0.008, ease.out);
      r.mark.setAttribute('opacity', tScore);
      r.rBar.setAttribute('width', (r.win ? 56 : 4) * tScore);
      r.rTxt.setAttribute('opacity', tScore);
      const tAdv = seg(p, 0.60 + i * 0.007, 0.66 + i * 0.007, ease.out);
      r.adv.setAttribute('opacity', tAdv);
      // final beat: winning chains tint green — those tokens get reinforced
      const tRe = seg(p, 0.78, 0.86);
      if (r.win) {
        r.bar.setAttribute('fill', tRe > 0.5 ? 'rgba(125,216,127,0.18)' : 'rgba(90,200,220,0.12)');
        r.bar.setAttribute('stroke', tRe > 0.5 ? PAL.train : PAL.act);
      }
    });
    const tMean = seg(p, 0.52, 0.60);
    meanLine.setAttribute('opacity', tMean);
    meanTag.setAttribute('opacity', tMean);
    reinforceTag.setAttribute('opacity', seg(p, 0.80, 0.88));
  });
  return fig;
}

/* ---- chapter assembly ---------------------------------------------------- */

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'Alignment', title),
    prose(
      `What pretraining produces — the <strong>base model</strong> — is a document continuator, not an assistant. Prompt it with &ldquo;What is the capital of France?&rdquo; and a perfectly calibrated continuation might be <em>another quiz question</em>, because that's how such text often continues on the web. The knowledge is in there; the behavior isn't. Post-training is a short, cheap sequence of stages (a sliver of pretraining's compute) that reshapes behavior without re-teaching content.`),
    pipelineFigure(),

    prose(
      `<strong>Stage one — supervised fine-tuning (SFT).</strong> Continue next-token training, but on curated conversations rendered through a <strong>chat template</strong> — special tokens delimiting system, user, and assistant turns (the &ldquo;raw&rdquo; view of every chat you've had). Loss is computed only on the assistant's tokens: the model learns to produce answers, not to imitate users. SFT is imitation learning; it can only make the model sound like its demonstrations.`),
    term('chat template', 'n.', 'e.g. <code>&lt;|im_start|&gt;user … &lt;|im_end|&gt;&lt;|im_start|&gt;assistant …</code> — plain tokens; &ldquo;turns&rdquo; are a formatting convention the model learns, not an API feature'),
    chatTemplateFigure(),

    prose(
      `<strong>Stage two — RL from human feedback (RLHF).</strong> Imitation caps quality at the demonstrator's level, and many properties (helpfulness, honesty, tone) are easier to judge than to demonstrate. So: collect human rankings between candidate answers, fit a <strong>reward model</strong> that predicts those judgments, then optimize the LLM by reinforcement learning to score highly — while a KL-divergence penalty tethers it to its SFT starting point so it can't wander into reward-hacking gibberish.`,
      `<strong>Stage three — RL with verifiable rewards (RLVR).</strong> The engine of the 2025–26 reasoning wave, and the setting for chapter 10's punchline. For math, code, and logic, you don't need a learned judge: check the final answer, run the tests — reward is 1 or 0, and it cannot be flattered. The dominant algorithm is <strong>GRPO</strong>: sample a group of, say, 16 attempts per problem; score each; use each attempt's standing relative to its own group as the learning signal (no separate value network needed). Long chains of thought emerge because thinking longer wins more reward — K3's &ldquo;always-on thinking&rdquo; is this, productized.`),
    term('GRPO', 'n.', `Group Relative Policy Optimization: advantage of attempt i = (rᵢ − mean(r)) / std(r) within its prompt&rsquo;s group; reinforce tokens of above-average attempts`),
    grpoFigure(),

    mathAside('the RLHF objective, Bradley–Terry, GRPO', `
      <p>The reward model is trained on preference pairs via the Bradley–Terry likelihood: p(y⁺ ≻ y⁻) = σ(r(x,y⁺) − r(x,y⁻)). The policy then maximizes</p>
      <div class="eq">E_y∼π [ r(x, y) ] − β · KL( π ‖ π_ref )</div>
      <p>with π_ref the frozen SFT model. PPO optimizes this with a clipped policy-gradient step; GRPO replaces PPO's learned value baseline with the group mean — for group rewards r₁…r_G, advantage Âᵢ = (rᵢ − r̄)/σ_r, applied to every token of attempt i. Cheaper (no value network), and notably robust in the tiny-update regime — a property chapter 10 turns into a headline.</p>`));
}
