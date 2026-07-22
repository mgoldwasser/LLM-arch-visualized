/* Extension registry — content inserted INTO existing chapters without
   touching their files.

   Each entry: {
     target: '<chapter id from js/registry.js>',
     load:   () => import('./<module>.js'),   // module exports render(ctx) → Node
     anchor: '<css selector>',                 // optional: insert after this
                                               // element inside the chapter;
                                               // omitted → append at chapter end
   }

   Extensions mount in array order after their target chapter renders.
   A failing extension logs and is skipped — it never breaks its chapter.

   The standing convention: every chapter carries a `frontier-<id>` extension
   holding its "where this breaks / what comes next" research section, built
   from the frontier()/bottleneck()/researchItem()/novelIdea() components.  */

export const EXTENSIONS = [
  { target: 'objective',       load: () => import('./frontier-objective.js') },
  { target: 'tokens',          load: () => import('./frontier-tokens.js') },
  { target: 'residual',        load: () => import('./frontier-residual.js') },
  { target: 'anatomy',         load: () => import('./frontier-anatomy.js') },
  { target: 'attention',       load: () => import('./frontier-attention.js') },
  { target: 'attention-scale', load: () => import('./frontier-attention-scale.js') },
  { target: 'moe',             load: () => import('./frontier-moe.js') },
  { target: 'assembly',        load: () => import('./frontier-assembly.js') },
  { target: 'pretraining',     load: () => import('./frontier-pretraining.js') },
  { target: 'posttraining',    load: () => import('./frontier-posttraining.js') },
  { target: 'inference',       load: () => import('./frontier-inference.js') },
  { target: 'adaptation',      load: () => import('./frontier-adaptation.js') },
  { target: 'multimodal',      load: () => import('./frontier-multimodal.js') },
];
