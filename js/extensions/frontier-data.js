/* Frontier — the `data` chapter.
   The corpus is the one input to a frontier run that money cannot straightforwardly
   buy more of. What the field is doing about that, and one speculative direction of
   our own. */

import { frontier, bottleneck, researchItem, novelIdea } from '../core/components.js';
import { si, pct, fmtBytes } from '../core/anim.js';
import { CORPUS, PUBLISHED, CRAWL } from '../chapters/data/corpus.js';

export function render({ num }) {
  return frontier(num,
    bottleneck(`
      <p><strong>The supply is finite, the filters are folklore, and the well is being
      capped.</strong> The chapter's cascade ends at ${fmtBytes(CORPUS.bytes)} and
      ≈ ${si(CORPUS.tokens, 0)} tokens drawn from ${CRAWL.snapshots} snapshots — which is
      most of the usable open web, not a sample of it. Estimates of the total stock of
      high-quality public human text put it within roughly an order of magnitude of what
      frontier runs already consume, and unlike compute, that stock does not respond to
      capital expenditure. Every remaining lever acts on the same pile.</p>
      <p>The pile is also getting harder to reach. Robots.txt exclusions and terms-of-service
      changes on the highest-quality domains have tightened sharply since 2023, so future
      crawls will be systematically poorer in exactly the sources that matter most — news,
      reference, curated forums — while staying rich in machine-generated filler now produced
      faster than humans write. And what is collected gets filtered by hand-tuned heuristics
      with no theory behind them: ${pct(CORPUS.keepAll, 1)} of the crawl survives, and every
      threshold that decided the rest was set by ablating a small model and reading a
      benchmark. Nobody can say what the discarded ${pct(1 - CORPUS.keepAll, 1)} contained,
      because measuring it would mean training a model on it, which nobody does. The filters
      are load-bearing product decisions validated by proxy.</p>`),

    researchItem(`${PUBLISHED.name} and FineWeb-Edu`, '2024', 'deployed', `
      <p>${PUBLISHED.org}'s ${PUBLISHED.name} is the reason this chapter can be written at
      all: a ${si(PUBLISHED.tokens, 0)}-token corpus whose every filtering decision was chosen
      by ablation — train a small model with the filter, train one without, compare — and then
      published, along with the processing library and the ablation results. FineWeb-Edu went
      further, using an LLM-scored &ldquo;educational value&rdquo; classifier to select a much
      smaller subset that outperformed the full corpus per token on reasoning benchmarks. The
      lesson generalised across labs: for a fixed compute budget, quality-scored subsets beat
      raw scale. The open question is what such a classifier quietly discards — it was trained
      on one model's judgement of what a textbook looks like, and the long tail of the web is
      not textbook-shaped.</p>`),

    researchItem('Deduplication and memorization (Lee et al.; Carlini et al.)', '2021–2023', 'deployed', `
      <p>Two lines of work that met. <em>Deduplicating Training Data Makes Language Models
      Better</em> (2021) showed that near-duplicate removal cuts verbatim regurgitation by
      roughly an order of magnitude while improving held-out perplexity — which is why the
      dedup stage exists at all. <em>Quantifying Memorization Across Neural Language
      Models</em> (2022) supplied the mechanism: extractable memorization grows log-linearly
      in model size, in the length of the prompting context, and — decisively — in the number
      of times a sequence appears in training. Duplication is the dial. That makes the
      chapter's largest single cut also the field's main privacy and copyright control, which
      is a great deal of weight for a MinHash threshold to carry: dedup is tuned for loss, and
      its safety properties are a side effect nobody optimises directly.</p>`),

    researchItem('Scaling Data-Constrained Language Models (Muennighoff et al.)', '2023', 'research', `
      <p>The direct experiment on what happens when D runs out: hundreds of runs varying the
      number of epochs over a fixed corpus. Up to roughly four passes, repeated data is worth
      nearly as much as fresh data; past that the return decays quickly, and by around sixteen
      epochs additional passes are worth almost nothing. The same work found that under a data
      constraint the compute-optimal move is to spend surplus FLOPs on parameters rather than
      on more epochs — inverting part of the Chinchilla guidance, which assumed data was free.
      It is the best quantitative answer anyone has to &ldquo;what if there is no more
      text&rdquo;, and its ceiling is low: four epochs is a factor of four, and demand is
      growing faster than that.</p>`),

    researchItem('Model collapse and its avoidance (Shumailov et al.; Gerstgrasser et al.)', '2023–2024', 'contested', `
      <p>Train a model on the previous model's output, repeat, and the tails of the
      distribution disappear: rare events go first, variance shrinks, and the corpus converges
      to a caricature of itself — &ldquo;model collapse&rdquo;, demonstrated in 2023 and
      published in Nature in 2024. Because the open web is now filling with generated text
      that no filter reliably detects, this is a property of the actual corpus rather than a
      thought experiment. The strong form is contested: follow-up work in 2024 showed collapse
      depends on <em>replacing</em> real data each generation, and that <em>accumulating</em>
      synthetic data alongside the original corpus avoids the degeneracy. That is reassuring
      for labs, which keep their archives, and much less so for anyone crawling the web fresh
      in five years, who cannot separate the accumulated real from the accumulated
      synthetic.</p>`),

    researchItem('Consent in Crisis (Data Provenance Initiative)', '2024', 'research', `
      <p>An audit of robots.txt and terms of service across the domains that dominate the
      major public corpora, tracked over time. It found a rapid, recent and highly uneven
      tightening: a large share of the most-used tokens now sits behind crawl restrictions
      that did not exist before 2023, concentrated in the highest-quality sources, and often
      inconsistent between a site's robots.txt and its own terms. The consequences are
      structural rather than technical. The open corpus and the licensed corpus are diverging;
      incumbents holding signed contracts and historical archives gain a durable advantage
      over anyone starting now; and reproducible public research on frontier-scale data gets
      harder every year.</p>`),

    researchItem('Multilingual corpus audits (Kreutzer et al.; MADLAD-400)', '2022–2023', 'research', `
      <p>The chapter's claim that filter choices are product decisions has been measured.
      <em>Quality at a Glance</em> (2022) hand-audited samples from the major multilingual
      crawl corpora and found that for many low-resource languages the majority of the
      &ldquo;data&rdquo; was mislabelled, machine-translated, pornographic, or not the
      language claimed at all — several corpora scored below 50% correct on languages they
      advertised. MADLAD-400 (2023) repeated the exercise at 419-language scale with a
      documented manual audit and published the failures alongside the dataset. The finding
      that matters: for most of the world's languages the binding constraint is not corpus
      size but that nobody has looked — and language identification, the same stage in the
      cascade, is both the cause and the instrument doing the measuring.</p>`),

    novelIdea('Duplication as a loss weight, not a delete', `
      <p>Deduplication answers a question about the training objective with an irreversible
      edit to the corpus. It decides that a passage appearing ten thousand times should count
      once, and then destroys the count. But the cluster size is real signal — a noisy measure
      of how much of the web endorses a passage — and it is discarded only because deletion is
      the one tool the stage has.</p>
      <p>Proposal: keep the canonical copy <em>and</em> its cluster size <em>n</em>, and pass
      <em>n</em> to the training loop as a per-document loss weight w = 1 + α·log(1 + n),
      capped. Frequent material is then seen once per epoch but weighted, so exposure to
      near-duplicates becomes a scalar tuned during the run instead of a preprocessing
      decision made a year earlier. Because extractable memorization scales with repetition
      count, α turns into an explicit dial trading memorization against fidelity — measurable
      on the run you actually care about, rather than on a proxy.</p>
      <p>Failure modes to test first, in the order most likely to kill it. Duplication
      correlates with syndication and spam at least as strongly as with endorsement, so
      weighting by cluster size may amplify boilerplate; the weight probably has to be
      conditioned on the quality score, at which point two hand-tuned dials interact and the
      simplicity is gone. Cluster size is trivially attackable — anyone who can publish at
      scale can manufacture <em>n</em>. Cluster sizes are heavy-tailed enough that the cap,
      not α, would do most of the work, which would make the whole scheme a complicated way
      to write a threshold. And retaining cluster membership costs index space that the dedup
      stage partly exists to save. The cheapest falsifying experiment is small: take a single
      snapshot, build two corpora from identical MinHash fingerprints — delete-duplicates
      versus keep-one-and-weight — train matched 1B models at matched token budgets, and
      compare held-out loss <em>and</em> extractable-memorization rates measured the way
      Carlini et al. measure them. If the weighted run fails to beat deletion on both axes at
      some α, the idea is dead and the current stage is right.</p>`),
  );
}
