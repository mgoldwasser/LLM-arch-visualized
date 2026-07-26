/* Chapter-local helpers and the chapter's arithmetic. Every number here is
   derived from the K3 blueprint — nothing about long context is typed in by
   hand, and no chapter or figure number appears anywhere. */

import { el } from '../../core/dom.js';
import { claimFig } from '../../core/components.js';
import { reveal } from '../../core/scroll.js';
import { K3 } from '../../../data/k3.js';

export const BP = K3.blueprint;               // illustrative K2 dims
export const L = BP.layers, D = BP.dModel, NH = BP.heads, DH = BP.dHead;
export const T1M = K3.contextWindow;          // 1,000,000
export const B = 2;                           // bf16 bytes

/* ---- the numbers, computed from the blueprint (never hard-coded) ---------- */
export const mhaPerTok  = 2 * L * D * B;      // K+V, all layers ≈ 1.75 MB/token
export const mhaAt1M    = mhaPerTok * T1M;    // ≈ 1.75 TB per sequence
export const gqaAt1M    = mhaAt1M / 8;        // 8 KV groups
export const MLA_C = 512, MLA_R = 64;         // DeepSeek-style latent + RoPE dims
export const mlaPerTok  = L * (MLA_C + MLA_R) * B;
export const mlaAt1M    = mlaPerTok * T1M;    // ≈ 70 GB
export const scoresOne  = T1M * T1M * B;      // one head, one layer, bf16 ≈ 2 TB
export const scoresAll  = scoresOne * NH * L; // ≈ 7.8 PB
export const mhaLayerB  = 2 * NH * DH * B;    // per token per layer: 32,768 B
export const gqaLayerB  = 2 * 8 * DH * B;     //                       4,096 B
export const mlaLayerB  = (MLA_C + MLA_R) * B;//                       1,152 B

export const fmtBig = (b) => {
  if (b >= 1e15) return (b / 1e15).toFixed(1).replace(/\.0$/, '') + ' PB';
  if (b >= 1e12) return (b / 1e12).toFixed(2).replace(/0$/, '').replace(/\.$/, '') + ' TB';
  if (b >= 1e9) return Math.round(b / 1e9) + ' GB';
  return Math.round(b / 1e6) + ' MB';
};

/* Section subhead (the source's inner headings). */
export const subhead = (s) => reveal(el('h3', { class: 'measure', style: { margin: '3.2rem auto 1rem', fontSize: '1.32rem' } }, s));

/* A scroll scene is a numbered figure whose caption lives in the prose that
   follows it — reserve its number at the point it appears on the page. */
export function claimed(key, node) {
  claimFig(key);
  return node;
}
