/* Boot — mounts chrome (progress bar, theme toggle, minimap), the TOC, and
   every chapter from the registry.

   Chapters are NOT all loaded at boot. Each one gets a placeholder <section>
   immediately (so the TOC, the minimap and #hash links work straight away),
   and its module is dynamically imported and rendered only as the reader
   approaches it. Mounting is serialized so the figure-numbering context in
   core/numbering.js can never interleave between two chapters. */

import { CHAPTERS, PARTS } from './registry.js';
import { EXTENSIONS } from './extensions/registry.js';
import { el } from './core/dom.js';
import { onScrollY, refresh } from './core/scroll.js';
import { chNum, beginChapter, resolveFigRefs } from './core/numbering.js';

const article = document.getElementById('article');

/* ---- theme --------------------------------------------------------------- */

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || (!savedTheme && matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.body.classList.add('dark');
}

function themeToggle() {
  const btn = el('button', {
    onclick: () => {
      const dark = document.body.classList.toggle('dark');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      btn.textContent = dark ? 'light' : 'dark';
    },
  }, document.body.classList.contains('dark') ? 'light' : 'dark');
  return btn;
}

/* ---- chrome -------------------------------------------------------------- */

const bar = el('div', { class: 'bar' });
document.body.prepend(el('div', { class: 'progress-rail' }, bar));
document.body.prepend(el('div', { class: 'chrome' },
  el('div', { class: 'chrome-title' }, 'How a Trillion-Parameter Model Actually Works'),
  el('div', { class: 'chrome-actions' }, themeToggle())));

onScrollY((y, docP) => {
  bar.style.transform = `scaleX(${docP})`;
  document.body.classList.toggle('scrolled', y > 400);
});

/* ---- minimap dots -------------------------------------------------------- */

const tocChapters = CHAPTERS.filter((c) => !c.kind);
const dots = new Map();
document.body.append(el('nav', { class: 'minimap', 'aria-label': 'Chapters' },
  tocChapters.map((c) => {
    const a = el('a', { href: `#${c.id}`, title: `${chNum(c.id)} ${c.title}` });
    dots.set(c.id, a);
    return a;
  })));

onScrollY(() => {
  let active = null;
  for (const c of tocChapters) {
    const sec = document.getElementById(c.id);
    if (sec && sec.getBoundingClientRect().top < innerHeight * 0.4) active = c.id;
  }
  for (const [id, a] of dots) a.classList.toggle('active', id === active);
});

/* ---- table of contents --------------------------------------------------- */

export function buildToc() {
  const items = [];
  let part = null;
  for (const c of tocChapters) {
    if (c.part && c.part !== part) {
      part = c.part;
      items.push(el('li', { class: 'toc-part' }, PARTS[part] || part));
    }
    items.push(el('li', {}, el('a', { href: `#${c.id}` },
      el('span', { class: 'n' }, chNum(c.id)),
      el('span', {}, c.title))));
  }
  return el('nav', { class: 'toc measure' },
    el('div', { class: 'toc-label' }, 'Contents'),
    el('ol', {}, items));
}

/* ---- placeholders: one per chapter, in order, before anything loads ------- */

const slots = new Map();
for (const c of CHAPTERS) {
  const node = el('section', { class: 'chapter chapter-pending', id: c.id });
  article.append(node);
  slots.set(c.id, { c, node, state: 'pending' });
  if (c.id === 'hero') article.append(buildToc());
}

/* ---- mounting ------------------------------------------------------------ */

async function mountExtensions(c, chapterNode, ctx) {
  for (const ext of EXTENSIONS.filter((e) => e.target === c.id)) {
    try {
      const mod = await ext.load();
      const node = await mod.render(ctx);
      const at = ext.anchor && chapterNode.querySelector(ext.anchor);
      if (at) at.after(node);
      else chapterNode.append(node);
    } catch (err) {
      console.error(`Extension for "${c.id}" failed to render:`, err);
    }
  }
}

async function doMount(id) {
  const slot = slots.get(id);
  if (!slot || slot.state !== 'pending') return;
  slot.state = 'mounting';
  const { c } = slot;
  const ctx = { id: c.id, num: chNum(c.id), title: c.title };
  try {
    const mod = await c.load();
    beginChapter(c.id);                       // figure numbering context
    const node = await mod.render(ctx);
    slot.node.replaceWith(node);
    slot.node = node;
    await mountExtensions(c, node, ctx);
  } catch (err) {
    console.error(`Chapter "${c.id}" failed to render:`, err);
    slot.node.classList.remove('chapter-pending');
    slot.node.append(el('div', {
      class: 'measure',
      style: { color: 'var(--c-loss)', fontFamily: 'var(--mono)', fontSize: '0.8rem', padding: '1rem 0' },
    }, `⚠ chapter "${c.id}" failed: ${err.message}`));
  }
  slot.state = 'mounted';
  resolveFigRefs();
  refresh();
}

/* Serialized: figure numbering is a module-level cursor, so two chapters must
   never render concurrently. */
let chain = Promise.resolve();
function mount(id) {
  chain = chain.then(() => doMount(id));
  return chain;
}

/* Mount everything up to and including `id` — used for #hash deep links, so
   the target lands at the right scroll offset. */
async function mountThrough(id) {
  for (const c of CHAPTERS) {
    mount(c.id);
    if (c.id === id) break;
  }
  await chain;
}

/* ---- lazy trigger -------------------------------------------------------- */

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    io.unobserve(e.target);
    mount(e.target.id);
  }
}, { rootMargin: '1400px 0px' });

for (const { node } of slots.values()) io.observe(node);

/* The opening screens are always wanted — don't make the reader wait on IO. */
mount('hero');
mount(CHAPTERS[1].id);

/* ---- deep links ---------------------------------------------------------- */

async function gotoHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id || !slots.has(id)) return;
  await mountThrough(id);
  document.getElementById(id)?.scrollIntoView();
}

if (location.hash) gotoHash();
addEventListener('hashchange', gotoHash);

refresh();
