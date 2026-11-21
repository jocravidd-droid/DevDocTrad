#!/usr/bin/env node
/*
 * Test réel avec une vraie clé GRATUITE, en peu de requêtes (limite de 9 000 caractères par page).
 * La clé n'est jamais écrite dans un fichier : elle est lue dans une variable d'environnement.
 *   DDT_TEST_PROVIDER=groq DDT_TEST_MODEL=openai/gpt-oss-120b DDT_TEST_KEY="$GROK_KEY" node tools/e2e_real.js
 *   DDT_TEST_PROVIDER=gemini DDT_TEST_MODEL=gemini-flash-latest DDT_TEST_KEY=... node tools/e2e_real.js
 * Pages : la démo locale, une page MDN et un README GitHub. DDT_TEST_SHOTS=1 enregistre
 * aussi les captures pour les boutiques (store/screenshots/screenshot-5/6).
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const KEY = process.env.DDT_TEST_KEY || process.env.DDT_TEST_GEMINI_KEY;
const PROVIDER = process.env.DDT_TEST_PROVIDER || 'gemini';
const MODEL = process.env.DDT_TEST_MODEL || 'gemini-flash-latest';
const SHOTS = process.env.DDT_TEST_SHOTS === '1';
if (!KEY) { console.error('Variable DDT_TEST_KEY absente.'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const results = [];
const check = (n, ok, x) => { results.push(ok); console.log((ok ? 'OK   ' : 'FAIL ') + n + (x ? ' : ' + x : '')); };
const mask = (s) => String(s).split(KEY).join('[clé]');

(async () => {
  const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-real-'));
  fs.cpSync(path.join(ROOT, 'dist', 'chrome'), ext, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
  mf.host_permissions.push('*://localhost/*', 'https://developer.mozilla.org/*', 'https://github.com/*');
  fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(mf));
  const html = fs.readFileSync(path.join(__dirname, 'demo', 'index.html'));
  const server = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(html); }).listen(8124, '127.0.0.1');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-real-prof-')), {
    channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 }, locale: 'fr-FR',
    env: Object.assign({}, process.env, { LANGUAGE: 'fr', LANG: 'fr_FR.UTF-8' }),
    args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext, '--lang=fr-FR']
  });
  const logs = [];
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
    sw.on('console', (m) => logs.push(m.text()));
    await new Promise((r) => setTimeout(r, 800));
    await sw.evaluate((k) => chrome.storage.local.set({
      keys: [{ id: 'g', provider: k.p, label: k.p === 'groq' ? 'Groq' : 'Gemini', key: k.key, tier: 'free', enabled: true, modelEasy: k.m, order: 0 }],
      settings: { target: 'auto', mode: 'replace', explainTerms: false, translateComments: false, pageCap: 9000, batchChars: 6000, sensitiveExtra: [], autoSites: [], theme: 'system' }
    }), { key: KEY, p: PROVIDER, m: MODEL });
    const page = await ctx.newPage();
    async function run(url, name) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1500);
      const before = await page.evaluate(() => document.body.innerHTML);
      const codes = await page.evaluate(() => [...document.querySelectorAll('code, pre')].map((c) => c.textContent));
      const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({}))
        .filter((t) => t.url && t.url.startsWith(u))[0].id, url.split('?')[0].replace(/#.*$/, ''));
      await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'translate', null), tabId);
      await page.waitForFunction(() => {
        const h = document.querySelector('div[data-tr-ui]');
        const b = h && h.shadowRoot && h.shadowRoot.querySelector('.b');
        const m = b && b.querySelector('.msg').textContent;
        return b && (/\berr\b/.test(b.className) || /^(Traduit|Arrêté|Erreur|Rien à traduire|Aucune clé|Limite atteinte sur|Limite de \\d)/.test(m));
      }, null, { timeout: 300000, polling: 1000 }).catch(() => console.log('     (délai dépassé)'));
      const badge = await page.evaluate(() => {
        const m = document.querySelector('div[data-tr-ui]').shadowRoot.querySelector('.msg');
        return m.textContent + ' | ' + m.title;
      });
      console.log('     badge :', mask(badge));
      const codesAfter = await page.evaluate(() => [...document.querySelectorAll('code, pre')].map((c) => c.textContent));
      check(name + ' : code et blocs pre identiques', JSON.stringify(codes) === JSON.stringify(codesAfter), codes.length + ' éléments');
      const sample = await page.evaluate(() => [...document.querySelectorAll('main h1, article h1, main p, article p, article li')].filter((p) => p.textContent.trim().length > 30).slice(0, 6).map((p) => p.textContent.trim().replace(/\s+/g, ' ').slice(0, 260)));
      sample.forEach((s) => console.log('     « ' + s + ' »'));
      return { before, tabId, badge };
    }
    const SKIP_DEMO = process.env.DDT_TEST_SKIP_DEMO === '1';
    if (!SKIP_DEMO) {
    const r1 = await run('http://localhost:8124/', 'démo');
    check('démo : titre traduit', (await page.textContent('h1')) !== 'Getting started', await page.textContent('h1'));
    check('démo : aucun passage en échec', !/laissés en original|left in the original|Erreur/.test(r1.badge), mask(r1.badge));
    await page.screenshot({ path: path.join(ROOT, 'design', 'qa', `reel-${PROVIDER}-demo.png`) });
    await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'original', null), r1.tabId);
    await page.waitForTimeout(500);
    const restored = await page.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('div[data-tr-ui]').forEach((n) => n.remove()); return c.innerHTML; });
    check('démo : original identique après traduction réelle', restored === r1.before);
    }

    const r2 = await run('https://developer.mozilla.org/en-US/docs/Web/API/Window/alert', 'MDN');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ROOT, 'design', 'qa', `reel-${PROVIDER}-mdn.png`) });
    if (SHOTS) await page.screenshot({ path: path.join(ROOT, 'store', 'screenshots', '../../design/qa/reel-groq-mdn-boutique.png') });
    check('MDN : page traduite par la vraie IA', /^Traduit|^Limite de \d/.test(r2.badge), mask(r2.badge));

    const r3 = await run('https://github.com/sindresorhus/is-online', 'GitHub README');
    await page.evaluate(() => { const a = document.querySelector('article'); if (a) a.scrollIntoView(); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ROOT, 'design', 'qa', `reel-${PROVIDER}-github.png`) });
    if (SHOTS) await page.screenshot({ path: path.join(ROOT, 'store', 'screenshots', 'screenshot-5-github-reel.png') });
    check('GitHub : README traduit par la vraie IA', /^Traduit|^Limite de \d/.test(r3.badge), mask(r3.badge));
    const usage = await sw.evaluate(() => chrome.storage.local.get('usage').then((r) => r.usage));
    console.log('     requêtes utilisées :', JSON.stringify(usage && usage.perKey));
    const all = logs.join('\n');
    check('la clé n\'apparaît dans aucun journal', !all.includes(KEY));
  } catch (e) {
    check('scénario', false, mask(e && e.stack));
  } finally {
    await ctx.close();
    server.close();
  }
  console.log(`\n${results.filter(Boolean).length}/${results.length} vérifications réussies`);
})();
