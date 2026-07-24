/* KV-cache growth per 1,000 tokens of context, by attention variant — the
   bars that explain why the variant zoo exists. Bars animate as the figure
   transits the viewport. Figure number is claimed by figure(); key 'kv'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, chRef, PAL } from '../../core/components.js';
import { seg, ease, si } from '../../core/anim.js';
import { track } from '../../core/scroll.js';
import { K3 } from '../../../data/k3.js';

export function kvGrowthFigure() {
  const L = K3.blueprint.layers, d = K3.blueprint.dModel;
  const per1k = {
    mha: 2 * L * d * 2 * 1000,          // K and V · bf16
    gqa: 2 * L * (d / 8) * 2 * 1000,    // 8 kv-groups
    mla: L * 576 * 2 * 1000,            // one 576-dim latent per token
  };
  const rows = [
    ['MHA', per1k.mha, `~${(per1k.mha / 1e9).toFixed(2)} GB`],
    ['GQA (8 kv-groups)', per1k.gqa, `~${Math.round(per1k.gqa / 1e6 / 10) * 10} MB`],
    ['MLA latent', per1k.mla, `~${Math.round(per1k.mla / 1e6 / 10) * 10} MB`],
  ];
  const W = 720, H = 252, BARX = 210, BARMAX = 420;
  const mhaAt1M = `~${(per1k.mha * 1000 / 1e12).toFixed(2)} TB`;

  const title = txt(36, 26, 'KV cache growth per 1,000 tokens of context', { size: 13, fill: PAL.ink });
  const sub = txt(36, 44, `bf16 · illustrative ${L}-layer / d=${d} blueprint`, { size: 10 });
  const barEls = rows.map(([name, v, label], i) => {
    const y = 66 + i * 40;
    return {
      v,
      label: txt(36, y + 14, name, { size: 12, fill: PAL.tx, mono: true }),
      bar: svg('rect', { x: BARX, y, width: 0, height: 18, rx: 3, fill: PAL.act, opacity: 0.9 }),
      val: txt(BARX + 8, y + 14, label, { size: 12, fill: PAL.act, mono: true, opacity: 0 }),
    };
  });
  const kY = 66 + 3 * 40;
  const kdaLabel = txt(36, kY + 14, 'KDA (most K3 layers)', { size: 12, fill: PAL.tx, mono: true });
  const kdaLine = svg('line', { x1: BARX, y1: kY + 9, x2: BARX + BARMAX, y2: kY + 9, stroke: PAL.moe, 'stroke-width': 2, 'stroke-dasharray': '6 5', pathLength: 1, 'stroke-dashoffset': 1 });
  const kdaState = svg('rect', { x: BARX, y: kY + 1, width: 16, height: 16, rx: 3, fill: PAL.moe, opacity: 0 });
  const kdaTag = txt(BARX + BARMAX, kY - 4, 'constant-size state · independent of context length',
    { size: 10, fill: PAL.moe, anchor: 'end', opacity: 0 });
  const at1M = txt(36, 238, `at a 1M-token context, MHA's cache would be ${mhaAt1M} per sequence`,
    { size: 12, fill: PAL.loss, opacity: 0 });

  const node = svgRoot(W, H, { role: 'img', 'aria-label': 'Bar chart of KV cache memory per 1,000 tokens: MHA about 1.75 gigabytes, GQA with 8 groups about 220 megabytes, MLA latent about 70 megabytes, and KDA a constant-size state independent of context length.' },
    title, sub, barEls.map((b) => [b.label, b.bar, b.val]), kdaLabel, kdaLine, kdaState, kdaTag, at1M);

  const fig = figure(
    `the two phases, and why ${chRef('attention')}'s variant zoo exists: at ${si(K3.contextWindow)} tokens, MHA's cache would be ${mhaAt1M} <em>per sequence</em>. Bars computed from the illustrative K2 blueprint.`,
    node, { key: 'kv' });

  track(fig, (p) => {
    barEls.forEach((b, i) => {
      const t = seg(p, 0.16 + i * 0.05, 0.36 + i * 0.05, ease.out);
      const w = Math.max(4, BARMAX * (b.v / per1k.mha)) * t;
      b.bar.setAttribute('width', w);
      b.val.setAttribute('opacity', t);
      b.val.setAttribute('x', BARX + w + 8);
    });
    kdaLine.setAttribute('stroke-dashoffset', 1 - seg(p, 0.32, 0.48));
    kdaState.setAttribute('opacity', seg(p, 0.32, 0.4));
    kdaTag.setAttribute('opacity', seg(p, 0.4, 0.48));
    at1M.setAttribute('opacity', seg(p, 0.44, 0.54));
  });
  return fig;
}
