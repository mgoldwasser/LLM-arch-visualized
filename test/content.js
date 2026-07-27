/* Content checks — plan section 5.3.

   These are not about behaviour, they are about the book's own bookkeeping:
   cross-references that resolve, numbering that is never typed by hand, and
   frontier cards that carry the metadata the convention promises.

   Like the invariants, everything here is derived. The chapter file list comes
   from the registries plus the static import graph, so a chapter added this
   afternoon is linted this afternoon.                                        */

import { test, suite, collectChapterSources, MOUNTED, SITE_ROOT, extensionUrl } from './harness.js';
import { CHAPTERS } from '../js/registry.js';
import { EXTENSIONS } from '../js/extensions/registry.js';
import { chNum } from '../js/core/numbering.js';

const rel = (url) => url.replace(SITE_ROOT.href, '');

/* ------------------------------------------------- every reference resolves */

export async function referencesResolve() {
  suite('5.3 references resolve');
  const article = document.getElementById('article');

  await test('every figRef() placeholder was filled in', (t) => {
    const left = [...article.querySelectorAll('[data-figref]')];
    if (!left.length) return;
    const list = left.slice(0, 6).map((n) => `"${n.dataset.figref}" in ${chapterOf(n)}`);
    t.fail(`${left.length} unresolved figure reference(s): ${list.join(', ')}`
      + ' — the target figure was never created, or its figure() call is missing { key }');
  });

  await test('no placeholder survives render', (t) => {
    /* The placeholder figRef() emits is literally "Fig. __". Anything of
       that shape left in the rendered text means a reference did not resolve
       even though its marker attribute was stripped. */
    const bad = [];
    for (const n of article.querySelectorAll('.xref, figcaption, .prose p, .step-body p')) {
      const s = n.textContent;
      if (/(Fig|fig)\.\s*__|\bchapter\s+__|\bundefined\b|\bNaN\b/.test(s)) {
        bad.push(`${chapterOf(n)}: "${s.trim().slice(0, 80)}"`);
      }
    }
    t.ok(bad.length === 0, `${bad.length} placeholder(s) survived render: ${bad.slice(0, 4).join(' | ')}`);
  });

  await test('every chRef() link points at a chapter that exists', (t) => {
    const ids = new Set(CHAPTERS.map((c) => c.id));
    const bad = [];
    for (const a of article.querySelectorAll('a.xref[href^="#"]')) {
      const target = decodeURIComponent(a.getAttribute('href').slice(1));
      if (target.startsWith('fig-')) {
        if (!document.getElementById(target)) bad.push(`#${target} (from ${chapterOf(a)})`);
      } else if (!ids.has(target)) {
        bad.push(`#${target} (from ${chapterOf(a)})`);
      }
    }
    t.ok(bad.length === 0, `${bad.length} dangling cross-reference(s): ${bad.slice(0, 5).join(', ')}`);
  });

  await test('every chapter mounted without throwing', (t) => {
    const broken = MOUNTED.filter((m) => m.err);
    t.ok(broken.length === 0,
      broken.map((m) => `${m.c.id}: ${m.err && m.err.message}`).join(' | '));
  });

  await test('every extension mounted without throwing', (t) => {
    const broken = MOUNTED.flatMap((m) => m.extErrors.map((e) => `${rel(e.url)}: ${e.err && e.err.message}`));
    t.ok(broken.length === 0, broken.join(' | '));
  });
}

function chapterOf(node) {
  const c = node.closest && node.closest('.chapter');
  return c ? c.id : '?';
}

/* ------------------------------------ no number is ever typed into a chapter */

/* Exactly the two patterns the plan names. Both are case-sensitive on
   purpose: "Chapter 04 —" at the top of a file header comment is a note about
   which chapter the file belongs to, not a number rendered to the reader, and
   the numbering system does not emit that casing. */
const HARDCODED = [
  { re: /\bFig\.\s*\d/g, why: 'a literal figure number — use figRef(chapterId, key)' },
  { re: /\bchapter\s+\d/g, why: 'a literal chapter number — use chRef(chapterId)' },
  { re: /\bch\.\s*\d/g, why: "a literal chapter number — use chRef(id, { word: 'ch.' })" },
];

export async function noHardCodedNumbers() {
  suite('5.3 numbering is programmatic');
  const sources = await collectChapterSources();

  await test('chapter sources were readable', (t) => {
    const missing = sources.filter((s) => s.src == null);
    t.ok(missing.length === 0,
      missing.map((s) => `${rel(s.url)} — ${s.error}`).join(' | '));
    t.ok(sources.length > 0, 'no chapter source files were discovered at all');
  });

  for (const { url, src } of sources) {
    if (src == null) continue;
    await test(`${rel(url)}`, (t) => {
      for (const { re, why } of HARDCODED) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(src))) {
          const lineNo = src.slice(0, m.index).split('\n').length;
          t.fail(`line ${lineNo}: ${JSON.stringify(m[0])} — ${why}`);
        }
      }
    });
  }
}

/* ------------------------------------------- frontier cards carry metadata */

const VALID_STATUS = new Set(['deployed', 'research', 'contested']);

export async function researchItemsWellFormed() {
  suite('5.3 research items');
  const article = document.getElementById('article');
  /* `.fr-card.fr-research`, not `.fr-research`: researchItem() puts the status
     on its badge as `fr-${status}`, so a card whose status happens to be
     "research" has a child span carrying the same class as the card. */
  const cards = [...article.querySelectorAll('.fr-card.fr-research')];

  await test('the book contains research items at all', (t) => {
    t.ok(cards.length > 0, 'no researchItem() cards rendered — is the extension registry loading?');
  });

  for (const card of cards) {
    const nameEl = card.querySelector('.fr-name');
    const label = `${chapterOf(card)} · ${(nameEl ? nameEl.textContent : '?').trim().slice(0, 48)}`;
    await test(label, (t) => {
      const year = (card.querySelector('.fr-year') || {}).textContent || '';
      const status = ((card.querySelector('.fr-status') || {}).textContent || '').trim();
      /* A four-digit year, optionally a range: "2024", "2017–24", "2017–"
         for work that is still going. */
      t.ok(/^\d{4}(\s*[–—-]\s*\d{0,4})?$/.test(year.trim()),
        `year is ${JSON.stringify(year.trim())} — researchItem() needs a four-digit year`);
      t.ok(VALID_STATUS.has(status),
        `status is ${JSON.stringify(status)} — must be one of ${[...VALID_STATUS].join(' / ')}`);
      t.ok((nameEl ? nameEl.textContent.trim() : '').length > 0, 'name is empty');
      const body = card.querySelector('.fr-card-b');
      t.ok(body && body.textContent.trim().length > 40, 'body is empty or a stub');
    });
  }
}

/* --------------------------------------------- the standing section convention */

/* Not in 5.3, but it is the same kind of bookkeeping and it is free.
   The convention (docs/AUTHORING.md) is about the SUBJECT, not the Part: a
   chapter teaching settled mathematics closes on takeaway() and carries no
   frontier, because there is no live research frontier in the dot product.
   `objective` sits in Part I and legitimately carries a frontier — what to
   train on is open even though the mathematics around it is not — so it is
   exempted here by name rather than by Part. */
const SETTLED_MATH = ['vectors', 'networks', 'learning', 'probability', 'sequences'];
export async function sectionConventions() {
  suite('convention · chapter sections');
  const byTarget = new Set(EXTENSIONS.map((e) => e.target));
  for (const c of CHAPTERS) {
    if (c.kind || SETTLED_MATH.includes(c.id)) continue;
    await test(`${chNum(c.id)} ${c.id} has a frontier extension registered`, (t) => {
      t.ok(byTarget.has(c.id),
        'every chapter whose subject is still open carries a frontier-<id> extension (docs/AUTHORING.md)');
    });
  }
  for (const c of CHAPTERS) {
    if (!SETTLED_MATH.includes(c.id)) continue;
    const node = (MOUNTED.find((m) => m.c.id === c.id) || {}).node;
    await test(`${chNum(c.id)} ${c.id} closes on a takeaway`, (t) => {
      if (!node) return t.fail('chapter did not mount');
      t.ok(node.querySelector('.takeaway'),
        'chapters teaching settled mathematics close on takeaway(), not frontier()');
    });
  }
}

/* Registry hygiene — cheap, and it catches the copy-paste mistake that breaks
   numbering for every chapter after it. */
export async function registryWellFormed() {
  suite('registry');
  await test('chapter ids are unique', (t) => {
    const seen = new Set();
    for (const c of CHAPTERS) {
      if (seen.has(c.id)) t.fail(`duplicate id "${c.id}"`);
      seen.add(c.id);
    }
  });
  await test('every chapter has an id, a title and a loader', (t) => {
    for (const c of CHAPTERS) {
      t.ok(!!c.id, `entry with no id: ${JSON.stringify(c)}`);
      t.ok(!!c.title, `${c.id} has no title`);
      t.ok(typeof c.load === 'function', `${c.id} has no load()`);
    }
  });
  await test('every extension targets a chapter that exists', (t) => {
    const ids = new Set(CHAPTERS.map((c) => c.id));
    for (const e of EXTENSIONS) {
      t.ok(ids.has(e.target), `extension ${rel(extensionUrl(e) || '?')} targets unknown chapter "${e.target}"`);
    }
  });
  await test('every numbered chapter got a number', (t) => {
    for (const c of CHAPTERS) {
      if (c.kind) continue;
      t.ok(/^\d{2}[A-Z]?$/.test(chNum(c.id)), `${c.id} → ${JSON.stringify(chNum(c.id))}`);
    }
  });
}

/* --------------------------------------------------- SVG ids are page-global */

/* Every chapter renders into one document, so `id` is a single shared
   namespace — and SVG cross-references (marker-end, filter, clip-path, fill
   with url(#…)) resolve against the FIRST match in the document. Two chapters
   that both define `id="arr"` therefore do not fail loudly: the second one
   silently borrows the first one's arrowhead, and only ever on pages where
   both have mounted.

   The convention is to prefix ids with the chapter slug. Conventions hold
   until someone forgets, so this asserts the property instead. */
export async function svgIdsUnique() {
  suite('content · SVG ids are unique page-wide');
  const seen = new Map();
  for (const node of document.querySelectorAll('svg [id], svg[id]')) {
    const chapter = node.closest('section.chapter')?.id || '(unknown)';
    if (!seen.has(node.id)) seen.set(node.id, []);
    seen.get(node.id).push(chapter);
  }
  const dupes = [...seen.entries()].filter(([, where]) => where.length > 1);
  await test('no SVG id is defined twice', (t) => {
    t.ok(dupes.length === 0, dupes.length
      ? `url(#…) resolves to the first match, so these silently cross-wire: ${
          dupes.map(([id, w]) => `#${id} in ${[...new Set(w)].join(' + ')}`).join('; ')}`
      : `${seen.size} ids, all unique`);
  });
}

export async function runContentChecks() {
  await registryWellFormed();
  await referencesResolve();
  await noHardCodedNumbers();
  await researchItemsWellFormed();
  await sectionConventions();
  await svgIdsUnique();
}
