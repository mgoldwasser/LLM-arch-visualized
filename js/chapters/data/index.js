/* Where the knowledge comes from. The machine is fully specified by now and
   knows nothing; this chapter is the corpus that fills it — Common Crawl, the
   filter cascade that turns a crawl into a training set, and the fact that
   every filter choice is a product decision. It hands off to pretraining,
   which consumes exactly the token count this chapter produces.

   Spine only: the cascade lives in fig-cascade.js, the zoom in fig-zoom.js,
   and every number on the page is computed in corpus.js. */

import { chapter, chapterHead, prose, term, mathAside, goDeeper, specTable, chRef, figRef } from '../../core/components.js';
import { si, pct, fmtBytes } from '../../core/anim.js';
import { CRAWL, STAGES, CASCADE, CORPUS, PUBLISHED, DRIVE_BYTES, fmtBig } from './corpus.js';
import { cascadeFigure } from './fig-cascade.js';
import { zoomFigure } from './fig-zoom.js';

const stage = (id) => STAGES.find((s) => s.id === id);

export function render({ id, num, title }) {
  return chapter(id,
    chapterHead(num, 'The corpus', title),

    prose(
      `The machine is now fully specified. ${chRef('assembly', { cap: true })} counted every parameter in it, and every one of them is a random number. The residual stream of ${chRef('residual')}, the attention of ${chRef('attention')}, the sparse expert bank of ${chRef('moe')} — none of it knows anything. An untrained transformer is an expensive way to sample noise.`,
      `Everything the finished model will ever know arrives from one place: a pile of text, and a long series of decisions about which text. Those decisions get made by a handful of engineers, months before training starts, using heuristics they can defend but cannot prove. This chapter is about that pile and those decisions, because a reader who skips them is left believing knowledge arrives by magic.`,
      `The pile starts with the <strong>Common Crawl</strong>: a non-profit that has been crawling the open web since ${CRAWL.since} and publishing what it finds, free, roughly once a month. Each snapshot is on the order of ${si(CRAWL.pagesPerSnapshot, 1)} page fetches — raw HTTP responses, stored as they came off the wire. ${PUBLISHED.name} (${PUBLISHED.org}, ${PUBLISHED.year}), the best-documented public corpus, draws on ${CRAWL.snapshots} of them. Nothing in that archive was collected in order to train anything. It is the web as it stood on the crawl date: spam, boilerplate, syndication, machine-generated filler and every language, exactly as found.`),

    term('Common Crawl', 'n.', `a non-profit web archive, crawling since ${CRAWL.since}; its monthly snapshots of raw HTTP responses are the starting material for nearly every public pretraining corpus and, by all accounts, most private ones`),

    prose(
      `A raw crawl is not a training set, and the distance between the two is the whole subject. Six stages do the work. Each is mechanical, each throws away far more than it keeps, and each earned its place the same way: somebody trained a model with the filter and another without it, and kept whichever came out better. Nobody argued these from first principles &mdash; they are settled by running the experiment, which is what a lab means by an <strong>ablation</strong>.`),

    cascadeFigure(),

    prose(
      `Read the stages in order. The <strong>URL blocklist</strong> is applied before a page is parsed at all — published domain lists, the cheapest filter in the pipeline and the only one that never reads a document. <strong>Text extraction</strong> is where documents and bytes part company: ${pct(1 - stage('extract').keepPages, 1)} of pages fail it outright, but ${pct(1 - stage('extract').keepBytes, 1)} of the <em>bytes</em> vanish, because the markup is not the content. Navigation, scripts, cookie banners and comment chrome are most of what a web page weighs. <strong>Language identification</strong> scores each document and drops whole anything under the threshold. <strong>Deduplication</strong> is the largest single cut. <strong>PII removal</strong> barely dents the count and edits nearly every document that survives it. <strong>Quality filters</strong> finish the job with rules about repetition, symbol ratios and line lengths — the descendants of the Gopher and C4 rule sets, kept because ablations said they helped.`),

    term('deduplication', 'n.', 'collapsing near-identical documents to a single copy, usually by MinHash fingerprint. The web mirrors itself relentlessly — syndicated news, scraped listings, the same licence text on a million pages — and duplicates cost training compute while teaching the model to recite'),

    prose(
      `Now the part that is easy to state and hard to absorb: <strong>these filter choices are product decisions.</strong> Language identification is the cleanest case. It is a classifier with a threshold, and documents scoring below it are deleted. Set that threshold for English and you have decided, in one line of pipeline configuration, that your model will be bad at Spanish — worse at Telugu, hopeless at Xhosa. Nobody in the room framed it that way. It was a data-cleaning parameter.`,
      `And it compounds. The tokenizer of ${chRef('tokens')} is fitted on a corpus assembled the same way, so an under-represented language also gets poor compression: more tokens per sentence, less of it fitting in context, more compute for the same paragraph, and worse loss on every one of those tokens. The quality heuristics compound it again — rules tuned on English prose read a language with different punctuation, a different average line length or a different script as noise. There is no neutral corpus. There is only a corpus somebody assembled, whose shape stays legible in the finished model's strengths.`),

    goDeeper('the language cutoff, and what it decides', `
      <p><strong>What the filter actually is.</strong> Hand the language step a document and it returns a score per language — roughly, how sure it is. The pipeline keeps the document if the score for the language you want clears a cutoff, and deletes it otherwise. One number, chosen once, applied to billions of pages.</p>
      <p><strong>Where you put that number is a trade with no clean side.</strong> Set it high and you keep only the documents you are confident about: a tidier corpus, and a great many perfectly good pages in the bin. Set it low and you keep more real text, along with junk that the quality filters downstream now have to catch — and those filters were tuned on English prose, so they catch it unevenly. Both directions are defensible. Neither is neutral.</p>
      <p><strong>The part that compounds.</strong> The classifier is itself trained on labelled web text, so it is most confident about exactly the languages that are already best represented. Picture a page written in Xhosa: the classifier is only 0.6 sure of what it is looking at, the cutoff sits at 0.8, and the page is deleted — while an equally ordinary English page clears the bar easily. Multiply that across a language's whole share of the crawl and you have a loop with nothing pushing back on it. A thinly-represented language gets a less confident classifier, so more of its pages fall below the cutoff, so it is thinner still in the next corpus, so the classifier trained on <em>that</em> corpus is less confident again.</p>
      <p>None of this is anybody's stated intention, and that is the point worth leaving with. The choice is made once, months before training starts, by an engineer who could accurately describe it as a data-cleaning parameter — and it holds for every user the model will ever have.</p>`),

    prose(
      `The other thing worth absorbing is how small the result is. The web is unimaginably large; the <em>usable text</em> in it is not. Start on one document and zoom out until the whole corpus is on screen.`),

    zoomFigure(),

    prose(
      `${fmtBytes(CORPUS.bytes)} is a number a reader can hold. It is ${CORPUS.drives} consumer hard drives at ${fmtBytes(DRIVE_BYTES)} apiece — a stack you could carry in one hand, for less than the price of a laptop. Every article, argument, tutorial, recipe, forum thread and kiln log a frontier model has ever been shown fits in a desk drawer. The crawl those drives were distilled from was ${fmtBig(CASCADE[0].bytes)}. About ${pct(CORPUS.keepAll, 0)} of its pages survived — and because most of what a web page weighs is markup rather than words, only ${pct(CORPUS.keepBytesAll, 2)} of its bytes did.`),

    specTable('The corpus, end to end', `${PUBLISHED.name}-style pipeline over ${CRAWL.snapshots} Common Crawl snapshots — per-stage retentions illustrative, totals published`, [
      ['Source', `Common Crawl · ${CRAWL.snapshots} snapshots · crawling since ${CRAWL.since}`],
      ['Entering', `${si(CASCADE[0].pages, 1)} page fetches · ${fmtBig(CASCADE[0].bytes)} of raw HTTP responses`],
      ['Surviving', `${si(CORPUS.docs, 1)} documents · ${fmtBig(CORPUS.bytes)} · ${pct(CORPUS.keepAll, 1)} of the pages, ${pct(CORPUS.keepBytesAll, 2)} of the bytes`],
      ['Tokens', `≈ ${si(CORPUS.tokens, 0)} · ${CORPUS.bytesPerToken.toFixed(2)} bytes per token · ≈ ${Math.round(CORPUS.tokensPerDoc)} tokens per document`],
      ['On disk', `${CORPUS.drives} × ${fmtBytes(DRIVE_BYTES)} consumer drives`],
      ['Dated', 'every snapshot carries a crawl date — and so, permanently, does the model'],
    ]),

    prose(
      `That last row is the one readers meet daily without recognising it. A corpus is assembled from snapshots taken on particular days, and the last of those days is the <strong>knowledge cutoff</strong>. It is not a policy, a filter or a safety decision. It is the date the crawl stopped. Everything after it is absent — not withheld, absent — and a model asked about that period has nothing to retrieve and no mechanism for noticing the gap, so it produces the most plausible continuation instead. ${chRef('base-model', { cap: true })} shows precisely what that looks like.`,
      `The handoff from here is direct. ${chRef('pretraining', { cap: true })} takes this corpus and runs the loop of ${chRef('learning')} across it: the D in its 6·N·D budget is ≈ ${si(CORPUS.tokens, 0)}, the number ${figRef('data', 'cascade')} ends on. Everything the training run can possibly learn is already sitting in that stack of drives. The loop's only job is to move as much of it as it can into the weights.`),

    term('knowledge cutoff', 'n.', 'the date of the most recent snapshot in the training corpus. Not a restriction imposed on the model — a boundary of what it was ever shown'),

    mathAside('from raw HTTP responses to D', `
      <p>The chain is short enough to do by hand. ${CRAWL.snapshots} snapshots at ≈ ${si(CRAWL.pagesPerSnapshot, 1)} page fetches each, at ≈ ${fmtBytes(CRAWL.bytesPerRecord)} per stored response:</p>
      <div class="eq">${CRAWL.snapshots} × ${si(CRAWL.pagesPerSnapshot, 1)} ≈ ${si(CASCADE[0].pages, 1)} fetches ≈ ${fmtBig(CASCADE[0].bytes)}</div>
      <p>Multiply through the six byte retentions and ${fmtBig(CASCADE[0].bytes)} becomes ${fmtBig(CORPUS.bytes)} — ${pct(CORPUS.bytes / CASCADE[0].bytes, 2)} of what entered. Text extraction alone accounts for most of the loss: an average crawl record is ${fmtBytes(CRAWL.bytesPerRecord)} of HTML, scripts and headers wrapped around ${fmtBytes(CRAWL.proseBytesPerPage)} of prose.</p>
      <p>Bytes become tokens at the corpus's own measured rate. ${PUBLISHED.name} publishes ${fmtBytes(PUBLISHED.bytes)} and ${si(PUBLISHED.tokens, 0)} tokens, which is ${CORPUS.bytesPerToken.toFixed(2)} bytes per token:</p>
      <div class="eq">${fmtBig(CORPUS.bytes)} ÷ ${CORPUS.bytesPerToken.toFixed(2)} B/token ≈ ${si(CORPUS.tokens, 0)} tokens = D</div>
      <p>Divide by the surviving document count and each document is worth ≈ ${Math.round(CORPUS.tokensPerDoc)} tokens — about the length of the kiln log in ${figRef('data', 'zoom')}, which is the point. The corpus is not an encyclopedia. It is ${si(CORPUS.docs, 1)} ordinary pages.</p>`));
}
