#!/usr/bin/env node
/*
 * Test réel avec Ollama (aucune clé, aucun quota) : traduit tools/demo/langtest.html avec de vrais
 * modèles locaux, dans un Chromium avec l'extension chargée.
 *
 *   python3 build.py
 *   DDT_CHROMIUM=/usr/bin/chromium node tools/ollama_matrix.js models qwen2.5:3b,gemma3:4b fr
 *   DDT_CHROMIUM=/usr/bin/chromium node tools/ollama_matrix.js langs qwen2.5:7b fr,de,ja,...   (ou all)
 *
 * Écrit les résultats dans design/qa/ollama-<mode>.json et affiche un résumé : texte traduit,
 * code intact (oui/non), durée.
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const [mode, modelsArg, langsArg] = process.argv.slice(2);
const MODELS = (modelsArg || 'qwen2.5:3b').split(',');
global.window = global;
require(path.join(ROOT, 'src', 'shared.js'));
const ALL = Object.keys(global.DDT.TARGETS).filter((c) => c !== 'en');
const LANGS = !langsArg || langsArg === 'all' ? ALL : langsArg.split(',');
const CODE = ["const client = createClient({ baseUrl: 'https://api.example.com' });", 'npm install is-online', 'await isOnline()', 'window.alert()', 'Path'];

function prepare() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-ollama-'));
  fs.cpSync(path.join(ROOT, 'dist', 'chrome'), tmp, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  mf.host_permissions.push('http://127.0.0.1:11434/*', '*://localhost/*');
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(mf));
  return tmp;
}

(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'demo', 'langtest.html'));
  const server = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(html); }).listen(8124, '127.0.0.1');
  const ext = prepare();
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-ollama-prof-')), {
    executablePath: process.env.DDT_CHROMIUM || undefined, channel: process.env.DDT_CHROMIUM ? undefined : 'chromium',
    headless: true, args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext]
  });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const page = await ctx.newPage();
  const results = [];
  const runs = mode === 'models' ? MODELS.map((m) => [m, LANGS[0]]) : LANGS.map((l) => [MODELS[0], l]);
  for (const [model, lang] of runs) {
    await sw.evaluate(([m, l]) => chrome.storage.local.set({
      keys: [{ id: 'o', provider: 'ollama', label: 'Ollama', tier: 'local', enabled: true, modelEasy: m, baseUrl: 'http://127.0.0.1:11434', order: 0 }],
      settings: { target: l, mode: 'replace', explainTerms: false, pageCap: 150000, batchChars: 6000, sensitiveExtra: [], autoSites: [], termsStyle: 3 },
      cache: {}
    }), [model, lang]);
    await sw.evaluate(() => self.__DDT_BG.clearCache && self.__DDT_BG.clearCache());
    await page.goto('http://localhost:8124/');
    const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost/*' }))[0].id);
    const t0 = Date.now();
    await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'translate', null), tabId);
    let st = null;
    for (let i = 0; i < 240; i++) {
      st = await sw.evaluate((id) => chrome.tabs.sendMessage(id, { to: 'content', cmd: 'status' }), tabId).catch(() => null);
      if (st && st.state !== 'running') break;
      await page.waitForTimeout(1000);
    }
    const out = await page.evaluate(() => ({
      h1: document.querySelector('h1').innerText,
      p: [...document.querySelectorAll('main p')].map((p) => p.innerText),
      codes: [...document.querySelectorAll('code')].map((c) => c.textContent)
    }));
    const codeOk = CODE.every((c) => out.codes.some((x) => x.includes(c)) || out.p.join(' ').includes(c));
    const r = { model, lang, secs: Math.round((Date.now() - t0) / 1000), state: st && st.state, done: st && st.done, total: st && st.total, failed: st && st.failed, codeOk, h1: out.h1, p: out.p };
    results.push(r);
    console.log(`\n=== ${model} → ${lang} : ${r.state} ${r.done}/${r.total} (échecs ${r.failed}), ${r.secs} s, code intact : ${codeOk ? 'oui' : 'NON'}`);
    console.log('  ' + r.h1);
    r.p.slice(0, 2).forEach((p) => console.log('  ' + p));
  }
  fs.mkdirSync(path.join(ROOT, 'design', 'qa'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'design', 'qa', `ollama-${mode}.json`), JSON.stringify(results, null, 2));
  await ctx.close();
  server.close();
})();
