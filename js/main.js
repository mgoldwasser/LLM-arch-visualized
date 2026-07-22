/* Boot — mounts chrome (progress bar, theme toggle, minimap), the TOC,
   and every chapter from the registry, in order. */

import { CHAPTERS } from './registry.js';
import { EXTENSIONS } from './extensions/registry.js';
import { el } from './core/dom.js';
import { onScrollY, refresh } from './core/scroll.js';

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

const tocChapters = CHAPTERS.filter((c) => c.toc);
const dots = new Map();
document.body.append(el('nav', { class: 'minimap', 'aria-label': 'Chapters' },
  tocChapters.map((c) => {
    const a = el('a', { href: `#${c.id}`, title: `${c.num} ${c.title}` });
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

/* ---- table of contents (rendered after the hero) -------------------------- */

export function buildToc() {
  return el('nav', { class: 'toc measure' },
    el('div', { class: 'toc-label' }, 'Contents'),
    el('ol', {}, tocChapters.map((c) =>
      el('li', {}, el('a', { href: `#${c.id}` },
        el('span', { class: 'n' }, c.num),
        el('span', {}, c.title))))));
}

/* ---- mount chapters ------------------------------------------------------ */

async function mountExtensions(c, chapterNode) {
  for (const ext of EXTENSIONS.filter((e) => e.target === c.id)) {
    try {
      const mod = await ext.load();
      const node = mod.render({ target: c.id, num: c.num, title: c.title });
      const at = ext.anchor && chapterNode.querySelector(ext.anchor);
      if (at) at.after(node);
      else chapterNode.append(node);
    } catch (err) {
      console.error(`Extension for "${c.id}" failed to render:`, err);
    }
  }
}

for (const c of CHAPTERS) {
  try {
    const mod = await c.load();
    const node = mod.render({ id: c.id, num: c.num, title: c.title });
    article.append(node);
    await mountExtensions(c, node);
    if (c.id === 'hero') article.append(buildToc());
  } catch (err) {
    console.error(`Chapter "${c.id}" failed to render:`, err);
    article.append(el('div', { class: 'measure', style: { color: 'var(--c-loss)', fontFamily: 'var(--mono)', fontSize: '0.8rem', padding: '1rem 0' } },
      `⚠ chapter "${c.id}" failed: ${err.message}`));
  }
}

refresh();
