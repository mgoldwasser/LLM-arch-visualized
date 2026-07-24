/* BPE tokenization of "unbelievability", as a sticky scroll scene: fifteen
   byte cells slide together into three subword tokens, then collapse into
   integer IDs. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, ease } from '../../core/anim.js';

/* ---- the sticky figure --------------------------------------------------- */

function bpeFigure(canvas) {
  const W = 720, H = 300;
  const chars = 'unbelievability'.split('');
  const N = chars.length; // 15

  // merge stages as [start,end] character spans
  const single = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => [a + i, a + i]);
  const STAGES = [
    single(0, 14),                                                    // raw bytes
    [[0, 1], ...single(2, 14)],                                       // merge 1: un
    [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 14]],     // merge k
    [[0, 1], [2, 7], [8, 14]],                                        // merge n
  ];
  const FRESH = [[], [0], [1, 2, 3, 4, 5, 6], [1, 2]];  // newly-merged groups per stage

  const CW = 34, GAP = 12, ROWY = 92, CH = 46;
  const layouts = STAGES.map((groups) => {
    const total = N * CW + (groups.length - 1) * GAP;
    let x = (W - total) / 2;
    const xs = new Array(N);
    for (const [a, b] of groups) {
      for (let i = a; i <= b; i++) { xs[i] = x; x += CW; }
      x += GAP;
    }
    return xs;
  });

  const title = txt(24, 30, 'tokenizing “unbelievability” — replaying the learned merges');
  const stageTag = txt(24, 64, 'bytes · 15 symbols', { size: 12, fill: PAL.weight, mono: true });

  const glyphs = chars.map((c) => txt(0, ROWY + 30, c, { size: 15, fill: PAL.ink, anchor: 'middle', mono: true }));

  const R = STAGES.map((groups) => groups.map(() => svg('rect', {
    y: ROWY, height: CH, rx: 7, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1, opacity: 0,
  })));
  const pulses = [1, 2, 3].map((s) => FRESH[s].map(() => svg('rect', {
    y: ROWY - 3, height: CH + 6, rx: 9, fill: 'none', stroke: PAL.weight, 'stroke-width': 1.6, opacity: 0,
  })));

  // token-ID chips (step 4)
  const CHIP_W = 112, CHIP_H = 42, CHIP_Y = 222;
  const ids = ['517', '83,220', '12,940'];
  const centers = STAGES[3].map(([a, b]) => (layouts[3][a] + layouts[3][b] + CW) / 2);
  const chips = ids.map((idStr) => svg('g', { opacity: 0 },
    svg('rect', { x: -CHIP_W / 2, width: CHIP_W, height: CHIP_H, rx: 8, fill: 'rgba(224,168,76,0.12)', stroke: PAL.weight, 'stroke-width': 1.2 }),
    txt(0, 26, idStr, { size: 15, fill: PAL.weight, anchor: 'middle', mono: true })));
  const conns = centers.map((c) => svg('line', {
    x1: c, y1: ROWY + CH + 8, x2: c, y2: CHIP_Y - 10,
    stroke: PAL.mut, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0, 'marker-end': 'url(#arr02)',
  }));
  const idsLabel = txt(24, CHIP_Y + 26, '→ token IDs', { opacity: 0 });

  const defs = svg('defs', {},
    svg('marker', { id: 'arr02', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Byte-pair encoding of the word unbelievability: fifteen raw byte cells merge step by step into three subword tokens — un, believ, ability — which collapse into the integer token IDs 517, 83220 and 12940.',
  }, defs, title, stageTag, R, pulses, glyphs, conns, chips, idsLabel));

  const setGeom = (rect, xs, [a, b], pad = 0) => {
    rect.setAttribute('x', xs[a] - pad);
    rect.setAttribute('width', xs[b] + CW - xs[a] + 2 * pad);
  };

  return (p) => {
    const t1 = seg(p, 0.28, 0.42), t2 = seg(p, 0.52, 0.66), t3 = seg(p, 0.74, 0.84);
    const xs = chars.map((_, i) => {
      let x = layouts[0][i];
      x = lerp(x, layouts[1][i], t1);
      x = lerp(x, layouts[2][i], t2);
      x = lerp(x, layouts[3][i], t3);
      return x;
    });

    const tIn = seg(p, 0.02, 0.2);
    const intro = (i) => seg(tIn, i / (N + 3), (i + 4) / (N + 3), ease.out);
    glyphs.forEach((g, i) => {
      const ti = intro(i);
      g.setAttribute('opacity', ti);
      g.setAttribute('x', xs[i] + CW / 2);
      g.setAttribute('y', lerp(ROWY + 22, ROWY + 30, ti));
    });

    const ops = [
      (gi) => intro(gi) * (1 - seg(p, 0.28, 0.35)),
      () => seg(p, 0.29, 0.40) * (1 - seg(p, 0.52, 0.58)),
      () => seg(p, 0.55, 0.66) * (1 - seg(p, 0.74, 0.79)),
      () => seg(p, 0.77, 0.85),
    ];
    R.forEach((rects, s) => rects.forEach((rect, gi) => {
      setGeom(rect, xs, STAGES[s][gi]);
      rect.setAttribute('opacity', ops[s](gi));
    }));

    const pw = [[0.30, 0.48], [0.55, 0.72], [0.77, 0.92]];
    pulses.forEach((set, k) => {
      const t = seg(p, pw[k][0], pw[k][1], ease.linear);
      set.forEach((rect, j) => {
        setGeom(rect, xs, STAGES[k + 1][FRESH[k + 1][j]], 3);
        rect.setAttribute('opacity', t * (1 - t) * 4);
      });
    });

    stageTag.textContent =
      p < 0.30 ? 'bytes · 15 symbols' :
      p < 0.54 ? 'merge 1 · u+n → un' :
      p < 0.76 ? 'merge k · 7 pieces' : 'merge n · 3 tokens';

    const t4 = seg(p, 0.87, 0.99);
    chips.forEach((chip, k) => {
      const tk = seg(t4, k * 0.12, 0.7 + k * 0.12, ease.out);
      chip.setAttribute('opacity', tk);
      chip.setAttribute('transform', `translate(${centers[k]}, ${lerp(CHIP_Y - 26, CHIP_Y, tk)})`);
      conns[k].setAttribute('opacity', tk * 0.9);
    });
    idsLabel.setAttribute('opacity', t4);
  };
}

/* ---- the scene ----------------------------------------------------------- */

export function sceneBpe() {
  return createScene({
    id: 'bpe-merges',
    figure: bpeFigure,
    steps: [
      { n: 'STEP 1 / 4 — RAW BYTES', html: `<p>Start at the floor. <code>unbelievability</code> arrives as 15 raw bytes — u·n·b·e·l·i·e·v·a·b·i·l·i·t·y. The 256 possible byte values are the tokenizer’s starting alphabet, which is why nothing is ever unrepresentable.</p>` },
      { n: 'STEP 2 / 4 — MERGE 1', html: `<p>At inference the tokenizer replays its learned merge list, greedily and in order. An early rule fires first: <code>u</code> + <code>n</code> → <code>un</code> — a pair frequent enough in the reference corpus to have earned its own symbol.</p>` },
      { n: 'STEP 3 / 4 — MERGE k', html: `<p>Merges compound: merged symbols are themselves candidates for further merges. A few thousand rules in, the word is seven pieces — un·be·li·ev·ab·il·ity — each a statistically common fragment of text.</p>` },
      { n: 'STEP 4 / 4 — MERGE n → TOKEN IDs', html: `<p>When no rule applies, segmentation stops: <code>un</code>·<code>believ</code>·<code>ability</code>. Each piece is looked up in the vocabulary, and the text is gone — the model receives only the integers 517, 83220, 12940.</p>` },
    ],
  });
}
