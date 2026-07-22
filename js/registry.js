/* Chapter registry — the site's table of contents IS this array.
   To add a chapter: create js/chapters/<nn>-<slug>.js exporting
   `render() → Node`, then add one entry here. Order = page order.  */

export const CHAPTERS = [
  { id: 'hero',         num: '',   toc: false, title: 'How a Trillion-Parameter Model Actually Works', load: () => import('./chapters/00-hero.js') },
  { id: 'objective',    num: '01', toc: true,  title: 'One task: predict the next token',              load: () => import('./chapters/01-objective.js') },
  { id: 'tokens',       num: '02', toc: true,  title: 'Tokens and embeddings',                         load: () => import('./chapters/02-tokens.js') },
  { id: 'residual',     num: '03', toc: true,  title: 'The residual stream and one layer',             load: () => import('./chapters/03-residual.js') },
  { id: 'attention',    num: '04', toc: true,  title: 'Attention, step by step',                       load: () => import('./chapters/04-attention.js') },
  { id: 'moe',          num: '05', toc: true,  title: 'Mixture of experts',                            load: () => import('./chapters/05-moe.js') },
  { id: 'assembly',     num: '06', toc: true,  title: 'Assembling K3: parameter arithmetic',           load: () => import('./chapters/06-assembly.js') },
  { id: 'pretraining',  num: '07', toc: true,  title: 'Pretraining: the loop that costs millions',     load: () => import('./chapters/07-pretraining.js') },
  { id: 'posttraining', num: '08', toc: true,  title: 'Post-training: SFT, RLHF, RLVR',                load: () => import('./chapters/08-posttraining.js') },
  { id: 'inference',    num: '09', toc: true,  title: 'Inference: prefill, decode, the KV cache',      load: () => import('./chapters/09-inference.js') },
  { id: 'adaptation',   num: '10', toc: true,  title: 'Adaptation: fine-tuning → LoRA → 13 parameters', load: () => import('./chapters/10-adaptation.js') },
  { id: 'epilogue',     num: '',   toc: false, title: 'Nine years, one story',                         load: () => import('./chapters/11-epilogue.js') },
];
