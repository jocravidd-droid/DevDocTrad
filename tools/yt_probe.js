#!/usr/bin/env node
/*
 * Sonde de la voix des vidéos sur le VRAI YouTube (à lancer à la main sur un PC, jamais en CI).
 *
 *   python3 build.py
 *   node tools/yt_probe.js [adresse YouTube]
 *
 * Charge dist/chrome dans un Chromium visible, ouvre la vidéo, lance la voix des vidéos et affiche toutes
 * les 2 s : mode, message de la bande, sources essayées et leur résultat (diagnostic de voice.js), nombre de
 * phrases de la transcription, voix choisie, appels à chrome.tts (la voix parle vraiment : les appels sont
 * seulement comptés, puis transmis au vrai chrome.tts).
 *
 * Réglages (variables d'environnement) :
 *   FLAGS="--enable-speech-dispatcher"   options de plus pour le navigateur (Linux : voix de speech-dispatcher)
 *   PROFILE=~/.config/ddt-probe          dossier de profil gardé d'une fois sur l'autre (clés, cookies YouTube) ;
 *                                         par défaut un profil vierge temporaire
 *   CHANNEL=chrome                        Google Chrome installé (voix Google) au lieu du Chromium de Playwright
 *   BROWSER=/usr/bin/chromium             exécutable précis (prioritaire sur CHANNEL)
 *   MODE=dub|voice|subs                   mode de la voix (défaut : dub)
 *   TARGET=fr                             langue cible (défaut : fr)
 *   SECONDS=90                            durée de la sonde
 *   LANGUAGE=fr                           langue de l'interface (Chromium sous Linux ignore souvent --lang :
 *                                         c'est la variable LANGUAGE / LANG qui compte)
 * Ctrl+C pour arrêter plus tôt. Aucune clé n'est créée : celles du profil (PROFILE) servent telles quelles.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'chrome');
const URL_ARG = process.argv[2] || 'https://www.youtube.com/watch?v=QTR4S_uP5Mc';
const MODE = process.env.MODE || 'dub';
const TARGET = process.env.TARGET || 'fr';
const SECONDS = Number(process.env.SECONDS) || 90;
const FLAGS = (process.env.FLAGS || '').split(/\s+/).filter(Boolean);

function prepareExtension() {
  if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
    console.error('dist/chrome absent : lancer d\'abord « python3 build.py »');
    process.exit(2);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-probe-ext-'));
  fs.cpSync(DIST, tmp, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  // la voix est lancée depuis le service worker (pas de clic dans le popup, donc pas d'activeTab) :
  // permission YouTube ajoutée à cette copie seulement
  mf.host_permissions = (mf.host_permissions || []).concat(['https://www.youtube.com/*']);
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(mf, null, 2));
  return tmp;
}

(async () => {
  const ext = prepareExtension();
  const profile = process.env.PROFILE ? path.resolve(process.env.PROFILE.replace(/^~/, os.homedir()))
    : fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-probe-profile-'));
  const launch = {
    headless: false,
    viewport: null,
    args: ['--disable-extensions-except=' + ext, '--load-extension=' + ext, '--autoplay-policy=no-user-gesture-required'].concat(FLAGS)
  };
  if (process.env.BROWSER) launch.executablePath = process.env.BROWSER;
  else launch.channel = process.env.CHANNEL || 'chromium';
  console.log('Navigateur :', launch.executablePath || launch.channel, '| options :', FLAGS.join(' ') || '(aucune)', '| profil :', profile);
  const ctx = await chromium.launchPersistentContext(profile, launch);
  let stopping = false;
  const finish = async (code) => {
    if (stopping) return;
    stopping = true;
    try { await ctx.close(); } catch (e) { /* déjà fermé */ }
    process.exit(code);
  };
  process.on('SIGINT', () => finish(0));
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 20000 });
    // réglages : mode et langue cible seulement (le reste du profil est gardé)
    await sw.evaluate(async ({ mode, target }) => {
      for (let i = 0; i < 50; i++) { const r = await chrome.storage.local.get('settings'); if (r.settings) break; await new Promise((ok) => setTimeout(ok, 100)); }
      const r = await chrome.storage.local.get(['settings', 'keys']);
      await chrome.storage.local.set({ settings: Object.assign({}, r.settings, { voiceMode: mode, target }) });
    }, { mode: MODE, target: TARGET });
    // chrome.tts compté puis transmis tel quel (la voix parle vraiment)
    const voices = await sw.evaluate(() => {
      const log = { calls: [], voices: [] };
      self.__probeTts = log;
      if (chrome.tts && !chrome.tts.__probe) {
        const real = chrome.tts.speak.bind(chrome.tts);
        const spy = function (text, opts, cb) {
          log.calls.push({ at: Date.now(), text: String(text).slice(0, 80), lang: opts && opts.lang, rate: opts && opts.rate, voice: opts && opts.voiceName });
          return real(text, opts, cb);
        };
        try { chrome.tts.speak = spy; } catch (e) { /* lecture seule */ }
        if (chrome.tts.speak !== spy) Object.defineProperty(chrome.tts, 'speak', { value: spy, configurable: true, writable: true });
        Object.defineProperty(chrome.tts, '__probe', { value: true });
      }
      return new Promise((ok) => {
        if (!chrome.tts) { ok(null); return; }
        chrome.tts.getVoices((v) => ok((v || []).map((x) => ({ name: x.voiceName, lang: x.lang, remote: !!x.remote }))));
      });
    });
    const keys = await sw.evaluate(async () => ((await chrome.storage.local.get('keys')).keys || []).map((k) => k.provider + (k.enabled === false ? ' (off)' : '')));
    console.log('Clés du profil :', keys.length ? keys.join(', ') : 'aucune');
    console.log('chrome.tts.getVoices() :', voices === null ? 'chrome.tts absent' : voices.length + ' voix');
    (voices || []).filter((v) => String(v.lang || '').toLowerCase().startsWith(TARGET.toLowerCase().split('-')[0]))
      .forEach((v) => console.log('   ' + TARGET + ' :', v.name, v.lang, v.remote ? '(réseau)' : '(locale)'));
    const page = await ctx.newPage();
    await page.goto(URL_ARG, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('video', { timeout: 30000 });
    // bandeau de consentement éventuel : à accepter à la main dans la fenêtre si la vidéo ne démarre pas
    await page.waitForTimeout(3000);
    await page.evaluate(() => { const v = document.querySelector('video'); if (v && v.paused) return v.play().catch(() => {}); });
    const tabId = await sw.evaluate(async (u) => {
      const tabs = await chrome.tabs.query({});
      const t = tabs.find((x) => x.url && x.url.indexOf(new URL(u).pathname) !== -1) || tabs.find((x) => /youtube\.com/.test(x.url || ''));
      return t && t.id;
    }, URL_ARG);
    const st = await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'start', null), tabId);
    console.log('Voix lancée :', JSON.stringify({ active: st.active, mode: st.mode, message: st.message }));
    let shown = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < SECONDS * 1000 && !stopping) {
      await page.waitForTimeout(2000);
      const s = await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'status', null), tabId).catch((e) => ({ error: String(e) }));
      const tts = await sw.evaluate(() => self.__probeTts).catch(() => ({ calls: [] }));
      const sec = Math.round((Date.now() - t0) / 1000);
      console.log(`[${String(sec).padStart(3)} s] mode=${s.mode} phrases=${s.sentences || 0} traduits=${s.translated} transcrits=${s.transcribed}` +
        ` voix=${s.dubVoice || '-'}${s.voiceTier ? ' (niveau ' + s.voiceTier + ')' : ''} tts=${tts.calls.length}` +
        ` | ${s.message || ''}${s.voiceWarn ? ' | AVERTISSEMENT : ' + s.voiceWarn : ''}`);
      const diag = Array.isArray(s.diag) ? s.diag : [];
      if (diag.length < shown) shown = 0;   // voix relancée : diagnostic remis à zéro
      diag.slice(shown).forEach((d) => console.log(`        ${String(d.t).padStart(5)} s  ${d.src.padEnd(15)} ${d.result}`));
      shown = diag.length;
      const last = tts.calls[tts.calls.length - 1];
      if (last) console.log(`        dernière phrase dite : « ${last.text} » (${last.lang}, ${last.rate}×, ${last.voice || 'voix par défaut'})`);
    }
    await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'stop', null), tabId).catch(() => {});
  } catch (e) {
    console.error('Sonde interrompue :', e && e.stack || e);
    await finish(1);
    return;
  }
  await finish(0);
})();
