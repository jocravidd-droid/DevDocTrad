#!/usr/bin/env node
/*
 * Vidéo de présentation de DevDocTrad : 16:9 et 9:16, français et anglais, + miniatures.
 *
 *   python3 build.py              # construit dist/chrome
 *   node tools/video/make.js      # captures réelles + rendu + encodage
 *
 * Sorties : les vidéos 16:9 (1080p) vont directement dans docs/assets/video/ (servies par le site,
 * un seul exemplaire dans le dépôt) ; les verticales et les miniatures dans store/video/.
 *
 * Options :
 *   --skip-capture     réutilise dist/video/captures (captures déjà faites)
 *   --only fr-wide     un seul rendu (fr-wide, en-wide, fr-vertical, en-vertical, thumbs)
 *   --frames 3,8.5     n'encode rien : enregistre ces instants en PNG dans dist/video/preview
 *   --crf 18           qualité H.264 (plus petit = meilleur, plus lourd)
 *   --audio-only       refait seulement la musique des vidéos déjà encodées
 *
 * Images calculées une par une à 30 i/s (le temps est imposé, pas l'horloge réelle),
 * envoyées à ffmpeg (libx264, preset slow, yuv420p), musique synthétisée par music.js.
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { capture } = require('./capture');
const { writeMusic } = require('./music');

const ROOT = path.join(__dirname, '..', '..');
const WORK = path.join(ROOT, 'dist', 'video');
const OUT = path.join(ROOT, 'store', 'video');                   // verticales + miniatures
const OUT_WIDE = path.join(ROOT, 'docs', 'assets', 'video');     // 1080p : servies par le site
const outDir = (fmt) => (fmt === 'wide' ? OUT_WIDE : OUT);
const FPS = 30;
const PORT = 8143;
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
function serve() {
  const allowed = ['/tools/video/', '/design/logo/', '/dist/video/captures/'];
  return new Promise((r) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, path.normalize(u));
      if (!allowed.some((a) => u.startsWith(a)) || !f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
      fs.createReadStream(f).pipe(res);
    });
    s.listen(PORT, '127.0.0.1', () => r(s));
  });
}

async function openStage(browser, fmt, lang) {
  const size = { wide: [1920, 1080], vertical: [1080, 1920], thumb: [1280, 720] }[fmt];
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(r.status() + ' ' + r.url()); });
  await page.goto(`http://127.0.0.1:${PORT}/tools/video/stage.html?fmt=${fmt}&lang=${lang}`);
  await page.evaluate(() => window.ready);
  if (errors.length) throw new Error('erreur dans la scène : ' + errors.join(' / '));
  const info = await page.evaluate(() => ({ dur: window.DURATION, events: window.EVENTS }));
  const cdp = await page.context().newCDPSession(page);
  const shot = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64');
  return { page, info, shot, errors };
}

async function renderVideo(browser, fmt, lang, crf) {
  const name = `devdoctrad-promo-${lang}-${fmt === 'wide' ? '1080p' : 'vertical'}`;
  const { page, info, shot, errors } = await openStage(browser, fmt, lang);
  const wav = path.join(WORK, name + '.wav');
  writeMusic(wav, info.dur, info.events);
  const out = path.join(outDir(fmt), name + '.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-i', wav,
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-tune', 'animation',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(FPS), '-g', String(FPS * 2),
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-movflags', '+faststart',
    '-metadata', 'title=DevDocTrad', '-metadata', 'comment=https://devdoctrad.vercel.app/',
    out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, ko) => ff.on('close', (c) => (c ? ko(new Error('ffmpeg ' + c)) : ok())));
  const n = Math.round(info.dur * FPS);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.renderAt(t), i / FPS);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) log(`${name} : ${i}/${n} images (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await done;
  await page.close();
  if (errors.length) throw new Error('erreur pendant le rendu : ' + errors.join(' / '));
  fs.rmSync(wav, { force: true });
  log(`${name}.mp4 : ${(fs.statSync(out).size / 1048576).toFixed(1)} Mo, ${info.dur} s`);
}

/* Refait seulement la musique d'une vidéo déjà encodée (image copiée telle quelle). */
async function remuxAudio(browser, fmt, lang) {
  const name = `devdoctrad-promo-${lang}-${fmt === 'wide' ? '1080p' : 'vertical'}`;
  const out = path.join(outDir(fmt), name + '.mp4');
  if (!fs.existsSync(out)) throw new Error(out + ' absent : lance d\'abord le rendu complet');
  const { page, info } = await openStage(browser, fmt, lang);
  await page.close();
  const wav = path.join(WORK, name + '.wav');
  const tmp = path.join(WORK, name + '.tmp.mp4');
  writeMusic(wav, info.dur, info.events);
  await new Promise((ok, ko) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart',
    '-metadata', 'title=DevDocTrad', '-metadata', 'comment=https://devdoctrad.vercel.app/', tmp], { stdio: 'inherit' })
    .on('close', (c) => (c ? ko(new Error('ffmpeg ' + c)) : ok())));
  fs.renameSync(tmp, out);
  fs.rmSync(wav, { force: true });
  log(`${name}.mp4 : musique refaite`);
}

async function preview(browser, fmt, lang, times) {
  const dir = path.join(WORK, 'preview');
  fs.mkdirSync(dir, { recursive: true });
  const { page, shot } = await openStage(browser, fmt, lang);
  for (const t of times) {
    await page.evaluate((tt) => window.renderAt(tt), t);
    const f = path.join(dir, `${fmt}-${lang}-${String(t).replace('.', '_')}.png`);
    fs.writeFileSync(f, await shot());
  }
  await page.close();
  log(`aperçus ${fmt}-${lang} : ${times.join(', ')} s -> ${dir}`);
}

async function thumbnails(browser) {
  for (const lang of ['fr', 'en']) {
    const { page } = await openStage(browser, 'thumb', lang);
    await page.evaluate(() => window.renderAt(0));
    const f = path.join(OUT, `thumbnail-${lang}.png`);
    await page.screenshot({ path: f });
    await page.close();
    log(`thumbnail-${lang}.png`);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(OUT_WIDE, { recursive: true });
  fs.mkdirSync(WORK, { recursive: true });
  const caps = path.join(WORK, 'captures');
  if (!arg('skip-capture') || !fs.existsSync(path.join(caps, 'manifest.json'))) {
    log('captures réelles de l\'extension…');
    await capture(caps, log);
  }
  const server = await serve();
  const browser = await chromium.launch(process.env.DDT_CHROMIUM ? { executablePath: process.env.DDT_CHROMIUM } : { channel: 'chromium' });
  try {
    const only = arg('only');
    const frames = arg('frames');
    const crf = Number(arg('crf', 18));
    const jobs = [['fr', 'wide'], ['en', 'wide'], ['fr', 'vertical'], ['en', 'vertical']].filter(([l, f]) => !only || only === `${l}-${f}`);
    if (arg('audio-only')) {
      for (const [l, f] of jobs) await remuxAudio(browser, f, l);
    } else if (frames) {
      const times = String(frames).split(',').map(Number);
      for (const [l, f] of jobs) if (!only || only !== 'thumbs') await preview(browser, f, l, times);
      if (!only || only === 'thumbs') await thumbnails(browser);
    } else {
      if (!only || only === 'thumbs') await thumbnails(browser);
      for (const [l, f] of jobs) await renderVideo(browser, f, l, crf);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
