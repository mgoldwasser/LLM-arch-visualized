/* One batch, one grid: rows are examples, columns are features. The band that
   defines a normalization layer sweeps down the columns (BatchNorm), then
   rotates and sweeps across the rows (LayerNorm).

   Every number on the canvas is computed here from the matrix — the mean, the
   standard deviation, the normalized band, and the mean and standard deviation
   of that normalized band, which are 0.000 and 1.000 by construction and are
   printed so the reader can check the arithmetic. */

import { svg, svgRoot } from '../../core/dom.js';
import { figure, txt, PAL } from '../../core/components.js';
import { pin } from '../../core/scroll.js';
import { seg, lerp, clamp, rng, ease } from '../../core/anim.js';

const R = 4, C = 6;
const SUB = ['₁', '₂', '₃', '₄', '₅', '₆'];

/* Seeded data with a deliberately different scale and offset per feature —
   the situation BatchNorm was designed for. */
const M = (() => {
  const r = rng(28);
  const scale = Array.from({ length: C }, () => 0.35 + 1.15 * r());
  const shift = Array.from({ length: C }, () => Math.round((r() * 4 - 2) * 10) / 10);
  return Array.from({ length: R }, () => Array.from({ length: C }, (_, j) =>
    Math.round((shift[j] + scale[j] * (r() * 2 - 1)) * 10) / 10));
})();

const COL = Array.from({ length: C }, (_, j) => M.map((row) => row[j]));
const ROW = M.map((row) => row.slice());

const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v) => { const m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) * (x - m)))); };
const norml = (v) => { const m = mean(v), s = sd(v); return v.map((x) => (x - m) / s); };

const fx = (v, d) => ((Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d)).replace('-', '−');
const f1 = (v) => fx(v, 1);
const f3 = (v) => fx(v, 3);

const GX = 110, GY = 128, CW = 58, CH = 36, DX = 64, DY = 42;
const cellX = (j) => GX + j * DX;
const cellY = (i) => GY + i * DY;
const SLOT = (m) => 190 + m * 74;

export function axesFigure() {
  const W = 760, H = 470;

  const cells = [];
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
    cells.push({
      i, j,
      rect: svg('rect', { x: cellX(j), y: cellY(i), width: CW, height: CH, rx: 4, fill: PAL.act, 'fill-opacity': 0.07, stroke: PAL.grid }),
      label: txt(cellX(j) + CW / 2, cellY(i) + CH / 2 + 4.3, f1(M[i][j]), { size: 12, fill: PAL.ink, anchor: 'middle', mono: true }),
    });
  }
  const tags = [
    ...Array.from({ length: C }, (_, j) => txt(cellX(j) + CW / 2, 118, `f${SUB[j]}`, { size: 10.5, anchor: 'middle', mono: true })),
    ...Array.from({ length: R }, (_, i) => txt(100, cellY(i) + 22, `e${SUB[i]}`, { size: 10.5, anchor: 'end', mono: true })),
    txt(GX + (C * DX - (DX - CW)) / 2, 98, 'features — one column each', { size: 10.5, anchor: 'middle' }),
    txt(100, 106, 'examples ↓', { size: 10.5, anchor: 'end' }),
  ];

  const colMus = Array.from({ length: C }, (_, j) => txt(cellX(j) + CW / 2, 314, f3(mean(COL[j])), { size: 10.5, fill: PAL.tx, anchor: 'middle', mono: true, opacity: 0 }));
  const colMuLab = txt(100, 314, 'μ per feature', { size: 10, anchor: 'end', opacity: 0 });
  const rowMus = Array.from({ length: R }, (_, i) => txt(502, cellY(i) + 22, f3(mean(ROW[i])), { size: 10.5, fill: PAL.tx, mono: true, opacity: 0 }));
  const rowMuLab = txt(502, 118, 'μ per example', { size: 10, opacity: 0 });

  const band = svg('rect', { x: 105, y: 122, width: 68, height: 174, rx: 7, fill: 'none', stroke: PAL.ink, 'stroke-width': 1.6 });

  const panel = (y, name, lines) => ({
    bar: svg('rect', { x: 570, y: y - 13, width: 3, height: 74, rx: 1.5, fill: PAL.ink, opacity: 0.3 }),
    g: svg('g', { opacity: 0.35 },
      txt(580, y, name, { size: 11.5, fill: PAL.ink, mono: true }),
      lines.map((s, k) => txt(580, y + 20 + k * 17, s, { size: 10 }))),
  });
  const pBatch = panel(150, 'BatchNorm', ['axis: down each column', 'one μ, σ per feature', 'output depends on the batch']);
  const pLayer = panel(236, 'LayerNorm', ['axis: across each row', 'one μ, σ per example', 'never crosses examples']);

  const l1 = txt(40, 344, '', { size: 11, fill: PAL.tx });
  const rawLab = txt(40, 370, 'x', { size: 11.5, fill: PAL.mut, mono: true });
  const raws = Array.from({ length: C }, (_, m) => svg('text', {
    x: SLOT(m), y: 370, 'text-anchor': 'middle', fill: PAL.ink, 'font-family': 'monospace', 'font-size': 11.5, dataset: { raw: '' },
  }, ''));
  const muT = txt(40, 396, '', { size: 11.5, fill: PAL.tx, mono: true });
  const sdT = txt(180, 396, '', { size: 11.5, fill: PAL.tx, mono: true });
  const sdNote = txt(330, 396, 'σ² = mean((x − μ)²)', { size: 10.5 });
  const nrmLab = txt(40, 422, '(x−μ)/σ', { size: 11.5, fill: PAL.mut, mono: true });
  const nrms = Array.from({ length: C }, (_, m) => svg('text', {
    x: SLOT(m), y: 422, 'text-anchor': 'middle', fill: PAL.act, 'font-family': 'monospace', 'font-size': 11.5, dataset: { nrm: '' },
  }, ''));
  const check = txt(40, 450, '', { size: 11, fill: PAL.act });

  const title = txt(28, 32, 'one batch of activations: 4 examples × 6 features', { size: 12.5, fill: PAL.ink });
  const subtitle = txt(28, 50, 'the same operation — subtract the mean, divide by the standard deviation — along two axes', { size: 10.5 });

  const root = svgRoot(W, H, {
    role: 'img',
    'aria-label': 'A four by six grid of numbers: rows are examples in a batch, columns are features. A rectangular band first selects one column at a time and sweeps across all six, printing that feature’s mean and standard deviation over the four examples — this is BatchNorm. The band then rotates ninety degrees and sweeps down the four rows, printing each example’s mean and standard deviation over its own six features — this is LayerNorm. At every position the band’s values, its mean and standard deviation, and the normalized values are recomputed and displayed, together with the mean and standard deviation of the normalized band, which are zero and one.',
  }, title, subtitle, tags,
    cells.map((c) => [c.rect, c.label]), colMuLab, colMus, rowMuLab, rowMus, band,
    pBatch.bar, pBatch.g, pLayer.bar, pLayer.g,
    l1, rawLab, raws, muT, sdT, sdNote, nrmLab, nrms, check);

  const node = figure(
    'BatchNorm and LayerNorm are one operation applied along different axes of the same matrix. BatchNorm normalizes a column — one feature, gathered across the batch. LayerNorm normalizes a row — one example, gathered across its own features. Every number shown is computed from the grid, including the mean and standard deviation of the normalized band.',
    root, { wide: true, key: 'axes' });

  return pin(node, (p) => {
    const rise = seg(p, 0.02, 0.08);
    cells.forEach((c) => { c.rect.setAttribute('opacity', rise); c.label.setAttribute('opacity', rise); });
    tags.forEach((t) => t.setAttribute('opacity', rise));

    const tr = seg(p, 0.46, 0.54, ease.linear);
    const ci = clamp(Math.floor((p - 0.10) / 0.058), 0, C - 1);
    const ri = clamp(Math.floor((p - 0.55) / 0.085), 0, R - 1);

    /* The band's geometry is a straight interpolation between the last column
       and the first row, so the sweep literally rotates. */
    const cb = [105 + ci * DX, 122, CW + 10, R * DY - (DY - CH) + 12];
    const rb = [GX - 6, cellY(ri) - 5, C * DX - (DX - CW) + 12, CH + 10];
    const g = cb.map((v, k) => lerp(v, rb[k], tr));
    band.setAttribute('x', g[0]); band.setAttribute('y', g[1]);
    band.setAttribute('width', g[2]); band.setAttribute('height', g[3]);
    band.setAttribute('opacity', seg(p, 0.09, 0.14));

    cells.forEach((c) => {
      const w = clamp((c.j === ci ? 1 - tr : 0) + (c.i === ri ? tr : 0));
      c.rect.setAttribute('fill-opacity', 0.07 + 0.30 * w);
    });

    colMus.forEach((t, j) => t.setAttribute('opacity', seg(p, 0.10 + j * 0.058, 0.13 + j * 0.058) * (1 - tr)));
    colMuLab.setAttribute('opacity', seg(p, 0.10, 0.15) * (1 - tr) * 0.9);
    rowMus.forEach((t, i) => t.setAttribute('opacity', seg(p, 0.55 + i * 0.085, 0.58 + i * 0.085) * tr));
    rowMuLab.setAttribute('opacity', seg(p, 0.55, 0.60) * tr * 0.9);

    pBatch.g.setAttribute('opacity', 0.35 + 0.65 * (1 - tr));
    pBatch.bar.setAttribute('opacity', 0.25 + 0.75 * (1 - tr));
    pLayer.g.setAttribute('opacity', 0.35 + 0.65 * tr);
    pLayer.bar.setAttribute('opacity', 0.25 + 0.75 * tr);

    /* Readout — always assigned, never conditionally, so the same p always
       renders the same text. It dips to zero as the band rotates. */
    const useRow = tr >= 0.5;
    const v = useRow ? ROW[ri] : COL[ci];
    const n = norml(v);
    const fade = seg(p, 0.10, 0.15) * Math.sqrt(Math.abs(1 - 2 * tr));
    l1.textContent = useRow
      ? `row e${SUB[ri]} — example ${ri + 1} across all ${C} of its own features`
      : `column f${SUB[ci]} — feature ${ci + 1} taken from all ${R} examples`;
    muT.textContent = `μ = ${f3(mean(v))}`;
    sdT.textContent = `σ = ${f3(sd(v))}`;
    raws.forEach((t, m) => { t.textContent = m < v.length ? f1(v[m]) : ''; });
    nrms.forEach((t, m) => { t.textContent = m < n.length ? f3(n[m]) : ''; });
    check.textContent = `the normalized band: mean ${f3(mean(n))}, standard deviation ${f3(sd(n))}`;
    [l1, rawLab, muT, sdT, sdNote, nrmLab, check, ...raws, ...nrms]
      .forEach((t) => t.setAttribute('opacity', fade));
  }, { extent: 280 });
}

/* ---- per-figure checks (5.2) ---------------------------------------------
   Read the figure's own printed numbers back and require them to agree with
   the arithmetic the figure claims to be doing. Nothing is transcribed: the
   raw values, μ and σ all come off the canvas. */

const parse = (s) => Number(String(s).replace(/−/g, '-').replace(/^[^-\d.]*/, ''));

function readout(root) {
  const raw = [...root.querySelectorAll('[data-raw]')].map((t) => t.textContent).filter((s) => s !== '').map(parse);
  const nrm = [...root.querySelectorAll('[data-nrm]')].map((t) => t.textContent).filter((s) => s !== '').map(parse);
  return { raw, nrm };
}

function assertBand(root, expected) {
  const { raw, nrm } = readout(root);
  if (raw.length !== expected) throw new Error(`band shows ${raw.length} values, expected ${expected}`);
  if (nrm.length !== expected) throw new Error(`normalized band shows ${nrm.length} values, expected ${expected}`);
  const m = mean(nrm), s = sd(nrm);
  if (Math.abs(m) > 6e-3) throw new Error(`normalized band mean is ${m}, not 0`);
  if (Math.abs(s - 1) > 6e-3) throw new Error(`normalized band std is ${s}, not 1`);
  const mu = mean(raw), sg = sd(raw);
  nrm.forEach((x, k) => {
    const want = (raw[k] - mu) / sg;
    if (Math.abs(x - want) > 2e-3) throw new Error(`(x−μ)/σ shows ${x} for x=${raw[k]}, arithmetic gives ${want}`);
  });
}

export const checks = [
  {
    fig: '#fig-axes', p: 0.3, name: 'BatchNorm band: one value per example, normalized to mean 0 / std 1',
    assert: (root) => assertBand(root, R),
  },
  {
    fig: '#fig-axes', p: 0.75, name: 'LayerNorm band: one value per feature, normalized to mean 0 / std 1',
    assert: (root) => assertBand(root, C),
  },
];
