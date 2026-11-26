#!/usr/bin/env node
/*
 * Contrôle de mise en page du popup dans les 36 langues de l'interface (facultatif, hors npm test).
 * Ouvre src/popup.html dans Chromium (Playwright) avec une fausse API chrome (i18n lu dans
 * src/_locales/<langue>/messages.json, repli anglais), puis vérifie pour chaque langue et chaque
 * situation :
 *   - hauteur du popup ≤ 600 px (au-delà, le navigateur ajoute une barre de défilement) ;
 *   - le bouton Stop ne chevauche pas le segment Original/Traduction ;
 *   - rien ne déborde à droite des 360 px.
 * Lancer : node tools/popup_layout.js [de fi el ...] ; DDT_SHOTS=<dossier> pour garder des captures,
 * DDT_THEMES=light,dark pour les deux thèmes (clair seulement par défaut), DDT_HOST=docs.example.com
 * pour un site ordinaire (par défaut, un site « sensible » : la note ajoutée en fait le cas le plus haut).
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const LOCALES = path.join(SRC, '_locales');
const BASE = 'http://ddt.test/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

const load = (l) => JSON.parse(fs.readFileSync(path.join(LOCALES, l, 'messages.json'), 'utf8'));
const EN = load('en');
const RTL = new Set(['ar', 'he', 'fa']);

/* Situations les plus chargées : 3 clés (2 listées + « autres »), raccourci, note « site sensible » */
function scenarios(msg) {
  const m = (k, subs) => {
    let s = (msg[k] || EN[k]).message;
    (subs || []).forEach((v, i) => { s = s.replace('{' + i + '}', v); });
    return s;
  };
  const longest = ['badgeRateLimited', 'badgeRateGiveUp', 'badgeCap', 'badgeNoKey', 'badgeNothing', 'badgeDoneFailed']
    .map((k) => m(k, ['150 000', '3']))
    .sort((a, b) => b.length - a.length)[0];
  const providerError = m('badgeError', [m('errOllamaOrigin', ['403']) || 'HTTP 500']);
  return [
    { name: 'en-cours', status: { state: 'running', done: 12, total: 48, showing: 'translated' } },
    { name: 'en-pause', status: { state: 'paused', done: 12, total: 48, showing: 'translated', message: longest } },
    { name: 'erreur', status: { state: 'error', done: 30, total: 48, failed: 2, showing: 'translated', message: providerError } },
    { name: 'payantes', status: null, paidOnly: true }
  ];
}

function keysFor(paidOnly) {
  const k = (id, label, tier, extra) => Object.assign({ id, provider: 'groq', label, tier, enabled: true, configured: true, available: true, requests: 140, maxPerDay: 1000, until: null }, extra || {});
  if (paidOnly) return [k('p1', 'Mistral (payante)', 'paid', { provider: 'mistral' })];
  return [k('k1', 'Gemini Flash personnelle', 'free', { provider: 'gemini' }), k('k2', 'Groq Llama 3.3 70B', 'free', { available: false, until: Date.now() + 25 * 60000 }),
    k('k3', 'Ollama', 'local', { provider: 'ollama', maxPerDay: 0 })];
}

/* Fausse API chrome injectée avant les scripts du popup */
function fakeChrome([lang, messages, en, rtl, state, status]) {
  const get = (k) => (messages[k] || en[k] || {}).message || '';
  const store = { settings: state.settings };
  window.chrome = {
    i18n: { getMessage: (k) => (k === '@@bidi_dir' ? (rtl ? 'rtl' : 'ltr') : get(k)), getUILanguage: () => lang.replace('_', '-') },
    runtime: {
      sendMessage: (m) => Promise.resolve(m.type === 'getState' ? state : m.type === 'voiceCommand' ? { active: false } : { ok: true }),
      openOptionsPage: () => {}, getManifest: () => ({ version: '1.1.0' })
    },
    tabs: {
      query: () => Promise.resolve([{ id: 7, url: state.url }]),
      sendMessage: () => (status ? Promise.resolve(status) : Promise.reject(new Error('pas de script')))
    },
    storage: {
      local: { get: () => Promise.resolve(JSON.parse(JSON.stringify(store))), set: () => Promise.resolve(), remove: () => Promise.resolve() },
      onChanged: { addListener: () => {} }
    },
    commands: { getAll: () => Promise.resolve([{ name: 'toggle-translation', shortcut: 'Alt+Shift+T' }]) },
    action: { setBadgeText: () => {}, setTitle: () => {} },
    permissions: { request: () => Promise.resolve(true) }
  };
}

function overlap(a, b) {
  return a && b && a.width && b.width && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

(async () => {
  const only = process.argv.slice(2);
  const langs = fs.readdirSync(LOCALES).filter((l) => !only.length || only.includes(l)).sort();
  const themes = (process.env.DDT_THEMES || 'light').split(',');
  const shots = process.env.DDT_SHOTS;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.DDT_CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 600 }, deviceScaleFactor: shots ? 2 : 1 });
  await ctx.route(BASE + '**', (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
    const file = path.join(SRC, rel);
    if (!file.startsWith(SRC) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const failures = [];
  let maxH = { h: 0 };
  for (const lang of langs) {
    const messages = load(lang);
    for (const sc of scenarios(messages)) {
      for (const theme of themes) {
        const page = await ctx.newPage();
        await page.emulateMedia({ colorScheme: theme });
        // site « sensible » par défaut (note en plus : cas le plus haut) ; DDT_HOST pour un site ordinaire
        const url = 'https://' + (process.env.DDT_HOST || 'banking.example.com') + '/docs/api/reference/getting-started';
        const state = { url, keys: keysFor(sc.paidOnly), settings: { target: 'auto', autoSites: [], theme: 'system', sensitiveExtra: [] } };
        await page.addInitScript(fakeChrome, [lang, messages, EN, RTL.has(lang), state, sc.status]);
        await page.goto(BASE + 'popup.html');
        await page.waitForTimeout(450);   // animations d'entrée (320 ms) et premier état
        const r = await page.evaluate(() => {
          const rect = (el) => { if (!el || el.hidden || !el.offsetParent) return null; const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width }; };
          const de = document.documentElement;
          return {
            h: Math.ceil(document.body.getBoundingClientRect().bottom + window.scrollY),
            w: de.scrollWidth,
            seg: rect(document.querySelector('.controls .seg')),
            // les libellés peuvent déborder du segment (min-width) : on mesure chaque capsule
            segParts: Array.from(document.querySelectorAll('.controls .seg label > span')).map(rect),
            segOverflow: (() => { const s = document.querySelector('.controls .seg'); return s.scrollWidth > s.clientWidth + 1; })(),
            stop: rect(document.getElementById('stop')),
            status: document.getElementById('status').textContent
          };
        });
        const problems = [];
        if (r.h > 600) problems.push('hauteur ' + r.h + ' px');
        if (r.w > 360) problems.push('largeur ' + r.w + ' px');
        if (overlap(r.seg, r.stop) || r.segParts.some((p) => overlap(p, r.stop))) problems.push('Stop chevauche le segment');
        if (r.segOverflow) problems.push('libellés du segment hors de leur cadre');
        if (r.h > maxH.h) maxH = { h: r.h, where: lang + ' ' + sc.name };
        const tag = `${lang.padEnd(5)} ${sc.name.padEnd(9)} ${theme.padEnd(5)} ${String(r.h).padStart(3)} px`;
        if (problems.length) { failures.push(tag + ' : ' + problems.join(', ')); console.log(tag + '  ÉCHEC : ' + problems.join(', ')); }
        else if (process.env.DDT_VERBOSE) console.log(tag + '  ok');
        if (shots) await page.screenshot({ path: path.join(shots, `popup-${lang}-${sc.name}-${theme}.png`), fullPage: true });
        await page.close();
      }
    }
  }
  await browser.close();
  console.log(`${langs.length} langues contrôlées ; hauteur maximale ${maxH.h} px (${maxH.where}).`);
  if (failures.length) { console.log(failures.length + ' problème(s).'); process.exit(1); }
  console.log('Aucun problème : hauteur ≤ 600 px, Stop sans chevauchement, aucune largeur en trop.');
})().catch((e) => { console.error(e); process.exit(1); });
