#!/usr/bin/env node
/* Record /reel as a video file.

   Deliberately NOT a screen recorder. A screen recorder races the page: it
   samples whatever happened to be painted when the clock ticked, so a slow
   frame becomes a dropped frame and the motion judders. This does the
   opposite — it tells the page which frame to be, waits for it, and shoots.
   The machine's speed changes how LONG the capture takes and nothing about
   what comes out. Run it on a busy laptop and you get the same file.

   That works because /reel?capture is a pure function of (scroll position,
   frame index): see reel/reel.js. Every figure in the book is driven by
   scroll progress, and the one animation that runs on wall time reads a
   virtual clock this script advances.

   Zero dependencies, like the rest of the project — it drives Chrome over
   the DevTools Protocol using Node's built-in WebSocket, and pipes frames
   straight into ffmpeg's stdin so no PNGs ever touch the disk.

   Usage:
     node tools/capture.mjs --out reel.mp4
     node tools/capture.mjs --out sample.mp4 --from 0.30 --to 0.32
     node tools/capture.mjs --out reel.mp4 --pxPerSec 140 --fps 30

   Requires: a local server on --port (python3 -m http.server 8012), ffmpeg.
*/

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

/* ---- arguments ----------------------------------------------------------- */

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : argv[i + 1];
};

const OPT = {
  out: arg('out', 'reel.mp4'),
  port: Number(arg('port', 8012)),
  width: Number(arg('width', 1920)),
  height: Number(arg('height', 1080)),
  fps: Number(arg('fps', 30)),
  pxPerSec: Number(arg('pxPerSec', 140)),   // scroll speed → sets the duration
  from: Number(arg('from', 0)),             // fraction of the reel, for samples
  to: Number(arg('to', 1)),
  quality: Number(arg('quality', 92)),
  chrome: arg('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
};

const log = (...a) => console.log('[capture]', ...a);

/* ---- a minimal CDP client ------------------------------------------------ */

/* Chrome speaks JSON-RPC over one WebSocket. We need six methods, so a full
   client library would be more code than this. */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.sessionId = null;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const p = this.pending.get(msg.id);
      if (!p) return;                       // an event, not a reply — ignored
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${msg.error.message} (${p.method})`));
      else p.resolve(msg.result);
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error(`cannot connect: ${url}`)), { once: true });
    });
    return new CDP(ws);
  }

  send(method, params = {}) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (this.sessionId) msg.sessionId = this.sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) =>
      this.pending.set(id, { resolve, reject, method }));
  }

  /* Runtime.evaluate, but it throws on a page-side exception instead of
     silently returning undefined — a seek that fails must stop the capture,
     not quietly emit thousands of frames of the same picture. */
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(`page: ${r.exceptionDetails.exception?.description
                              || r.exceptionDetails.text}`);
    }
    return r.result.value;
  }
}

/* ---- launch ------------------------------------------------------------- */

async function launchChrome() {
  const userDir = `/tmp/reel-capture-profile-${process.pid}`;
  const child = spawn(OPT.chrome, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDir}`,
    `--window-size=${OPT.width},${OPT.height}`,
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    /* The page must animate while headless and backgrounded, or every frame
       after the first would be identical. */
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  // Chrome prints the actual debugging URL to stderr when the port is 0.
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('Chrome did not report a debug URL')), 20000);
    child.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/ws:\/\/[^\s]+/);
      if (m) { clearTimeout(t); resolve(m[0]); }
    });
    child.on('exit', (c) => { clearTimeout(t); reject(new Error(`Chrome exited (${c})`)); });
  });
  return { child, wsUrl };
}

/* ---- main --------------------------------------------------------------- */

const { child: chrome, wsUrl } = await launchChrome();
log('chrome up');

const browser = await CDP.connect(wsUrl);
const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
browser.sessionId = sessionId;
const page = browser;

await page.send('Page.enable');
await page.send('Runtime.enable');
/* Pin the viewport explicitly. Scroll height is measured in vh, so the frame
   count depends on this being exactly what we think it is. */
await page.send('Emulation.setDeviceMetricsOverride', {
  width: OPT.width, height: OPT.height, deviceScaleFactor: 1, mobile: false,
});

const url = `http://localhost:${OPT.port}/reel/?capture`;
log(`loading ${url} at ${OPT.width}×${OPT.height}`);
await page.send('Page.navigate', { url });

// The reel mounts 22 chapters up front; that is the slow part of the run.
for (let waited = 0; ; waited += 500) {
  if (await page.eval('!!window.__reelReady')) break;
  if (waited > 180000) throw new Error('reel never became ready');
  await sleep(500);
}

const height = await page.eval('window.__reel.height()');
await page.eval(`window.__reel.fps = ${OPT.fps}`);

const y0 = Math.round(height * OPT.from);
const y1 = Math.round(height * OPT.to);
const span = y1 - y0;
const totalFrames = Math.max(1, Math.round((span / OPT.pxPerSec) * OPT.fps));
const seconds = totalFrames / OPT.fps;

log(`reel is ${height}px; capturing ${span}px ` +
    `(${(OPT.from * 100).toFixed(1)}%→${(OPT.to * 100).toFixed(1)}%)`);
log(`${totalFrames} frames @ ${OPT.fps}fps = ${(seconds / 60).toFixed(1)} min of video`);

/* ---- encode ------------------------------------------------------------- */

const ff = spawn('ffmpeg', [
  '-y',
  '-f', 'image2pipe', '-framerate', String(OPT.fps), '-i', 'pipe:0',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-pix_fmt', 'yuv420p',                    // required for QuickTime/YouTube
  '-movflags', '+faststart',
  OPT.out,
], { stdio: ['pipe', 'ignore', 'pipe'] });

let ffErr = '';
ff.stderr.on('data', (d) => { ffErr += d.toString(); });
const ffDone = new Promise((res, rej) => {
  ff.on('exit', (code) => code === 0 ? res()
    : rej(new Error(`ffmpeg exited ${code}\n${ffErr.slice(-2000)}`)));
});
/* If ffmpeg dies mid-run, writes to its stdin raise EPIPE. Surface that as the
   ffmpeg error above rather than an unhandled rejection. */
ff.stdin.on('error', () => {});

const write = (buf) => ff.stdin.write(buf)
  || new Promise((r) => ff.stdin.once('drain', r));

const started = Date.now();
for (let f = 0; f < totalFrames; f++) {
  const y = y0 + (span * f) / (totalFrames - 1 || 1);
  await page.eval(`window.__reel.seek(${y.toFixed(2)}, ${f})`);
  const { data } = await page.send('Page.captureScreenshot', {
    format: 'jpeg', quality: OPT.quality, captureBeyondViewport: false,
  });
  await write(Buffer.from(data, 'base64'));

  if (f % 100 === 0 || f === totalFrames - 1) {
    const done = f + 1;
    const rate = done / ((Date.now() - started) / 1000);
    const eta = (totalFrames - done) / rate;
    log(`frame ${done}/${totalFrames} · ${rate.toFixed(1)} fps captured · ` +
        `eta ${(eta / 60).toFixed(1)} min`);
  }
}

ff.stdin.end();
await ffDone;
log(`wrote ${OPT.out} — ${(seconds / 60).toFixed(1)} min`);

chrome.kill();
process.exit(0);
