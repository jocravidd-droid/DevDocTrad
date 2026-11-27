#!/usr/bin/env node
/*
 * Test de bout en bout dans un vrai Firefox (aucune dépendance : WebDriver BiDi intégré à Firefox).
 *
 *   python3 build.py && node tools/e2e_firefox.js
 *
 * Firefox ≥ 140 requis : `firefox` dans le PATH, ou FIREFOX_BIN=/chemin/vers/firefox.
 * Sur GitHub Actions (ubuntu-latest), Firefox est déjà installé.
 *
 * Copie de test de dist/firefox : accès à tous les sites (pas de fenêtre de permission en test),
 * un petit pont (testbridge.js) qui déclenche les commandes comme le popup, et Groq redirigé vers
 * un faux serveur local. Aucune vraie IA, aucune vraie clé.
 *
 * Vérifie, dans Firefox : traduction d'une page de doc (code intact, retour à l'original exact),
 * Markdown brut (vue lisible), voix des vidéos avec sous-titres, et voix sans sous-titres
 * (son capturé, envoyé au faux Groq, traduit) : les cas cassés trouvés en vrai dans Firefox 161.
 *
 * Doublage (1.3) : Firefox n'a pas browser.tts ; la voix sort de speechSynthesis de la page de fond.
 * Un espion remplace speechSynthesis dans cette page de fond (testbg.js, chargé après background.js) :
 * il prouve que la vraie chaîne page -> runtime.sendMessage -> background -> speechSynthesis est suivie,
 * avec le bon texte, la bonne langue, la bonne voix et la bonne vitesse. Firefox sans tête n'a souvent
 * aucune voix système : sans espion, on ne pourrait rien entendre ni mesurer.
 */
'use strict';
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const DEMO = path.join(__dirname, 'demo');
const VDIR = path.join(DEMO, 'voice');
const PORT_WEB = 8126;
const PORT_BIDI = 9334;
const UUID = '0d0d0d0d-1111-4222-8333-444455556666';
const results = [];
const check = (name, ok, extra) => { results.push({ name, ok }); console.log((ok ? 'OK   ' : 'FAIL ') + name + (extra ? ' : ' + extra : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function firefoxBin() {
  if (process.env.FIREFOX_BIN) return process.env.FIREFOX_BIN;
  try { return execFileSync('which', ['firefox']).toString().trim(); } catch (e) { return ''; }
}

/* ---------- Copie de test de l'extension ---------- */
const BRIDGE = `(function () {
  if (window.__ddtBridge) return; window.__ddtBridge = true;
  const set = (o) => document.documentElement.setAttribute('data-ddt-test', JSON.stringify(o));
  window.addEventListener('message', (e) => {
    if (!e.data || !e.data.ddtTest) return;
    if (e.data.ddtTest === 'status') { const en = globalThis.__DDT_ENGINE; set(en ? Object.assign({ engine: true }, en.status()) : { engine: false }); return; }
    const port = browser.runtime.connect({ name: 'ddt-test' });
    port.onMessage.addListener((r) => { set(Object.assign({ cmdReply: true }, r || {})); port.disconnect(); });
    port.postMessage({ cmd: e.data.ddtTest, voice: !!e.data.voice });
  });
  document.documentElement.setAttribute('data-ddt-bridge', '1');
})();`;
const BG = `browser.storage.local.set({ keys: [
  { id: 'k-ollama', provider: 'ollama', label: 'Ollama', tier: 'local', enabled: true, modelEasy: 'demo-model:latest', baseUrl: 'http://127.0.0.1:11434', order: 0 },
  { id: 'k-groq', provider: 'groq', label: 'Groq', key: 'gsk_DEMO_NOT_A_REAL_KEY_000000000000', tier: 'free', enabled: true, modelEasy: 'demo', order: 5 }],
  settings: { termsStyle: 3, target: 'fr', mode: 'replace', explainTerms: false, translateComments: false, pageCap: 150000, batchChars: 6000, sensitiveExtra: [], autoSites: [] } });
// Espion de la synthèse vocale de la page de fond (Firefox : pas de browser.tts). La vraie est d'abord décrite.
const ttsLog = { realSynth: typeof self.speechSynthesis, realUtterance: typeof self.SpeechSynthesisUtterance, realVoices: -1, calls: [], cancels: 0 };
try { ttsLog.realVoices = self.speechSynthesis.getVoices().length; } catch (e) { /* rien */ }
const ttsLive = [];
Object.defineProperty(self, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: function (text) { this.text = text; } });
Object.defineProperty(self, 'speechSynthesis', { configurable: true, value: {
  getVoices: () => [{ name: 'Fake English', lang: 'en-US' }, { name: 'Faux Google français', lang: 'fr-FR' }, { name: 'Faux basique', lang: 'fr-FR' }],
  addEventListener() {}, removeEventListener() {},
  speak(u) { ttsLog.calls.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice && u.voice.name }); ttsLive.push(u); },
  cancel() { ttsLog.cancels++; ttsLive.splice(0).forEach((u) => u.onerror && u.onerror({ error: 'interrupted' })); }
} });
async function setVoiceMode(mode) {
  const r = await browser.storage.local.get('settings');
  await browser.storage.local.set({ settings: Object.assign({}, r.settings, { voiceMode: mode }) });
}
browser.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ddt-test') return;
  port.onMessage.addListener((m) => {
    if (m.cmd === 'ttsLog') { port.postMessage(JSON.parse(JSON.stringify(ttsLog))); return; }
    if (m.cmd === 'ttsEnd') { const u = ttsLive.shift(); if (u && u.onend) u.onend({}); port.postMessage({ ended: !!u }); return; }
    if (m.cmd === 'dubOn' || m.cmd === 'dubOff') { setVoiceMode(m.cmd === 'dubOn' ? 'dub' : 'subs').then(() => port.postMessage({ ok: true })); return; }
    const fn = m.voice ? self.__DDT_BG.voiceCommand : self.__DDT_BG.tabCommand;
    fn(port.sender.tab.id, m.cmd, null).then((r) => port.postMessage(r || {}), (e) => port.postMessage({ injectError: String(e && e.message || e) }));
  });
});`;
function prepareExtension() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-ff-'));
  fs.cpSync(path.join(ROOT, 'dist', 'firefox'), dir, { recursive: true });
  const mf = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  mf.host_permissions.push('<all_urls>');
  mf.background.scripts.push('testbg.js');
  mf.content_scripts = [{ matches: ['<all_urls>'], js: ['testbridge.js'], run_at: 'document_idle' }];
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(mf, null, 2));
  fs.writeFileSync(path.join(dir, 'testbridge.js'), BRIDGE);
  fs.writeFileSync(path.join(dir, 'testbg.js'), BG);
  // Groq redirigé vers le faux serveur local (le test ne peut pas intercepter le background)
  const sh = path.join(dir, 'shared.js');
  fs.writeFileSync(sh, fs.readFileSync(sh, 'utf8').replace("base: 'https://api.groq.com/openai/v1'", `base: 'http://127.0.0.1:${PORT_WEB}/openai/v1'`));
  return dir;
}

/* ---------- Pages servies localement ---------- */
let groqCalls = 0;
const README = '# Nimbus\n\nA tiny HTTP client that keeps your code readable.\n\n```js\nconst api = createClient()\n```\n\n## Install\n\n- Run the installer\n- Read the docs\n';
const VPAGE = (track) => `<!doctype html><html lang="en"><body style="background:#111"><video id="v" src="clip.webm" autoplay loop controls style="width:800px">${track ? '<track kind="subtitles" srclang="en" src="subs.en.vtt">' : ''}</video></body></html>`;
function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((q, r) => {
      const u = q.url.split('?')[0];
      if (u === '/openai/v1/audio/transcriptions') {
        q.on('data', () => {}); q.on('end', () => { groqCalls++; r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ text: 'Hello from the audio track.' })); });
        return;
      }
      if (u === '/' || u === '/index.html') { r.setHeader('Content-Type', 'text/html; charset=utf-8'); return r.end(fs.readFileSync(path.join(DEMO, 'index.html'))); }
      if (u === '/README.md') { r.setHeader('Content-Type', 'text/plain; charset=utf-8'); return r.end(README); }
      if (u === '/track.html' || u === '/audio.html') { r.setHeader('Content-Type', 'text/html'); return r.end(VPAGE(u === '/track.html')); }
      const f = path.join(VDIR, path.basename(u));
      if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
      const buf = fs.readFileSync(f);
      r.setHeader('Content-Type', u.endsWith('.vtt') ? 'text/vtt' : 'video/webm');
      r.setHeader('Accept-Ranges', 'bytes');
      const m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
      if (!m) return r.end(buf);
      const a = m[1] ? +m[1] : 0; const b = m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
      r.statusCode = 206; r.setHeader('Content-Range', `bytes ${a}-${b}/${buf.length}`); r.end(buf.subarray(a, b + 1));
    });
    s.listen(PORT_WEB, '127.0.0.1', () => resolve(s));
  });
}

/* ---------- Client WebDriver BiDi minimal ---------- */
async function startFirefox(bin, extDir) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-ffp-'));
  fs.writeFileSync(path.join(prof, 'user.js'), [
    `user_pref("extensions.webextensions.uuids", "{\\"devdoctrad@ingenieurfou\\":\\"${UUID}\\"}");`,
    'user_pref("intl.locale.requested", "fr");', 'user_pref("intl.accept_languages", "fr-FR, fr");',
    'user_pref("media.autoplay.default", 0);', 'user_pref("media.autoplay.blocking_policy", 0);',
    'user_pref("browser.shell.checkDefaultBrowser", false);', 'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("network.proxy.type", 0);'
  ].join('\n'));
  const proc = spawn(bin, ['--headless', '--remote-debugging-port', String(PORT_BIDI), '--profile', prof, '--no-remote'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  proc.stderr.on('data', (d) => { err += d; });
  for (let i = 0; i < 150 && !/WebDriver BiDi listening/.test(err); i++) await sleep(200);
  if (!/WebDriver BiDi listening/.test(err)) throw new Error('Firefox ne démarre pas : ' + err.slice(-400));
  const ws = new WebSocket(`ws://127.0.0.1:${PORT_BIDI}/session`);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const wait = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; } };
  const call = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    wait[i] = (d) => (d.type === 'error' ? rej(new Error(method + ': ' + d.error + ' ' + d.message)) : res(d.result));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await call('session.new', { capabilities: {} });
  const ext = await call('webExtension.install', { extensionData: { type: 'path', path: extDir } });
  const version = (await call('session.status').catch(() => ({}))) || {};
  return { call, ext, version, close: () => { try { ws.close(); } catch (e) { /* rien */ } proc.kill(); } };
}

(async () => {
  const bin = firefoxBin();
  if (!bin) { console.log('Firefox introuvable : installe-le ou définis FIREFOX_BIN. Test ignoré.'); process.exit(process.env.CI ? 1 : 0); }
  const ext = prepareExtension();
  const server = await serve();
  const ollama = spawn(process.execPath, [path.join(__dirname, 'fake_ollama.js')], { stdio: 'ignore', env: Object.assign({}, process.env, { FAKE_OLLAMA_DELAY: '5' }) });
  await sleep(400);
  let ff = null;
  try {
    ff = await startFirefox(bin, ext);
    check('extension installée dans Firefox', ff.ext && ff.ext.extension === 'devdoctrad@ingenieurfou', JSON.stringify(ff.ext));
    const ctx = (await ff.call('browsingContext.getTree', {})).contexts[0].context;
    const ev = (x) => ff.call('script.evaluate', { target: { context: ctx }, expression: x, awaitPromise: true }).then((r) => r.result && r.result.value);
    const go = async (p) => {
      await ff.call('browsingContext.navigate', { context: ctx, url: `http://127.0.0.1:${PORT_WEB}${p}`, wait: 'complete' });
      for (let i = 0; i < 30 && !(await ev('document.documentElement.getAttribute("data-ddt-bridge")')); i++) await sleep(200);
    };
    const cmd = async (c, voice) => { await ev(`document.documentElement.removeAttribute("data-ddt-test"); window.postMessage({ddtTest:${JSON.stringify(c)}, voice:${!!voice}}, "*"); 1`); await sleep(800); };
    const engineStatus = async () => { await cmd('status'); const raw = await ev('document.documentElement.getAttribute("data-ddt-test")'); return raw ? JSON.parse(raw) : null; };
    const untilDone = async () => { let st = null; for (let i = 0; i < 40; i++) { st = await engineStatus(); if (st && st.state && st.state !== 'running' && st.state !== 'idle') break; await sleep(500); } return st; };

    // 1. Page de documentation
    await go('/');
    const original = await ev('document.body.innerHTML');
    await cmd('translate');
    let st = await untilDone();
    check('page traduite dans Firefox', st && st.state === 'done' && st.done > 5, JSON.stringify(st));
    const h1 = await ev('document.querySelector("h1").textContent');
    check('titre traduit', h1 === 'Prise en main', h1);
    const code = await ev('[...document.querySelectorAll("main code")].map((c) => c.textContent).join("|")');
    check('code jamais traduit', code.includes('npm install nimbus-http'), code.slice(0, 80));
    const badge = await ev('(()=>{const h=document.querySelector("div[data-tr-ui]");const b=h&&h.shadowRoot&&h.shadowRoot.querySelector(".b");return b?getComputedStyle(b).position:""})()');
    check('badge affiché et stylé', badge === 'fixed', badge);
    await cmd('toggle');
    await sleep(400);
    const restored = await ev('(()=>{const c=document.body.cloneNode(true);c.querySelectorAll("div[data-tr-ui]").forEach((n)=>n.remove());return c.innerHTML})()');
    check('original restauré à l\'identique', restored === original);

    // 2. Markdown brut (text/plain)
    await go('/README.md');
    await cmd('translate');
    st = await untilDone();
    check('Markdown brut traduit (plus « rien à traduire »)', st && st.state === 'done' && st.done > 2, JSON.stringify(st));
    const md = await ev('(()=>{const v=document.querySelector("[data-ddt-plain]");return v?JSON.stringify({h1:v.querySelector("h1")&&v.querySelector("h1").textContent,pre:[...v.querySelectorAll("pre")].map((p)=>p.textContent),li:v.querySelectorAll("li").length}):""})()');
    const mdv = md ? JSON.parse(md) : {};
    check('Markdown : vue lisible, code intact', mdv.li === 2 && (mdv.pre || []).includes('const api = createClient()'), md);

    // 3. Voix : sous-titres
    const overlay = '(()=>{const h=document.querySelector("div[data-tr-ui=voice]");const s=h&&h.shadowRoot;return s?s.querySelector(".tr").textContent:""})()';
    await go('/track.html');
    await ev('document.getElementById("v").play().then(()=>1,()=>0)');
    await cmd('start', true);
    let tr = '';
    for (let i = 0; i < 20 && !/Bienvenue|Commence|Ouvre/.test(tr); i++) { await sleep(500); tr = await ev(overlay); }
    check('voix : sous-titres traduits sur la vidéo (Firefox)', /Bienvenue|Commence|Ouvre/.test(tr), tr);
    await cmd('stop', true);

    // 3 bis. Doublage : la voix sort de speechSynthesis de la page de fond (espion), pas de la page
    const reply = async (c) => { await cmd(c); const raw = await ev('document.documentElement.getAttribute("data-ddt-test")'); return raw ? JSON.parse(raw) : {}; };
    await reply('dubOn');
    await go('/track.html');
    await ev('(()=>{const v=document.getElementById("v");v.volume=1;v.currentTime=0;return v.play().then(()=>1,()=>0)})()');
    await cmd('start', true);
    let tlog = {};
    let minVol = 1;
    for (let i = 0; i < 25; i++) {
      tlog = await reply('ttsLog');
      minVol = Math.min(minVol, Number(await ev('document.getElementById("v").volume')));
      if (tlog.calls && tlog.calls.length && minVol < 0.2) break;
      await sleep(200);
    }
    const said = (tlog.calls || [])[0];
    check('doublage (Firefox) : page -> background -> speechSynthesis de la page de fond, sous-titre traduit',
      !!said && /Bienvenue|Commence|Ouvre/.test(said.text), JSON.stringify(tlog));
    check('doublage (Firefox) : langue fr-FR, meilleure voix française, vitesse calée (0,9 à 1,7)',
      !!said && said.lang === 'fr-FR' && said.voice === 'Faux Google français' && said.rate >= 0.9 && said.rate <= 1.7, JSON.stringify(said));
    check('doublage (Firefox) : speechSynthesis présente dans la page de fond (sans browser.tts)',
      tlog.realSynth === 'object' && tlog.realUtterance === 'function', `speechSynthesis ${tlog.realSynth}, voix système : ${tlog.realVoices}`);
    check('doublage (Firefox) : son d\'origine baissé pendant la voix', minVol < 0.2, String(minVol));
    await reply('ttsEnd');
    let back = 0;
    for (let i = 0; i < 20 && back < 0.95; i++) { await sleep(150); back = Number(await ev('document.getElementById("v").volume')); }
    check('doublage (Firefox) : fin de phrase -> son d\'origine remonté', back >= 0.95, String(back));
    await cmd('stop', true);
    await reply('dubOff');

    // 4. Voix : son capturé -> faux Groq -> traduction
    await go('/audio.html');
    await ev('document.getElementById("v").play().then(()=>1,()=>0)');
    await cmd('start', true);
    tr = '';
    for (let i = 0; i < 40 && tr !== 'Bonjour depuis la piste audio.'; i++) { await sleep(500); tr = await ev(overlay); }
    check('voix : son de la vidéo transcrit puis traduit (Firefox)', tr === 'Bonjour depuis la piste audio.', tr + ' / appels Groq : ' + groqCalls);
    await cmd('stop', true);
    const playing = await ev('(()=>{const v=document.getElementById("v");return !v.paused&&!v.muted})()');
    check('la vidéo continue après l\'arrêt', playing === true);
  } catch (e) {
    check('exécution du scénario', false, e && e.stack);
  } finally {
    if (ff) ff.close();
    server.close();
    ollama.kill();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} vérifications réussies (Firefox)`);
  process.exit(failed ? 1 : 0);
})();
