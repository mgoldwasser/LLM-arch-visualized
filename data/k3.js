/* Kimi K3 spec sheet — the "specimen" every chapter refers to.
   Where Moonshot has not disclosed a number, we substitute Kimi K2's
   published blueprint and mark it `illustrative: true`. Update HERE
   when new numbers are published; all figures read from this file. */

export const K3 = {
  name: 'Kimi K3',
  vendor: 'Moonshot AI',
  released: 'July 16, 2026',
  openWeights: true,

  totalParams: 2.8e12,
  activeParams: 5.0e10,          // 3rd-party estimate
  activeParamsEstimated: true,
  contextWindow: 1_000_000,
  vocab: 160_000,

  experts: { routed: 896, active: 16, shared: 1 },

  attention: 'Gated MLA + KDA hybrid',
  weightsFormat: 'MXFP4 (QAT from SFT stage)',
  moeFramework: 'Stable LatentMoE',
  optimizer: 'Per-Head Muon',

  // Undisclosed for K3 — K2's published blueprint, used as illustrative stand-in.
  blueprint: {
    illustrative: true,
    source: 'Kimi K2 (published)',
    layers: 61,
    dModel: 7168,
    dHead: 128,
    heads: 64,
    expertHidden: 2048,
    routedExpertsK2: 384,
  },
};

/* Comparison presets for the parameter-calculator widget. */
export const PRESETS = {
  'K3 (defaults)': { L: 61, d: 7168, E: 896, k: 16, dff: 2048, Vk: 160 },
  'Kimi K2':       { L: 61, d: 7168, E: 384, k: 8,  dff: 2048, Vk: 160 },
  'DeepSeek-V3':   { L: 61, d: 7168, E: 256, k: 8,  dff: 2048, Vk: 129 },
  'Dense 70B-ish': { L: 80, d: 8192, E: 1,   k: 1,  dff: 28672, Vk: 128 },
};
