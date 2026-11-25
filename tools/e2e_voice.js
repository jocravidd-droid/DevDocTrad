#!/usr/bin/env node
/*
 * Test de bout en bout de la traduction de la voix des vidéos, dans un vrai Chromium.
 *
 *   python3 build.py && node tools/e2e_voice.js
 *
 * - vidéo de démo tools/demo/voice/clip.webm (10 s, image de test + son) et sous-titres anglais ;
 * - traductions par le faux Ollama (tools/fake_ollama.js), aucune vraie IA ;
 * - transcription : l'appel à api.groq.com est intercepté et reçoit une réponse préparée
 *   (aucune vraie clé, aucun envoi réel) ;
 * - vérifie : sous-titres traduits sur la vidéo, arrêt propre, son enregistré puis transcrit puis traduit.
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'chrome');
const VDIR = path.join(__dirname, 'demo', 'voice');
const results = [];
const check = (name, ok, extra) => { results.push({ name, ok }); console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra ? ' : ' + extra : '')); };

function prepareExtension() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-ext-'));
  fs.cpSync(DIST, tmp, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  mf.host_permissions.push('http://localhost:11434/*', 'http://127.0.0.1:11434/*', '*://localhost/*');
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(mf, null, 2));
  return tmp;
}

const PAGE = (withTrack) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Video tutorial</title>
<style>body{margin:0;font:16px system-ui;background:#111;color:#eee}main{max-width:900px;margin:40px auto}video{width:100%;display:block}</style></head>
<body><main><h1>Nimbus in 10 seconds</h1><video id="v" src="clip.webm" controls autoplay playsinline>
${withTrack ? '<track kind="subtitles" srclang="en" label="English" src="subs.en.vtt">' : ''}</video></main></body></html>`;

function serve() {
  return new Promise((r) => {
    const s = http.createServer((req, res) => {
      const u = req.url.split('?')[0];
      if (u === '/' || u === '/track.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(PAGE(true)); }
      if (u === '/audio.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(PAGE(false)); }
      const f = path.join(VDIR, path.basename(u));
      if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', u.endsWith('.vtt') ? 'text/vtt' : 'video/webm');
      res.setHeader('Accept-Ranges', 'bytes');
      const buf = fs.readFileSync(f);
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (!m) return res.end(buf);          // sans « Range », la vidéo ne peut pas être déplacée
      const start = m[1] ? +m[1] : 0;
      const end = m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${buf.length}`);
      res.end(buf.subarray(start, end + 1));
    });
    s.listen(8124, '127.0.0.1', () => r(s));
  });
}

function overlay(page) {
  return page.evaluate(() => {
    const h = document.querySelector('div[data-tr-ui="voice"]');
    if (!h || !h.shadowRoot) return null;
    const q = (s) => h.shadowRoot.querySelector(s).textContent;
    return { tr: q('.tr'), orig: q('.orig'), msg: q('.msg') };
  });
}
async function waitOverlay(page, test, timeout = 15000) {
  const end = Date.now() + timeout;
  let o = null;
  while (Date.now() < end) {
    o = await overlay(page);
    if (o && test(o)) return o;
    await page.waitForTimeout(200);
  }
  return o;
}

(async () => {
  const ext = prepareExtension();
  const server = await serve();
  const ollama = spawn(process.execPath, [path.join(__dirname, 'fake_ollama.js')], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 400));
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-profile-'));
  const ctx = await chromium.launchPersistentContext(userDir, {
    channel: 'chromium',
    headless: !process.env.DDT_HEADFUL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext, '--lang=fr-FR',
      '--autoplay-policy=no-user-gesture-required']
  });
  const groqCalls = [];
  try {
    let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    check('extension chargée', !!sw);
    await ctx.route('https://api.groq.com/**', (route) => {
      const req = route.request();
      groqCalls.push({ url: req.url(), auth: req.headers().authorization || '', size: (req.postDataBuffer() || Buffer.alloc(0)).length });
      if (/audio\/transcriptions/.test(req.url())) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Hello from the audio track.' }) });
      }
      return route.fulfill({ status: 500, body: '{}' });
    });
    const keys = [
      { id: 'k-ollama', provider: 'ollama', label: 'Ollama', tier: 'local', enabled: true, modelEasy: 'demo-model:latest', baseUrl: 'http://127.0.0.1:11434', order: 0 },
      { id: 'k-groq', provider: 'groq', label: 'Groq', key: 'gsk_DEMO_NOT_A_REAL_KEY_000000000000', tier: 'free', enabled: true, modelEasy: 'demo', order: 5 }
    ];
    // attendre la fin de onInstalled (qui écrit les réglages par défaut), sinon il écrase les nôtres
    await sw.evaluate(async () => { for (let i = 0; i < 50; i++) { const r = await chrome.storage.local.get('settings'); if (r.settings) return; await new Promise((ok) => setTimeout(ok, 100)); } });
    await sw.evaluate((k) => chrome.storage.local.set({ keys: k, settings: { termsStyle: 3, target: 'fr', mode: 'bilingual', explainTerms: false, translateComments: false, pageCap: 150000, batchChars: 6000, sensitiveExtra: [], autoSites: [] } }), keys);

    // 1. Vidéo avec sous-titres : traduits et affichés sur la vidéo
    const page = await ctx.newPage();
    await page.goto('http://localhost:8124/track.html');
    await page.waitForFunction(() => { const v = document.getElementById('v'); return v && v.readyState >= 2; }, null, { timeout: 15000 });
    const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:8124/*' }))[0].id);
    const st = await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'start', null), tabId);
    check('voix démarrée sur les sous-titres de la vidéo', st && st.active && st.mode === 'track', JSON.stringify(st));
    await page.evaluate(() => { const v = document.getElementById('v'); v.currentTime = 0; return v.play(); }).catch(() => {});
    let o = await waitOverlay(page, (x) => /Bienvenue|Commence|Ouvre/.test(x.tr));
    check('sous-titre traduit en français sur la vidéo', o && /Bienvenue|Commence|Ouvre/.test(o.tr), JSON.stringify(o));
    check('bilingue : original au-dessus', o && /Welcome|First|Then/.test(o.orig), o && o.orig);
    await page.evaluate(() => { const v = document.getElementById('v'); v.pause(); v.currentTime = 4.5; });
    o = await waitOverlay(page, (x) => x.tr === 'Commence par installer le paquet avec npm.');
    check('sous-titre suivant au bon moment', o && o.tr === 'Commence par installer le paquet avec npm.', o && o.tr);
    const hidden = await page.evaluate(() => document.getElementById('v').textTracks[0].mode);
    check('sous-titres d\'origine masqués pendant la traduction', hidden === 'hidden', hidden);
    for (const d of [path.join(ROOT, 'store', 'screenshots'), path.join(ROOT, 'docs', 'assets')]) {
      await page.screenshot({ path: path.join(d, 'screenshot-5-voix.png') });
    }
    const stop = await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'stop', null), tabId);
    check('arrêt : bande retirée', stop && !stop.active && !(await overlay(page)));
    const restored = await page.evaluate(() => document.getElementById('v').textTracks[0].mode);
    check('arrêt : piste remise comme avant', restored === 'disabled', restored);
    check('aucun appel audio pour une vidéo sous-titrée', groqCalls.length === 0, String(groqCalls.length));

    // 2. Vidéo sans sous-titres : son enregistré -> transcription Groq (simulée) -> traduction
    await page.goto('http://localhost:8124/audio.html');
    await page.waitForFunction(() => { const v = document.getElementById('v'); return v && v.readyState >= 2; }, null, { timeout: 15000 });
    await page.evaluate(() => { const v = document.getElementById('v'); v.loop = true; return v.play(); }).catch(() => {});
    const st2 = await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'start', null), tabId);
    check('vidéo sans sous-titres : écoute du son', st2 && st2.active && st2.mode === 'audio', JSON.stringify(st2));
    o = await waitOverlay(page, (x) => x.tr === 'Bonjour depuis la piste audio.', 25000);
    check('son transcrit puis traduit en français', o && o.tr === 'Bonjour depuis la piste audio.', JSON.stringify(o));
    const call = groqCalls.find((c) => /audio\/transcriptions/.test(c.url));
    check('transcription envoyée à Groq avec la clé gratuite', !!call && call.auth === 'Bearer gsk_DEMO_NOT_A_REAL_KEY_000000000000' && call.size > 1000,
      call ? call.size + ' octets' : 'aucun appel');
    await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'stop', null), tabId);
    check('arrêt de l\'écoute', !(await overlay(page)));

    // 3. Popup : l'interrupteur est là et le popup tient dans 600 px
    const pop = await ctx.newPage();
    await pop.setViewportSize({ width: 360, height: 600 });
    const extId = sw.url().split('/')[2];
    await pop.goto(`chrome-extension://${extId}/popup.html`);
    await pop.waitForTimeout(500);
    const h = await pop.evaluate(() => ({ sw: !!document.getElementById('voiceSwitch'), height: document.documentElement.scrollHeight }));
    check('popup : interrupteur « voix des vidéos »', h.sw);
    check('popup : hauteur sous 600 px', h.height <= 600, String(h.height));
    await pop.close();
  } catch (e) {
    check('exécution du scénario', false, e && e.stack);
  } finally {
    await ctx.close();
    server.close();
    ollama.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} vérifications réussies`);
  process.exit(failed ? 1 : 0);
})();
