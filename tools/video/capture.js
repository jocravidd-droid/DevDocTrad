/*
 * Captures réelles de l'extension pour la vidéo de présentation.
 *
 * - charge dist/chrome (construit par `python3 build.py`) dans Chromium, comme tools/e2e.js ;
 * - faux traducteur tools/fake_ollama.js (traductions préparées, aucune vraie IA, aucun envoi) ;
 * - page de démo tools/demo/index.html : original anglais, traduction, retour à l'original,
 *   bilingue, russe ; deux formats de fenêtre (large pour le 16:9, haute pour le 9:16) ;
 * - popup de l'extension (ouvert comme page, onglet actif = la page de démo) ;
 * - voix des vidéos : petite vidéo tutoriel + sous-titres anglais de tools/demo/voice,
 *   traduits par l'extension ; une image tous les 1/30 s (vidéo en pause, déplacée image
 *   par image), donc un mouvement fluide sans dépendre de l'horloge réelle.
 *
 * Tout est écrit dans dist/video/captures/ avec un fichier manifest.json (tailles, positions
 * des éléments utiles pour les zooms et les mises en évidence).
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { CLIP_HTML, renderClip } = require('./clip');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'chrome');
const VOICE = path.join(ROOT, 'tools', 'demo', 'voice');
const DPR = 2;
const SETS = { wide: { w: 1280, h: 800 }, tall: { w: 900, h: 1400 } };
const VOICE_FROM = 1.6, VOICE_TO = 7.4, FPS = 30;   // passage de la vidéo filmé (secondes)

const VIDEO_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Getting started – Nimbus HTTP</title>
<style>html,body{margin:0;background:#000;overflow:hidden}video{display:block;width:1280px;height:720px}</style></head>
<body><video id="v" src="clip.webm" muted playsinline preload="auto"><track kind="subtitles" srclang="en" label="English" src="subs.en.vtt"></video></body></html>`;

function prepareExtension() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-ext-'));
  fs.cpSync(DIST, tmp, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  mf.host_permissions.push('http://localhost:11434/*', 'http://127.0.0.1:11434/*', '*://localhost/*', '*://*.localhost/*');
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(mf, null, 2));
  return tmp;
}

function sendFile(req, res, file, type) {
  const buf = fs.readFileSync(file);
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (!m) return res.end(buf);
  const start = m[1] ? +m[1] : 0;
  const end = m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
  res.statusCode = 206;
  res.setHeader('Content-Range', `bytes ${start}-${end}/${buf.length}`);
  res.end(buf.subarray(start, end + 1));
}

function serve(port, clipFile) {
  return new Promise((r) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (port === 8141 && u === '/') return sendFile(req, res, path.join(ROOT, 'tools', 'demo', 'index.html'), 'text/html; charset=utf-8');
      if (u === '/__clip.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(CLIP_HTML); }
      if (u.startsWith('/tools/video/fonts/')) return sendFile(req, res, path.join(__dirname, 'fonts', path.basename(u)), 'font/woff2');
      if (port === 8142 && u === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(VIDEO_PAGE); }
      if (port === 8142 && u === '/clip.webm') return sendFile(req, res, clipFile, 'video/webm');
      if (port === 8142 && u === '/subs.en.vtt') return sendFile(req, res, path.join(VOICE, 'subs.en.vtt'), 'text/vtt');
      res.statusCode = 404; res.end();
    });
    s.listen(port, '127.0.0.1', () => r(s));
  });
}

async function waitDone(page, timeout = 20000) {
  try {
    await page.waitForFunction(() => {
      const h = document.querySelector('div[data-tr-ui]');
      const m = h && h.shadowRoot && h.shadowRoot.querySelector('.msg');
      return m && /Traduit|Translated|Переведено/.test(m.textContent);
    }, null, { timeout });
  } catch (e) {
    const msg = await page.evaluate(() => { const h = document.querySelector('div[data-tr-ui]'); return h && h.shadowRoot ? h.shadowRoot.textContent : '(pas de badge)'; });
    throw new Error('traduction non terminée, badge : ' + msg);
  }
}

/* Positions (en pixels CSS) des éléments utiles de la page de démo. */
function rects(page) {
  return page.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const codes = [...document.querySelectorAll('main p code')];
    const out = {
      h1: r(document.querySelector('main h1')), lead: r(document.querySelector('main p.lead')),
      install: r(document.querySelectorAll('main > p')[1]), pre: r(document.querySelector('main pre')),
      code1: r(codes[0]), code2: r(codes[1]), note: r(document.querySelector('.note')),
      h2: r(document.querySelector('main h2')), table: r(document.querySelector('main table')), main: r(document.querySelector('main'))
    };
    const host = document.querySelector('div[data-tr-ui]');
    if (host && host.shadowRoot) {
      const boxes = [...host.shadowRoot.querySelectorAll('*')].map((e) => ({ e, b: e.getBoundingClientRect() })).filter((x) => x.b.width > 60 && x.b.height > 20 && x.b.height < 90);
      boxes.sort((a, b) => b.b.width - a.b.width);
      if (boxes[0]) out.badge = r(boxes[0].e);
      const btns = [...host.shadowRoot.querySelectorAll('button')].map(r).filter((b) => b && b.w > 0);
      if (btns.length) out.badgeButtons = btns;
    }
    return out;
  });
}

async function setSettings(sw, patch) {
  await sw.evaluate((p) => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign(r.settings || {}, p) })), patch);
}

async function captureLocale(locale, ext, outDir, log) {
  const L = locale.slice(0, 2);
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-profile-'));
  const ctx = await chromium.launchPersistentContext(userDir, {
    channel: process.env.DDT_CHROMIUM ? undefined : 'chromium', executablePath: process.env.DDT_CHROMIUM || undefined,
    headless: !process.env.DDT_HEADFUL,
    viewport: { width: 1280, height: 800 }, deviceScaleFactor: DPR, locale, reducedMotion: 'reduce',
    env: Object.assign({}, process.env, { LANGUAGE: L, LANG: locale.replace('-', '_') + '.UTF-8', LC_ALL: locale.replace('-', '_') + '.UTF-8' }),
    args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext, '--lang=' + locale, '--accept-lang=' + locale + ',' + L,
      '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars']
  });
  const man = { locale: L, dpr: DPR, sets: {} };
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const extId = sw.url().split('/')[2];
    // attendre que onInstalled ait écrit les réglages par défaut (sinon il écrase les nôtres)
    await sw.evaluate(async () => { for (let i = 0; i < 50; i++) { const r = await chrome.storage.local.get('settings'); if (r.settings) return; await new Promise((ok) => setTimeout(ok, 100)); } });
    const keys = [{ id: 'k-ollama', provider: 'ollama', label: 'Ollama', tier: 'local', enabled: true, modelEasy: 'demo-model:latest', baseUrl: 'http://127.0.0.1:11434', order: 0 }];
    await sw.evaluate((k) => chrome.storage.local.set({ keys: k, settings: { target: 'fr', mode: 'replace', explainTerms: false, translateComments: false, pageCap: 150000, batchChars: 6000, sensitiveExtra: [], autoSites: [] } }), keys);

    const page = await ctx.newPage();
    const file = (n) => { const f = `${n}-${L}.png`; return { f, p: path.join(outDir, f) }; };
    const tabId = async () => sw.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:8141/*' }))[0].id);
    for (const [name, vp] of Object.entries(SETS)) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await setSettings(sw, { mode: 'replace', target: 'fr' });
      await page.goto('http://localhost:8141/');
      await page.waitForTimeout(400);
      const set = man.sets[name] = { w: vp.w, h: vp.h, shots: {} };
      let o = file('en-' + name); await page.screenshot({ path: o.p }); set.shots.en = { file: o.f, rects: await rects(page) };
      const id = await tabId();
      await sw.evaluate((i) => self.__DDT_BG.tabCommand(i, 'translate', null), id);
      await waitDone(page); await page.waitForTimeout(900);
      o = file('fr-' + name); await page.screenshot({ path: o.p }); set.shots.fr = { file: o.f, rects: await rects(page) };
      await sw.evaluate((i) => self.__DDT_BG.tabCommand(i, 'toggle', null), id);
      await page.waitForTimeout(900);
      o = file('orig-' + name); await page.screenshot({ path: o.p }); set.shots.orig = { file: o.f, rects: await rects(page) };
      await setSettings(sw, { mode: 'bilingual' });
      await page.reload(); await page.waitForTimeout(300);
      await sw.evaluate((i) => self.__DDT_BG.tabCommand(i, 'translate', null), await tabId());
      await waitDone(page); await page.waitForTimeout(900);
      o = file('bi-' + name); await page.screenshot({ path: o.p }); set.shots.bi = { file: o.f, rects: await rects(page) };
      if (name === 'wide') {
        await setSettings(sw, { mode: 'replace', target: 'ru' });
        await page.reload(); await page.waitForTimeout(300);
        await sw.evaluate((i) => self.__DDT_BG.tabCommand(i, 'translate', null), await tabId());
        await waitDone(page); await page.waitForTimeout(900);
        o = file('ru-' + name); await page.screenshot({ path: o.p }); set.shots.ru = { file: o.f, rects: await rects(page) };
      }
      log(`${L} ${name} : en, fr, orig, bi${name === 'wide' ? ', ru' : ''}`);
    }

    // Popup : ouvert comme page, avec l'onglet de démo (non traduit) comme onglet actif
    await setSettings(sw, { mode: 'replace', target: 'fr' });
    await page.setViewportSize({ width: SETS.wide.w, height: SETS.wide.h });
    await page.goto('http://localhost:8141/');
    await page.bringToFront();
    const pop = await ctx.newPage();
    await pop.addInitScript(() => {
      if (location.protocol !== 'chrome-extension:' || !self.chrome || !chrome.tabs) return;
      const q = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = (o) => (o && o.active ? q({ url: 'http://localhost:8141/*' }) : q(o));
    });
    await pop.setViewportSize({ width: 360, height: 600 });
    await pop.goto(`chrome-extension://${extId}/popup.html`);
    await pop.waitForTimeout(1200);
    const pr = await pop.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      const bottom = Math.max(...[...document.querySelectorAll('main > section')].filter((x) => !x.hidden).map((x) => x.getBoundingClientRect().bottom));
      return { translate: r(document.getElementById('translate')), height: Math.ceil(document.documentElement.scrollHeight), contentH: Math.ceil(bottom + 16), host: document.getElementById('host').textContent };
    });
    const ph = Math.min(600, pr.height);
    await pop.setViewportSize({ width: 360, height: ph });
    await pop.waitForTimeout(300);
    let o = file('popup'); await pop.screenshot({ path: o.p });
    man.popup = { file: o.f, w: 360, h: ph, contentH: Math.min(ph, pr.contentH), rects: { translate: pr.translate }, host: pr.host };
    await pop.close();
    log(`${L} popup (${pr.host})`);

    // Voix des vidéos : sous-titres traduits sur la vidéo, en mode bilingue
    await setSettings(sw, { mode: 'bilingual', target: 'fr' });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://localhost:8142/');
    await page.waitForFunction(() => { const v = document.getElementById('v'); return v && v.readyState >= 2; }, null, { timeout: 15000 });
    const vtab = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:8142/*' }))[0].id);
    const st = await sw.evaluate((i) => self.__DDT_BG.voiceCommand(i, 'start', null), vtab);
    if (!st || !st.active) throw new Error('voix non démarrée : ' + JSON.stringify(st));
    const CUES = [[0, 3.5, 'Welcome'], [3.5, 7, 'First'], [7, 10, 'Then']];
    const seek = (t) => page.evaluate((tt) => new Promise((ok) => {
      const v = document.getElementById('v'); v.pause();
      if (Math.abs(v.currentTime - tt) < 1e-4) return ok();
      v.addEventListener('seeked', () => ok(), { once: true }); v.currentTime = tt;
    }), t);
    const overlay = () => page.evaluate(() => {
      const h = document.querySelector('div[data-tr-ui="voice"]');
      if (!h || !h.shadowRoot) return null;
      const q = (s) => { const e = h.shadowRoot.querySelector(s); return e ? e.textContent : ''; };
      return { tr: q('.tr'), orig: q('.orig') };
    });
    // préchauffer : chaque phrase traduite une fois (cache)
    for (const [a] of CUES) { await seek(a + 0.5); for (let i = 0; i < 60; i++) { const x = await overlay(); if (x && x.tr && x.tr !== x.orig) break; await page.waitForTimeout(100); } }
    const vdir = path.join(outDir, 'voice-' + L);
    fs.mkdirSync(vdir, { recursive: true });
    const frames = [];
    for (let i = 0; i <= Math.round((VOICE_TO - VOICE_FROM) * FPS); i++) {
      const t = VOICE_FROM + i / FPS;
      await seek(t);
      const cue = CUES.find((c) => t >= c[0] && t < c[1]);
      for (let k = 0; k < 40; k++) {
        const x = await overlay();
        if (x && x.orig.startsWith(cue[2]) && x.tr && x.tr !== x.orig) break;
        await page.waitForTimeout(50);
      }
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
      const f = `f${String(i).padStart(4, '0')}.jpg`;
      await page.screenshot({ path: path.join(vdir, f), type: 'jpeg', quality: 92 });
      frames.push(f);
    }
    man.voice = { dir: 'voice-' + L, frames, w: 1280, h: 720, from: VOICE_FROM, fps: FPS };
    const last = await overlay();
    log(`${L} voix : ${frames.length} images, « ${last && last.tr} »`);
    await sw.evaluate((i) => self.__DDT_BG.voiceCommand(i, 'stop', null), vtab);
  } finally {
    await ctx.close();
  }
  return man;
}

async function capture(outDir, log = console.log) {
  if (!fs.existsSync(path.join(DIST, 'manifest.json'))) throw new Error('dist/chrome absent : lance d\'abord « python3 build.py »');
  spawnSync('pkill', ['-f', '[f]ake_ollama'], { stdio: 'ignore' });   // un faux Ollama resté d'une autre exécution
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  // la vidéo tutoriel est gardée d'une fois sur l'autre (refaite si clip.js a changé)
  const clipFile = path.join(path.dirname(outDir), 'clip.webm');
  const s1 = await serve(8141, clipFile);
  const s2 = await serve(8142, clipFile);
  const unknown = path.join(ROOT, 'tools', 'demo', 'unknown.txt');
  fs.rmSync(unknown, { force: true });
  const ollama = spawn(process.execPath, [path.join(ROOT, 'tools', 'fake_ollama.js')], { stdio: 'ignore', env: Object.assign({}, process.env, { FAKE_OLLAMA_DELAY: '120' }) });
  try {
    // 1. vidéo tutoriel (sans extension)
    if (!fs.existsSync(clipFile) || fs.statSync(clipFile).mtimeMs < fs.statSync(path.join(__dirname, 'clip.js')).mtimeMs) {
      const b = await chromium.launch(process.env.DDT_CHROMIUM ? { executablePath: process.env.DDT_CHROMIUM } : { channel: 'chromium' });
      const p = await (await b.newContext({ deviceScaleFactor: 1.5 })).newPage();
      await renderClip(p, 'http://localhost:8141', clipFile, log);
      await b.close();
    }
    // 2. captures de l'extension, interface en français puis en anglais
    await new Promise((r) => setTimeout(r, 300));
    const ext = prepareExtension();
    const only = process.env.DDT_VIDEO_LOCALE;   // pour déboguer : fr ou en seulement
    const manifest = {};
    if (!only || only === 'fr') manifest.fr = await captureLocale('fr-FR', ext, outDir, log);
    if (!only || only === 'en') manifest.en = await captureLocale('en-US', ext, outDir, log);
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
    if (fs.existsSync(unknown)) log('À vérifier sur les images : phrases reçues par le faux traducteur sans traduction préparée (renvoyées telles quelles) :\n' + fs.readFileSync(unknown, 'utf8'));
    return manifest;
  } finally {
    ollama.kill();
    s1.close(); s2.close();
  }
}

module.exports = { capture };
if (require.main === module) capture(path.join(ROOT, 'dist', 'video', 'captures')).catch((e) => { console.error(e); process.exit(1); });
