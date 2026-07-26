/* Audio — waveform → log-mel spectrogram → a strip of encoder tokens. Sound
   becomes an image, and the ViT playbook resumes from there. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, ease, rng } from '../../core/anim.js';

export function audioFigure() {
  const W = 720, H = 330;
  const r = rng(31);

  // waveform
  let d = 'M 36 72';
  for (let i = 1; i <= 56; i++) {
    const x = 36 + i * 5;
    const env = Math.sin((i / 56) * Math.PI);
    const a = (i % 2 ? -1 : 1) * (3 + r() * 26) * env;
    d += ` L ${x} ${(72 + a).toFixed(1)}`;
  }
  const wave = svg('path', { d, stroke: PAL.tx, 'stroke-width': 1.3, fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
  const waveLabel = svg('text', { x: 36, y: 122, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'waveform · 16,000 samples per second');

  const arr1 = svg('path', { d: 'M 330 72 L 372 72', stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mm-audio-arr)', opacity: 0 });

  // mel spectrogram: 26 cols × 10 rows
  const SGX = 384, SGY = 30, COLS = 26, ROWS = 10, CS = 11;
  const cols = Array.from({ length: COLS }, (_, cI) => {
    const cells = [];
    for (let rI = 0; rI < ROWS; rI++) {
      const energy = Math.max(0, Math.sin((cI / COLS) * Math.PI) * (1 - rI / ROWS) * 0.9 + (r() - 0.5) * 0.45);
      cells.push(svg('rect', {
        x: SGX + cI * CS, y: SGY + rI * CS, width: CS - 1, height: CS - 1,
        fill: PAL.act, opacity: 0, dataset: undefined,
      }));
      cells[cells.length - 1].dataset.o = Math.min(0.92, 0.06 + energy).toFixed(2);
    }
    return cells;
  });
  const specFrame = svg('rect', { x: SGX - 2, y: SGY - 2, width: COLS * CS + 3, height: ROWS * CS + 3, fill: 'none', stroke: PAL.mut, 'stroke-width': 1, opacity: 0 });
  const specLabel = svg('text', { x: SGX, y: SGY + ROWS * CS + 20, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'log-mel spectrogram — an image of sound (freq × time)');

  const arr2 = svg('path', { d: `M ${SGX + COLS * CS / 2} ${SGY + ROWS * CS + 30} L ${SGX + COLS * CS / 2 - 120} 216`, stroke: PAL.mut, 'stroke-width': 1.3, fill: 'none', 'marker-end': 'url(#mm-audio-arr)', opacity: 0 });
  const convLabel = svg('text', { x: SGX + COLS * CS / 2 - 40, y: 200, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'conv stack: downsample in time, then a transformer encoder');

  // token strip
  const TY = 228, TN = 10;
  const tChips = Array.from({ length: TN }, (_, i) => svg('rect', {
    x: 130 + i * 42, y: TY, width: 36, height: 26, rx: 5,
    fill: 'rgba(90,200,220,0.14)', stroke: PAL.act, 'stroke-width': 1.1, opacity: 0,
  }));
  const tLabel = svg('text', { x: 130, y: TY + 46, fill: PAL.act, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 },
    '≈ 25–50 vectors per second of audio (Whisper-style encoder)');
  const tLabel2 = svg('text', { x: 130, y: TY + 64, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10.5, opacity: 0 },
    'or: a neural codec (EnCodec-style RVQ) emits discrete audio tokens — which a model can also generate, i.e. speak');
  const tick = svg('text', { x: 130, y: TY - 8, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 10, opacity: 0 },
    'one second of speech →');

  const defs = svg('defs', {},
    svg('marker', { id: 'mm-audio-arr', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Audio pipeline: a raw waveform becomes a mel spectrogram — a grid of intensity cells over frequency and time — which a convolutional stack downsamples into a strip of roughly 25 to 50 audio tokens per second.',
  }, defs, wave, waveLabel, arr1, cols, specFrame, specLabel, arr2, convLabel, tick, tChips, tLabel, tLabel2);

  const node = figure(
    `sound becomes an image, then tokens: waveform → log-mel spectrogram → convolutional downsampling → encoder vectors at ~25–50 per second (Whisper's recipe). Codec-token variants stream at a few hundred discrete tokens per second — cheap enough to generate in real time, which is what makes live voice assistants possible.`,
    root, { key: 'audio' });

  return pin(node, (p) => {
    wave.setAttribute('stroke-dashoffset', 1 - seg(p, 0.08, 0.26, ease.inOut));
    waveLabel.setAttribute('opacity', seg(p, 0.18, 0.24));
    arr1.setAttribute('opacity', seg(p, 0.24, 0.29));
    specFrame.setAttribute('opacity', seg(p, 0.26, 0.32));
    cols.forEach((col, cI) => {
      const t = seg(p, 0.28 + cI * 0.006, 0.34 + cI * 0.006);
      col.forEach((c) => c.setAttribute('opacity', t * +c.dataset.o));
    });
    specLabel.setAttribute('opacity', seg(p, 0.42, 0.48));
    arr2.setAttribute('opacity', seg(p, 0.46, 0.52));
    convLabel.setAttribute('opacity', seg(p, 0.48, 0.54));
    tick.setAttribute('opacity', seg(p, 0.52, 0.58));
    tChips.forEach((c, i) => c.setAttribute('opacity', seg(p, 0.52 + i * 0.012, 0.6 + i * 0.012)));
    tLabel.setAttribute('opacity', seg(p, 0.6, 0.66));
    tLabel2.setAttribute('opacity', seg(p, 0.64, 0.7));
  });
}
