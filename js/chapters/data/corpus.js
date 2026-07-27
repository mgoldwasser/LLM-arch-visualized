/* Corpus constants — the ONE place a number about the crawl is written down.
   Both figures in this chapter compute everything they display from here:
   no surviving count, byte total or percentage is typed per stage.

   Two kinds of number live below, and they are kept apart deliberately:

     PUBLISHED  — figures the FineWeb team actually published (Hugging Face,
                  2024): 96 Common Crawl snapshots, 44 TB on disk, 15 T tokens.
     CRAWL      — order-of-magnitude anchors for the crawl itself, and the
                  per-stage retentions. Labs publish ablations, not exact
                  survival tables, so these are illustrative values inside the
                  published pipeline's range. They are chosen so the cascade
                  they compose to lands on the published totals — which is the
                  only claim the figures make.                                */

import { fmtBytes } from '../../core/anim.js';

export const CRAWL = {
  since: 2007,                 // Common Crawl the organization; first crawl 2008
  snapshots: 96,               // snapshots FineWeb draws on (2013–2024)
  pagesPerSnapshot: 2.7e9,     // page fetches in a typical monthly snapshot
  bytesPerRecord: 90e3,        // average raw HTTP response: HTML, scripts, headers
  proseBytesPerPage: 2.4e3,    // the prose actually inside one of those responses
};

export const PUBLISHED = {
  name: 'FineWeb',
  org: 'Hugging Face',
  year: 2024,
  bytes: 44e12,
  tokens: 15e12,
};

/* A large consumer hard drive, 2026 — the physical anchor for 44 TB. */
export const DRIVE_BYTES = 20e12;

/* Text extraction is the one stage where documents and bytes part company:
   almost every page survives it, and almost none of its bytes do. */
const EXTRACT_BYTE_KEEP = CRAWL.proseBytesPerPage / CRAWL.bytesPerRecord;

export const STAGES = [
  {
    id: 'url', name: 'URL blocklist',
    short: 'adult, spam and malware domains',
    what: 'published domain blocklists are applied before a single page is parsed — the cheapest filter in the pipeline, and the only one that never reads a document',
    keepPages: 0.95, keepBytes: 0.95,
  },
  {
    id: 'extract', name: 'Text extraction',
    short: 'the prose, not the markup',
    what: 'the readable text is pulled out of the HTML with an extractor such as trafilatura; navigation, scripts, cookie banners, comment chrome and markup are discarded. The markup is not the content',
    keepPages: 0.85, keepBytes: EXTRACT_BYTE_KEEP,
  },
  {
    id: 'lang', name: 'Language ID',
    short: 'classifier score below threshold',
    what: 'a fastText classifier scores each document per language; anything scoring below the threshold for the target language is dropped whole',
    keepPages: 0.45, keepBytes: 0.45,
  },
  {
    id: 'dedup', name: 'Deduplication',
    short: 'near-duplicates collapsed to one copy',
    what: 'MinHash fingerprints collapse near-duplicate documents — syndicated news, mirrors, templated listings, the same licence text on a million pages — to a single surviving copy',
    keepPages: 0.30, keepBytes: 0.30,
  },
  {
    id: 'pii', name: 'PII removal',
    short: 'e-mail and IP addresses rewritten in place',
    what: 'e-mail addresses and IP addresses are replaced with placeholders. Almost no document dies here, but almost every document is edited',
    keepPages: 0.999, keepBytes: 0.999,
  },
  {
    id: 'quality', name: 'Quality filters',
    short: 'repetition, symbol ratio, line length',
    what: 'heuristics descended from the Gopher and C4 rule sets: too much repetition, too many symbols per word, too many short lines, too few stop words. Each rule was kept because an ablation showed it helped',
    keepPages: 0.55, keepBytes: 0.55,
  },
];

/* The cascade: one row per checkpoint, [0] = what enters, [s+1] = what
   survives stage s. Strictly decreasing by construction — every keep
   fraction is < 1 — and computed, never transcribed. */
export const CASCADE = (() => {
  let pages = CRAWL.snapshots * CRAWL.pagesPerSnapshot;
  let bytes = pages * CRAWL.bytesPerRecord;
  const rows = [{ pages, bytes }];
  for (const s of STAGES) {
    pages *= s.keepPages;
    bytes *= s.keepBytes;
    rows.push({ pages, bytes });
  }
  return rows;
})();

const entering = CASCADE[0];
const surviving = CASCADE[CASCADE.length - 1];

/* Bytes per token is the published pair's own ratio — 44 TB over 15 T tokens
   — so applying it to the computed byte total is a conversion, not a guess. */
const bytesPerToken = PUBLISHED.bytes / PUBLISHED.tokens;

export const CORPUS = {
  enteringPages: entering.pages,
  enteringBytes: entering.bytes,
  docs: surviving.pages,
  bytes: surviving.bytes,
  bytesPerToken,
  tokens: surviving.bytes / bytesPerToken,
  keepAll: surviving.pages / entering.pages,
  get tokensPerDoc() { return this.tokens / this.docs; },
  drives: Math.ceil(surviving.bytes / DRIVE_BYTES),
};

/* fmtBytes stops at TB; the raw crawl is petabytes. */
export function fmtBig(bytes) {
  if (bytes >= 1e15) return (bytes / 1e15).toFixed(1).replace(/\.0$/, '') + ' PB';
  return fmtBytes(bytes);
}
