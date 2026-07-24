/* Programmatic numbering — the single source of truth for every number the
   reader sees. Chapter numbers, figure numbers, and cross-references are all
   DERIVED FROM js/registry.js ORDER. Nothing is hard-coded anywhere else, so
   inserting or reordering a chapter renumbers the book — and every reference
   to it — automatically.

   Chapter numbers
     chNum('attention')       → '09'    (zero-padded, for chapter headers)
     chNumShort('attention')  → '9'     (bare, for figure numbers)
     Sub-chapters (registry `sub: true`) hang off the previous main chapter:
     08 → 08B → 08C.

   Cross-references (in prose, which is raw HTML)
     chRef('attention')                  → 'chapter 09' as a link
     chRef('attention', { word: 'ch.' }) → 'ch. 09'
     chRef('attention', { cap: true })   → 'Chapter 09'
     figRef('attention', 'variants')     → 'Fig. 9.5', resolved after render

   Figure numbers
     Never write one. figure() claims the next number in its chapter, in call
     order. For a figure whose caption lives in prose (a scroll scene), call
     claimFig() to reserve the number at the point it appears.
*/

import { CHAPTERS } from '../registry.js';

/* ---- chapter numbers, assigned once from registry order ------------------- */

const short = new Map();   // id → '9'  | '9B' | ''
const padded = new Map();  // id → '09' | '09B' | ''

(() => {
  let n = 0, parent = 0, sub = 0;
  for (const c of CHAPTERS) {
    if (c.kind) { short.set(c.id, ''); padded.set(c.id, ''); continue; }  // front/back matter
    if (c.sub && parent > 0) {
      sub += 1;
      const letter = String.fromCharCode(65 + sub);            // B, C, D…
      short.set(c.id, `${parent}${letter}`);
      padded.set(c.id, `${String(parent).padStart(2, '0')}${letter}`);
    } else {
      n += 1; sub = 0; parent = n;
      short.set(c.id, String(n));
      padded.set(c.id, String(n).padStart(2, '0'));
    }
  }
})();

export const chNum = (id) => padded.get(id) ?? '';
export const chNumShort = (id) => short.get(id) ?? '';
export const chTitle = (id) => CHAPTERS.find((c) => c.id === id)?.title ?? '';

/* Every numbered chapter, in order — used by the TOC and the hero stats. */
export const numberedChapters = () => CHAPTERS.filter((c) => !c.kind);

/* ---- chapter cross-reference (a link, so the reader can jump) ------------- */

export function chRef(id, { cap = false, word = 'chapter' } = {}) {
  const num = chNum(id);
  if (!num) return chTitle(id);
  const w = cap ? word[0].toUpperCase() + word.slice(1) : word;
  return `<a class="xref" href="#${id}">${w}&nbsp;${num}</a>`;
}

/* ---- figure numbers ------------------------------------------------------- */

let currentId = null;
let count = 0;
const figNums = new Map();   // 'chapterId:key' → '9.2'

/* Called by main.js immediately before a chapter renders. */
export function beginChapter(id) {
  currentId = id;
  count = 0;
}

/* Reserve the next figure number in the current chapter. `key` makes it
   referenceable from prose via figRef(). */
export function claimFig(key) {
  count += 1;
  const n = `${chNumShort(currentId)}.${count}`;
  if (key) figNums.set(`${currentId}:${key}`, n);
  return n;
}

/* A placeholder resolved once the target chapter has rendered. Prose is built
   before later figures exist, so references cannot be resolved inline. */
export function figRef(chapterId, key, { prefix = 'Fig.' } = {}) {
  return `<span class="xref" data-figref="${chapterId}:${key}" data-figprefix="${prefix}">${prefix}&nbsp;__</span>`;
}

/* Fill in every placeholder whose figure now exists. Safe to call repeatedly;
   main.js calls it after each chapter mounts. */
export function resolveFigRefs(root = document) {
  for (const node of root.querySelectorAll('[data-figref]')) {
    const n = figNums.get(node.dataset.figref);
    if (!n) continue;
    node.textContent = `${node.dataset.figprefix} ${n}`;
    node.removeAttribute('data-figref');
    node.removeAttribute('data-figprefix');
  }
}
