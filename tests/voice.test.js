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
  assert.equal(usage.perKey['g:whisper'].requests, 1, 'requête comptée à part (Whisper)');
  assert.equal(usage.perKey.g, undefined, 'le quota de requêtes du chat n\'est pas consommé');
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
  const { bg, fetch, api } = makeBackground({
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
  // pause propre à Whisper : la traduction avec g1 reste possible
  assert.ok(api.storage.session._data().pauses['g1:whisper'] > 0, 'Whisper de g1 en pause');
  const st = await bg.publicState();
  assert.equal(st.keys.find((k) => k.id === 'g1').available, true);
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
  assert.deepEqual(await bg.onMessage({ type: 'voiceCommand', tabId: 3, cmd: 'dub', on: true }), { active: false });
  assert.equal(injected.length, 0, 'doublage sans voix lancée : pas d\'injection');
  const r = await bg.onMessage({ type: 'voiceCommand', tabId: 3, cmd: 'start' });
  assert.deepEqual(injected, [['shared.js', 'voice.js']]);
  assert.equal(r.active, true);
  let seen = null;
  api.tabs.sendMessage = (tabId, msg) => { seen = msg; return Promise.resolve({ active: true, speaking: msg.on }); };
  await bg.onMessage({ type: 'voiceCommand', tabId: 3, cmd: 'dub', on: true });
  assert.deepEqual([seen.to, seen.cmd, seen.on], ['voice', 'dub', true], 'doublage transmis à la page');
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

/* ---------------- Doublage : voix de synthèse du navigateur ---------------- */
const VOICES = [
  { name: 'Thomas', lang: 'fr-CA' },
  { name: 'Microsoft Hortense - French (France)', lang: 'fr-FR' },
  { name: 'Google français', lang: 'fr-FR' },
  { name: 'Samantha', lang: 'en-US', default: true },
  { name: 'Daniel', lang: 'en-GB' }
];
/* Fausse synthèse vocale : phrases gardées, fin pilotée par le test (finish), annulation qui
   déclenche onerror « interrupted » comme Chrome */
function fakeSpeech(w, voices = VOICES, opts = {}) {
  const listeners = {};
  const sp = {
    spoken: [], cancels: 0, list: opts.late ? [] : voices,
    getVoices() { return this.list; },
    addEventListener(n, f) { (listeners[n] = listeners[n] || []).push(f); },
    removeEventListener(n, f) { listeners[n] = (listeners[n] || []).filter((x) => x !== f); },
    loadLate() { this.list = voices; (listeners.voiceschanged || []).forEach((f) => f()); },
    speak(u) {
      this.spoken.push(u);
      if (opts.refuse) { u.onerror && u.onerror({ error: 'not-allowed' }); return; }
      u.onstart && u.onstart({});
    },
    cancel() {
      this.cancels++;
      this.spoken.filter((u) => !u.done).forEach((u) => { u.done = true; u.onerror && u.onerror({ error: 'interrupted' }); });
    },
    finish(u) { u.done = true; u.onend && u.onend({}); },
    pause() {}, resume() {}
  };
  w.speechSynthesis = sp;
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  return sp;
}
/* Vidéo qui joue (jsdom : toujours en pause, temps figé) */
function playingVideo(video, t0 = 0) {
  let paused = false;
  let time = t0;
  Object.defineProperty(video, 'paused', { get: () => paused, configurable: true });
  Object.defineProperty(video, 'currentTime', { get: () => time, set: (v) => { time = v; }, configurable: true });
  return {
    pause() { paused = true; video.dispatchEvent(new video.ownerDocument.defaultView.Event('pause')); },
    play() { paused = false; video.dispatchEvent(new video.ownerDocument.defaultView.Event('play')); },
    seek(v) {
      const E = video.ownerDocument.defaultView.Event;
      time = v;
      video.dispatchEvent(new E('seeking'));
      video.dispatchEvent(new E('seeked'));
    },
    set time(v) { time = v; }
  };
}
function dubSetup(cues, settings = {}, deps = {}, speechOpts) {
  const dom = voiceDom();
  const w = dom.window;
  const sp = fakeSpeech(w, speechOpts && speechOpts.voices, speechOpts);
  const video = w.document.querySelector('video');
  video.volume = 0.8;
  const ctl = playingVideo(video);
  const track = fakeTrack(cues);
  Object.defineProperty(video, 'textTracks', { value: [track] });
  const voice = w.DDT_createVoice(w.document, w, Object.assign({
    transport: fakeTransport([]), transcribe: () => null, rampMs: 0, unduckMs: 15, voicesWaitMs: 200,
    settings: Object.assign({ target: 'fr', mode: 'replace', voiceDub: true }, settings)
  }, deps));
  return { dom, w, sp, video, ctl, track, voice };
}

test('doublage : meilleure voix pour la langue cible (langue exacte, puis qualité, puis langue seule)', () => {
  const w = voiceDom().window;
  const pick = (voices, lang) => { const v = w.DDT_pickTtsVoice(voices, lang); return v && v.name; };
  assert.equal(pick(VOICES, 'fr'), 'Google français', 'fr-FR et « Google » avant fr-FR simple et fr-CA');
  assert.equal(pick([{ name: 'Amélie Premium', lang: 'fr-CA' }, { name: 'Hortense', lang: 'fr-FR' }], 'fr'), 'Hortense',
    'langue exacte avant la qualité');
  assert.equal(pick([{ name: 'Amélie', lang: 'fr-CA' }, { name: 'Felix', lang: 'de-DE' }], 'fr'), 'Amélie', 'langue seule en dernier');
  assert.equal(pick(VOICES, 'en'), 'Samantha', 'en -> en-US');
  assert.equal(pick([{ name: 'Luciana', lang: 'pt-BR' }, { name: 'Joana Enhanced', lang: 'pt-PT' }], 'pt-BR'), 'Luciana');
  assert.equal(pick([{ name: 'Nora', lang: 'nb-NO' }], 'no'), 'Nora', 'norvégien : voix « nb »');
  assert.equal(pick([{ name: 'Microsoft Xiaoxiao Online (Natural)', lang: 'zh-CN' }, { name: 'Ting-Ting', lang: 'zh-CN' }], 'zh-CN'),
    'Microsoft Xiaoxiao Online (Natural)');
  assert.equal(pick([{ name: 'x', lang: 'fr_FR' }], 'fr'), 'x', 'code avec « _ » (Android)');
  assert.equal(pick(VOICES, 'ja'), null, 'aucune voix japonaise');
});

test('doublage : vitesse adaptée à la durée du sous-titre et au retard, entre 0,9 et 1,7', () => {
  const rate = voiceDom().window.DDT_dubRate;
  const text = 'Commence par installer le paquet avec npm.';   // ~2,5 s à vitesse 1
  assert.equal(rate('Oui.', 4, 0, 'fr'), 0.9, 'texte court, sous-titre long : jamais sous 0,9');
  assert.equal(rate(text + ' ' + text + ' ' + text, 2, 0, 'fr'), 1.7, 'texte long, sous-titre court : jamais au-dessus de 1,7');
  const r = rate(text, 2.2, 0, 'fr');
  assert.ok(r > 1 && r < 1.4, 'un peu plus rapide pour tenir dans 2,2 s : ' + r);
  assert.ok(rate(text, 2.2, 0.6, 'fr') > r, 'retard de la phrase précédente : la suivante accélère');
  assert.ok(rate(text, null, 0, 'fr') >= 1 && rate(text, null, 0, 'fr') <= 1.2, 'sans durée connue : rythme soutenu');
  assert.ok(rate('配置文件已经更新了', 1, 0, 'zh-CN') > rate('配置文件已经更新了', 1, 0, 'fr'), 'chinois : moins de caractères par seconde');
});

test('doublage : chaque sous-titre dit au début avec la voix choisie, son d\'origine baissé à 15 % puis remonté', async () => {
  const cue = { text: 'Open the terminal', startTime: 0, endTime: 2 };
  const { sp, video, track, voice, ctl } = dubSetup([cue]);
  voice.start();
  assert.equal(voice.status().speaking, true, 'réglage voiceDub appliqué au démarrage');
  ctl.time = 0.05;
  track.fire([cue]);
  assert.ok(await until(() => sp.spoken.length === 1));
  const u = sp.spoken[0];
  assert.equal(u.text, 'OPEN THE TERMINAL');
  assert.equal(u.voice.name, 'Google français');
  assert.equal(u.lang, 'fr-FR');
  assert.ok(u.rate >= 0.9 && u.rate <= 1.7, 'vitesse bornée : ' + u.rate);
  assert.ok(Math.abs(video.volume - 0.8 * 0.15) < 1e-9, 'son baissé pendant la voix : ' + video.volume);
  assert.equal(voice.status().dubVoice, 'Google français');
  sp.finish(u);
  assert.ok(Math.abs(video.volume - 0.12) < 1e-9, 'pas remonté tout de suite (silence court entre deux phrases)');
  assert.ok(await until(() => Math.abs(video.volume - 0.8) < 1e-9, 1000), 'son remonté entre les phrases');
  // le volume choisi par l'utilisateur entre deux phrases est respecté
  video.volume = 0.5;
  voice.stop();
  assert.equal(video.volume, 0.5, 'arrêt : volume de l\'utilisateur gardé');
});

test('doublage : baisse et remontée du son en douceur, volume d\'origine rendu à l\'arrêt', async () => {
  const cue = { text: 'Hello world', startTime: 0, endTime: 3 };
  const { sp, video, track, voice } = dubSetup([cue], {}, { rampMs: 200 });
  voice.start();
  track.fire([cue]);
  assert.ok(await until(() => sp.spoken.length === 1));
  const steps = [];
  await until(() => { steps.push(video.volume); return Math.abs(video.volume - 0.12) < 1e-9; }, 1500);
  const middle = steps.filter((v) => v < 0.79 && v > 0.13);
  assert.ok(middle.length >= 1, 'valeurs intermédiaires : ' + steps.slice(0, 8).join(', '));
  voice.stop();
  assert.equal(video.volume, 0.8, 'arrêt pendant la voix : volume d\'origine rendu tout de suite');
  assert.ok(sp.cancels >= 1, 'voix coupée à l\'arrêt');
});

test('doublage : phrase précédente pas finie, la suivante accélère au lieu de couper ; au-delà de 2 s, coupée', async () => {
  const c1 = { text: 'Install the package first', startTime: 0, endTime: 2 };
  const c2 = { text: 'Then run the tests', startTime: 2, endTime: 4 };
  const { sp, track, voice, ctl } = dubSetup([c1, c2]);
  voice.start();
  track.fire([c1]);
  assert.ok(await until(() => sp.spoken.length === 1));
  ctl.time = 2;
  track.fire([c2]);
  assert.ok(await until(() => sp.spoken.length === 2));
  assert.equal(sp.cancels, 0, 'retard court : rien n\'est coupé');
  const alone = voice; // vitesse de la 2e phrase comparée à la même phrase sans retard
  assert.ok(sp.spoken[1].rate > sp.spoken[0].rate || sp.spoken[1].rate === 1.7, 'phrase suivante accélérée');
  alone.stop();

  const long = { text: 'This is a very long explanation that keeps going on and on about configuration files, environment variables, build steps and deployment targets', startTime: 0, endTime: 2 };
  const c3 = { text: 'Next step', startTime: 2, endTime: 4 };
  const b = dubSetup([long, c3]);
  b.voice.start();
  b.track.fire([long]);
  assert.ok(await until(() => b.sp.spoken.length === 1));
  b.ctl.time = 2;
  b.track.fire([c3]);
  assert.ok(await until(() => b.sp.spoken.length === 2));
  assert.equal(b.sp.cancels, 1, 'retard de plus de 2 s : la phrase en cours est coupée');
  assert.equal(b.sp.spoken[0].done, true);
  b.voice.stop();
});

test('doublage : pause de la vidéo = voix coupée et son remonté ; lecture = reprise du sous-titre ; saut = bon sous-titre', async () => {
  const c1 = { text: 'First step', startTime: 0, endTime: 3 };
  const c2 = { text: 'Second step', startTime: 10, endTime: 13 };
  const { sp, video, track, voice, ctl } = dubSetup([c1, c2]);
  voice.start();
  track.fire([c1]);
  assert.ok(await until(() => sp.spoken.length === 1));
  ctl.time = 1;
  ctl.pause();
  assert.equal(sp.cancels, 1, 'pause : voix coupée');
  assert.ok(await until(() => Math.abs(video.volume - 0.8) < 1e-9, 1000), 'pause : son d\'origine remonté');
  ctl.play();
  assert.ok(await until(() => sp.spoken.length === 2), 'lecture : le sous-titre en cours est redit');
  assert.equal(sp.spoken[1].text, 'FIRST STEP');
  // saut : le navigateur change de sous-titre, puis « seeked »
  track.activeCues = [c2];
  ctl.time = 10.2;
  video.dispatchEvent(new video.ownerDocument.defaultView.Event('seeking'));
  track.fire([c2]);
  video.dispatchEvent(new video.ownerDocument.defaultView.Event('seeked'));
  assert.ok(await until(() => sp.spoken.length >= 3));
  await wait(60);
  const after = sp.spoken.slice(2).map((u) => u.text);
  assert.deepEqual(after, ['SECOND STEP'], 'un seul énoncé, au nouveau sous-titre');
  assert.ok(sp.spoken[1].done, 'phrase d\'avant le saut coupée');
  // pendant la pause, un sous-titre affiché n'est pas dit
  ctl.pause();
  track.fire([c1]);
  await wait(60);
  assert.equal(sp.spoken.length, 3, 'rien de dit vidéo en pause');
  voice.stop();
});

test('doublage : bouton haut-parleur de la bande pour basculer, sans changer le réglage', async () => {
  const cue = { text: 'Hello', startTime: 0, endTime: 2 };
  const { dom, sp, track, voice } = dubSetup([cue], { voiceDub: false });
  voice.start();
  assert.equal(voice.status().speaking, false, 'défaut : sous-titres seuls');
  track.fire([cue]);
  await wait(40);
  assert.equal(sp.spoken.length, 0);
  overlay(dom).speak.click();
  assert.ok(await until(() => sp.spoken.length === 1), 'la traduction affichée est dite');
  assert.equal(overlay(dom).speak.getAttribute('aria-pressed'), 'true');
  assert.match(overlay(dom).speak.title, /Google français/);
  overlay(dom).speak.click();
  assert.equal(voice.status().speaking, false);
  assert.ok(sp.cancels >= 1);
  voice.stop();
});

test('doublage : liste des voix chargée plus tard (voiceschanged)', async () => {
  const cue = { text: 'Hello', startTime: 0, endTime: 2 };
  const { sp, track, voice } = dubSetup([cue], {}, { voicesWaitMs: 3000 }, { late: true });
  voice.start();
  track.fire([cue]);
  await wait(50);
  assert.equal(sp.spoken.length, 0, 'pas encore de voix');
  sp.loadLate();
  assert.ok(await until(() => sp.spoken.length === 1));
  assert.equal(sp.spoken[0].voice.name, 'Google français');
  voice.stop();
});

test('doublage : aucune voix pour la langue cible, message clair et sous-titres seuls', async () => {
  const cue = { text: 'Hello', startTime: 0, endTime: 2 };
  const { dom, sp, track, voice, video } = dubSetup([cue], { target: 'ja' });
  voice.start();
  assert.ok(await until(() => /^voiceNoTts: /.test(overlay(dom).msg)), overlay(dom).msg);
  assert.equal(voice.status().speaking, false);
  track.fire([cue]);
  assert.ok(await until(() => overlay(dom).tr === 'HELLO'), 'sous-titres toujours affichés');
  assert.equal(sp.spoken.length, 0);
  assert.equal(video.volume, 0.8, 'son d\'origine jamais baissé');
  voice.stop();
  // navigateur sans synthèse vocale du tout
  const d2 = voiceDom();
  const v2 = d2.window.document.querySelector('video');
  Object.defineProperty(v2, 'textTracks', { value: [fakeTrack([])] });
  const voice2 = d2.window.DDT_createVoice(d2.window.document, d2.window, { transport: fakeTransport([]), transcribe: () => null, settings: { voiceDub: true } });
  voice2.start();
  assert.match(overlay(d2).msg, /^voiceNoTts/);
  assert.equal(voice2.status().speaking, false);
  voice2.stop();
});

test('doublage : voix refusée par le navigateur (aucun clic sur la page), message pour débloquer', async () => {
  const cue = { text: 'Hello', startTime: 0, endTime: 2 };
  const { dom, sp, track, voice, video } = dubSetup([cue], {}, {}, { refuse: true });
  voice.start();
  track.fire([cue]);
  assert.ok(await until(() => sp.spoken.length === 1));
  assert.equal(overlay(dom).msg, 'voiceDubClick');
  assert.ok(await until(() => Math.abs(video.volume - 0.8) < 1e-9, 1000), 'son remonté');
  voice.stop();
});

/* ---------------- Partout : shadow DOM, <audio>, plusieurs vidéos, lecteurs intégrés ---------------- */
function rect(el, r) {
  el.getBoundingClientRect = () => Object.assign({ left: 0, top: 0 }, r, { right: (r.left || 0) + r.width, bottom: (r.top || 0) + r.height });
}

test('partout : vidéo dans un shadow root ouvert (lecteur en composant web)', async () => {
  const dom = voiceDom('<main><my-player></my-player></main>');
  const w = dom.window;
  const d = w.document;
  const inner = d.createElement('div');
  d.querySelector('my-player').attachShadow({ mode: 'open' }).appendChild(inner);
  const deep = inner.appendChild(d.createElement('x-inner')).attachShadow({ mode: 'open' });
  const video = d.createElement('video');
  deep.appendChild(video);
  const cue = { text: 'Deep inside', startTime: 0 };
  const track = fakeTrack([cue]);
  Object.defineProperty(video, 'textTracks', { value: [track] });
  const voice = w.DDT_createVoice(d, w, { transport: fakeTransport([]), transcribe: () => null, settings: { target: 'fr', mode: 'replace' } });
  const st = voice.start();
  assert.equal(st.active, true);
  assert.equal(voice._video(), video, 'vidéo trouvée dans deux shadow roots imbriqués');
  track.fire([cue]);
  assert.ok(await until(() => overlay(dom).tr === 'DEEP INSIDE'));
  voice.stop();
});

test('partout : <audio> (podcast) suivi, bande en bas de la fenêtre', async () => {
  const dom = voiceDom('<main><audio src="episode.mp3" controls></audio></main>');
  const w = dom.window;
  const audio = w.document.querySelector('audio');
  rect(audio, { left: 300, top: 100, width: 300, height: 40 });
  const cue = { text: 'Welcome to the show', startTime: 0 };
  const track = fakeTrack([cue]);
  Object.defineProperty(audio, 'textTracks', { value: [track] });
  const voice = w.DDT_createVoice(w.document, w, { transport: fakeTransport([]), transcribe: () => null, settings: { target: 'fr', mode: 'replace' } });
  const st = voice.start();
  assert.equal(st.active, true);
  assert.equal(st.media, 'audio');
  track.fire([cue]);
  assert.ok(await until(() => overlay(dom).tr === 'WELCOME TO THE SHOW'));
  const box = overlay(dom).host.shadowRoot.querySelector('.box');
  assert.equal(box.style.bottom, '24px', 'en bas de la fenêtre');
  assert.equal(box.style.left, '16px');
  voice.stop();
});

test('partout : plusieurs vidéos, celle qui joue, sinon la plus grande visible', () => {
  const dom = voiceDom('<main><video id="small"></video><video id="big"></video><video id="off"></video><audio id="a" src="x.mp3"></audio></main>');
  const w = dom.window;
  const d = w.document;
  const mk = () => w.DDT_createVoice(d, w, { transport: fakeTransport([]), transcribe: () => null });
  for (const id of ['small', 'big', 'off']) Object.defineProperty(d.getElementById(id), 'textTracks', { value: [fakeTrack([])] });
  rect(d.getElementById('small'), { width: 320, height: 180 });
  rect(d.getElementById('big'), { width: 960, height: 540, top: 200 });
  rect(d.getElementById('off'), { width: 1600, height: 900, top: 5000 });   // plus grande mais hors de la fenêtre
  let v = mk();
  v.start();
  assert.equal(v._video().id, 'big', 'la plus grande visible');
  v.stop();
  Object.defineProperty(d.getElementById('small'), 'paused', { value: false, configurable: true });
  v = mk();
  v.start();
  assert.equal(v._video().id, 'small', 'celle qui joue');
  v.stop();
  Object.defineProperty(d.getElementById('small'), 'paused', { value: true, configurable: true });
  Object.defineProperty(d.getElementById('a'), 'paused', { value: false, configurable: true });
  v = mk();
  v.start();
  assert.equal(v._video().id, 'a', 'un son qui joue passe avant une vidéo en pause');
  v.stop();
});

test('partout : lecteur intégré d\'un autre site (iframe), message clair et bouton pour l\'ouvrir dans un onglet', () => {
  const dom = voiceDom('<main><iframe id="yt" src="https://www.youtube-nocookie.com/embed/abc123?start=42" allowfullscreen></iframe></main>');
  const w = dom.window;
  const d = w.document;
  rect(d.getElementById('yt'), { left: 100, top: 100, width: 640, height: 360 });
  const opened = [];
  w.open = (url, target, feat) => { opened.push([url, target, feat]); return null; };
  const voice = w.DDT_createVoice(d, w, { transport: fakeTransport([]), transcribe: () => null });
  const st = voice.start();
  assert.equal(st.active, false);
  assert.equal(st.error, 'iframe_player');
  assert.equal(st.url, 'https://www.youtube.com/watch?v=abc123&t=42', 'YouTube : page de la vidéo (sous-titres disponibles)');
  assert.equal(st.message, 'voiceInFrame: youtube.com', 'site du lecteur nommé');
  const o = overlay(dom);
  assert.ok(o && o.on, 'bande affichée sur le lecteur');
  assert.equal(o.msg, 'voiceInFrame: youtube.com');
  const open = o.host.shadowRoot.querySelector('.open');
  assert.equal(open.hidden, false);
  assert.equal(open.textContent, 'voiceOpenTab');
  assert.equal(o.speak.hidden, true, 'pas de haut-parleur sans vidéo');
  open.click();
  assert.deepEqual(opened, [['https://www.youtube.com/watch?v=abc123&t=42', '_blank', 'noopener']]);
  assert.equal(overlay(dom), null, 'bande retirée après l\'ouverture');
});

test('partout : lecteurs Vimeo, Loom et générique reconnus ; iframe invisible ou non vidéo ignoré', () => {
  const run = (html, r) => {
    const dom = voiceDom('<main>' + html + '</main>');
    const w = dom.window;
    const f = w.document.querySelector('iframe');
    if (f && r) rect(f, r);
    const st = w.DDT_createVoice(w.document, w, { transport: fakeTransport([]), transcribe: () => null }).start();
    return st;
  };
  const big = { width: 640, height: 360, top: 50, left: 50 };
  assert.equal(run('<iframe src="https://player.vimeo.com/video/76979871?h=8272103f6e"></iframe>', big).url,
    'https://player.vimeo.com/video/76979871?h=8272103f6e');
  assert.equal(run('<iframe src="https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184"></iframe>', big).error, 'iframe_player');
  assert.equal(run('<iframe src="https://media.example.org/player/42" allow="autoplay; fullscreen"></iframe>', big).error, 'iframe_player',
    'lecteur inconnu mais déclaré comme tel (allow fullscreen + « player »)');
  assert.equal(run('<iframe src="https://player.vimeo.com/video/1"></iframe>', { width: 0, height: 0 }).error, 'no_video', 'invisible');
  assert.equal(run('<iframe src="https://ads.example.com/banner"></iframe>', big).error, 'no_video', 'pas un lecteur');
});

test('partout : vidéo protégée (DRM), message voiceNoAudio comme avant', () => {
  const dom = voiceDom();
  const w = dom.window;
  const video = w.document.querySelector('video');
  Object.defineProperty(video, 'mediaKeys', { value: {}, configurable: true });
  video.captureStream = () => { throw new Error('ne doit pas être appelé'); };
  const voice = w.DDT_createVoice(w.document, w, { transport: fakeTransport([]), transcribe: () => null, MediaRecorder: function () {} });
  voice.start();
  assert.equal(voice.status().mode, 'audio');
  assert.equal(overlay(dom).msg, 'voiceNoAudio');
  voice.stop();
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
/* Fausses pistes audio capturées et faux flux (captureStream / mozCaptureStream) */
function mkTrack(id) {
  return { id, kind: 'audio', readyState: 'live', stopped: false, stop() { this.stopped = true; this.readyState = 'ended'; } };
}
function fakeStream(ids) {
  const s = { tracks: ids.map(mkTrack), getAudioTracks: () => s.tracks.slice(), getTracks: () => s.tracks.slice() };
  return s;
}
/* Faux AudioContext : état réglable, sources et connexions notées, analyseur qui rend « value » */
function fakeAudio(state = 'running', value = 0.5) {
  const log = { sources: [], resumes: 0, closed: 0, ctx: null, analyser: null };
  function AC() { this.state = state; this.destination = { destination: true }; log.ctx = this; }
  AC.prototype.createAnalyser = function () {
    log.analyser = { fftSize: 0, getFloatTimeDomainData(buf) { buf.fill(value); } };
    return log.analyser;
  };
  AC.prototype.createMediaStreamSource = function (ms) {
    const src = { ms, out: [], disconnected: false, connect(n) { this.out.push(n); }, disconnect() { this.disconnected = true; } };
    log.sources.push(src);
    return src;
  };
  AC.prototype.resume = function () { log.resumes++; return Promise.resolve(); };
  AC.prototype.close = function () { log.closed++; return Promise.resolve(); };
  return { AC, log };
}

function audioSetup(transcribeImpl, opts = {}) {
  const dom = voiceDom(opts.html);
  const w = dom.window;
  const video = w.document.querySelector('video');
  Object.defineProperty(video, 'paused', { get: () => !!opts.paused, configurable: true });
  const track = { kind: 'audio' };
  const stream = opts.stream || { getAudioTracks: () => [track] };
  const captured = [];
  if (opts.moz) video.mozCaptureStream = () => { captured.push(stream); if (opts.onCapture) opts.onCapture(); return stream; };
  else video.captureStream = () => stream;
  w.MediaStream = function (tracks) { this.tracks = tracks; };
  const recorders = [];
  function FakeRecorder(stream, o) {
    if (opts.recorderThrows) throw new Error('NotSupportedError');
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
    MediaRecorder: FakeRecorder, AudioContext: opts.AudioContext, chunkMs: opts.chunkMs || 40,
    settings: { target: 'fr', mode: 'bilingual' }
  });
  return { dom, w, video, voice, recorders, sent, calls, stream, captured };
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

/* I8 : pistes capturées remplacées (vidéo suivante, publicité) */
test('son : pistes remplacées, source audio reconstruite vers l\'analyseur et les haut-parleurs (Firefox)', async () => {
  const stream = fakeStream(['a']);
  const A = fakeAudio();
  const { voice, recorders } = audioSetup(() => ({ ok: true, text: '' }), { moz: true, stream, AudioContext: A.AC });
  voice.start();
  await until(() => recorders.length >= 3);
  assert.equal(A.log.sources.length, 1, 'source créée une seule fois tant que les pistes ne changent pas');
  stream.tracks[0].readyState = 'ended';              // captureStream termine l'ancienne piste…
  stream.tracks = [mkTrack('b')];                       // … et en crée une autre
  assert.ok(await until(() => A.log.sources.length === 2), 'source reconstruite');
  const [s1, s2] = A.log.sources;
  assert.equal(s1.disconnected, true, 'ancienne source débranchée');
  assert.equal(s2.ms.tracks[0].id, 'b', 'nouvelle source sur la nouvelle piste');
  assert.ok(s2.out.includes(A.log.analyser), 'vers l\'analyseur');
  assert.ok(s2.out.includes(A.log.ctx.destination), 'mozCaptureStream : son renvoyé aux haut-parleurs');
  assert.equal(recorders[recorders.length - 1].stream.tracks[0].id, 'b', 'enregistrement de la nouvelle piste');
  voice.stop();
});

/* I9 : Firefox, mozCaptureStream coupe le son de l'élément */
test('son (Firefox) : vidéo d\'une autre origine sans CORS jamais capturée, message clair', () => {
  const { voice, captured, dom } = audioSetup(() => ({ ok: true, text: 'x' }), {
    moz: true, stream: fakeStream(['a']), AudioContext: fakeAudio().AC,
    html: '<main><video src="https://cdn.other.example/clip.mp4"></video></main>'
  });
  const st = voice.start();
  assert.equal(st.mode, 'audio');
  assert.equal(captured.length, 0, 'pas de mozCaptureStream : la vidéo garde son son');
  assert.equal(overlay(dom).msg, 'voiceNoAudio');
  voice.stop();
});

test('son (Firefox) : même origine, blob:, data: et crossorigin acceptés', () => {
  const htmls = [
    '<main><video src="/media/clip.webm"></video></main>',
    '<main><video src="blob:https://docs.example.dev/1234"></video></main>',
    '<main><video src="data:video/webm;base64,AAAA"></video></main>',
    '<main><video crossorigin="anonymous" src="https://cdn.other.example/clip.mp4"></video></main>'
  ];
  for (const html of htmls) {
    const { voice, captured } = audioSetup(() => ({ ok: true, text: '' }), { moz: true, stream: fakeStream(['a']), AudioContext: fakeAudio().AC, html });
    voice.start();
    assert.equal(captured.length, 1, html);
    voice.stop();
  }
});

test('son (Firefox) : à l\'arrêt ou en cas d\'échec, pistes capturées arrêtées et son rendu à la vidéo', async () => {
  // modèle de mozCaptureStream : le son quitte l'élément, il revient quand les pistes capturées sont arrêtées
  let soundOnElement = true;
  const mk = () => {
    const stream = fakeStream(['a']);
    stream.tracks.forEach((tr) => { const s = tr.stop; tr.stop = function () { s.call(this); soundOnElement = stream.tracks.every((x) => x.stopped); }; });
    return stream;
  };
  // arrêt normal
  let stream = mk();
  const A = fakeAudio();
  let s = audioSetup(() => ({ ok: true, text: '' }), { moz: true, stream, AudioContext: A.AC, onCapture: () => { soundOnElement = false; } });
  s.voice.start();
  await until(() => s.recorders.length >= 2);
  assert.equal(soundOnElement, false);
  s.voice.stop();
  assert.equal(stream.tracks[0].stopped, true, 'pistes arrêtées');
  assert.equal(soundOnElement, true, 'son rendu à la vidéo');
  assert.equal(A.log.closed, 1, 'contexte audio fermé');
  // MediaRecorder refusé
  stream = mk();
  s = audioSetup(() => ({ ok: true, text: '' }), { moz: true, stream, AudioContext: fakeAudio().AC, recorderThrows: true, onCapture: () => { soundOnElement = false; } });
  s.voice.start();
  assert.equal(soundOnElement, true, 'échec de MediaRecorder : son rendu');
  assert.equal(overlay(s.dom).msg, 'voiceNoAudio');
  s.voice.stop();
  // erreur de MediaRecorder pendant l'enregistrement
  stream = mk();
  s = audioSetup(() => ({ ok: true, text: '' }), { moz: true, stream, AudioContext: fakeAudio().AC, chunkMs: 1000, onCapture: () => { soundOnElement = false; } });
  s.voice.start();
  assert.equal(soundOnElement, false);
  s.recorders[0].onerror({ error: new Error('SecurityError') });
  assert.equal(soundOnElement, true, 'erreur de MediaRecorder : son rendu');
  assert.equal(overlay(s.dom).msg, 'voiceNoAudio');
  const n = s.recorders.length;
  await wait(60);
  assert.equal(s.recorders.length, n, 'plus d\'enregistrement après l\'échec');
  s.voice.stop();
});

/* I10 : contexte audio suspendu */
test('son : contexte audio suspendu, relance tentée à chaque morceau et morceaux envoyés quand même', async () => {
  const A = fakeAudio('suspended', 0);                 // suspendu : l'analyseur ne lit que des zéros
  const { voice, sent } = audioSetup(() => ({ ok: true, text: '' }), { AudioContext: A.AC, chunkMs: 150 });
  voice.start();
  assert.ok(await until(() => sent.length >= 2), 'pas jugé silencieux');
  assert.ok(A.log.resumes >= 2, 'ctx.resume() tenté à chaque morceau');
  voice.stop();
});

test('son : contexte actif, morceau silencieux ignoré, morceau sonore envoyé', async () => {
  const quiet = audioSetup(() => ({ ok: true, text: '' }), { AudioContext: fakeAudio('running', 0).AC, chunkMs: 150 });
  quiet.voice.start();
  await until(() => quiet.recorders.length >= 3);
  assert.equal(quiet.sent.length, 0, 'silence : rien envoyé');
  quiet.voice.stop();
  const loud = audioSetup(() => ({ ok: true, text: '' }), { AudioContext: fakeAudio('running', 0.5).AC, chunkMs: 150 });
  loud.voice.start();
  assert.ok(await until(() => loud.sent.length >= 1), 'son : envoyé');
  loud.voice.stop();
});

/* M8 : enregistreur qui s'arrête tout seul */
test('son : un enregistreur arrêté tout seul ne fait pas couper le morceau suivant par l\'ancien minuteur', async () => {
  const { voice, recorders } = audioSetup(() => ({ ok: true, text: '' }), { chunkMs: 400 });
  voice.start();
  await wait(150);
  recorders[0].stop();                                  // pistes terminées : arrêt spontané
  assert.equal(recorders.length, 2, 'morceau suivant démarré');
  await wait(330);                                      // l'ancien minuteur (400 ms) est passé
  assert.equal(recorders[1].state, 'recording', 'morceau suivant pas coupé');
  assert.ok(await until(() => recorders[1].state === 'inactive', 1000), 'coupé par son propre minuteur');
  voice.stop();
});

/* M9 : vidéo retirée ou remplacée */
test('vidéo remplacée (application d\'une seule page) : la nouvelle vidéo est suivie avec ses sous-titres', async () => {
  const dom = voiceDom('<main><video id="a"></video></main>');
  const d = dom.window.document;
  const v1 = d.getElementById('a');
  const c1 = { text: 'One', startTime: 0 };
  const t1 = fakeTrack([c1]);
  Object.defineProperty(v1, 'textTracks', { value: [t1] });
  const voice = dom.window.DDT_createVoice(d, dom.window, {
    transport: fakeTransport([]), transcribe: () => null, watchMs: 30, settings: { target: 'fr', mode: 'replace' }
  });
  voice.start();
  assert.equal(t1.mode, 'hidden');
  const v2 = d.createElement('video');
  const c2 = { text: 'Two', startTime: 0 };
  const t2 = fakeTrack([c2]);
  Object.defineProperty(v2, 'textTracks', { value: [t2] });
  v1.replaceWith(v2);
  assert.ok(await until(() => voice._video() === v2), 'nouvelle vidéo suivie');
  assert.equal(voice.status().active, true);
  assert.equal(voice.status().mode, 'track');
  assert.equal(t1.mode, 'disabled', 'ancienne piste remise comme avant');
  assert.equal(t1.listeners.cuechange.length, 0, 'ancien écouteur retiré');
  assert.equal(t2.mode, 'hidden', 'nouvelle piste utilisée');
  t2.fire([c2]);
  assert.ok(await until(() => overlay(dom).tr === 'TWO'));
  voice.stop();
});

test('vidéo retirée sans remplaçante : arrêt propre, plus de « Lance la vidéo » sans fin', async () => {
  const { dom, video, voice } = audioSetup(() => ({ ok: true, text: 'x' }), { paused: true, stream: fakeStream([]) });
  voice.start();
  assert.ok(await until(() => overlay(dom) && overlay(dom).msg === 'voicePlay', 2000));
  video.remove();
  assert.ok(await until(() => !voice.status().active, 2500), 'arrêté');
  assert.equal(overlay(dom), null, 'bande retirée');
});

/* M7 : aria-live */
test('accessibilité : aria-live seulement sur la traduction, coupé pendant la lecture à voix haute', () => {
  const dom = voiceDom();
  const w = dom.window;
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  w.speechSynthesis = { speaking: false, pending: false, speak: () => {}, cancel: () => {} };
  Object.defineProperty(w.document.querySelector('video'), 'textTracks', { value: [fakeTrack([])] });
  const voice = w.DDT_createVoice(w.document, w, { transport: fakeTransport([]), transcribe: () => null });
  voice.start();
  const sr = overlay(dom).host.shadowRoot;
  assert.equal(sr.querySelectorAll('[aria-live]').length, 1, 'une seule zone annoncée');
  assert.equal(sr.querySelector('.box').hasAttribute('aria-live'), false, 'pas sur toute la bande');
  assert.equal(sr.querySelector('.tr').getAttribute('aria-live'), 'polite');
  overlay(dom).speak.click();
  assert.equal(sr.querySelector('.tr').getAttribute('aria-live'), 'off', 'lecture à voix haute : pas lu deux fois');
  overlay(dom).speak.click();
  assert.equal(sr.querySelector('.tr').getAttribute('aria-live'), 'polite');
  voice.stop();
});

/* YouTube : vidéo suivante */
test('YouTube : vidéo suivante, mémoire des sous-titres et détection remises à zéro', async () => {
  const dom = voiceDom(YT_HTML, { url: 'https://www.youtube.com/watch?v=abc' });
  const w = dom.window;
  const d = w.document;
  const btn = d.querySelector('.ytp-subtitles-button');
  btn.addEventListener('click', () => btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
  const video = d.querySelector('video');
  Object.defineProperty(video, 'paused', { value: false, configurable: true });
  video.captureStream = () => null;
  const box = d.querySelector('.ytp-caption-window-container');
  const voice = w.DDT_createVoice(d, w, {
    transport: fakeTransport([]), transcribe: () => null, ytWaitMs: 600, watchMs: 30, MediaRecorder: function () {}
  });
  voice.start();
  box.innerHTML = '<span class="ytp-caption-segment">first video</span>';
  assert.ok(await until(() => overlay(dom).tr === 'FIRST VIDEO', 3000));
  assert.deepEqual(Object.keys(voice._memo()), ['first video']);
  // navigation interne vers une vidéo sans sous-titres
  box.innerHTML = '';
  w.history.pushState({}, '', '/watch?v=def');
  d.dispatchEvent(new w.Event('yt-navigate-finish'));
  assert.deepEqual(Object.keys(voice._memo()), [], 'mémoire remise à zéro');
  assert.equal(overlay(dom).tr, '', 'ancienne traduction effacée');
  assert.equal(voice.status().mode, 'youtube', 'détection relancée');
  assert.ok(await until(() => voice.status().mode === 'audio', 3000), 'pas de sous-titres : écoute du son');
  // changement de « v= » sans événement, vers une vidéo sous-titrée : on revient aux sous-titres
  w.history.pushState({}, '', '/watch?v=ghi');
  assert.ok(await until(() => voice.status().mode === 'youtube'), 'détection relancée depuis le mode son');
  box.innerHTML = '<span class="ytp-caption-segment">next video</span>';
  assert.ok(await until(() => overlay(dom).tr === 'NEXT VIDEO', 3000));
  assert.equal(btn.getAttribute('aria-pressed'), 'true');
  voice.stop();
  assert.equal(btn.getAttribute('aria-pressed'), 'false', 'sous-titres remis comme avant');
});

/* M10 : plein écran natif de la vidéo */
test('plein écran natif : traductions dans une piste texte DevDocTrad, seulement pendant le plein écran, retirée à l\'arrêt', async () => {
  const dom = voiceDom();
  const w = dom.window;
  const d = w.document;
  const video = d.querySelector('video');
  const cues = [{ text: 'Hello world', startTime: 1, endTime: 2.5 }, { text: 'Run the tests', startTime: 3, endTime: 4 }];
  const src = fakeTrack(cues);
  const list = [src];
  Object.defineProperty(video, 'textTracks', { value: list });
  const added = [];
  video.addTextTrack = (kind, label, language) => {
    const tt = {
      kind, label, language, mode: 'hidden', cues: [],
      addCue(c) { this.cues.push(c); },
      removeCue(c) { const i = this.cues.indexOf(c); if (i >= 0) this.cues.splice(i, 1); }
    };
    list.push(tt);
    added.push(tt);
    return tt;
  };
  w.VTTCue = function (s, e, text) { this.startTime = s; this.endTime = e; this.text = text; };
  let fsEl = null;
  Object.defineProperty(d, 'fullscreenElement', { get: () => fsEl, configurable: true });
  const fs = (el) => { fsEl = el; d.dispatchEvent(new w.Event('fullscreenchange')); };
  const voice = w.DDT_createVoice(d, w, { transport: fakeTransport([]), transcribe: () => null, settings: { target: 'fr', mode: 'replace' } });
  voice.start();
  await until(() => Object.keys(voice._memo()).length === 2);
  assert.equal(added.length, 0, 'hors plein écran natif : aucune piste ajoutée');
  fs(video);
  assert.equal(added.length, 1);
  const own = added[0];
  assert.deepEqual([own.kind, own.label, own.language, own.mode], ['subtitles', 'DevDocTrad', 'fr', 'showing']);
  assert.deepEqual(own.cues.map((c) => [c.startTime, c.endTime, c.text]), [[1, 2.5, 'HELLO WORLD'], [3, 4, 'RUN THE TESTS']],
    'temps des sous-titres d\'origine copiés');
  assert.equal(src.mode, 'hidden', 'sous-titres d\'origine toujours masqués');
  fs(d.querySelector('main'));
  assert.equal(own.mode, 'disabled', 'plein écran d\'un conteneur : la bande suffit');
  fs(null);
  assert.equal(own.mode, 'disabled');
  voice.stop();
  assert.equal(own.cues.length, 0, 'arrêt : traductions retirées');
  assert.equal(own.mode, 'disabled');
  // redémarrage : notre piste n'est jamais prise comme source, ni ajoutée une seconde fois
  voice.start();
  assert.equal(src.mode, 'hidden');
  fs(video);
  assert.equal(added.length, 1, 'piste reprise');
  assert.equal(own.mode, 'showing');
  assert.ok(await until(() => own.cues.length === 2), 'traductions arrivées pendant le plein écran : ajoutées');
  voice.stop();
  fs(null);
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
  assert.ok(H.read('popup.html').includes('id="voiceDubSel"'), 'choix sous-titres / doublage');
  assert.equal(DDT.DEFAULT_SETTINGS.voiceDub, false, 'défaut : sous-titres');
  assert.ok(!/tabCapture|offscreen/.test(JSON.stringify(base)), 'aucune nouvelle permission demandée');
});
