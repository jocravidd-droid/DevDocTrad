/* Tests de la traduction de la voix des vidéos : pistes de sous-titres, YouTube, son -> Groq Whisper,
   nettoyage des transcriptions, garde-fous (clé gratuite seulement), affichage et lecture à voix haute. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');
const { makeBackground, key, response, fakeTranslate } = H;
const DDT = require('../src/shared.js');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await wait(20); }
  return false;
}

function voiceDom(html, opts = {}) {
  const dom = H.makeDom(html || '<main><video></video></main>', opts);
  dom.window.eval(H.read('voice.js'));
  return dom;
}
function fakeTransport(calls, map) {
  return {
    translate(texts) {
      calls.push(Array.from(texts));
      return Promise.resolve({ translations: texts.map(map || fakeTranslate) });
    }
  };
}
function overlay(dom) {
  const host = dom.window.document.querySelector('div[data-tr-ui="voice"]');
  if (!host) return null;
  const sr = host.shadowRoot;
  return {
    host,
    orig: sr.querySelector('.orig').textContent,
    tr: sr.querySelector('.tr').textContent,
    msg: sr.querySelector('.msg').textContent,
    speak: sr.querySelector('.speak'),
    close: sr.querySelector('.close'),
    on: sr.querySelector('.box').classList.contains('on')
  };
}

/* Fausse piste de sous-titres façon TextTrack */
function fakeTrack(cues, extra = {}) {
  const listeners = {};
  const track = Object.assign({
    kind: 'subtitles', language: 'en', mode: 'disabled', cues, activeCues: [],
    addEventListener(n, f) { (listeners[n] = listeners[n] || []).push(f); },
    removeEventListener(n, f) { listeners[n] = (listeners[n] || []).filter((x) => x !== f); },
    fire(active) { track.activeCues = active; (listeners.cuechange || []).forEach((f) => f()); },
    listeners
  }, extra);
  return track;
}

test.after(() => H.closeAll());

/* ---------------- Nettoyage des transcriptions ---------------- */
test('transcription : phrases inventées par Whisper retirées, texte utile gardé', () => {
  assert.equal(DDT.cleanTranscript('Thank you for watching!'), '');
  assert.equal(DDT.cleanTranscript("Sous-titres réalisés par la communauté d'Amara.org"), '');
  assert.equal(DDT.cleanTranscript('ご視聴ありがとうございました'), '');
  assert.equal(DDT.cleanTranscript('[Music] \u266A \u266A'), '');
  assert.equal(DDT.cleanTranscript('  ...  '), '');
  assert.equal(DDT.cleanTranscript(null), '');
  assert.equal(DDT.cleanTranscript('Now run npm install. Thank you for watching.'), 'Now run npm install.');
  assert.equal(DDT.cleanTranscript('The useEffect hook runs after render.'), 'The useEffect hook runs after render.');
});

test('sous-titres : balises WebVTT et entités retirées', () => {
  const dom = voiceDom();
  const cueText = dom.window.DDT_cueText;
  assert.equal(cueText('<v Speaker>Hello <c.yellow>world</c></v>'), 'Hello world');
  assert.equal(cueText('a &amp; b &lt;div&gt;'), 'a & b <div>');
  assert.equal(cueText('  two\nlines  '), 'two lines');
});

/* ---------------- Background : transcription Groq Whisper ---------------- */
const AUDIO = Buffer.from('fake-opus-audio-bytes').toString('base64');

test('transcription : envoi multipart à Groq Whisper avec la clé gratuite, texte nettoyé', async () => {
  const { bg, fetch, api } = makeBackground({
    local: { settings: { target: 'fr' }, keys: [key('g', 'groq')] },
    handler: () => response(200, { text: ' Install the package first. Thanks for watching! ' })
  });
  const r = await bg.transcribe({ audio: AUDIO, mime: 'audio/webm;codecs=opus' });
  assert.deepEqual(r, { ok: true, text: 'Install the package first.', via: 'g' });
  assert.equal(fetch.calls.length, 1);
  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, 'Bearer TEST-KEY-g-0123456789abcdef');
  assert.equal(init.body.get('model'), 'whisper-large-v3-turbo');
  const file = init.body.get('file');
  assert.equal(file.name, 'audio.webm');
  assert.equal(file.type, 'audio/webm');
  assert.equal(Buffer.from(await file.arrayBuffer()).toString(), 'fake-opus-audio-bytes');
  const usage = api.storage.local._data().usage;
  assert.equal(usage.perKey.g.requests, 1, 'requête comptée');
});

test('transcription : ogg envoyé avec la bonne extension', async () => {
  const { bg, fetch } = makeBackground({
    local: { settings: {}, keys: [key('g', 'groq')] },
    handler: () => response(200, { text: 'Hello' })
  });
  await bg.transcribe({ audio: AUDIO, mime: 'audio/ogg;codecs=opus' });
  assert.equal(fetch.calls[0].init.body.get('file').name, 'audio.ogg');
});

test('transcription : jamais de clé payante ni d\'autre fournisseur, message clair sans clé Groq', async () => {
  const { bg, fetch } = makeBackground({
    local: { settings: {}, keys: [key('p', 'groq', { tier: 'paid' }), key('m', 'mistral'), key('o', 'ollama', { key: '' })] }
  });
  const r = await bg.transcribe({ audio: AUDIO, mime: 'audio/webm' });
  assert.deepEqual(r, { ok: false, error: 'no_groq' });
  assert.equal(fetch.calls.length, 0, 'aucune requête');
});

test('transcription : clé Groq désactivée ignorée', async () => {
  const { bg, fetch } = makeBackground({ local: { settings: {}, keys: [key('g', 'groq', { enabled: false })] } });
  assert.equal((await bg.transcribe({ audio: AUDIO })).error, 'no_groq');
  assert.equal(fetch.calls.length, 0);
});

test('transcription : 429 met la clé en pause et passe à la clé Groq suivante', async () => {
  const { bg, fetch } = makeBackground({
    local: { settings: {}, keys: [key('g1', 'groq', { order: 0 }), key('g2', 'groq', { order: 1, key: 'OTHER-KEY-0123456789abcdef' })] },
    handler: (url, init) => (init.headers.Authorization.includes('TEST-KEY-g1')
      ? response(429, { error: { message: 'Rate limit reached for whisper' } }, { 'retry-after': '30' })
      : response(200, { text: 'Second key works.' }))
  });
  const r1 = await bg.transcribe({ audio: AUDIO });
  assert.equal(r1.error, 'rate_limited');
  assert.equal(r1.waitMs, 30000);
  const r2 = await bg.transcribe({ audio: AUDIO });
  assert.deepEqual(r2, { ok: true, text: 'Second key works.', via: 'g2' });
  assert.equal(fetch.calls.length, 2);
  const st = await bg.publicState();
  assert.equal(st.keys.find((k) => k.id === 'g1').available, false);
});

test('transcription : clé refusée (401) désactivée, la clé n\'apparaît jamais dans le message', async () => {
  const { bg } = makeBackground({
    local: { settings: {}, keys: [key('g', 'groq')] },
    handler: () => response(401, { error: { message: 'Invalid API Key TEST-KEY-g-0123456789abcdef' } })
  });
  const r = await bg.transcribe({ audio: AUDIO });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'auth');
  assert.ok(!JSON.stringify(r).includes('TEST-KEY-g'), 'clé masquée');
  const again = await bg.transcribe({ audio: AUDIO });
  assert.equal(again.error, 'no_groq', 'clé désactivée : plus utilisée');
});

test('transcription : coupure réseau signalée proprement', async () => {
  const { bg } = makeBackground({
    local: { settings: {}, keys: [key('g', 'groq')] },
    handler: () => { throw new Error('Failed to fetch'); }
  });
  const r = await bg.transcribe({ audio: AUDIO });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'network');
});

test('transcription : son vide ou trop gros refusé sans requête', async () => {
  const { bg, fetch } = makeBackground({ local: { settings: {}, keys: [key('g', 'groq')] } });
  assert.equal((await bg.transcribe({ audio: '' })).error, 'empty');
  assert.equal((await bg.transcribe({ audio: 'A'.repeat(30 * 1024 * 1024) })).error, 'too_big');
  assert.equal(fetch.calls.length, 0);
});

test('message voiceCommand : script injecté à la première demande, statut sans injection', async () => {
  const { bg, api } = makeBackground({ local: { settings: {} } });
  const injected = [];
  let loaded = false;
  api.tabs = {
    sendMessage: (tabId, msg) => (loaded ? Promise.resolve({ active: msg.cmd !== 'stop', cmd: msg.cmd }) : Promise.reject(new Error('no receiver')))
  };
  api.scripting = { executeScript: (o) => { injected.push(o.files); loaded = true; return Promise.resolve(); } };
  assert.deepEqual(await bg.onMessage({ type: 'voiceCommand', tabId: 3, cmd: 'status' }), { active: false });
  assert.equal(injected.length, 0, 'statut : pas d\'injection');
  const r = await bg.onMessage({ type: 'voiceCommand', tabId: 3, cmd: 'start' });
  assert.deepEqual(injected, [['shared.js', 'voice.js']]);
  assert.equal(r.active, true);
});

/* ---------------- Page : pistes de sous-titres ---------------- */
test('pistes : sous-titres traduits à l\'avance, piste masquée, bande affichée puis restaurée', async () => {
  const dom = voiceDom();
  const video = dom.window.document.querySelector('video');
  const cues = [
    { text: 'Hello <b>world</b>', startTime: 0 },
    { text: 'Run the tests', startTime: 2 },
    { text: 'Hello world', startTime: 4 }
  ];
  const track = fakeTrack(cues);
  Object.defineProperty(video, 'textTracks', { value: [track] });
  const calls = [];
  const voice = dom.window.DDT_createVoice(dom.window.document, dom.window, {
    transport: fakeTransport(calls), transcribe: () => assert.fail('pas de son pour une vidéo sous-titrée'),
    settings: { target: 'fr', mode: 'replace' }
  });
  const st = voice.start();
  assert.equal(st.active, true);
  assert.equal(st.mode, 'track');
  assert.equal(track.mode, 'hidden', 'piste chargée mais pas dessinée par le navigateur');
  await until(() => Object.keys(voice._memo()).length === 2);
  assert.equal(calls.length, 1, 'une seule demande pour toute la piste');
  assert.deepEqual(calls[0].sort(), ['Hello world', 'Run the tests'], 'doublons retirés');
  track.fire([cues[1]]);
  let o = overlay(dom);
  assert.equal(o.tr, 'RUN THE TESTS');
  assert.equal(o.orig, '', 'mode remplacement : pas d\'original');
  assert.equal(o.on, true);
  track.fire([]);
  assert.equal(overlay(dom).tr, '');
  voice.stop();
  assert.equal(track.mode, 'disabled', 'piste remise comme avant');
  assert.equal(overlay(dom), null, 'bande retirée');
  assert.equal(track.listeners.cuechange.length, 0, 'écouteur retiré');
});

test('pistes : mode bilingue affiche l\'original au-dessus de la traduction', async () => {
  const dom = voiceDom();
  const video = dom.window.document.querySelector('video');
  const cue = { text: 'Deploy now', startTime: 0 };
  const track = fakeTrack([cue], { mode: 'showing' });
  Object.defineProperty(video, 'textTracks', { value: [track] });
  const voice = dom.window.DDT_createVoice(dom.window.document, dom.window, {
    transport: fakeTransport([]), transcribe: () => null, settings: { target: 'fr', mode: 'bilingual' }
  });
  voice.start();
  track.fire([cue]);
  await until(() => overlay(dom).tr === 'DEPLOY NOW');
  assert.equal(overlay(dom).orig, 'Deploy now');
  voice.stop();
  assert.equal(track.mode, 'showing');
});

test('pistes : la piste déjà dans la langue cible est évitée', () => {
  const dom = voiceDom();
  const video = dom.window.document.querySelector('video');
  const fr = fakeTrack([], { language: 'fr' });
  const en = fakeTrack([], { language: 'en' });
  Object.defineProperty(video, 'textTracks', { value: [fr, en] });
  const voice = dom.window.DDT_createVoice(dom.window.document, dom.window, {
    transport: fakeTransport([]), transcribe: () => null, settings: { target: 'fr' }
  });
  voice.start();
  assert.equal(en.mode, 'hidden');
  assert.equal(fr.mode, 'disabled');
  voice.stop();
});

test('pistes : erreur de traduction affichée dans la bande (aucune clé)', async () => {
  const dom = voiceDom();
  const video = dom.window.document.querySelector('video');
  const cue = { text: 'Hello', startTime: 0 };
  const track = fakeTrack([cue]);
  Object.defineProperty(video, 'textTracks', { value: [track] });
  const voice = dom.window.DDT_createVoice(dom.window.document, dom.window, {
    transport: { translate: () => Promise.resolve({ error: 'no_key' }) }, transcribe: () => null, settings: { target: 'fr' }
  });
  voice.start();
  await until(() => overlay(dom).msg === 'badgeNoKey');
  assert.equal(overlay(dom).msg, 'badgeNoKey');
  voice.stop();
});

test('aucune vidéo : réponse claire, rien d\'affiché', () => {
  const dom = voiceDom('<main><p>Texte</p></main>');
  const voice = dom.window.DDT_createVoice(dom.window.document, dom.window, { transport: fakeTransport([]), transcribe: () => null });
  const st = voice.start();
  assert.equal(st.active, false);
  assert.equal(st.error, 'no_video');
  assert.equal(st.message, 'voiceNoVideo');
  assert.equal(overlay(dom), null);
});

test('marche/arrêt : toggle et statut', () => {
  const dom = voiceDom();
  Object.defineProperty(dom.window.document.querySelector('video'), 'textTracks', { value: [fakeTrack([])] });
  const voice = dom.window.DDT_createVoice(dom.window.document, dom.window, { transport: fakeTransport([]), transcribe: () => null });
  assert.equal(voice.toggle().active, true);
  assert.equal(voice.status().active, true);
  assert.equal(voice.toggle().active, false);
  assert.equal(voice.status().mode, null);
});

test('bouton fermer de la bande : arrête tout', () => {
  const dom = voiceDom();
  Object.defineProperty(dom.window.document.querySelector('video'), 'textTracks', { value: [fakeTrack([])] });
  const voice = dom.window.DDT_createVoice(dom.window.document, dom.window, { transport: fakeTransport([]), transcribe: () => null });
  voice.start();
  overlay(dom).close.click();
  assert.equal(voice.status().active, false);
  assert.equal(overlay(dom), null);
});

/* ---------------- Lecture à voix haute ---------------- */
test('voix haute : lit chaque nouvelle traduction dans la langue cible et baisse le son de la vidéo', async () => {
  const dom = voiceDom();
  const w = dom.window;
  const spoken = [];
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  w.speechSynthesis = { speaking: false, pending: false, speak: (u) => spoken.push(u), cancel: () => {} };
  const video = w.document.querySelector('video');
  video.volume = 0.9;
  const cue = { text: 'Open the terminal', startTime: 0 };
  const track = fakeTrack([cue]);
  Object.defineProperty(video, 'textTracks', { value: [track] });
  const voice = w.DDT_createVoice(w.document, w, { transport: fakeTransport([]), transcribe: () => null, settings: { target: 'de' } });
  voice.start();
  overlay(dom).speak.click();
  assert.equal(overlay(dom).speak.getAttribute('aria-pressed'), 'true');
  assert.equal(video.volume, 0.25);
  track.fire([cue]);
  await until(() => spoken.length === 1);
  assert.equal(spoken[0].text, 'OPEN THE TERMINAL');
  assert.equal(spoken[0].lang, 'de');
  voice.stop();
  assert.equal(video.volume, 0.9, 'volume rendu');
});

/* ---------------- YouTube ---------------- */
const YT_HTML = '<div id="movie_player"><video></video><button class="ytp-subtitles-button" aria-pressed="false"></button>' +
  '<div class="ytp-caption-window-container"></div></div>';

test('YouTube : active les sous-titres, les masque, traduit le texte stable puis remet tout en place', async () => {
  const dom = voiceDom(YT_HTML, { url: 'https://www.youtube.com/watch?v=abc' });
  const d = dom.window.document;
  const btn = d.querySelector('.ytp-subtitles-button');
  btn.addEventListener('click', () => btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
  const calls = [];
  const voice = dom.window.DDT_createVoice(d, dom.window, { transport: fakeTransport(calls), transcribe: () => assert.fail('pas de son') });
  const st = voice.start();
  assert.equal(st.mode, 'youtube');
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'sous-titres activés');
  assert.ok(d.querySelector('style[data-tr-ui="voice-style"]'), 'sous-titres d\'origine masqués');
  d.querySelector('.ytp-caption-window-container').innerHTML =
    '<span class="ytp-caption-segment">so we call</span> <span class="ytp-caption-segment">the render function</span>';
  await until(() => overlay(dom).tr === 'SO WE CALL THE RENDER FUNCTION', 3000);
  assert.equal(overlay(dom).tr, 'SO WE CALL THE RENDER FUNCTION');
  assert.deepEqual(calls, [['so we call the render function']]);
  voice.stop();
  assert.equal(btn.getAttribute('aria-pressed'), 'false', 'sous-titres remis comme avant');
  assert.equal(d.querySelector('style[data-tr-ui="voice-style"]'), null);
});

test('YouTube sans sous-titres : passe à l\'écoute du son', async () => {
  const dom = voiceDom(YT_HTML, { url: 'https://www.youtube.com/watch?v=nocc' });
  const video = dom.window.document.querySelector('video');
  Object.defineProperty(video, 'paused', { value: false, configurable: true });
  video.captureStream = () => null;
  const voice = dom.window.DDT_createVoice(dom.window.document, dom.window, {
    transport: fakeTransport([]), transcribe: () => null, ytWaitMs: 60, MediaRecorder: function () {}
  });
  voice.start();
  await until(() => voice.status().mode === 'audio');
  assert.equal(voice.status().mode, 'audio');
  assert.equal(overlay(dom).msg, 'voiceNoAudio', 'pas de son accessible ici : message clair');
  voice.stop();
});

/* ---------------- Son -> transcription -> traduction ---------------- */
function audioSetup(transcribeImpl, opts = {}) {
  const dom = voiceDom();
  const w = dom.window;
  const video = w.document.querySelector('video');
  Object.defineProperty(video, 'paused', { get: () => !!opts.paused, configurable: true });
  const track = { kind: 'audio' };
  video.captureStream = () => ({ getAudioTracks: () => [track] });
  w.MediaStream = function (tracks) { this.tracks = tracks; };
  const recorders = [];
  function FakeRecorder(stream, o) {
    this.stream = stream;
    this.options = o;
    this.state = 'inactive';
    recorders.push(this);
  }
  FakeRecorder.isTypeSupported = (m) => m === 'audio/webm;codecs=opus';
  FakeRecorder.prototype.start = function () { this.state = 'recording'; };
  FakeRecorder.prototype.stop = function () {
    this.state = 'inactive';
    this.ondataavailable({ data: new w.Blob(['chunk-' + recorders.length], { type: 'audio/webm' }) });
    this.onstop();
  };
  const sent = [];
  const calls = [];
  const voice = w.DDT_createVoice(w.document, w, {
    transport: fakeTransport(calls),
    transcribe: (b64, mime) => { sent.push({ b64, mime }); return Promise.resolve(transcribeImpl(sent.length)); },
    MediaRecorder: FakeRecorder, chunkMs: 40, settings: { target: 'fr', mode: 'bilingual' }
  });
  return { dom, w, voice, recorders, sent, calls };
}

test('son : morceaux enregistrés, transcrits puis traduits, affichés dans l\'ordre', async () => {
  const { dom, voice, recorders, sent, calls } = audioSetup((n) => ({ ok: true, text: n === 1 ? 'First sentence.' : 'Second sentence.' }));
  const st = voice.start();
  assert.equal(st.mode, 'audio');
  await until(() => sent.length >= 2 && calls.length >= 2);
  assert.equal(recorders[0].options.mimeType, 'audio/webm;codecs=opus');
  assert.equal(sent[0].mime, 'audio/webm;codecs=opus');
  assert.equal(Buffer.from(sent[0].b64, 'base64').toString(), 'chunk-1');
  assert.deepEqual(calls.slice(0, 2), [['First sentence.'], ['Second sentence.']]);
  await until(() => overlay(dom).tr === 'SECOND SENTENCE.');
  assert.equal(overlay(dom).orig, 'Second sentence.', 'bilingue : original affiché');
  assert.equal(overlay(dom).msg, 'voiceSourceAudio');
  voice.stop();
  const n = sent.length;
  await wait(120);
  assert.ok(sent.length <= n + 1, 'plus d\'enregistrement après l\'arrêt');
});

test('son : sans clé Groq, message qui explique quoi faire', async () => {
  const { dom, voice } = audioSetup(() => ({ ok: false, error: 'no_groq' }));
  voice.start();
  await until(() => overlay(dom).msg === 'voiceNeedGroq');
  assert.equal(overlay(dom).msg, 'voiceNeedGroq');
  voice.stop();
});

test('son : limite gratuite atteinte signalée', async () => {
  const { dom, voice } = audioSetup(() => ({ ok: false, error: 'rate_limited' }));
  voice.start();
  await until(() => overlay(dom).msg === 'voiceRate');
  assert.equal(overlay(dom).msg, 'voiceRate');
  voice.stop();
});

test('son : vidéo en pause, rien n\'est envoyé', async () => {
  const { voice, sent, recorders } = audioSetup(() => ({ ok: true, text: 'x' }), { paused: true });
  voice.start();
  await until(() => recorders.length >= 3);
  assert.equal(sent.length, 0);
  voice.stop();
});

test('son : transcription vide (silence filtré) n\'appelle pas la traduction', async () => {
  const { voice, sent, calls } = audioSetup(() => ({ ok: true, text: '' }));
  voice.start();
  await until(() => sent.length >= 2);
  assert.equal(calls.length, 0);
  voice.stop();
});

/* ---------------- Fichiers de l'extension ---------------- */
test('extension : raccourci de la voix déclaré, voice.js présent, popup avec l\'interrupteur', () => {
  const fs = require('fs');
  const path = require('path');
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifests', 'base.json'), 'utf8'));
  assert.equal(base.commands['toggle-voice'].suggested_key.default, 'Alt+Shift+V');
  assert.ok(Object.keys(base.commands).length <= 4, 'Chrome : 4 raccourcis maximum');
  assert.ok(fs.existsSync(path.join(H.SRC, 'voice.js')));
  assert.ok(H.read('popup.html').includes('id="voiceSwitch"'));
  assert.ok(!/tabCapture|offscreen/.test(JSON.stringify(base)), 'aucune nouvelle permission demandée');
});
