/* Sticky scene — where the norm goes: post-norm vs pre-norm gradient flow.
   The whole argument is one animation: a gradient pulse falls down each stack
   and only the pre-norm one arrives intact. The scene's caption lives in the
   prose paragraph that follows it in index.js, so the number is claimed here,
   at the point the scene appears on the page. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, claimFig, chRef, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease } from '../../core/anim.js';

function normSceneFigure(canvas) {
  const W = 720, H = 460;
  const CX1 = 148, CX2 = 392;            // post-norm stack, pre-norm stack
  const BY = (i) => 76 + i * 84;         // block tops, i = 0..3
  const SUBNAMES = ['attn', 'MLP', 'attn', 'MLP'];
  const TOPY = 54, BOTY = 408;
  const ATT = 0.75;                      // schematic attenuation per on-path norm

  const defs = svg('defs', {},
    svg('marker', { id: 'anat-norm-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  /* ---- post-norm stack (left): norm sits ON the residual path ---- */

  const postParts = [];
  const postLine = svg('line', { x1: CX1, y1: TOPY, x2: CX1, y2: BOTY, stroke: PAL.act, 'stroke-width': 1.6, opacity: 0.85 });
  postParts.push(postLine);
  const postChipYs = [];
  for (let i = 0; i < 4; i++) {
    const y = BY(i);
    postChipYs.push(y + 17);
    postParts.push(
      // norm chip ON the main path
      svg('rect', { x: CX1 - 27, y: y + 8, width: 54, height: 18, rx: 5, fill: '#182029', stroke: PAL.mut, 'stroke-width': 1 }),
      txt(CX1, y + 21, 'LN', { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }),
      // "+" node
      svg('circle', { cx: CX1, cy: y + 42, r: 8, fill: '#182029', stroke: PAL.act, 'stroke-width': 1.3 }),
      txt(CX1, y + 46, '+', { size: 12, fill: PAL.act, anchor: 'middle', mono: true }),
      // sublayer branch
      svg('rect', { x: CX1 + 26, y: y + 30, width: 62, height: 24, rx: 7, fill: 'rgba(90,200,220,0.06)', stroke: PAL.mut, 'stroke-width': 1 }),
      txt(CX1 + 57, y + 46, SUBNAMES[i], { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }),
      svg('path', { d: `M ${CX1} ${y + 68} L ${CX1 + 52} ${y + 54}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none' }),
      svg('path', { d: `M ${CX1 + 26} ${y + 42} L ${CX1 + 11} ${y + 42}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none', 'marker-end': 'url(#anat-norm-arr)' }));
  }
  const postTitle = txt(CX1, 20, 'post-norm · 2017', { size: 11.5, fill: PAL.tx, anchor: 'middle' });
  const postLoss = svg('g', {},
    svg('rect', { x: CX1 - 28, y: 28, width: 56, height: 22, rx: 6, fill: 'rgba(240,120,80,0.10)', stroke: PAL.loss, 'stroke-width': 1.2 }),
    txt(CX1, 43, 'loss', { size: 11, fill: PAL.loss, anchor: 'middle', mono: true }));
  const postNote = svg('text', {
    x: 20, y: 240, fill: PAL.loss, 'font-size': 10.5, 'font-family': 'sans-serif',
    'text-anchor': 'middle', transform: 'rotate(-90, 20, 240)', opacity: 0,
  }, 'gradient re-scaled by every on-path norm');
  const gPost = svg('g', {}, postParts, postLoss, postNote);

  /* ---- pre-norm stack (right): norm inside the branch, identity clean ---- */

  const preParts = [], preChipLN = [], preChipRMS = [], qkChips = [];
  const preLine = svg('line', { x1: CX2, y1: TOPY, x2: CX2, y2: BOTY, stroke: PAL.act, 'stroke-width': 1.6, opacity: 0.85 });
  const idHighlight = svg('line', { x1: CX2, y1: TOPY, x2: CX2, y2: BOTY, stroke: PAL.act, 'stroke-width': 4, opacity: 0, 'stroke-linecap': 'round' });
  preParts.push(idHighlight, preLine);
  for (let i = 0; i < 4; i++) {
    const y = BY(i);
    const ln = txt(CX2 + 44, y + 49, 'LN', { size: 11, fill: PAL.tx, anchor: 'middle', mono: true });
    const rms = txt(CX2 + 44, y + 49, 'RMS', { size: 10, fill: PAL.act, anchor: 'middle', mono: true, opacity: 0 });
    preChipLN.push(ln); preChipRMS.push(rms);
    preParts.push(
      svg('circle', { cx: CX2, cy: y + 16, r: 8, fill: '#182029', stroke: PAL.act, 'stroke-width': 1.3 }),
      txt(CX2, y + 20, '+', { size: 12, fill: PAL.act, anchor: 'middle', mono: true }),
      // norm chip on the BRANCH
      svg('rect', { x: CX2 + 20, y: y + 36, width: 48, height: 18, rx: 5, fill: '#182029', stroke: PAL.mut, 'stroke-width': 1 }),
      ln, rms,
      // sublayer box
      svg('rect', { x: CX2 + 76, y: y + 30, width: 58, height: 24, rx: 7, fill: 'rgba(90,200,220,0.06)', stroke: PAL.mut, 'stroke-width': 1 }),
      txt(CX2 + 105, y + 46, SUBNAMES[i], { size: 11, fill: PAL.tx, anchor: 'middle', mono: true }),
      svg('path', { d: `M ${CX2} ${y + 62} L ${CX2 + 38} ${y + 54}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none' }),
      svg('path', { d: `M ${CX2 + 68} ${y + 45} L ${CX2 + 76} ${y + 43}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none' }),
      svg('path', { d: `M ${CX2 + 105} ${y + 30} C ${CX2 + 105} ${y + 16}, ${CX2 + 44} ${y + 16}, ${CX2 + 11} ${y + 16}`, stroke: PAL.mut, 'stroke-width': 1, fill: 'none', 'marker-end': 'url(#anat-norm-arr)' }));
    if (SUBNAMES[i] === 'attn') {
      const qk = svg('g', { opacity: 0 },
        svg('rect', { x: CX2 + 108, y: y + 22, width: 30, height: 15, rx: 4, fill: 'rgba(180,140,224,0.16)', stroke: PAL.attn, 'stroke-width': 1 }),
        txt(CX2 + 123, y + 33, 'qk', { size: 9.5, fill: PAL.attn, anchor: 'middle', mono: true }));
      qkChips.push(qk); preParts.push(qk);
    }
  }
  const preTitle = txt(CX2, 20, 'pre-norm · 2019 →', { size: 11.5, fill: PAL.tx, anchor: 'middle', opacity: 0 });
  const preLoss = svg('g', {},
    svg('rect', { x: CX2 - 28, y: 28, width: 56, height: 22, rx: 6, fill: 'rgba(240,120,80,0.10)', stroke: PAL.loss, 'stroke-width': 1.2 }),
    txt(CX2, 43, 'loss', { size: 11, fill: PAL.loss, anchor: 'middle', mono: true }));
  const idLabel = txt(CX2 - 14, 398, 'identity path — untouched', { size: 10.5, fill: PAL.act, anchor: 'end', opacity: 0 });
  const gPre = svg('g', { opacity: 0 }, preParts, preLoss, preTitle, idLabel);

  /* ---- gradient pulses + magnitude bars ---- */

  const pulseL = svg('circle', { cx: CX1, cy: TOPY, r: 7, fill: PAL.loss, opacity: 0 });
  const pulseR = svg('circle', { cx: CX2, cy: TOPY, r: 7, fill: PAL.loss, opacity: 0 });
  const magFinal = Math.pow(ATT, 4);
  const mkBar = (cx) => ({
    track: svg('rect', { x: cx - 45, y: 424, width: 90, height: 7, rx: 3, fill: 'rgba(230,237,243,0.08)', opacity: 0 }),
    fill: svg('rect', { x: cx - 45, y: 424, width: 0, height: 7, rx: 3, fill: PAL.loss, opacity: 0 }),
    label: txt(cx, 446, '', { size: 10.5, anchor: 'middle', mono: true, opacity: 0 }),
  });
  const barL = mkBar(CX1), barR = mkBar(CX2);
  barL.label.textContent = `‖∇‖ at the bottom ≈ ${magFinal.toFixed(2)}×`;
  barR.label.textContent = '‖∇‖ at the bottom ≈ 1×';

  /* ---- right info column: RMSNorm card + refinements card ---- */

  const cardA = svg('g', { opacity: 0 },
    txt(546, 96, 'the simplification', { size: 10.5, fill: PAL.act }),
    txt(546, 118, 'RMSNorm(x) =', { size: 11.5, fill: PAL.ink, mono: true }),
    txt(546, 136, 'x/√(mean(x²)+ε) ⊙ g', { size: 11.5, fill: PAL.ink, mono: true }),
    txt(546, 162, 'mean-centering  μ', { size: 11, fill: PAL.mut, mono: true }),
    svg('line', { x1: 544, y1: 158, x2: 668, y2: 158, stroke: PAL.loss, 'stroke-width': 1.4 }),
    txt(546, 182, 'learned bias  β', { size: 11, fill: PAL.mut, mono: true }),
    svg('line', { x1: 544, y1: 178, x2: 648, y2: 178, stroke: PAL.loss, 'stroke-width': 1.4 }),
    txt(546, 204, 'one reduction, one gain —', { size: 10.5 }),
    txt(546, 219, 'same loss, less traffic', { size: 10.5 }));

  const cardB = svg('g', { opacity: 0 },
    txt(546, 262, 'later refinements', { size: 10.5, fill: PAL.attn }),
    txt(546, 284, 'QK-norm:', { size: 11.5, fill: PAL.ink, mono: true }),
    txt(546, 300, 'RMSNorm(q), RMSNorm(k)', { size: 11, fill: PAL.tx, mono: true }),
    txt(546, 316, '→ attention logits bounded,', { size: 10.5 }),
    txt(546, 330, 'no more loss spikes from q·k', { size: 10.5 }),
    txt(546, 356, 'sandwich / peri-norm:', { size: 11.5, fill: PAL.ink, mono: true }),
    txt(546, 372, 'norm into AND out of each', { size: 10.5 }),
    txt(546, 386, 'sublayer (Gemma-2 lineage)', { size: 10.5 }));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Two four-block transformer stacks side by side. In the post-norm stack, the norm sits on the residual path after every addition, and a red gradient pulse flowing down from the loss shrinks each time it crosses a norm. In the pre-norm stack, the norm sits inside each sublayer branch, the identity path is a clean straight line, and the gradient pulse reaches the bottom at full strength. Side cards show RMSNorm deleting mean-centering and bias, then QK-norm and sandwich-norm refinements.',
  }, defs, gPost, gPre, pulseL, pulseR,
    barL.track, barL.fill, barL.label, barR.track, barR.fill, barR.label,
    postTitle, cardA, cardB));

  const postMagAt = (y) => Math.pow(ATT, postChipYs.filter((cy) => cy < y).length);

  return (p) => {
    /* step 0 — post-norm era: pulse down the left stack, shrinking */
    postNote.setAttribute('opacity', seg(p, 0.05, 0.12) * 0.9);
    const tA = seg(p, 0.06, 0.21, ease.linear);
    const tB = seg(p, 0.36, 0.50, ease.linear);
    const tL = p < 0.30 ? tA : tB;                 // rerun for the comparison
    const runningL = tL > 0 && tL < 1;
    const yL = lerp(TOPY, BOTY, tL);
    const mL = postMagAt(yL);
    pulseL.setAttribute('cy', yL);
    pulseL.setAttribute('r', 3 + 4.5 * mL);
    pulseL.setAttribute('opacity', runningL ? 0.35 + 0.6 * mL : 0);
    const barLOn = (p >= 0.21 && p < 0.36) || p >= 0.50 ? 1 : 0;
    barL.track.setAttribute('opacity', barLOn);
    barL.fill.setAttribute('opacity', barLOn);
    barL.fill.setAttribute('width', 90 * magFinal * barLOn);
    barL.label.setAttribute('opacity', barLOn * 0.9);

    /* step 1 — pre-norm appears; identity highlight; both pulses race */
    const tShow = seg(p, 0.26, 0.32);
    gPre.setAttribute('opacity', tShow);
    preTitle.setAttribute('opacity', tShow);
    idHighlight.setAttribute('opacity', seg(p, 0.31, 0.37) * 0.35);
    idLabel.setAttribute('opacity', seg(p, 0.32, 0.38));
    const runningR = tB > 0 && tB < 1;
    pulseR.setAttribute('cy', lerp(TOPY, BOTY, tB));
    pulseR.setAttribute('r', 7.5);
    pulseR.setAttribute('opacity', runningR ? 0.95 : 0);
    const barROn = p >= 0.50 ? 1 : 0;
    barR.track.setAttribute('opacity', barROn);
    barR.fill.setAttribute('opacity', barROn);
    barR.fill.setAttribute('width', 90 * barROn);
    barR.label.setAttribute('opacity', barROn * 0.9);

    /* step 2 — LN → RMS relabel + card A; post stack recedes */
    const tRms = seg(p, 0.53, 0.61);
    preChipLN.forEach((n) => n.setAttribute('opacity', 1 - tRms));
    preChipRMS.forEach((n) => n.setAttribute('opacity', tRms));
    cardA.setAttribute('opacity', seg(p, 0.55, 0.64));
    gPost.setAttribute('opacity', lerp(1, 0.45, seg(p, 0.52, 0.62)));
    postTitle.setAttribute('opacity', lerp(1, 0.45, seg(p, 0.52, 0.62)));

    /* step 3 — QK-norm chips + refinements card */
    qkChips.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.79 + i * 0.03, 0.85 + i * 0.03)));
    cardB.setAttribute('opacity', seg(p, 0.78, 0.87));
  };
}

export function normScene() {
  claimFig('norm');
  return createScene({
    id: 'norm-placement',
    figure: normSceneFigure,
    steps: [
      { n: 'STEP 1 / 4 — POST-NORM, 2017', html: `<p><strong>The original placement.</strong> Norm after every residual add — on the stream itself. Watch the gradient pulse descend: each on-path norm rescales it, and the rescalings compound with depth. Six layers train fine; sixty need warmup rituals and still walk a stability cliff. The 2017 recipe — post-norm plus warmup plus carefully tuned initialization — is a coupled system where touching any knob breaks the others.</p>` },
      { n: 'STEP 2 / 4 — PRE-NORM', html: `<p><strong>Move the norm into the branch.</strong> Now the residual path is a pure identity from loss to embedding: the pulse arrives at full strength no matter the depth. A fresh sublayer defaults to &ldquo;change nothing,&rdquo; so a 100-layer pre-norm stack trains from a cold start without warmup fragility. The one cost: the stream&rsquo;s magnitude grows layer by layer, which is why a final norm sits after the last block (you saw it in ${chRef('residual', { word: 'ch.' })}).</p>` },
      { n: 'STEP 3 / 4 — SIMPLIFY THE NORM ITSELF', html: `<p><strong>LayerNorm → RMSNorm.</strong> With placement solved, the formula shrank: delete mean-centering, delete the bias, keep the RMS rescale and the gain. Cheaper — one reduction instead of two, no bias parameters — and statistically indistinguishable in final loss. Every open frontier model since the Llama lineage ships RMSNorm, K3 included.</p>` },
      { n: 'STEP 4 / 4 — MODERN REFINEMENTS', html: `<p><strong>Stability at scale, not quality.</strong> Two residual failure modes got their own norms. Query and key vectors can drift large during training, blowing up attention logits into loss spikes — <strong>QK-norm</strong> normalizes q and k right before the dot product, bounding the logits by construction. And some recent models (the Gemma-2 lineage) sandwich each sublayer with norms on <em>both</em> sides — &ldquo;peri-norm&rdquo; — buying extra headroom at large scale. Refinements, not revolutions: the pre-norm identity path is the part nobody touches.</p>` },
    ],
  });
}
