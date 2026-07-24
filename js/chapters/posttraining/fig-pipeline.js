/* The post-training pipeline — base model → SFT → RLHF/RLVR → assistant,
   with a compute bar that shows pretraining dwarfing everything after it.
   Figure number is claimed by figure(); key 'pipeline'. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { seg, ease } from '../../core/anim.js';
import { track } from '../../core/scroll.js';
import { K3 } from '../../../data/k3.js';

export function pipelineFigure() {
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
        txt(b.x + b.w / 2, BY + 53, b.sub, { size: 11, fill: PAL.tx, anchor: 'middle' }));
      const dataLines = b.data.length > 20 ? b.data.split(' + ').map((s, j) => (j ? '+ ' : '') + s) : [b.data];
      dataLines.forEach((line, j) => g.append(
        txt(b.x + b.w / 2, BY + 71 + j * 13, line, { size: 10, fill: b.color, anchor: 'middle', mono: true })));
    } else {
      g.append(
        svg('text', { x: b.x + b.w / 2, y: BY + 44, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'sans-serif', 'font-size': 11.5, 'font-weight': 650 }, 'assistant'),
        txt(b.x + b.w / 2, BY + 62, 'deployed K3', { size: 9, fill: PAL.act, anchor: 'middle' }));
    }
    return g;
  });

  const arrows = boxes.slice(0, 3).map((b, i) => svg('path', {
    d: `M ${b.x + b.w + 4} ${BY + BH / 2} L ${boxes[i + 1].x - 6} ${BY + BH / 2}`,
    stroke: PAL.mut, 'stroke-width': 1.6, fill: 'none', 'marker-end': 'url(#pt-arr)', opacity: 0,
  }));

  /* compute bar: pretraining dwarfs everything to its right */
  const CBX = 26, CBW = 674, CBY = 208, CBH = 22;
  const preW = CBW * 0.965;
  const compBase = svg('rect', { x: CBX, y: CBY, width: CBW, height: CBH, rx: 5, fill: 'rgba(230,237,243,0.05)', opacity: 0 });
  const compPre = svg('rect', { x: CBX, y: CBY, width: 0, height: CBH, fill: PAL.weight, opacity: 0.85 });
  const compSFT = svg('rect', { x: CBX + preW, y: CBY, width: 0, height: CBH, fill: PAL.train, opacity: 0.9 });
  const compRL = svg('rect', { x: CBX + preW + CBW * 0.015, y: CBY, width: 0, height: CBH, fill: PAL.loss, opacity: 0.9 });
  const compLabIn = svg('text', { x: CBX + 10, y: CBY + 15, fill: '#0E1116', 'font-family': 'sans-serif', 'font-size': 11, 'font-weight': 600, opacity: 0 }, 'compute: pretraining');
  const compLab = txt(CBX, CBY + 48,
    'compute: pretraining ≫ everything to its right — behavior is cheap, knowledge is expensive',
    { size: 12, fill: PAL.tx, opacity: 0 });

  const defs = svg('defs', {},
    svg('marker', { id: 'pt-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'The post-training pipeline: base model to SFT to RLHF or RLVR to assistant, with a compute bar below showing pretraining dwarfing every later stage.',
  }, defs, boxNodes, arrows, compBase, compPre, compSFT, compRL, compLabIn, compLab);

  const fig = figure(
    `the post-training pipeline. K3 applies quantization-aware training (${K3.weightsFormat.split(' ')[0]}) from the SFT stage onward.`,
    root, { wide: true, key: 'pipeline' });

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
