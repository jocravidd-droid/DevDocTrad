#!/usr/bin/env node
/*
 * Captures de contrôle visuel (design/qa/) : popup dans tous ses états et badge, thèmes clair et sombre,
 * dans un vrai Chromium avec l'extension chargée. Le popup est ouvert dans un onglet ; un script de test
 * (injecté seulement ici) fait pointer chrome.tabs.query vers l'onglet de démo. Relancer :
 *   python3 build.py && node tools/qa_shots.js
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'design', 'qa');
fs.mkdirSync(OUT, { recursive: true });

function prepareExtension() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-qa-'));
  fs.cpSync(path.join(ROOT, 'dist', 'chrome'), tmp, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  mf.host_permissions.push('http://localhost:11434/*', 'http://127.0.0.1:11434/*', '*://localhost/*');
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(mf, null, 2));
  return tmp;
}

(async () => {
  const ext = prepareExtension();
  const html = fs.readFileSync(path.join(__dirname, 'demo', 'index.html'));
  const server = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(html); }).listen(8123, '127.0.0.1');
  const ollama = spawn(process.execPath, [path.join(__dirname, 'fake_ollama.js')], { stdio: 'ignore', env: Object.assign({}, process.env, { FAKE_OLLAMA_DELAY: '2500' }) });
  await new Promise((r) => setTimeout(r, 400));
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-qa-prof-')), {
    channel: process.env.DDT_CHROMIUM ? undefined : 'chromium', executablePath: process.env.DDT_CHROMIUM || undefined, headless: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, locale: 'fr-FR',
    env: Object.assign({}, process.env, { LANGUAGE: 'fr', LANG: 'fr_FR.UTF-8' }),
    args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext, '--lang=fr-FR']
  });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  const settings = { target: 'auto', mode: 'replace', explainTerms: false, translateComments: true, pageCap: 150000, batchChars: 400, sensitiveExtra: [], autoSites: [], theme: 'system' };
  const keys = [
    { id: 'k1', provider: 'gemini', label: 'Gemini', key: 'AIzaSy-DEMO-NOT-A-REAL-KEY-000000', tier: 'free', enabled: false, modelEasy: 'gemini-flash-latest', order: 0 },
    { id: 'k2', provider: 'ollama', label: 'Ollama', tier: 'local', enabled: true, modelEasy: 'demo-model:latest', baseUrl: 'http://127.0.0.1:11434', order: 1 },
    { id: 'k3', provider: 'groq', label: 'Groq', key: 'gsk_DEMO_NOT_A_REAL_KEY_0000000000', tier: 'free', enabled: true, modelEasy: 'demo', order: 2 }
  ];
  await sw.evaluate(([k, s]) => chrome.storage.local.set({ keys: k, settings: s }), [keys, settings]);
  await sw.evaluate(() => chrome.storage.session.set({ pauses: { k3: Date.now() + 25 * 60000 } }));

  const page = await ctx.newPage();
  await page.goto('http://localhost:8123/');
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:8123/*' }))[0].id);

  async function popupShot(name, scheme, opts = {}) {
    const p = await ctx.newPage();
    await p.emulateMedia({ colorScheme: scheme });
    await p.setViewportSize({ width: 360, height: 600 });
    await p.addInitScript(([url]) => {
      const q = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = (o) => (o && o.active ? q({ url }) : q(o));
    }, [opts.url || 'http://localhost:8123/*']);
    await p.goto(`chrome-extension://${id}/popup.html`);
    await p.waitForTimeout(opts.wait || 900);
    const h = await p.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
    await p.setViewportSize({ width: 360, height: Math.min(600, h) });
    await p.screenshot({ path: path.join(OUT, `popup-${name}-${scheme}.png`) });
    const over = await p.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);
    console.log('popup', name, scheme, 'hauteur', h, over ? 'DÉFILEMENT' : 'ok');
    await p.close();
  }

  for (const scheme of ['light', 'dark']) await popupShot('1-prete', scheme);
  // traduction en cours (faux Ollama lent)
  await page.emulateMedia({ colorScheme: 'light' });
  await sw.evaluate((t) => self.__DDT_BG.tabCommand(t, 'translate', null), tabId);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'badge-en-cours-light.png'), clip: { x: 880, y: 680, width: 400, height: 120 } });
  for (const scheme of ['light', 'dark']) await popupShot('2-en-cours', scheme, { wait: 600 });
  await page.waitForFunction(() => {
    const h = document.querySelector('div[data-tr-ui]');
    return h && /Traduit/.test(h.shadowRoot.querySelector('.msg').textContent);
  }, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  for (const scheme of ['light', 'dark']) await popupShot('3-traduite', scheme);
  await page.screenshot({ path: path.join(OUT, 'page-traduite-light.png') });
  await page.screenshot({ path: path.join(OUT, 'badge-traduit-light.png'), clip: { x: 880, y: 680, width: 400, height: 120 } });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'badge-traduit-dark.png'), clip: { x: 880, y: 680, width: 400, height: 120 } });
  await page.emulateMedia({ colorScheme: 'light' });
  // badge réduit
  await page.evaluate(() => document.querySelector('div[data-tr-ui]').shadowRoot.querySelector('[data-a=min]').click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'badge-reduit-light.png'), clip: { x: 1080, y: 700, width: 200, height: 100 } });
  // original affiché
  await sw.evaluate((t) => self.__DDT_BG.tabCommand(t, 'original', null), tabId);
  await page.waitForTimeout(400);
  for (const scheme of ['light', 'dark']) await popupShot('4-original', scheme);
  // page non traduisible
  for (const scheme of ['light', 'dark']) await popupShot('5-non-traduisible', scheme, { url: `chrome-extension://${id}/*` });
  // aucune clé
  await sw.evaluate(() => chrome.storage.local.set({ keys: [] }));
  const p2 = await ctx.newPage();
  await p2.goto('http://localhost:8123/?nokey');
  for (const scheme of ['light', 'dark']) await popupShot('6-aucune-cle', scheme, { url: 'http://localhost:8123/?nokey' });
  await ctx.close();
  server.close();
  ollama.kill();
})().catch((e) => { console.error(e); process.exit(1); });
