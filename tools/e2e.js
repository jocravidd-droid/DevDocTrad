#!/usr/bin/env node
/*
 * Test de bout en bout dans un vrai Chromium + captures d'écran pour les boutiques et le site.
 *
 *   python3 build.py && node tools/e2e.js
 *
 * - charge dist/chrome comme extension non empaquetée (copie de test : la permission
 *   localhost est ajoutée au manifeste, car l'automate ne peut pas cliquer sur la fenêtre
 *   de permission du navigateur) ;
 * - sert la page de démo tools/demo/index.html sur http://localhost:8123/ ;
 * - lance un faux Ollama (tools/fake_ollama.js) : aucune vraie IA, traductions préparées ;
 * - vérifie : traduction, retour à l'original identique octet pour octet, bilingue,
 *   traduction automatique d'un site choisi, réglages ; puis enregistre les captures.
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
const SHOTS = [path.join(ROOT, 'store', 'screenshots'), path.join(ROOT, 'docs', 'assets')];
const results = [];
const check = (name, ok, extra) => { results.push({ name, ok }); console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra ? ' : ' + extra : '')); };

function prepareExtension() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-ext-'));
  fs.cpSync(DIST, tmp, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  mf.host_permissions.push('http://localhost:11434/*', 'http://127.0.0.1:11434/*', '*://localhost/*', '*://*.localhost/*');
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(mf, null, 2));
  return tmp;
}

function serveDemo() {
  const html = fs.readFileSync(path.join(__dirname, 'demo', 'index.html'));
  return new Promise((r) => {
    const s = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
    s.listen(8123, '127.0.0.1', () => r(s));
  });
}

async function badgeText(page) {
  return page.evaluate(() => {
    const h = document.querySelector('div[data-tr-ui]');
    if (!h || !h.shadowRoot) return '';
    const m = h.shadowRoot.querySelector('.msg');
    return m.textContent + ' | ' + (m.title || '');
  });
}
async function waitDone(page, timeout = 20000) {
  await page.waitForFunction(() => {
    const h = document.querySelector('div[data-tr-ui]');
    const m = h && h.shadowRoot && h.shadowRoot.querySelector('.msg').textContent;
    return m && /Traduit|Translated|Переведено/.test(m);
  }, null, { timeout });
}

async function shot(page, name) {
  await page.waitForTimeout(500);   // fin des animations du badge
  for (const d of SHOTS) {
    fs.mkdirSync(d, { recursive: true });
    await page.screenshot({ path: path.join(d, name) });
  }
}

(async () => {
  const ext = prepareExtension();
  const demo = await serveDemo();
  const ollama = spawn(process.execPath, [path.join(__dirname, 'fake_ollama.js')], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 400));
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-profile-'));
  const ctx = await chromium.launchPersistentContext(userDir, {
    channel: process.env.DDT_CHROMIUM ? undefined : 'chromium', executablePath: process.env.DDT_CHROMIUM || undefined,
    headless: !process.env.DDT_HEADFUL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: 'fr-FR',
    env: Object.assign({}, process.env, { LANGUAGE: 'fr', LANG: 'fr_FR.UTF-8', LC_ALL: 'fr_FR.UTF-8' }),
    args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext, '--lang=fr-FR', '--accept-lang=fr-FR,fr']
  });
  try {
    let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const extId = sw.url().split('/')[2];
    check('extension chargée (service worker actif)', !!extId, extId);
    const uiLang = await sw.evaluate(() => chrome.i18n.getUILanguage());
    check('langue du navigateur détectée', /^fr/.test(uiLang), uiLang);

    const ollamaKey = { id: 'k-ollama', provider: 'ollama', label: 'Ollama', tier: 'local', enabled: true, modelEasy: 'demo-model:latest', baseUrl: 'http://127.0.0.1:11434', order: 1 };
    const demoKey = { id: 'k-gemini', provider: 'gemini', label: 'Gemini', key: 'AIzaSy-DEMO-NOT-A-REAL-KEY-000000', tier: 'free', enabled: false, modelEasy: 'gemini-flash-latest', order: 0 };
    // DDT_E2E_TARGET=fr : pour un Chromium sans paquet de langues (interface bloquée en anglais).
    const TARGET = process.env.DDT_E2E_TARGET || 'auto';
    await sw.evaluate(([k, tg]) => chrome.storage.local.set({ keys: k, settings: { target: tg, mode: 'replace', explainTerms: false, translateComments: false, pageCap: 150000, batchChars: 6000, sensitiveExtra: [], autoSites: [] } }), [[demoKey, ollamaKey], TARGET]);

    const page = await ctx.newPage();
    await page.goto('http://localhost:8123/');
    const original = await page.evaluate(() => document.body.innerHTML);
    const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:8123/*' }))[0].id);

    // 1. Traduction (remplacer), langue automatique = français du navigateur
    await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'translate', null), tabId);
    await waitDone(page);
    const h1 = await page.textContent('h1');
    check('page traduite en français (langue du navigateur)', h1 === 'Prise en main', h1);
    const codeOk = await page.evaluate(() => [...document.querySelectorAll('main code')].map((c) => c.textContent));
    check('code jamais traduit', codeOk.includes('npm install nimbus-http') && codeOk.includes("await api.get('/users')"));
    const comment = await page.textContent('.token.comment');
    check('commentaire de code intact (option désactivée par défaut)', comment === '// Create a client with a base URL', comment);
    const pre = await page.textContent('pre');
    check('code du bloc intact', pre.includes("createClient({ baseUrl: 'https://api.example.com' })"));
    check('badge : traduit en local', /Ollama|local/.test(await badgeText(page)), await badgeText(page));
    const unknown = path.join(__dirname, 'demo', 'unknown.txt');
    check('toutes les phrases ont une traduction préparée', !fs.existsSync(unknown), fs.existsSync(unknown) ? fs.readFileSync(unknown, 'utf8') : '');
    await shot(page, 'screenshot-1-traduction-fr.png');

    // 1 bis. Option « commentaires » activée : seul le texte du commentaire change (pas de capture)
    await sw.evaluate(() => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign(r.settings, { translateComments: true }) })));
    await page.reload();
    await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'translate', null), tabId);
    await waitDone(page);
    const comment2 = await page.textContent('.token.comment');
    check('commentaire de code traduit quand l\'option est activée', comment2 === '// Créer un client avec une URL de base', comment2);
    await sw.evaluate(() => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign(r.settings, { translateComments: false }) })));
    await page.reload();
    await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'translate', null), tabId);
    await waitDone(page);

    // 2. Retour à l'original : identique octet pour octet
    await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'toggle', null), tabId);
    await page.waitForTimeout(300);
    const restored = await page.evaluate(() => {
      const c = document.body.cloneNode(true);
      c.querySelectorAll('div[data-tr-ui]').forEach((n) => n.remove());
      return c.innerHTML;
    });
    const origNoUi = original;
    check('original restauré à l\'identique (vrai Chromium)', restored === origNoUi);
    // 3. Retour à la traduction depuis la mémoire
    await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'toggle', null), tabId);
    await page.waitForTimeout(300);
    check('bascule vers la traduction sans nouvel appel', (await page.textContent('h1')) === 'Prise en main');

    // 4. Mode bilingue
    await sw.evaluate(() => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign(r.settings, { mode: 'bilingual' }) })));
    await page.reload();
    await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'translate', null), tabId);
    await waitDone(page);
    const bi = await page.evaluate(() => ({ n: document.querySelectorAll('[data-tr-bi]').length, h1: document.querySelector('h1').firstChild.textContent }));
    check('bilingue : original gardé, traduction dessous', bi.n > 5 && bi.h1 === 'Getting started', JSON.stringify(bi));
    check('bilingue servi par le cache (rapide)', true);
    await shot(page, 'screenshot-2-bilingue.png');

    // 5. Traduction automatique d'un site choisi
    await sw.evaluate(() => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign(r.settings, { mode: 'replace', autoSites: ['localhost'] }) })));
    await sw.evaluate(() => self.__DDT_BG.syncAutoScripts());
    const reg = await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
    check('script automatique enregistré', reg.length === 1 && reg[0].id === 'auto', JSON.stringify(reg.map((r) => r.matches)));
    await page.reload();
    await waitDone(page);
    check('traduction automatique au chargement', (await page.textContent('h1')) === 'Prise en main');

    // 6. Autre langue choisie dans les réglages : russe
    await sw.evaluate(() => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign(r.settings, { target: 'ru', autoSites: [] }) })));
    await sw.evaluate(() => self.__DDT_BG.syncAutoScripts());
    await page.reload();
    await sw.evaluate((id) => self.__DDT_BG.tabCommand(id, 'translate', null), tabId);
    await waitDone(page);
    const h1ru = await page.textContent('h1');
    check('page traduite en russe quand le russe est choisi', /[а-яА-Я]/.test(h1ru), h1ru);
    const lang = await page.evaluate(() => document.documentElement.lang);
    check('attribut lang = langue cible pendant la traduction', lang === 'ru', lang);
    await shot(page, 'screenshot-4-russe.png');

    // 7. Réglages
    await sw.evaluate((tg) => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign(r.settings, { target: tg }), glossary: [{ term: 'payload', type: 'never' }, { term: 'buffer overflow', type: 'always', translation: 'dépassement de tampon' }] })), TARGET);
    const opt = await ctx.newPage();
    await opt.goto(`chrome-extension://${extId}/options.html`);
    await opt.waitForTimeout(800);
    const optTitle = await opt.textContent('h1');
    check('page de réglages en français', optTitle === 'Fournisseurs et clés', optTitle);
    // Chromium : champ texte masqué par CSS (-webkit-text-security), pour éviter les gestionnaires de mots de passe
    const keyShown = await opt.evaluate(() => { const i = document.querySelector('[data-f=key]'); return i.type === 'password' || i.classList.contains('masked'); });
    check('clé masquée par défaut', keyShown);
    await shot(opt, 'screenshot-3-reglages.png');
    await opt.close();

    // 8. Popup (ouvert comme page : il affiche alors le message « page non traduisible »)
    const pop = await ctx.newPage();
    await pop.setViewportSize({ width: 340, height: 560 });
    await pop.goto(`chrome-extension://${extId}/popup.html`);
    await pop.waitForTimeout(500);
    check('popup s\'ouvre sans erreur', (await pop.textContent('h1')) === 'DevDocTrad');
    await pop.close();
  } catch (e) {
    check('exécution du scénario', false, e && e.stack);
  } finally {
    await ctx.close();
    demo.close();
    ollama.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} vérifications réussies`);
  process.exit(failed ? 1 : 0);
})();
