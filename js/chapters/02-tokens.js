/* Chapter 02 — tokens & embeddings. From text to vectors the model can touch.
   Sticky scene: BPE merges replayed on "unbelievability" — byte cells sliding
   together into subword tokens, then collapsing into integer IDs. Then the
   embedding lookup: one row of a learned matrix becomes the token's vector. */

import { svg, svgRoot } from '../core/dom.js';
import { chapter, chapterHead, prose, term, mathAside, figure, PAL } from '../core/components.js';
import { createScene } from '../core/scene.js';
import { track } from '../core/scroll.js';
import { seg, lerp, ease, si } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

/* ---- Fig 2.1 (scene): BPE tokenization of "unbelievability" -------------- */

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

  const title = svg('text', { x: 24, y: 30, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 },
    'tokenizing “unbelievability” — replaying the learned merges');
  const stageTag = svg('text', { x: 24, y: 64, fill: PAL.weight, 'font-family': 'monospace', 'font-size': 12 },
    'bytes · 15 symbols');

  const glyphs = chars.map((c) => svg('text', {
    x: 0, y: ROWY + 30, 'text-anchor': 'middle',
    fill: PAL.ink, 'font-family': 'monospace', 'font-size': 15,
  }, c));

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
    svg('text', { x: 0, y: 26, 'text-anchor': 'middle', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 15 }, idStr)));
  const conns = centers.map((c) => svg('line', {
    x1: c, y1: ROWY + CH + 8, x2: c, y2: CHIP_Y - 10,
    stroke: PAL.mut, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0, 'marker-end': 'url(#arr02)',
  }));
  const idsLabel = svg('text', { x: 24, y: CHIP_Y + 26, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 },
    '→ token IDs');

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

/* ---- Fig 2.2: the embedding lookup + its unembedding mirror -------------- */

function embeddingFigure() {
  const W = 720, H = 400;
  const d = K3.blueprint.dModel;

  // E — the embedding matrix, tall and thin
  const eLines = Array.from({ length: 17 }, (_, i) => svg('line', {
    x1: 41, y1: 56 + (i + 1) * (290 / 18), x2: 139, y2: 56 + (i + 1) * (290 / 18),
    stroke: PAL.weight, opacity: 0.12,
  }));
  const gE = svg('g', { opacity: 0 },
    svg('rect', { x: 40, y: 56, width: 100, height: 290, rx: 4, fill: 'rgba(224,168,76,0.07)', stroke: PAL.weight, 'stroke-width': 1.4 }),
    eLines,
    svg('text', { x: 40, y: 40, fill: PAL.weight, 'font-family': 'monospace', 'font-size': 12.5 }, `E ∈ ℝ^(${si(K3.vocab)} × d)`),
    svg('text', { x: 40, y: 366, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, 'one row per vocab entry'));

  const hlRow = svg('rect', { x: 42, y: 190, width: 96, height: 10, rx: 2, fill: PAL.weight, opacity: 0 });
  const rowLabel = svg('text', { x: 170, y: 178, fill: PAL.weight, 'font-family': 'monospace', 'font-size': 12, opacity: 0 },
    '← row 517 (“un”)');

  // the extracted vector — activation-cyan cells expanding out of the row
  const vecVals = ['0.11', '−1.72', '0.03', '…'];
  const VX = [170, 225, 280, 335], VY = 181;
  const gVec = svg('g', { opacity: 0 },
    vecVals.map((v, i) => svg('g', { transform: `translate(${VX[i]}, ${VY})` },
      svg('rect', { width: 52, height: 28, rx: 5, fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1 }),
      svg('text', { x: 26, y: 19, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 12 }, v))));
  const dLabel = svg('text', { x: 170, y: 228, fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 },
    '· d numbers');

  const arrow1 = svg('path', { d: 'M 394 195 L 436 195', stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', opacity: 0, 'marker-end': 'url(#arr22)' });

  // the stack of layers (next chapter)
  const slabs = Array.from({ length: 4 }, (_, i) => svg('rect', {
    x: 456, y: 152 + i * 13, width: 100, height: 7, rx: 2, fill: PAL.act, opacity: 0.35,
  }));
  const gStack = svg('g', { opacity: 0 },
    svg('rect', { x: 444, y: 140, width: 124, height: 110, rx: 10, fill: 'rgba(90,200,220,0.06)', stroke: PAL.act, 'stroke-width': 1.3 }),
    slabs,
    svg('text', { x: 506, y: 218, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11.5 }, 'the stack'),
    svg('text', { x: 506, y: 232, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'sans-serif', 'font-size': 11.5 }, 'of layers'),
    svg('text', { x: 506, y: 245, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11 }, '(next chapter)'));

  const arrow2 = svg('path', { d: 'M 572 195 L 604 195', stroke: PAL.mut, 'stroke-width': 1.5, fill: 'none', opacity: 0, 'marker-end': 'url(#arr22)' });

  // the unembedding mirror
  const wuLines = Array.from({ length: 13 }, (_, i) => svg('line', {
    x1: 611, y1: 80 + (i + 1) * (230 / 14), x2: 693, y2: 80 + (i + 1) * (230 / 14),
    stroke: PAL.weight, opacity: 0.12,
  }));
  const gWu = svg('g', { opacity: 0 },
    svg('rect', { x: 610, y: 80, width: 84, height: 230, rx: 4, fill: 'rgba(224,168,76,0.07)', stroke: PAL.weight, 'stroke-width': 1.4 }),
    wuLines,
    svg('text', { x: 706, y: 64, 'text-anchor': 'end', fill: PAL.weight, 'font-family': 'monospace', 'font-size': 11.5 }, 'Wᵁ — unembedding (V × d)'));
  const gLogits = svg('g', { opacity: 0 },
    svg('path', { d: 'M 652 314 L 652 334', stroke: PAL.mut, 'stroke-width': 1.4, fill: 'none', 'marker-end': 'url(#arr22)' }),
    svg('text', { x: 652, y: 352, 'text-anchor': 'middle', fill: PAL.tx, 'font-family': 'monospace', 'font-size': 11 }, 'logits → softmax'));

  const bottomNote = svg('text', { x: 300, y: 388, 'text-anchor': 'middle', fill: PAL.mut, 'font-family': 'sans-serif', 'font-size': 11, opacity: 0 },
    'one vector per input token — the model’s working representation');

  const defs = svg('defs', {},
    svg('marker', { id: 'arr22', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: PAL.mut })));

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'Embedding lookup: the tall embedding matrix E with one highlighted row extracted as a dense vector that flows into the stack of layers; at the other end the unembedding matrix maps the final vector back to logits over the vocabulary.',
  }, defs, gE, hlRow, rowLabel, gVec, dLabel, arrow1, gStack, arrow2, gWu, gLogits, bottomNote);

  const node = figure('2.2',
    `embedding lookup: a token ID selects one row of a learned matrix. With a ${si(K3.vocab)} vocabulary and d = ${d.toLocaleString('en-US')} (K2 blueprint, illustrative), E alone is ≈ ${si(K3.vocab * d)} parameters.`,
    root);

  track(node, (p) => {
    gE.setAttribute('opacity', seg(p, 0.12, 0.28));
    const tRow = seg(p, 0.28, 0.38);
    hlRow.setAttribute('opacity', tRow);
    rowLabel.setAttribute('opacity', tRow);
    // the row (96×10, at x=42 y=190) grows into the vector (217×28, at x=170 y=181)
    const tV = seg(p, 0.36, 0.52, ease.out);
    const sx = lerp(0.44, 1, tV), sy = lerp(0.36, 1, tV);
    gVec.setAttribute('opacity', tV);
    gVec.setAttribute('transform',
      `translate(${lerp(42, 170, tV) - 170 * sx} ${lerp(190, VY, tV) - VY * sy}) scale(${sx} ${sy})`);
    dLabel.setAttribute('opacity', seg(p, 0.5, 0.56));
    arrow1.setAttribute('opacity', seg(p, 0.5, 0.58));
    gStack.setAttribute('opacity', seg(p, 0.54, 0.64));
    arrow2.setAttribute('opacity', seg(p, 0.62, 0.68));
    gWu.setAttribute('opacity', seg(p, 0.64, 0.76));
    gLogits.setAttribute('opacity', seg(p, 0.72, 0.8));
    bottomNote.setAttribute('opacity', seg(p, 0.55, 0.65));
  });

  return node;
}

/* ---- chapter assembly ---------------------------------------------------- */

export function render({ id, num, title }) {
  const d = K3.blueprint.dModel;
  return chapter(id,
    chapterHead(num, 'Tokens & embeddings', title),
    prose(
      `A transformer never sees characters or words. Text is first segmented into <strong>tokens</strong> by a tokenizer — a fixed, deterministic preprocessing step trained separately from the model, almost always some variant of <strong>byte-pair encoding</strong>. BPE is a greedy compression scheme: start with an alphabet of the 256 possible bytes, count which adjacent pair of symbols occurs most often in a reference corpus, merge that pair into a new symbol, and repeat until you hit a vocabulary budget — around ${si(K3.vocab)} entries for the Kimi family. Frequent strings (<code>the</code>, <code>&nbsp;of</code>, <code>tion</code>, <code>import numpy</code>) end up as single tokens; rare ones decompose into pieces, bottoming out at raw bytes, so no input is ever <em>out of vocabulary</em>.`),
    term('byte-pair encoding', 'n.', 'iteratively replace the most frequent adjacent symbol pair with a new symbol; the learned merge list is then applied greedily at inference'),

    createScene({
      id: 'bpe-merges',
      figure: bpeFigure,
      steps: [
        { n: 'STEP 1 / 4 — RAW BYTES', html: `<p>Start at the floor. <code>unbelievability</code> arrives as 15 raw bytes — u·n·b·e·l·i·e·v·a·b·i·l·i·t·y. The 256 possible byte values are the tokenizer’s starting alphabet, which is why nothing is ever unrepresentable.</p>` },
        { n: 'STEP 2 / 4 — MERGE 1', html: `<p>At inference the tokenizer replays its learned merge list, greedily and in order. An early rule fires first: <code>u</code> + <code>n</code> → <code>un</code> — a pair frequent enough in the reference corpus to have earned its own symbol.</p>` },
        { n: 'STEP 3 / 4 — MERGE k', html: `<p>Merges compound: merged symbols are themselves candidates for further merges. A few thousand rules in, the word is seven pieces — un·be·li·ev·ab·il·ity — each a statistically common fragment of text.</p>` },
        { n: 'STEP 4 / 4 — MERGE n → TOKEN IDs', html: `<p>When no rule applies, segmentation stops: <code>un</code>·<code>believ</code>·<code>ability</code>. Each piece is looked up in the vocabulary, and the text is gone — the model receives only the integers 517, 83220, 12940.</p>` },
      ],
    }),
    prose(
      `<em>Fig. 2.1 — BPE in action. The merge list is learned once from corpus statistics; token IDs are arbitrary indices.</em>`,
      `Token IDs are meaningless integers — 517 is not “close to” 518. The first learned component of the model gives them geometry: the <strong>embedding matrix</strong> E, with one row per vocabulary entry. Looking up token 517 means taking row 517 of E: a dense vector of dimension d_model — ${d.toLocaleString('en-US')} in Kimi K2, undisclosed but similar in K3. That width is the model’s chief internal dimension; nearly every activation you’ll meet from here on is a vector in ℝ<sup>d_model</sup>.`,
      `E starts as random noise and is trained by gradient descent like every other weight. Structure emerges because tokens used in similar contexts receive similar gradient updates: synonyms drift together, and some semantic relationships become roughly linear directions in the space. At the output end a mirror-image <strong>unembedding matrix</strong> (the “LM head”) maps the final d_model-dimensional vector back to one score per vocabulary entry — the logits that become Fig. 1.1’s distribution.`),

    embeddingFigure(),

    mathAside('Why subwords? The case against characters and words', `
      <p><strong>Characters/bytes:</strong> sequences get ~4× longer, and self-attention cost grows quadratically in sequence length (chapter 04) — you pay ~16× compute for the same text, and long-range structure gets harder to learn. <strong>Whole words:</strong> the vocabulary explodes (morphology, names, typos, code identifiers, other languages), and anything unseen at training time becomes an unrepresentable out-of-vocabulary hole.</p>
      <p>Subwords interpolate: common strings are cheap single tokens, everything else decomposes gracefully. The cost is quirks — arithmetic on digit-chunks, “how many r’s in strawberry” — that live in the tokenizer, not the transformer.</p>`),
    mathAside('lookup as matrix multiply, tied unembedding', `
      <p>Writing token t as a one-hot vector eₜ ∈ ℝ<sup>V</sup>, the lookup is a matrix product that never gets materialized as one:</p>
      <div class="eq">x = eₜᵀ E</div>
      <p>The unembedding computes logits z = W<sub>U</sub> h_final with W<sub>U</sub> ∈ ℝ^(V×d); some models <em>tie</em> W<sub>U</sub> = E to save parameters, larger ones usually keep them separate. Softmax over z (chapter 04 defines it) yields the output distribution. Embedding + unembedding ≈ 2·V·d parameters — ~${si(2 * K3.vocab * d)} at K2 scale, a rounding error against ${si(K3.totalParams)}.</p>`));
}
