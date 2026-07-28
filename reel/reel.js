/* The reel — every figure in the book, back to back, no prose.

   Three jobs, one mechanism:
     1. a scrollable page of nothing but animations
     2. an autoscroll so it can be watched hands-free
     3. a deterministic frame source for the video capture

   The third is why autoscroll and capture are separated below. For a human,
   scrolling is driven by requestAnimationFrame against the wall clock, which
   is smooth but frame-rate dependent. For capture that is exactly wrong: a
   dropped frame would shift the whole timeline. So capture never animates —
   it sets an absolute scroll position, waits for the scroll engine to settle,
   and shoots. Every figure in this book is a pure function of scroll progress,
   so the two paths produce identical pixels for the same position.

   Chapters are mounted through the same modules the book uses; reel.css hides
   the prose. Nothing under js/chapters/ knows this page exists. */

import { CHAPTERS } from '../js/registry.js';
import { el } from '../js/core/dom.js';
import { refresh } from '../js/core/scroll.js';
import { chNum, beginChapter, resolveFigRefs } from '../js/core/numbering.js';

const article = document.getElementById('article');
const params = new URLSearchParams(location.search);

/* ---- theme: follow the book's saved choice ------------------------------- */
const saved = localStorage.getItem('theme');
document.body.classList.add(
  saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

/* ---- mount everything, eagerly and in order ------------------------------ */

/* The book mounts lazily as you approach each chapter. The reel cannot: an
   autoscroll over a document whose height keeps changing would drift, and a
   capture run would produce frames of different scenes than it measured. So
   the whole book is built up front, serialized, before the reel starts. */
async function mountAll() {
  const skip = new Set(['epilogue']);          // its content is prose and links
  for (const c of CHAPTERS) {
    if (skip.has(c.id)) continue;
    const ctx = { id: c.id, num: chNum(c.id), title: c.title };
    try {
      const mod = await c.load();
      beginChapter(c.id);
      const node = await mod.render(ctx);
      article.append(node);
    } catch (err) {
      console.error(`reel: chapter "${c.id}" failed`, err);
    }
  }
  resolveFigRefs();
  refresh();
}

/* ---- the transport ------------------------------------------------------- */

const playBtn = document.getElementById('play');
const speedEl = document.getElementById('speed');
const speedV = document.getElementById('speedv');
const pbar = document.getElementById('pbar');
const pctEl = document.getElementById('pct');

let playing = false;
let pxPerSec = Number(speedEl.value);
let carry = 0;             // sub-pixel remainder, so slow speeds still move
let lastT = 0;

const maxY = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);

function setProgressUI() {
  const f = window.scrollY / maxY();
  pbar.style.width = `${(f * 100).toFixed(2)}%`;
  pctEl.textContent = `${Math.round(f * 100)}%`;
}

function frame(t) {
  if (!playing) return;
  const dt = lastT ? (t - lastT) / 1000 : 0;
  lastT = t;
  carry += pxPerSec * dt;
  const step = Math.floor(carry);
  if (step > 0) {
    carry -= step;
    const y = Math.min(window.scrollY + step, maxY());
    window.scrollTo(0, y);
    if (y >= maxY()) return stop();          // reached the end
  }
  setProgressUI();
  requestAnimationFrame(frame);
}

function play() {
  if (playing) return;
  playing = true; lastT = 0; carry = 0;
  playBtn.textContent = '❚❚ pause';
  requestAnimationFrame(frame);
}
function stop() {
  playing = false;
  playBtn.textContent = '▶ play';
  setProgressUI();
}
const toggle = () => (playing ? stop() : play());

playBtn.addEventListener('click', toggle);
speedEl.addEventListener('input', () => {
  pxPerSec = Number(speedEl.value);
  speedV.textContent = speedEl.value;
});
addEventListener('scroll', setProgressUI, { passive: true });

/* Space plays and pauses; a manual scroll takes over, which is what anyone
   reaching for the wheel mid-playback means by it. */
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); toggle(); }
});
for (const ev of ['wheel', 'touchstart']) {
  addEventListener(ev, () => { if (playing) stop(); }, { passive: true });
}

/* ---- capture API --------------------------------------------------------- */

/* Driven from outside by the frame grabber. Deliberately NOT the autoscroll
   path: this jumps to an absolute position and resolves once the scroll engine
   has painted that position, so a slow machine yields the same frames as a
   fast one — it only takes longer. */
function installCaptureApi() {
  document.body.classList.add('capturing');
  /* Force dark. The figure canvases are dark in both themes, so on the light
     theme a video is a bright page with dark rectangles punched out of it —
     the artwork fights its own background. Dark also grades better and is
     kinder on a phone at night, which is where this gets watched. A headless
     browser has no saved preference anyway, so without this the theme would
     be whatever the capture machine's OS happened to prefer. */
  document.body.classList.remove('light');
  document.body.classList.add('dark');
  stop();
  window.__reel = {
    height: () => maxY(),
    /* The virtual clock. Anything in the book that animates on wall time reads
       this instead while capturing, so "frame 900" means the same picture on
       any machine at any speed. seek() sets it from the frame index; the
       grabber never has to think about it. */
    fps: 30,
    async seek(y, frameIndex = null) {
      window.__captureSeconds = frameIndex == null ? 0 : frameIndex / window.__reel.fps;
      /* `behavior: instant` as well as the CSS override, because this is the
         one place where a smooth scroll would silently corrupt every frame
         rather than merely look wrong. */
      window.scrollTo({ top: Math.max(0, Math.min(y, maxY())), behavior: 'instant' });
      /* Three frames, not two. The scroll engine schedules its work on one
         rAF and the figures paint on the next; a third leaves room for any
         layout the second caused to settle before the shutter. Cheap
         insurance — at 30fps this costs milliseconds per frame and removes a
         whole class of one-frame-stale captures. */
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => requestAnimationFrame(r));
      }
    },
  };
}

/* ---- boot ---------------------------------------------------------------- */

mountAll().then(() => {
  document.getElementById('loading')?.remove();
  setProgressUI();
  if (params.has('capture')) installCaptureApi();
  else if (params.has('autoplay')) play();
  window.__reelReady = true;
});
