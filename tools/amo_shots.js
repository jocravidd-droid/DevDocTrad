#!/usr/bin/env node
/*
 * Captures de la fiche addons.mozilla.org (AMO) : 8 images de 1280 x 800, avec un titre en anglais
 * (store/amo/en/) et en français (store/amo/fr/).
 *
 *   pkill -f fake_ollama ; python3 build.py && node tools/amo_shots.js
 *
 * - charge dist/chrome comme extension non empaquetée dans un vrai Chromium (copie de test : accès
 *   ajouté aux pages de démo et au faux Ollama, car l'automate ne peut pas cliquer sur la fenêtre
 *   de permission du navigateur) ;
 * - la page de démo tools/demo/index.html est servie à l'adresse fictive https://docs.example.com/…
 *   et une vidéo de tutoriel (fabriquée avec ffmpeg, sinon tools/demo/voice/clip.webm) à https://learn.example.com/… (interception Playwright :
 *   rien ne sort sur Internet) ;
 * - traductions par le faux Ollama (tools/fake_ollama.js) : aucune vraie IA, aucune vraie clé ;
 *   les adresses des fournisseurs (Gemini, Groq, Mistral, OpenRouter) sont bloquées par sécurité ;
 * - chaque capture brute est faite en résolution double (deviceScaleFactor 2), puis posée dans une
 *   composition HTML (fond de la marque, titre, fenêtre de navigateur) rendue à 1280 x 800 exactement.
 *
 * Variables : DDT_AMO_RAW=dossier garde les captures brutes ; DDT_CHROMIUM=chemin d'un autre Chromium.
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'chrome');
const OUT = path.join(ROOT, 'store', 'amo');
const RAW = process.env.DDT_AMO_RAW || fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-amo-raw-'));
fs.mkdirSync(RAW, { recursive: true });

/* ---------- Géométrie de la composition (1280 x 800) ---------- */
const W = 1280, H = 800;
const HEAD = 118;                       // bandeau de titre
const FX = 64, FW = W - 2 * FX;         // fenêtre : 1152 px de large
const FY = HEAD + 4, BAR = 40;          // barre d'adresse factice
const FH = H - FY - 26;                 // hauteur de la fenêtre
const VW = FW, VH = FH - BAR;           // taille de la page capturée (1:1 dans la composition)
const POPUP_W = 360;

const DOC_URL = 'https://docs.example.com/nimbus/getting-started';
const VIDEO_URL = 'https://learn.example.com/nimbus-in-10-seconds';

const KEYS = [
  { id: 'k-ollama', provider: 'ollama', label: 'Ollama', tier: 'local', enabled: true, modelEasy: 'demo-model:latest', baseUrl: 'http://127.0.0.1:11434', order: 0 },
  { id: 'k-groq', provider: 'groq', label: 'Groq', key: 'gsk_DEMO_NOT_A_REAL_KEY_000000000000', tier: 'free', enabled: true, modelEasy: 'llama-3.3-70b-versatile', order: 1 },
  { id: 'k-gemini', provider: 'gemini', label: 'Gemini', key: 'AIzaSy-DEMO-NOT-A-REAL-KEY-000000', tier: 'free', enabled: true, modelEasy: 'gemini-flash-latest', order: 2 }
];
const GLOSSARY = [
  { term: 'payload', type: 'never' },
  { term: 'Nimbus', type: 'never' },
  { term: 'buffer overflow', type: 'always', translation: 'dépassement de tampon' },
  { term: 'pull request', type: 'always', translation: 'demande de fusion' },
  { term: 'thread', type: 'always', translation: 'fil d’exécution' }
];
const BASE_SETTINGS = { target: 'auto', mode: 'replace', explainTerms: false, translateComments: false, pageCap: 150000, batchChars: 6000, sensitiveExtra: [], autoSites: [], theme: 'system' };

/* Thème sombre pour la page de démo (beaucoup de sites de documentation en ont un). */
const DARK_DOC_CSS = `:root{--ink:#e6edf3;--muted:#9198a1;--line:#30363d;--accent:#4493f8;--code:#262c36}
body{background:#0d1117}.note{background:#0f2a4d}pre{background:#010409;border:1px solid #30363d}th{background:#161b22}`;

const VOICE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Nimbus in 10 seconds</title>
<style>body{margin:0;font:16px/1.5 -apple-system,"Segoe UI",system-ui,sans-serif;background:#0f1115;color:#e8eaed}
header{display:flex;align-items:center;gap:12px;padding:12px 28px;border-bottom:1px solid #2a2e36}header b{font-size:17px}
header span{color:#9aa0a6;font-size:14px}main{width:820px;margin:18px auto 0}h1{font-size:22px;margin:0 0 12px}
video{width:820px;height:461px;display:block;border-radius:10px;background:#000}p{color:#9aa0a6;font-size:14px;margin:10px 0 0}</style></head>
<body><header><b>Nimbus Academy</b><span>Video tutorials</span></header><main><h1>Nimbus in 10 seconds</h1>
<video id="v" src="tutorial.webm" playsinline><track kind="subtitles" srclang="en" label="English" src="subs.en.vtt"></video>
<p>Lesson 1 · Installing the package · 0:10</p></main></body></html>`;

/* Image de la vidéo de démo : un écran de tutoriel (terminal + code), plus lisible qu'une mire. */
const SLIDE = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1280px;height:720px;overflow:hidden;font-family:"Inter",system-ui,sans-serif;color:#e6edf3;
background:linear-gradient(135deg,#131a33,#1b1240 60%,#0f2a3a)}
.t{position:absolute;left:80px;top:62px;font-size:44px;font-weight:700;letter-spacing:-.02em}.s{position:absolute;left:82px;top:124px;font-size:24px;color:#9fb0d8}
.term{position:absolute;left:80px;top:190px;width:1120px;height:300px;border-radius:16px;background:#0b0f19;border:1px solid #2a3350;box-shadow:0 20px 50px rgba(0,0,0,.45)}
.tb{height:40px;border-bottom:1px solid #222a40;display:flex;gap:9px;align-items:center;padding:0 18px}.tb i{width:13px;height:13px;border-radius:50%;background:#3a4360}
pre{margin:0;padding:26px 30px;font:30px/1.6 "JetBrains Mono",monospace;color:#c9d1d9}.p{color:#7ee787}.c{color:#8b949e}.k{color:#ff7b72}.q{color:#a5d6ff}
</style></head><body><div class="t">Nimbus HTTP · Lesson 1</div><div class="s">Install the package and create a client</div>
<div class="term"><div class="tb"><i></i><i></i><i></i></div><pre><span class="p">$</span> npm install nimbus-http
<span class="c">added 1 package in 2s</span>
<span class="k">import</span> { createClient } <span class="k">from</span> <span class="q">'nimbus-http'</span>;</pre></div></body></html>`;

/* Fabrique tutorial.webm (10 s) avec ffmpeg ; sans ffmpeg, la vidéo de test tools/demo/voice/clip.webm sert. */
async function makeTutorialVideo() {
  const out = path.join(RAW, 'tutorial.webm');
  const png = path.join(RAW, 'tutorial-slide.png');
  const b = await chromium.launch(process.env.DDT_CHROMIUM ? { executablePath: process.env.DDT_CHROMIUM } : {});
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(SLIDE);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: png });
  await b.close();
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '5', '-i', png, '-t', '10', '-g', '5',
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-b:v', '0', '-crf', '28', out]);
  if (r.status === 0 && fs.existsSync(out)) return out;
  console.log('ffmpeg indisponible : vidéo de test clip.webm utilisée');
  return path.join(__dirname, 'demo', 'voice', 'clip.webm');
}

/* ---------- Textes des bandeaux ---------- */
const SHOTS = [
  { file: '01-traduction', url: DOC_URL,
    en: ['Docs translated. Code untouched.', 'Here into French: commands, function names and URLs stay exactly as written.'],
    fr: ['La doc traduite, le code intact', 'Commandes, noms de fonctions et URL restent exactement tels quels.'] },
  { file: '02-bilingue', url: DOC_URL,
    en: ['Bilingual mode', 'The translation appears under each original sentence.'],
    fr: ['Mode bilingue', 'La traduction s’affiche sous chaque phrase d’origine.'] },
  { file: '03-popup', url: DOC_URL, popup: true,
    en: ['Everything in one click', 'Translate, switch back to the original, choose the language or the key.'],
    fr: ['Tout en un clic', 'Traduire, revenir à l’original, choisir la langue ou la clé.'] },
  { file: '04-voix-videos', url: VIDEO_URL,
    en: ['Video voice, translated', 'Subtitles translated live on the video. No subtitles? Free Groq Whisper transcription.'],
    fr: ['La voix des vidéos traduite', 'Sous-titres traduits en direct sur la vidéo. Sans sous-titres : transcription gratuite Groq Whisper.'] },
  { file: '05-russe', url: DOC_URL,
    en: ['Your browser’s language, automatically', 'Here in Russian. 37 target languages, interface in 36 languages.'],
    fr: ['La langue de ton navigateur, automatiquement', 'Ici en russe. 37 langues cibles, interface en 36 langues.'] },
  { file: '06-cles', url: 'chrome-extension://devdoctrad/options.html#keys',
    en: ['Your own free keys', 'Gemini, Groq, Mistral, OpenRouter or local Ollama. Keys stay in your browser.'],
    fr: ['Tes propres clés gratuites', 'Gemini, Groq, Mistral, OpenRouter ou Ollama en local. Les clés restent dans ton navigateur.'] },
  { file: '07-glossaire', url: 'chrome-extension://devdoctrad/options.html#glossary',
    en: ['Your personal glossary', 'Terms never translated, or always translated the same way.'],
    fr: ['Ton glossaire personnel', 'Des termes jamais traduits, ou toujours traduits de la même façon.'] },
  { file: '08-theme-sombre', url: DOC_URL, popup: true, dark: true,
    en: ['Dark theme', 'Popup, badge and settings follow your system theme.'],
    fr: ['Thème sombre', 'Le popup, le badge et les réglages suivent le thème du système.'] }
];

/* ---------- Extension et serveurs de test ---------- */
function prepareExtension() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-amo-ext-'));
  fs.cpSync(DIST, tmp, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  mf.host_permissions.push('http://localhost:11434/*', 'http://127.0.0.1:11434/*', 'https://*.example.com/*');
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(mf, null, 2));
  return tmp;
}

async function routeDemo(ctx, video) {
  const doc = fs.readFileSync(path.join(__dirname, 'demo', 'index.html'));
  const vdir = path.join(__dirname, 'demo', 'voice');
  await ctx.route('https://docs.example.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: doc }));
  await ctx.route('https://learn.example.com/**', (r) => {
    const u = new URL(r.request().url());
    const name = path.basename(u.pathname);
    if (name === 'tutorial.webm' || name === 'subs.en.vtt') {
      const buf = fs.readFileSync(name === 'tutorial.webm' ? video : path.join(vdir, name));
      const type = name.endsWith('.vtt') ? 'text/vtt' : 'video/webm';
      const m = /bytes=(\d*)-(\d*)/.exec(r.request().headers().range || '');
      if (!m) return r.fulfill({ status: 200, contentType: type, headers: { 'Accept-Ranges': 'bytes' }, body: buf });
      const start = m[1] ? +m[1] : 0;
      const end = m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
      return r.fulfill({ status: 206, contentType: type, body: buf.subarray(start, end + 1),
        headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${buf.length}` } });
    }
    return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: VOICE_PAGE });
  });
  // Aucune requête réelle vers les fournisseurs : les clés de démonstration sont factices.
  for (const host of ['generativelanguage.googleapis.com', 'api.groq.com', 'api.mistral.ai', 'openrouter.ai']) {
    await ctx.route(`https://${host}/**`, (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"demo"}' }));
  }
}

async function launch(ext, lang, video) {
  const loc = lang === 'ru' ? 'ru-RU' : 'fr-FR';
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-amo-prof-')), {
    channel: process.env.DDT_CHROMIUM ? undefined : 'chromium', executablePath: process.env.DDT_CHROMIUM || undefined,
    headless: !process.env.DDT_HEADFUL,
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 2,
    locale: loc,
    env: Object.assign({}, process.env, { LANGUAGE: lang, LANG: loc.replace('-', '_') + '.UTF-8', LC_ALL: loc.replace('-', '_') + '.UTF-8' }),
    args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext, '--lang=' + loc, '--accept-lang=' + loc + ',' + lang,
      '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars']
  });
  await routeDemo(ctx, video);
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = sw.url().split('/')[2];
  // attendre la fin de onInstalled (qui écrit les réglages par défaut), sinon il écrase les nôtres
  await sw.evaluate(async () => { for (let i = 0; i < 50; i++) { const r = await chrome.storage.local.get('settings'); if (r.settings) return; await new Promise((ok) => setTimeout(ok, 100)); } });
  await sw.evaluate(([k, s, g]) => chrome.storage.local.set({ keys: k, settings: s, glossary: g }), [KEYS, BASE_SETTINGS, GLOSSARY]);
  const ui = await sw.evaluate(() => chrome.i18n.getUILanguage());
  console.log(`Chromium ${lang} : langue de l'interface ${ui}`);
  return { ctx, sw, id, ui };
}

const setSettings = (sw, patch) => sw.evaluate((p) => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign(r.settings, p) })), patch);

async function waitBadge(page, timeout = 30000) {
  const badge = () => page.evaluate(() => { const h = document.querySelector('div[data-tr-ui]'); return h && h.shadowRoot ? h.shadowRoot.querySelector('.row').textContent : '(aucun badge)'; });
  await page.waitForFunction(() => {
    const h = document.querySelector('div[data-tr-ui]');
    const m = h && h.shadowRoot && h.shadowRoot.querySelector('.msg');
    return m && /Traduit|Translated|Переведено/.test(m.textContent);
  }, null, { timeout }).catch(async (e) => { throw new Error('page non traduite, badge : ' + await badge()); });
  await page.waitForTimeout(700);   // fin des animations du badge
}

/* Faux Ollama : relancé s'il ne répond plus (un autre script de test a pu l'arrêter entre-temps). */
let ollama = null;
const ollamaUp = () => new Promise((ok) => {
  const req = http.get('http://127.0.0.1:11434/api/tags', (res) => { res.resume(); ok(res.statusCode === 200); });
  req.on('error', () => ok(false));
  req.setTimeout(1500, () => { req.destroy(); ok(false); });
});
async function ensureOllama() {
  if (await ollamaUp()) return;
  if (ollama) ollama.kill();
  ollama = spawn(process.execPath, [path.join(__dirname, 'fake_ollama.js')], { stdio: 'ignore' });
  for (let i = 0; i < 30 && !(await ollamaUp()); i++) await new Promise((r) => setTimeout(r, 200));
}

async function translatedDoc(ctx, sw, opts = {}, attempt = 1) {
  await ensureOllama();
  const page = await ctx.newPage();
  await page.emulateMedia({ colorScheme: opts.dark ? 'dark' : 'light' });
  await page.goto(DOC_URL);
  if (opts.dark) await page.addStyleTag({ content: DARK_DOC_CSS });
  const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u }))[0].id, DOC_URL);
  await sw.evaluate((t) => self.__DDT_BG.tabCommand(t, 'translate', null), tabId);
  try {
    await waitBadge(page);
  } catch (e) {
    await page.close();
    if (attempt >= 3) throw e;
    console.log('nouvel essai : ' + e.message);
    return translatedDoc(ctx, sw, opts, attempt + 1);
  }
  return page;
}

async function popupShot(ctx, id, name, scheme) {
  const p = await ctx.newPage();
  await p.emulateMedia({ colorScheme: scheme });
  await p.setViewportSize({ width: POPUP_W, height: 600 });
  await p.addInitScript((url) => {
    const q = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (o) => (o && o.active ? q({ url }) : q(o));
  }, 'https://docs.example.com/*');
  await p.goto(`chrome-extension://${id}/popup.html`);
  await p.waitForTimeout(1200);
  const h = await p.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
  await p.setViewportSize({ width: POPUP_W, height: Math.min(600, h) });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(RAW, name) });
  await p.close();
}

async function rawShots() {
  const ext = prepareExtension();
  const video = await makeTutorialVideo();
  await ensureOllama();
  try {
    /* --- Navigateur en français --- */
    const { ctx, sw, id } = await launch(ext, 'fr', video);
    // 1. Page traduite (remplacer)
    let page = await translatedDoc(ctx, sw);
    const code = await page.evaluate(() => [...document.querySelectorAll('main code')].map((c) => c.textContent).join(' | '));
    if (!/npm install nimbus-http/.test(code)) throw new Error('code modifié : ' + code);
    await page.screenshot({ path: path.join(RAW, '01-doc-fr.png') });
    // 3. Popup ouvert sur la page traduite (thème clair) ; le badge, caché par le popup, est masqué
    await page.evaluate(() => { document.querySelector('div[data-tr-ui]').style.visibility = 'hidden'; });
    await page.screenshot({ path: path.join(RAW, '03-doc-fr-sans-badge.png') });
    await popupShot(ctx, id, '03-popup-light.png', 'light');
    await page.close();
    // 2. Bilingue
    await setSettings(sw, { mode: 'bilingual' });
    page = await translatedDoc(ctx, sw);
    await page.screenshot({ path: path.join(RAW, '02-doc-bilingue.png') });
    await page.close();
    await setSettings(sw, { mode: 'replace' });
    // 8. Thème sombre : page sombre + popup sombre
    page = await translatedDoc(ctx, sw, { dark: true });
    await page.screenshot({ path: path.join(RAW, '08-doc-dark.png') });
    await popupShot(ctx, id, '08-popup-dark.png', 'dark');
    await page.close();
    // 4. Voix des vidéos (sous-titres de la vidéo traduits, mode bilingue)
    await setSettings(sw, { mode: 'bilingual' });
    await ensureOllama();
    page = await ctx.newPage();
    await page.goto(VIDEO_URL);
    await page.waitForFunction(() => { const v = document.getElementById('v'); return v && v.readyState >= 2; }, null, { timeout: 15000 });
    const vtab = await sw.evaluate(async () => (await chrome.tabs.query({ url: 'https://learn.example.com/*' }))[0].id);
    const vst = await sw.evaluate((t) => self.__DDT_BG.voiceCommand(t, 'start', null), vtab);
    if (!vst || !vst.active) throw new Error('voix non démarrée : ' + JSON.stringify(vst));
    await page.evaluate(() => { const v = document.getElementById('v'); v.currentTime = 0; return v.play(); }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const v = document.getElementById('v'); v.pause(); v.currentTime = 4.6; });
    const deadline = Date.now() + 30000;
    let sub = '';
    while (Date.now() < deadline) {
      sub = await page.evaluate(() => { const h = document.querySelector('div[data-tr-ui="voice"]'); return h && h.shadowRoot ? h.shadowRoot.querySelector('.tr').textContent : ''; });
      if (/Commence par installer/.test(sub)) break;
      await page.waitForTimeout(200);
    }
    if (!/Commence par installer/.test(sub)) throw new Error('sous-titre traduit absent : ' + sub);
    await page.mouse.move(VW - 5, 5);       // souris hors de la vidéo : la barre de la voix reste discrète
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(RAW, '04-voix.png') });
    await sw.evaluate((t) => self.__DDT_BG.voiceCommand(t, 'stop', null), vtab);
    await page.close();
    await setSettings(sw, { mode: 'replace' });
    // 6. Réglages : clés (factices, masquées) ; la carte Groq en premier pour montrer une clé masquée
    const order = { groq: 0, gemini: 1, ollama: 2 };
    await sw.evaluate((k) => chrome.storage.local.set({ keys: k }), KEYS.map((k) => Object.assign({}, k, { order: order[k.provider] })).sort((a, b) => a.order - b.order));
    const opt = await ctx.newPage();
    await opt.emulateMedia({ colorScheme: 'light' });
    await opt.goto(`chrome-extension://${id}/options.html#keys`);
    await opt.waitForTimeout(1200);
    const masked = await opt.evaluate(() => [...document.querySelectorAll('[data-f=key]')].every((i) => i.type === 'password' || i.classList.contains('masked')));
    if (!masked) throw new Error('une clé est affichée en clair');
    await opt.screenshot({ path: path.join(RAW, '06-cles.png') });
    // 7. Glossaire
    await opt.goto(`chrome-extension://${id}/options.html#glossary`);
    await opt.reload();
    await opt.waitForTimeout(1200);
    await opt.screenshot({ path: path.join(RAW, '07-glossaire.png') });
    await opt.close();
    await ctx.close();

    /* --- Navigateur en russe : la langue cible « auto » suit le navigateur --- */
    const ru = await launch(ext, 'ru', video);
    if (!/^ru/.test(ru.ui)) await setSettings(ru.sw, { target: 'ru' });   // Chromium sans paquet de langue russe
    // seul le faux Ollama traduit ici (les autres clés, factices, ne servent qu'à l'affichage)
    await ru.sw.evaluate((k) => chrome.storage.local.set({ keys: k }), KEYS.map((k) => Object.assign({}, k, { enabled: k.provider === 'ollama' })));
    page = await translatedDoc(ru.ctx, ru.sw);
    await page.screenshot({ path: path.join(RAW, '05-doc-ru.png') });
    await ru.ctx.close();
  } finally {
    if (ollama) ollama.kill();
  }
}

/* ---------- Composition ---------- */
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function compose(shot, lang, raw) {
  const [title, sub] = shot[lang];
  const dark = !!shot.dark || /voix/.test(shot.file);
  const logo = fs.readFileSync(path.join(ROOT, 'design', 'logo', 'devdoctrad-symbol.svg'), 'utf8').replace(/<title>[^<]*<\/title>/, '');
  const icon = b64(path.join(DIST, 'icons', 'icon-32.png'));
  const url = shot.url.replace(/^chrome-extension:\/\/devdoctrad\//, 'DevDocTrad · ');
  const popup = raw.popup ? `<div class="popup"><img src="${b64(raw.popup)}"></div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;font-family:"Inter","Inter Display",system-ui,sans-serif;color:#eef0ff;
background:#0a0e24;background-image:radial-gradient(70% 90% at 0% 0%,rgba(47,90,220,.55),transparent 65%),
radial-gradient(60% 80% at 100% 0%,rgba(110,70,220,.45),transparent 65%),radial-gradient(70% 70% at 60% 115%,rgba(20,150,170,.35),transparent 70%)}
.head{position:absolute;left:${FX}px;right:${FX}px;top:0;height:${HEAD}px;display:flex;align-items:center;gap:18px}
.head svg{width:54px;height:54px;flex:none;filter:drop-shadow(0 6px 14px rgba(47,107,255,.45))}
h1{margin:0;font-family:"Inter Display","Inter",sans-serif;font-size:35px;font-weight:700;letter-spacing:-.02em;line-height:1.1;white-space:nowrap}
p{margin:6px 0 0;font-size:18px;line-height:1.3;color:#c6ccf0;white-space:nowrap}
.win{position:absolute;left:${FX}px;top:${FY}px;width:${FW}px;height:${FH}px;border-radius:14px;overflow:hidden;
box-shadow:0 28px 70px rgba(0,0,0,.55),0 0 0 1px rgba(170,190,255,.22)}
.bar{height:${BAR}px;display:flex;align-items:center;gap:8px;padding:0 14px;background:${dark ? '#1d2130' : '#eceff4'};border-bottom:1px solid ${dark ? '#2c3142' : '#d5dae3'}}
.dot{width:12px;height:12px;border-radius:50%;background:${dark ? '#3a4054' : '#c9ced8'}}
.url{margin-left:14px;flex:1;height:26px;border-radius:13px;background:${dark ? '#2a2f42' : '#fff'};color:${dark ? '#c9cede' : '#4a5160'};
font-size:13.5px;display:flex;align-items:center;padding:0 14px;gap:8px}
.url i{width:10px;height:12px;border:2px solid currentColor;border-radius:3px;opacity:.6}
.ext{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;${raw.popup ? `background:${dark ? '#363c52' : '#d9dee8'}` : ''}}
.ext img{width:18px;height:18px}
.page{display:block;width:${VW}px;height:${VH}px}
.popup{position:absolute;top:${FY + BAR + 6}px;right:${W - FX - FW + 12}px;width:${POPUP_W}px;border-radius:14px;overflow:hidden;
box-shadow:0 22px 60px rgba(0,0,0,.45),0 0 0 1px ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.10)'}}
.popup img{display:block;width:${POPUP_W}px}
</style></head><body>
<div class="head">${logo}<div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div></div>
<div class="win"><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
<div class="url">${/^https/.test(shot.url) ? '<i></i>' : ''}${esc(url)}</div><div class="ext"><img src="${icon}"></div></div>
<img class="page" src="${b64(raw.page)}"></div>${popup}</body></html>`;
}

async function composeAll() {
  const rawFor = {
    '01-traduction': { page: '01-doc-fr.png' },
    '02-bilingue': { page: '02-doc-bilingue.png' },
    '03-popup': { page: '03-doc-fr-sans-badge.png', popup: '03-popup-light.png' },
    '04-voix-videos': { page: '04-voix.png' },
    '05-russe': { page: '05-doc-ru.png' },
    '06-cles': { page: '06-cles.png' },
    '07-glossaire': { page: '07-glossaire.png' },
    '08-theme-sombre': { page: '08-doc-dark.png', popup: '08-popup-dark.png' }
  };
  const b = await chromium.launch(process.env.DDT_CHROMIUM ? { executablePath: process.env.DDT_CHROMIUM } : {});
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const lang of ['en', 'fr']) {
    fs.mkdirSync(path.join(OUT, lang), { recursive: true });
    for (const s of SHOTS) {
      const r = rawFor[s.file];
      const raw = { page: path.join(RAW, r.page), popup: r.popup && path.join(RAW, r.popup) };
      await p.setContent(compose(s, lang, raw));
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(150);
      const over = await p.evaluate(() => [...document.querySelectorAll('h1,p')].some((e) => e.getBoundingClientRect().right > 1280 - 40));
      if (over) throw new Error(`titre trop long (${lang}) : ${s.file}`);
      const out = path.join(OUT, lang, s.file + '.png');
      await p.screenshot({ path: out });
      console.log(path.relative(ROOT, out));
    }
  }
  await b.close();
}

(async () => {
  if (!process.env.DDT_AMO_COMPOSE_ONLY) await rawShots();
  await composeAll();
  console.log('Captures brutes : ' + RAW);
})().catch((e) => { console.error(e); process.exit(1); });
