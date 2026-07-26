/* Frontier — the `pretraining` chapter.
   Why the megaproject wastes data, FLOPs, and its own hard-won lessons —
   what the field is doing about it, and one speculative direction of our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';
import { si } from '../core/anim.js';
import { K3 } from '../../data/k3.js';

const totalT = `${si(K3.totalParams).replace('T', '')} trillion`;

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>A one-shot, non-resumable megaproject that wastes its inputs at every layer.</strong>
      The data is running out: estimates of the high-quality public text stock put it within an
      order of magnitude of what frontier runs already consume, and repeating epochs pays rapidly
      diminishing returns — so D in the chapter's 6·N·D formula has a ceiling that money can't
      raise. What data there is gets extracted inefficiently: SGD skims a fraction of each
      document's information per pass (the reverse-curse results are the sharpest evidence —
      thousands of "A is B" exposures never teach "B is A"). The run itself is brittle: a loss
      spike or a bad mixture decision discovered at step five million can't be excised, only
      lived with or restarted, and checkpoint-rollback burns days of cluster time. The hardware
      runs at 30–50% model-FLOPs utilization — pipeline bubbles, communication stalls, and
      stragglers leave roughly half the purchased compute on the floor. And the meta-knowledge
      evaporates: everything painstakingly learned about <em>this</em> run's learning-rate
      schedule, mixture ratios, and instability triggers is tied to this architecture at this
      scale, and is largely obsolete for the next one. Science that cannot rerun its experiments
      accumulates folklore, not theory.</p>`),

    researchItem('Synthetic & curated data pipelines (phi family)', '2023–24', 'deployed', `
      <p>Microsoft's "Textbooks Are All You Need" line (phi-1 through phi-4) attacks the data
      wall from the quality side: filter aggressively for pedagogical value and generate
      textbook-style synthetic data with a stronger model, so each token carries more learnable
      signal per pass. Small models trained this way punch far above their compute class, and
      every frontier lab now runs some version of the pipeline. The contested part is diversity:
      synthetic corpora inherit the generator's blind spots, benchmark-adjacent phrasing can
      inflate scores, and recursive training on model output degrades tail knowledge — curation
      buys efficiency but nobody has shown it replaces the raw web's long tail.</p>`),
    researchItem('Muon and matrix-aware optimizers', '2024–25', 'deployed', `
      <p>Adam treats ${totalT} parameters as ${totalT} independent scalars; Muon (2024)
      instead treats each weight matrix as the unit, orthogonalizing its update via Newton–Schulz
      iterations so all directions of the matrix move at comparable rates. Moonshot scaled it
      first (Moonlight, then K2's full trillion-parameter run) and reported markedly better
      loss-per-FLOP than AdamW, with K3's Per-Head Muon refining the treatment per attention
      head — the optimizer this chapter's Beat 4 shows. This is one of the few levers that
      extracts more from <em>existing</em> data and compute rather than demanding more of either;
      how far the advantage persists across architectures is still being mapped.</p>`),
    researchItem('Low-precision training (FP8 → FP4)', '2024–25', 'deployed', `
      <p>DeepSeek-V3 (2024) ran the first disclosed frontier-scale pretraining with FP8 matrix
      multiplies — nearly doubling arithmetic throughput per chip and directly attacking the MFU
      problem, with fine-grained scaling to contain outlier activations. K3 pushes the endgame
      further with MXFP4 quantization-aware training from the SFT stage, so the served model was
      trained in the format it ships in. Research prototypes demonstrate FP4 pretraining at
      modest scale, but each halving of precision narrows the margin for the loss spikes the
      bottleneck above describes — low precision and training stability are in direct tension.</p>`),
    researchItem('Low-communication distributed training (DiLoCo)', '2023–25', 'research', `
      <p>DiLoCo (DeepMind, 2023) and the async-SGD lineage let workers train locally for hundreds
      of steps between synchronizations — an inner/outer optimizer split that cuts communication
      by orders of magnitude and tolerates stragglers and heterogeneous hardware. OpenDiLoCo and
      Prime Intellect's INTELLECT runs (2024–25) demonstrated billion-parameter training across
      continents. If the scaling holds, the single-datacenter constraint — and some of the
      one-shot brittleness that comes with it — relaxes; whether loosely-synchronized replicas
      match the loss curves of a tightly-coupled cluster at frontier scale remains open.</p>`),
    researchItem('Data mixture optimization (DoReMi and successors)', '2023–24', 'research', `
      <p>Mixture ratios — how much code vs. web vs. papers — are among the most consequential
      and least principled decisions in a run. DoReMi (2023) uses a small proxy model trained
      with group distributionally-robust optimization to reweight domains before the big run;
      RegMix (2024) fits regression models over many cheap runs to extrapolate good mixtures.
      Both beat hand-tuned heuristics at small scale, but proxy-to-frontier transfer is the weak
      link: the best mixture is a moving target that depends on model scale and training stage,
      which static reweighting can't follow — online curriculum over a live run is still
      research territory.</p>`),

    novelIdea('Transferable data-influence ledgers', `
      <p>The most wasteful part of the one-shot regime is that each run's data lessons die with
      it. Proposal: during every run (including the cheap scaling-law probes labs already do),
      log per-document <em>influence sketches</em> — compact functions of gradient alignment and
      excess loss, cheap low-rank projections rather than full per-example gradients — keyed to
      content hashes in a persistent ledger. Before the next architecture's run, warm-start its
      mixture and curriculum from ledger statistics instead of from folklore: documents that were
      consistently high-influence across past architectures get early, repeated exposure;
      consistently low-influence shards get demoted without re-litigating the filtering debate.
      The bet is that <em>relative</em> document value is more architecture-invariant than
      hyperparameters are. Failure modes to test first: influence may simply not transfer across
      tokenizers and objectives (a new vocabulary re-segments every document); ledger scores
      computed on small proxies may invert at scale, exactly as static mixtures do today;
      hash-keyed logging invites a monoculture where every lab converges on the same
      "high-influence" subset, amplifying its biases; and the sketches themselves add per-step
      overhead to runs already fighting for MFU.</p>`),
  );
}
