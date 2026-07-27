/* C1 — the representation ladder. One sentence in four encodings, each
   morphing into the next: characters → bits → bytes → BPE tokens. Every
   sequence length on screen is measured from the string itself, and the
   two-axis readout plots what the ladder is really about — sequence length
   falling as vocabulary size rises. */

import { svg, svgRoot } from '../../core/dom.js';
import { txt, PAL, chRef } from '../../core/components.js';
import { createScene } from '../../core/scene.js';
import { seg, lerp, rng, si } from '../../core/anim.js';
import { K3 } from '../../../data/k3.js';
import { SENTENCE, toyTokenize, tokenId, utf8 } from './toy-bpe.js';
import { tradePlot } from './ladder-trade.js';

/* ---- measurements, all derived from the sentence -------------------------- */

const chars = [...SENTENCE];
const bytes = [];
const byteChar = [];                                   // byte index → char index
chars.forEach((c, ci) => { for (const b of utf8(c)) { bytes.push(b); byteChar.push(ci); } });

const pieces = toyTokenize(SENTENCE);
const tokSpan = [];                                    // token index → [firstChar, lastChar]
let cursor = 0;
for (const piece of pieces) {
  const n = [...piece].length;
  tokSpan.push([cursor, cursor + n - 1]);
  cursor += n;
}
const charTok = [];                                    // char index → token index
tokSpan.forEach(([a, b], k) => { for (let i = a; i <= b; i++) charTok[i] = k; });

const N_CH = chars.length, N_BY = bytes.length, N_BIT = N_BY * 8, N_TK = pieces.length;
const FIRST_BITS = bytes[0].toString(2).padStart(8, '0');
const DASH_BYTES = utf8('—').length;
const glyph = (s) => s.replace(/ /g, '·');

/* Byte values shaded through a seeded permutation, not a ramp: neighbouring
   values are not neighbouring meanings, and the figure should not imply they
   are. */
const shade = (() => {
  const a = [...Array(256).keys()];
  const r = rng(20260727);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return (v) => `rgba(90,200,220,${(0.08 + 0.5 * a[v] / 255).toFixed(3)})`;
})();

/* ---- the sticky figure ---------------------------------------------------- */

function ladderFigure(canvas) {
  const W = 720, H = 352;
  const X0 = 28, XW = 664, ROWY = 62, ROWH = 56, MID = ROWY + ROWH / 2;
  const cW = XW / N_CH, byW = XW / N_BY, biW = XW / N_BIT;
  const charC = (i) => X0 + i * cW + cW / 2;
  const byteC = (b) => X0 + b * byW + byW / 2;
  const tokX = (k) => X0 + tokSpan[k][0] * cW;
  const tokW = (k) => (tokSpan[k][1] - tokSpan[k][0] + 1) * cW;

  const title = txt(24, 24, `“${SENTENCE}” — one sentence, four encodings`, { size: 12.5, fill: PAL.tx });
  const stage = txt(24, 46, '', { size: 12, fill: PAL.weight, mono: true });

  const gChars = svg('g', {}, chars.map((c, i) => svg('g', {},
    svg('rect', {
      x: X0 + i * cW + 0.6, y: ROWY, width: cW - 1.2, height: ROWH, rx: 3,
      fill: 'rgba(90,200,220,0.06)', stroke: PAL.act, 'stroke-width': 0.8, 'stroke-opacity': 0.5,
    }),
    txt(charC(i), MID + 4, glyph(c), { size: 12, fill: c === ' ' ? PAL.mut : PAL.ink, anchor: 'middle', mono: true }))));

  const bitRects = Array.from({ length: N_BIT }, (_, j) => svg('rect', {
    x: charC(byteChar[j >> 3]) - biW / 2, y: ROWY, width: Math.max(1.1, biW - 0.5), height: ROWH,
    fill: PAL.act, opacity: ((bytes[j >> 3] >> (7 - (j & 7))) & 1) ? 0.85 : 0.13,
  }));
  const gBits = svg('g', { opacity: 0 }, bitRects);

  const byteRects = bytes.map((v, b) => svg('rect', {
    x: X0 + b * byW + 0.5, y: ROWY, width: byW - 1, height: ROWH, rx: 3,
    fill: shade(v), stroke: PAL.act, 'stroke-width': 0.8, 'stroke-opacity': 0.45,
  }));
  const byteLabels = bytes.map((v, b) => txt(byteC(b), MID + 3, String(v),
    { size: 7.5, fill: PAL.ink, anchor: 'middle', mono: true, opacity: 0.85 }));
  const gBytes = svg('g', { opacity: 0 }, byteRects, byteLabels);

  const gToks = svg('g', { opacity: 0 }, pieces.map((piece, k) => svg('g', {},
    svg('rect', {
      x: tokX(k) + 1.5, y: ROWY, width: tokW(k) - 3, height: ROWH, rx: 6,
      fill: 'rgba(90,200,220,0.10)', stroke: PAL.act, 'stroke-width': 1.1,
    }),
    txt(tokX(k) + tokW(k) / 2, MID - 2, glyph(piece), { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }),
    txt(tokX(k) + tokW(k) / 2, MID + 17, String(tokenId(piece)), { size: 9.5, fill: PAL.weight, anchor: 'middle', mono: true }))));

  const note1 = txt(28, 140, '', { size: 11.5, fill: PAL.tx });
  const note2 = txt(28, 157, '', { size: 11 });
  const rule = svg('line', { x1: 28, y1: 170, x2: 692, y2: 170, stroke: PAL.grid, 'stroke-width': 1 });

  const seqVal = txt(28, 226, '', { size: 26, fill: PAL.act, mono: true });
  const vocVal = txt(28, 312, '', { size: 26, fill: PAL.weight, mono: true });
  const readout = svg('g', {},
    txt(28, 192, 'SEQUENCE LENGTH', { size: 9 }), seqVal,
    txt(28, 243, 'positions the model must process', { size: 10 }),
    txt(28, 278, 'VOCABULARY SIZE', { size: 9 }), vocVal,
    txt(28, 329, 'rows in the embedding table', { size: 10 }));

  const plot = tradePlot({
    x: 396, y: 174, w: 302, h: 170,
    points: [
      { label: 'bits', v: 2, n: N_BIT },
      { label: 'bytes', v: 256, n: N_BY },
      { label: 'BPE', v: K3.vocab, n: N_TK },
    ],
  });

  canvas.append(svgRoot(W, H, {
    role: 'img',
    'aria-label': `The sentence “${SENTENCE}” shown in four encodings that morph into one another: `
      + `${N_CH} characters, ${N_BIT} bits, ${N_BY} bytes, and ${N_TK} byte-pair tokens. `
      + `A readout beside them plots sequence length falling from ${N_BIT} to ${N_TK} as the symbol `
      + `vocabulary rises from 2 to ${si(K3.vocab)}.`,
  }, title, stage, gChars, gBits, gBytes, gToks, note1, note2, rule, readout, plot.node));

  const NOTES = [
    [`${N_CH} characters — what you see, and the one rung the model never uses.`,
      '“Character” has no fixed inventory: Unicode keeps adding them, and a symbol the tokenizer never met would have no row to look up.'],
    [`${N_BIT} bits — a vocabulary of exactly 2, and nothing is unrepresentable.`,
      `The first eight bits are ${FIRST_BITS}: one character, eight positions. The floor is safe and ruinously long.`],
    [`${N_BY} bytes — 256 possible values. One character is not one byte: “—” costs ${DASH_BYTES}.`,
      `Byte ${bytes[0]} is “${chars[0]}”. Not one hundred and sixteen — ${bytes[0]}+1 is “${String.fromCharCode(bytes[0] + 1)}”, not more “${chars[0]}”. A byte is an identity, not a quantity.`],
    [`${N_TK} tokens — ${(N_BY / N_TK).toFixed(1)} bytes apiece, on average.`,
      'Each rung multiplied the vocabulary and divided the sequence. The model receives the amber integers, and nothing else.'],
  ];

  return (p, stepIdx) => {
    const IN = [[-0.03, 0.03], [0.22, 0.33], [0.47, 0.58], [0.72, 0.83]];
    const OUT = [[0.21, 0.31], [0.46, 0.56], [0.71, 0.81], [9, 10]];
    const op = (i) => seg(p, IN[i][0], IN[i][1]) * (1 - seg(p, OUT[i][0], OUT[i][1]));
    const m0 = seg(p, 0.20, 0.33), m1 = seg(p, 0.45, 0.58), m2 = seg(p, 0.70, 0.83);

    [gChars, gBits, gBytes, gToks].forEach((g, i) => {
      const t = op(i);
      g.setAttribute('opacity', t.toFixed(3));
      const sy = 0.22 + 0.78 * t;
      g.setAttribute('transform', `translate(0 ${MID}) scale(1 ${sy.toFixed(4)}) translate(0 ${-MID})`);
    });

    /* Positions are set unconditionally. Skipping the work while the row is
       invisible looked free, but it left the rects at whatever the last
       visible frame assigned — so the same p produced different geometry
       depending on the route taken to it, and the row flashed its stale
       position on the way back in. A few hundred setAttribute calls per frame
       is a cheaper price than a figure that is not a function of p. */
    // bits burst out of their character, then collapse back into their byte
    for (let j = 0; j < N_BIT; j++) {
      const b = j >> 3;
      let x = lerp(charC(byteChar[b]) - biW / 2, X0 + j * biW, m0);
      x = lerp(x, byteC(b) - biW / 2, m1);
      bitRects[j].setAttribute('x', x.toFixed(2));
    }
    // bytes slide into the token that swallowed them
    for (let b = 0; b < N_BY; b++) {
      const k = charTok[byteChar[b]];
      const c = lerp(byteC(b), tokX(k) + tokW(k) / 2, m2);
      byteRects[b].setAttribute('x', (c - byW / 2 + 0.5).toFixed(2));
      byteLabels[b].setAttribute('x', c.toFixed(2));
    }

    let n = N_CH;
    n = lerp(n, N_BIT, m0); n = lerp(n, N_BY, m1); n = lerp(n, N_TK, m2);
    seqVal.textContent = Math.round(n).toLocaleString('en-US');

    let v = Math.exp(lerp(Math.log(2), Math.log(256), m1));
    v = Math.exp(lerp(Math.log(v), Math.log(K3.vocab), m2));
    vocVal.textContent = p < 0.20 ? 'open-ended'
      : v < 1000 ? String(Math.round(v))
      : Math.round(v).toLocaleString('en-US');

    const rung = NOTES[Math.min(stepIdx, NOTES.length - 1)];
    stage.textContent = `rung ${stepIdx + 1} / ${NOTES.length} — ${['characters', 'bits', 'bytes', 'BPE tokens'][stepIdx] ?? ''}`;
    note1.textContent = rung[0];
    note2.textContent = rung[1];

    plot.update([seg(p, 0.26, 0.36), seg(p, 0.52, 0.62), seg(p, 0.77, 0.87)]);
  };
}

/* ---- the scene ------------------------------------------------------------ */

export function sceneLadder() {
  return createScene({
    id: 'representation-ladder',
    figure: ladderFigure,
    steps: [
      { n: 'RUNG 1 / 4 — CHARACTERS', html: `<p>Start where you are. The sentence is ${N_CH} characters, and that is the only encoding in this figure the model never receives. “Character” is not a finite alphabet you can build a table from — Unicode has grown every year since 1991, and a code point the tokenizer never met at training time has no row to look up. Every rung below fixes a finite set of symbols in advance, and then argues about how many.</p>` },
      { n: 'RUNG 2 / 4 — BITS', html: `<p>The floor. A vocabulary of two symbols, 0 and 1, encodes anything at all — the sentence becomes ${N_BIT} bits, eight per byte. Nothing is unrepresentable and the embedding table has two rows. The bill arrives as sequence length: ${N_BIT} positions to process, and attention cost grows with the <em>square</em> of that (${chRef('attention')}). Safe, general, and unaffordable.</p>` },
      { n: 'RUNG 3 / 4 — BYTES', html: `<p>Group the bits eight at a time and the vocabulary jumps to 256 while the sequence divides by eight — ${N_BY} positions. Two things to notice. One character is not one byte: the em dash costs ${DASH_BYTES}. And the value in each cell is a <strong>name</strong>, not a magnitude. Byte ${bytes[0]} is “${chars[0]}”. It is not one hundred and sixteen of anything; ${bytes[0]}+1 is “${String.fromCharCode(bytes[0] + 1)}”, which is not more “${chars[0]}”. The shading here is deliberately patternless for that reason — adjacent values are not adjacent meanings.</p>` },
      { n: 'RUNG 4 / 4 — BPE TOKENS', html: `<p>Keep merging the most frequent adjacent pair until the table holds about ${si(K3.vocab)} entries, and the same sentence lands in ${N_TK} positions — ${(N_BY / N_TK).toFixed(1)} bytes apiece. Read the two readouts together and the whole ladder is one trade: every rung multiplies the vocabulary and divides the sequence. Vocabulary is paid for once, in embedding rows and output-softmax width; sequence length is paid for on every token of every request, quadratically. That asymmetry is why the industry sits where it sits.</p>` },
    ],
  });
}
