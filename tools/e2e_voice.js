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
 * - vérifie : sous-titres traduits sur la vidéo, arrêt propre, son enregistré puis transcrit puis traduit ;
 * - cause de « le mode vocal ne marche pas » (1.2) reproduite : dans une page sans clic, Chrome refuse
 *   speechSynthesis.speak() (« not-allowed ») ;
 * - doublage et voix seule (1.3) : la vraie chaîne page -> background -> chrome.tts, avec des espions mis
 *   à la place de chrome.tts.speak / stop / getVoices dans le service worker (Chromium sans tête n'a
 *   aucune voix) : texte, langue, voix, vitesse, son d'origine baissé puis remonté sur « end ».
 *
 * Capture d'écran (screenshot-5-voix.png) : par défaut dans un dossier temporaire (chemin affiché à
 * la fin), pour ne jamais modifier les fichiers suivis par git. Pour mettre à jour celle du dépôt
 * (store/screenshots/ et docs/assets/) :
 *
 *   DDT_SHOTS=1 node tools/e2e_voice.js
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
// DDT_SHOTS=1 : capture écrite dans les dossiers suivis du dépôt ; sinon dans un dossier temporaire.
const SHOTS = process.env.DDT_SHOTS === '1'
  ? [path.join(ROOT, 'store', 'screenshots'), path.join(ROOT, 'docs', 'assets')]
  : [fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-shots-'))];
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

/* Cause du bug de la 1.2 : speechSynthesis.speak() lancé par la page sans aucun clic. Le résultat est
   écrit dans le document (aucun page.evaluate avant : Playwright donne une activation utilisateur). */
const PROBE = `<!doctype html><p id="o">...</p><script>
setTimeout(() => {
  const out = { activated: navigator.userActivation.hasBeenActive };
  const u = new SpeechSynthesisUtterance('Bonjour');
  u.onerror = (e) => { out.error = e.error; document.getElementById('o').textContent = JSON.stringify(out); };
  u.onend = () => { out.end = true; document.getElementById('o').textContent = JSON.stringify(out); };
  speechSynthesis.speak(u);
}, 200);
</script>`;

function serve() {
  return new Promise((r) => {
    const s = http.createServer((req, res) => {
      const u = req.url.split('?')[0];
      if (u === '/' || u === '/track.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(PAGE(true)); }
      if (u === '/audio.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(PAGE(false)); }
      if (u === '/probe.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(PROBE); }
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
  // 0. Cause réelle : Chromium normal (règle d'autoplay par défaut), page jamais cliquée
  {
    const b = await chromium.launch({ channel: 'chromium', headless: !process.env.DDT_HEADFUL });
    const p = await b.newPage();
    await p.goto('http://localhost:8124/probe.html');
    // pas de waitForFunction : chaque évaluation de Playwright compte comme un geste de l'utilisateur
    await p.waitForTimeout(1500);
    const raw = await p.textContent('#o');
    const r = raw && raw !== '...' ? JSON.parse(raw) : {};
    check('cause (1.2) : speechSynthesis.speak() dans une page sans clic refusé par Chrome (« not-allowed »)',
      r.activated === false && r.error === 'not-allowed', raw);
    await b.close();
  }
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
    for (const d of SHOTS) {
      await page.screenshot({ path: path.join(d, 'screenshot-5-voix.png') });
    }
    const stop = await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'stop', null), tabId);
    check('arrêt : bande retirée', stop && !stop.active && !(await overlay(page)));
    const restored = await page.evaluate(() => document.getElementById('v').textTracks[0].mode);
    check('arrêt : piste remise comme avant', restored === 'disabled', restored);
    check('aucun appel audio pour une vidéo sous-titrée', groqCalls.length === 0, String(groqCalls.length));

    // 1 bis. Doublage et voix seule : la vraie chaîne page (voice.js) -> background -> chrome.tts.
    // Chromium sans tête n'a aucune voix : chrome.tts.speak / stop / getVoices sont remplacés DANS LE
    // SERVICE WORKER par des espions (rien d'autre n'est simulé : messages, background, voice.js réels).
    // Les événements de chrome.tts (start, end, interrupted) sont envoyés par le test.
    await sw.evaluate(() => {
      const voices = [{ voiceName: 'Fake English', lang: 'en-US' }, { voiceName: 'Faux Google français', lang: 'fr-FR', remote: true },
        { voiceName: 'Faux basique', lang: 'fr-FR' }];
      const log = { calls: [], stops: 0, voicesAsked: 0 };
      const live = [];
      self.__ttsLog = log;
      self.__ttsEnd = () => { const e = live.shift(); if (e) e.ev({ type: 'end' }); return !!e; };
      const spy = {
        getVoices(cb) { log.voicesAsked++; if (cb) { cb(voices); return undefined; } return Promise.resolve(voices); },
        speak(text, opts, cb) {
          log.calls.push({ text, lang: opts.lang, rate: opts.rate, voiceName: opts.voiceName, enqueue: opts.enqueue });
          const ev = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
          live.push({ ev });
          setTimeout(() => ev({ type: 'start' }), 10);
          if (cb) cb();
          return undefined;
        },
        stop() { log.stops++; live.splice(0).forEach((e) => e.ev({ type: 'interrupted' })); }
      };
      for (const k of Object.keys(spy)) {
        try { chrome.tts[k] = spy[k]; } catch (e) { /* propriété en lecture seule */ }
        if (chrome.tts[k] !== spy[k]) Object.defineProperty(chrome.tts, k, { value: spy[k], configurable: true, writable: true });
      }
    });
    const spyOk = await sw.evaluate(() => typeof chrome.tts === 'object' && chrome.tts.speak.toString().includes('log.calls'));
    check('chrome.tts présent (permission « tts ») et espionné dans le service worker', spyOk);
    const ttsLog = () => sw.evaluate(() => JSON.parse(JSON.stringify(self.__ttsLog)));
    // piège : une fausse speechSynthesis dans le monde de voice.js, qui ne doit jamais servir
    const trapPage = (id) => sw.evaluate((tid) => chrome.scripting.executeScript({
      target: { tabId: tid },
      func: () => {
        const log = { spoken: 0 };
        const write = () => document.documentElement.setAttribute('data-ddt-page-tts', JSON.stringify(log));
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
          getVoices: () => [{ name: 'Page fr', lang: 'fr-FR' }], addEventListener() {}, removeEventListener() {},
          speak() { log.spoken++; write(); }, cancel() {}, pause() {}, resume() {} } });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: function (text) { this.text = text; }, configurable: true });
        write();
      }
    }), id);
    const setSettings = (patch) => sw.evaluate(async (p) => {
      const r = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: Object.assign({}, r.settings, p) });
    }, patch);
    const vol = () => page.evaluate(() => document.getElementById('v').volume);
    const bandState = () => page.evaluate(() => {
      const h = document.querySelector('div[data-tr-ui="voice"]');
      const sr = h && h.shadowRoot;
      if (!sr) return null;
      const lines = [...sr.querySelectorAll('.line')];
      return { linesShown: lines.filter((l) => !l.hidden && l.textContent && getComputedStyle(l).display !== 'none').length,
        bar: getComputedStyle(sr.querySelector('.bar')).display !== 'none', rates: !sr.querySelector('.rates').hidden,
        rate: sr.querySelector('.rate').textContent, tr: sr.querySelector('.tr').textContent };
    });
    async function waitCalls(n, timeout = 12000) {
      const end = Date.now() + timeout;
      let l = await ttsLog();
      while (Date.now() < end && l.calls.length < n) { await page.waitForTimeout(150); l = await ttsLog(); }
      return l;
    }
    async function freshVideoPage() {
      await page.goto('http://localhost:8124/track.html');
      await page.waitForFunction(() => { const v = document.getElementById('v'); return v && v.readyState >= 2; }, null, { timeout: 15000 });
      await page.evaluate(() => { const v = document.getElementById('v'); v.pause(); v.currentTime = 0; v.volume = 1; });
    }

    // a) Doublage (sous-titres + voix), vitesse réglée à 1,5
    await setSettings({ voiceMode: 'dub', voiceRate: 1.5, mode: 'replace' });
    await freshVideoPage();
    const st3 = await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'start', null), tabId);
    await trapPage(tabId);
    check('doublage : réglage voiceMode appliqué au démarrage', st3 && st3.active && st3.voiceMode === 'dub' && st3.voiceRate === 1.5, JSON.stringify(st3));
    await page.evaluate(() => document.getElementById('v').play()).catch(() => {});
    let tl = await waitCalls(1);
    const first = tl.calls[0];
    check('doublage : page -> background -> chrome.tts.speak avec le sous-titre traduit', !!first && /Bienvenue|Commence|Ouvre/.test(first.text), JSON.stringify(first));
    check('doublage : langue fr-FR, meilleure voix française (même ordre de préférence), file d\'attente',
      !!first && first.lang === 'fr-FR' && first.voiceName === 'Faux Google français' && first.enqueue === true, JSON.stringify(first));
    check('doublage : vitesse = calage (0,9 à 1,7) × réglage 1,5', !!first && first.rate >= 1.35 && first.rate <= 2.55, first && String(first.rate));
    let minVol = 1;
    for (let i = 0; i < 20 && minVol >= 0.2; i++) { minVol = Math.min(minVol, await vol()); await page.waitForTimeout(100); }
    check('doublage : son d\'origine baissé (~15 %) pendant la voix', minVol < 0.2, String(minVol));
    let band = await bandState();
    check('doublage : sous-titre affiché ET dit', band && band.linesShown === 1 && band.rates && band.rate === '1,5×', JSON.stringify(band));
    await sw.evaluate(() => self.__ttsEnd());       // événement « end » de chrome.tts
    let back = 0;
    for (let i = 0; i < 25 && back < 0.95; i++) { await page.waitForTimeout(100); back = await vol(); }
    check('doublage : événement « end » -> son d\'origine remonté', back >= 0.95, String(back));
    // saut au 2e sous-titre : nouvelle phrase, puis pause pendant qu'elle est dite
    const n1 = (await ttsLog()).calls.length;
    await page.evaluate(() => { document.getElementById('v').currentTime = 4; });
    tl = await waitCalls(n1 + 1);
    check('doublage : saut dans la vidéo -> phrase du nouvel endroit', tl.calls.length > n1 && /Commence/.test(tl.calls[tl.calls.length - 1].text),
      JSON.stringify(tl.calls[tl.calls.length - 1]));
    await page.evaluate(() => document.getElementById('v').pause());
    await page.waitForTimeout(400);
    tl = await ttsLog();
    check('doublage : pause de la vidéo pendant la voix -> chrome.tts.stop', tl.stops >= 1, String(tl.stops));
    const pageTts = await page.evaluate(() => JSON.parse(document.documentElement.getAttribute('data-ddt-page-tts') || '{}'));
    check('doublage : speechSynthesis de la page jamais utilisée', pageTts.spoken === 0, JSON.stringify(pageTts));
    const stop3 = await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'stop', null), tabId);
    check('doublage : arrêt, volume d\'origine rendu', stop3 && !stop3.active && (await vol()) === 1, String(await vol()));

    // b) Voix traduite seule (sans sous-titres), vitesse 0,8 puis + dans la barre de la vidéo
    await setSettings({ voiceMode: 'voice', voiceRate: 0.8 });
    const before = (await ttsLog()).calls.length;
    await freshVideoPage();
    const st4 = await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'start', null), tabId);
    check('voix seule : démarrée', st4 && st4.active && st4.voiceMode === 'voice', JSON.stringify(st4));
    await page.evaluate(() => document.getElementById('v').play()).catch(() => {});
    tl = await waitCalls(before + 1);
    const vo = tl.calls[before];
    check('voix seule : chrome.tts.speak appelé (texte, langue, vitesse = calage × 0,8)',
      !!vo && /Bienvenue|Commence|Ouvre/.test(vo.text) && vo.lang === 'fr-FR' && vo.rate >= 0.72 && vo.rate <= 1.36, JSON.stringify(vo));
    band = await bandState();
    check('voix seule : aucune ligne de texte, barre (message, haut-parleur, vitesse, fermer) visible',
      band && band.linesShown === 0 && band.bar && band.rates && band.rate === '0,8×', JSON.stringify(band));
    await page.evaluate(() => document.querySelector('div[data-tr-ui="voice"]').shadowRoot.querySelector('.faster').click());
    await page.waitForTimeout(300);
    const savedRate = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings.voiceRate);
    band = await bandState();
    check('vitesse : bouton + de la bande -> 0,9×, enregistré', savedRate === 0.9 && band.rate === '0,9×', savedRate + ' / ' + (band && band.rate));
    // phrase suivante (saut au 2e sous-titre) : à la nouvelle vitesse
    await sw.evaluate(() => self.__ttsEnd());
    const n2 = (await ttsLog()).calls.length;
    await page.evaluate(() => { document.getElementById('v').currentTime = 4; });
    tl = await waitCalls(n2 + 1);
    const nx = tl.calls[tl.calls.length - 1];
    check('vitesse : appliquée à la phrase suivante (calage × 0,9)', tl.calls.length > n2 && /Commence/.test(nx.text) && nx.rate >= 0.81 && nx.rate <= 1.53,
      JSON.stringify(nx));
    // vitesse changée dans les réglages (storage) : appliquée tout de suite sur la vidéo
    await setSettings({ voiceRate: 1.7 });
    await page.waitForTimeout(300);
    band = await bandState();
    check('vitesse : changée dans les réglages, appliquée tout de suite à la bande', band && band.rate === '1,7×', band && band.rate);
    await sw.evaluate((id) => self.__DDT_BG.voiceCommand(id, 'stop', null), tabId);
    await setSettings({ voiceMode: 'subs', voiceRate: 1, mode: 'bilingual' });

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
    const h = await pop.evaluate(() => ({ sw: !!document.getElementById('voiceSwitch'), height: document.documentElement.scrollHeight,
      modes: [...document.querySelectorAll('#voiceModeSel option')].map((o) => o.value) }));
    check('popup : interrupteur « voix des vidéos »', h.sw);
    check('popup : trois choix (sous-titres, doublage, voix seule)', h.modes.join() === 'subs,dub,voice', h.modes.join());
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
  console.log('Capture : ' + SHOTS.join(', ') + (process.env.DDT_SHOTS === '1' ? '' : ' (DDT_SHOTS=1 pour mettre à jour celle du dépôt)'));
  process.exit(failed ? 1 : 0);
})();
