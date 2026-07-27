/* Chapter registry — the site's table of contents IS this array, and its ORDER
   is the only place chapter numbering is decided (js/core/numbering.js derives
   every number and cross-reference from it). Reordering or inserting a chapter
   renumbers the book automatically; nothing else needs editing.

   Entry fields:
     id      stable slug — the DOM id, the anchor, and the cross-reference key.
             NEVER change one casually: chRef('attention') and every #hash
             link depend on it.
     title   headline shown in the TOC and the chapter header.
     part    which part of the book it belongs to (see PARTS below).
     load    () => import(...) — the chapter module, exporting render(ctx).
     sub     true → a sub-chapter: numbers as 08B off the previous chapter.
     kind    'front' | 'back' → unnumbered, kept out of the TOC.

   To add a chapter: create js/chapters/<slug>/index.js exporting render(),
   then add one line here. See docs/AUTHORING.md.  */

export const PARTS = {
  tools:   'Part I · The task and the tools',
  machine: 'Part II · The machine',
  making:  'Part III · Making one',
  using:   'Part IV · Using one',
};

export const CHAPTERS = [
  { id: 'hero', kind: 'front', title: 'How a Trillion-Parameter Model Actually Works', load: () => import('./chapters/hero/index.js') },

  /* ---- Part I — the task, then the mathematics it needs -------------------- */
  { id: 'objective',       part: 'tools', title: 'One task: predict the next token',                    load: () => import('./chapters/objective/index.js') },
  { id: 'vectors',         part: 'tools', title: 'Vectors, matrices, and the dot product',              load: () => import('./chapters/vectors/index.js') },
  { id: 'networks',        part: 'tools', title: 'From one neuron to a network',                        load: () => import('./chapters/networks/index.js') },
  { id: 'learning',        part: 'tools', title: 'How a machine learns: loss, gradients, descent',      load: () => import('./chapters/learning/index.js') },
  { id: 'probability',     part: 'tools', title: 'Probability, softmax, and surprise',                  load: () => import('./chapters/probability/index.js') },
  { id: 'sequences',       part: 'tools', title: 'Why sequences were hard: n-grams, RNNs, and the parallelism wall', load: () => import('./chapters/sequences/index.js') },

  /* ---- Part II — the machine ---------------------------------------------- */
  { id: 'tokens',          part: 'machine', title: 'Tokens and embeddings',                             load: () => import('./chapters/tokens/index.js') },
  { id: 'residual',        part: 'machine', title: 'The residual stream and one layer',                 load: () => import('./chapters/residual/index.js') },
  { id: 'anatomy',         part: 'machine', sub: true, title: 'Inside the layer: the component catalog', load: () => import('./chapters/anatomy/index.js') },
  { id: 'attention',       part: 'machine', title: 'Attention, step by step',                           load: () => import('./chapters/attention/index.js') },
  { id: 'attention-scale', part: 'machine', sub: true, title: 'Attention at scale: long context and the memory wall', load: () => import('./chapters/attention-scale/index.js') },
  { id: 'moe',             part: 'machine', title: 'Mixture of experts',                                load: () => import('./chapters/moe/index.js') },
  { id: 'assembly',        part: 'machine', title: 'Assembling K3: parameter arithmetic',               load: () => import('./chapters/assembly/index.js') },

  /* ---- Part III — making one ---------------------------------------------- */
  { id: 'data',            part: 'making', title: 'Where the knowledge comes from',                     load: () => import('./chapters/data/index.js') },
  { id: 'pretraining',     part: 'making', title: 'Pretraining: the loop that costs millions',          load: () => import('./chapters/pretraining/index.js') },
  { id: 'base-model',      part: 'making', sub: true, title: 'The base model: an internet simulator',   load: () => import('./chapters/base-model/index.js') },
  { id: 'posttraining',    part: 'making', title: 'Post-training: SFT, RLHF, RLVR',                     load: () => import('./chapters/posttraining/index.js') },
  { id: 'rl',              part: 'making', sub: true, title: 'Practice problems: RL and the emergence of thinking', load: () => import('./chapters/rl/index.js') },

  /* ---- Part IV — using one ------------------------------------------------ */
  { id: 'inference',       part: 'using', title: 'Inference: prefill, decode, the KV cache',            load: () => import('./chapters/inference/index.js') },
  { id: 'adaptation',      part: 'using', title: 'Adaptation: fine-tuning → LoRA → 13 parameters',      load: () => import('./chapters/adaptation/index.js') },
  { id: 'multimodal',      part: 'using', title: 'Beyond text: how images, audio, and video get in',    load: () => import('./chapters/multimodal/index.js') },

  { id: 'epilogue', kind: 'back', title: 'Nine years, one story', load: () => import('./chapters/epilogue/index.js') },
];
