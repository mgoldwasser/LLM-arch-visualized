/* The autoregressive loop, as a sticky scroll scene.
   Token IDs in → one distribution out → sample → append → run again. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, chRef, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease, clamp } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';

/* ---- the sticky figure --------------------------------------------------- */

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
    txt(tokW / 2, 22, t, { size: 14, fill: PAL.ink, anchor: 'middle', mono: true })));

  const appended = svg('g', { opacity: 0 },
    svg('rect', { width: tokW, height: tokH, rx: 7, fill: 'rgba(224,168,76,0.15)', stroke: PAL.weight, 'stroke-width': 1.2 }),
    txt(tokW / 2, 22, 'Paris', { size: 14, fill: PAL.weight, anchor: 'middle', mono: true }));

  const inLabel = txt(34, 30, 'input tokens (integer IDs)');

  // arrow into the model
  const arrow1 = svg('path', { d: `M ${W / 2} ${tokY + tokH + 8} L ${W / 2} 130`, stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#arr)' });

  // the model box
  const model = svg('g', {},
    svg('rect', { x: W / 2 - 130, y: 138, width: 260, height: 64, rx: 12, fill: 'rgba(90,200,220,0.07)', stroke: PAL.act, 'stroke-width': 1.4 }),
    txt(W / 2, 165, K3.name, { size: 15, fill: PAL.ink, anchor: 'middle', mono: true }),
    txt(W / 2, 186, 'one deterministic function', { anchor: 'middle', mono: true }));
  const modelPulse = svg('rect', { x: W / 2 - 130, y: 138, width: 260, height: 64, rx: 12, fill: 'none', stroke: PAL.act, 'stroke-width': 2, opacity: 0 });

  const arrow2 = svg('path', { d: `M ${W / 2} 210 L ${W / 2} 246`, stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#arr)' });

  // the distribution
  const distLabel = txt(150, 268,
    `one probability distribution over all ${(K3.vocab / 1000).toFixed(0)}k tokens`);
  const barX = 245, barMax = 300, rowH = 26, distY = 284;
  const rows = dist.map(([w, p], i) => {
    const y = distY + i * rowH;
    return {
      label: txt(barX - 12, y + 13, w, { size: 13, fill: PAL.tx, anchor: 'end', mono: true }),
      bar: svg('rect', { x: barX, y, height: 16, width: 0, rx: 3, fill: PAL.act, opacity: 0.9 }),
      val: txt(barX + 8, y + 13, p.toFixed(p < 0.02 ? 3 : 2), { fill: PAL.bg, mono: true, opacity: 0 }),
      p, w,
    };
  });
  const more = txt(barX - 12, distY + 5 * rowH + 10,
    `⋮ ${(K3.vocab - dist.length).toLocaleString('en-US')} more`, { anchor: 'end', mono: true });

  // sampling highlight + return path
  const samplePick = svg('rect', { x: barX - 90, y: distY - 5, width: barMax + 110, height: 26, rx: 6, fill: 'none', stroke: PAL.weight, 'stroke-width': 1.6, opacity: 0 });
  const sampleTag = txt(barX + barMax + 16, distY + 12, 'sampled', { fill: PAL.weight, opacity: 0 });
  const loopPath = svg('path', {
    d: `M ${barX + barMax + 60} ${distY + 8} C ${W - 20} ${distY - 60}, ${W - 20} 90, ${tokX(5) + tokW + 10} ${tokY + tokH / 2}`,
    stroke: PAL.weight, 'stroke-width': 1.6, fill: 'none', 'stroke-dasharray': '5 5', opacity: 0, 'marker-end': 'url(#arrW)',
  });
  const loopTag = txt(W - 26, 158, 'append · run again', { anchor: 'end', fill: PAL.weight, opacity: 0 });

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

/* ---- the scene ----------------------------------------------------------- */

export function sceneLoop() {
  return createScene({
    id: 'objective-loop',
    figure: loopFigure,
    steps: [
      { n: 'The interface', html: `<p>The entire external surface of the model: a sequence of token IDs goes in. Nothing else — no parse tree, no database handle, no memory beyond the sequence itself.</p>` },
      { n: 'One forward pass', html: `<p>The function runs once and emits exactly one thing: a probability for <em>every</em> token in the ${(K3.vocab / 1000).toFixed(0)}k-entry vocabulary. Most of the mass lands on a handful of plausible continuations.</p>` },
      { n: 'Pick one', html: `<p>Something outside the model chooses a single token from that distribution — greedily, or with controlled randomness. The model itself is done; choosing is <em>sampling policy</em>, a serving-time decision (${chRef('inference')}).</p>` },
      { n: 'Append, repeat', html: `<p>The chosen token is appended to the input and the function runs again, now conditioned on its own output. That loop <em>is</em> generation — a few dozen turns of it per second, and nothing more.</p>` },
    ],
  });
}
