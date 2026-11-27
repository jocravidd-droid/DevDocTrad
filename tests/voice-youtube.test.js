/* Tests de la voix des vidéos YouTube (1.4) : transcription entière lue dans le lecteur (monde de la page),
   jeton « pot » repris des entrées de performance, fichier json3, fusion en phrases, traduction d'avance
   (YouTube « tlang » ou fournisseur), programmation sur video.currentTime (pause, saut, vitesse, publicité,
   vidéo suivante) et replis (texte à l'écran, puis son -> Groq Whisper). Aucun accès réseau réel. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await wait(15); }
  return false;
}
test.after(() => H.closeAll());
/* objets créés dans la fenêtre jsdom (autre « realm ») : comparés en JSON */
const plain = (x) => JSON.parse(JSON.stringify(x));

H.loadBackground();
const ytMain = globalThis.DDT_ytMain;

/* ---------------- Faux YouTube ---------------- */
const YT_HTML = '<div id="movie_player" class="html5-video-player"><video></video>' +
  '<button class="ytp-subtitles-button" aria-pressed="false"></button><div class="ytp-caption-window-container"></div></div>';

const EN = {
  vid1: [
    { tStartMs: 1000, dDurationMs: 4000, segs: [{ utf8: 'Open' }, { utf8: ' the', tOffsetMs: 300 }, { utf8: ' terminal.', tOffsetMs: 600 }] },
    { tStartMs: 2500, dDurationMs: 10, aAppend: 1, segs: [{ utf8: '\n' }] },
    { tStartMs: 4000, dDurationMs: 4000, segs: [{ utf8: 'Then' }, { utf8: ' run', tOffsetMs: 300 }, { utf8: ' npm', tOffsetMs: 600 }, { utf8: ' install.', tOffsetMs: 900 }] },
    { tStartMs: 10000, dDurationMs: 3000, segs: [{ utf8: 'Finally' }, { utf8: ' deploy', tOffsetMs: 400 }, { utf8: ' the', tOffsetMs: 800 }, { utf8: ' app.', tOffsetMs: 1100 }] }
  ],
  vid2: [{ tStartMs: 500, dDurationMs: 3000, segs: [{ utf8: 'Second' }, { utf8: ' video', tOffsetMs: 400 }, { utf8: ' here.', tOffsetMs: 800 }] }]
};
const FR = {
  vid1: [
    { tStartMs: 1000, dDurationMs: 3000, segs: [{ utf8: 'Ouvre le terminal.' }] },
    { tStartMs: 4000, dDurationMs: 3000, segs: [{ utf8: 'Puis lance npm install.' }] },
    { tStartMs: 10000, dDurationMs: 3000, segs: [{ utf8: "Enfin, déploie l'application." }] }
  ],
  vid2: [{ tStartMs: 500, dDurationMs: 3000, segs: [{ utf8: 'Deuxième vidéo ici.' }] }]
};

function playerResponse(id, o) {
  const tracks = o.noCaptions ? [] : [{
    baseUrl: `https://www.youtube.com/api/timedtext?v=${id}&caps=asr&xoaf=5&lang=en&kind=asr&signature=SIG`,
    languageCode: 'en', kind: 'asr', isTranslatable: o.translatable !== false, name: { simpleText: 'English (auto-generated)' }
  }];
  return {
    videoDetails: { videoId: id },
    captions: o.noCaptions ? undefined : { playerCaptionsTracklistRenderer: {
      captionTracks: tracks,
      translationLanguages: (o.tlangs || ['de', 'es']).map((c) => ({ languageCode: c, languageName: { simpleText: c } }))
    } },
    streamingData: { adaptiveFormats: [{ itag: 140, audioTrack: { id: 'en.4', audioIsDefault: true } }] }
  };
}

/* json3 -> srv3 (XML) : même contenu, autre format (le lecteur ne demande pas toujours json3) */
function srv3(events) {
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>' + events.filter((e) => e.segs && e.segs.some((g) => g.utf8.trim()))
    .map((e) => `<p t="${e.tStartMs}" d="${e.dDurationMs}">${esc(e.segs.map((g) => g.utf8).join(''))}</p>`).join('') + '</body></timedtext>';
}
/* Page YouTube simulée, comme le vrai (1.4.1) : le lecteur demande /api/timedtext lui-même (fetch ou XHR,
   au clic sur CC ou via setOption), AUCUNE entrée de performance (sauf o.perf), adresse sans jeton vide,
   CC parfois déjà actif au chargement (o.ccOn), get_transcript innertube (o.innertube). */
function ytSetup(o = {}) {
  const dom = H.makeDom(YT_HTML, { url: 'https://www.youtube.com/watch?v=' + (o.id || 'vid1') });
  dom.window.eval(H.read('voice.js'));
  const w = dom.window;
  const d = w.document;
  const state = { id: o.id || 'vid1', entries: [], fetches: [], player: [], posts: [], lag: 0, track: null };
  if (o.perf) state.entries.push({ name: `https://www.youtube.com/api/timedtext?v=${state.id}&lang=en&kind=asr&fmt=srv3&pot=TOKEN1&c=WEB` });
  const player = d.getElementById('movie_player');
  player.getPlayerResponse = () => {
    // navigation interne : l'ancien lecteur répond encore un moment
    if (state.lag > 0) { state.lag--; return playerResponse(state.prev, o); }
    return playerResponse(state.id, o);
  };
  Object.defineProperty(w.performance, 'getEntriesByType', { configurable: true,
    value: (type) => (type === 'resource' ? state.entries.slice() : []) });
  const btn = d.querySelector('.ytp-subtitles-button');
  if (o.ccOn) btn.setAttribute('aria-pressed', 'true');
  state.ccClicks = 0;
  let cached = !!o.ccOn && !!o.cacheCc;      // piste déjà en mémoire du lecteur : CC off/on ne redemande rien
  // requête du lecteur : passe par window.fetch / XMLHttpRequest DE LA PAGE (vus par les crochets de ytMain)
  function playerRequest(lang, tlang) {
    if (o.neverRequest) return;
    const url = `https://www.youtube.com/api/timedtext?v=${state.id}&lang=${lang}&kind=asr&fmt=${o.fmt || 'json3'}` +
      (tlang ? '&tlang=' + tlang : '') + '&xorb=2&pot=TOKEN2&c=WEB&cver=2.0';
    state.player.push(url);
    if (o.xhr) { const x = new w.XMLHttpRequest(); x.open('GET', url); x.send(); } else w.fetch(url).catch(() => {});
  }
  btn.addEventListener('click', () => {
    state.ccClicks++;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on && !cached) playerRequest((state.track && state.track.lang) || 'en', state.track && state.track.tlang);
    if (on && o.cacheCc) cached = true;
  });
  if (o.api !== false) {
    player.setOption = (mod, opt, v) => {
      if (mod !== 'captions' || opt !== 'track') return;
      state.setOptions = (state.setOptions || []).concat([JSON.parse(JSON.stringify(v))]);
      const next = v && v.languageCode ? { lang: v.languageCode, tlang: v.translationLanguage && v.translationLanguage.languageCode } : null;
      const same = JSON.stringify(next) === JSON.stringify(state.track);
      state.track = next;
      if (next && (!same || next.tlang) && !(o.cacheCc && !next.tlang)) playerRequest(next.lang, next.tlang);
    };
    player.getOption = (mod, opt) => (mod === 'captions' && opt === 'track' && state.track
      ? { languageCode: state.track.lang, kind: 'asr', translationLanguage: state.track.tlang ? { languageCode: state.track.tlang } : undefined } : {});
    player.loadModule = () => {};
  }
  const body = (u) => {
    const v = u.searchParams.get('v');
    if (!u.searchParams.get('pot') || o.emptyAlways) return '';
    const tl = u.searchParams.get('tlang');
    const events = (tl === 'fr' ? FR : EN)[v] || [];
    return u.searchParams.get('fmt') === 'srv3' ? srv3(events) : JSON.stringify({ wireMagic: 'pb3', events });
  };
  w.fetch = (url, init) => {
    const u = new w.URL(url, 'https://www.youtube.com/');
    if (u.pathname === '/youtubei/v1/get_transcript') {
      state.posts.push({ url: u.href, init });
      if (!o.innertube) return Promise.resolve({ ok: false, status: 400, text: () => Promise.resolve('{}') });
      const segs = (EN[state.id] || []).filter((e) => e.segs.some((g) => g.utf8.trim())).map((e) => ({ transcriptSegmentRenderer: {
        startMs: String(e.tStartMs), endMs: String(e.tStartMs + e.dDurationMs), snippet: { runs: [{ text: e.segs.map((g) => g.utf8).join('') }] } } }));
      const json = { actions: [{ updateEngagementPanelAction: { content: { transcriptRenderer: { content: { transcriptSearchPanelRenderer: {
        body: { transcriptSegmentListRenderer: { initialSegments: segs.concat([{ transcriptSectionHeaderRenderer: { snippet: { simpleText: 'Intro' } } }]) } } } } } } } }] };
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(json)) });
    }
    state.fetches.push(u.href);
    const b = body(u);
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(b), clone() { return { text: () => Promise.resolve(b) }; } });
  };
  // XMLHttpRequest de la page (minimal) : le vrai lecteur passe par là
  w.XMLHttpRequest = function () { this.listeners = {}; this.status = 0; this.responseType = ''; this.responseText = ''; };
  w.XMLHttpRequest.prototype.open = function (m, url) { this.url = url; };
  w.XMLHttpRequest.prototype.addEventListener = function (k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); };
  w.XMLHttpRequest.prototype.send = function () {
    const u = new w.URL(this.url);
    state.fetches.push(u.href);
    setTimeout(() => {
      this.status = 200;
      this.responseText = body(u);
      (this.listeners.loadend || []).forEach((f) => f());
    }, 5);
  };
  if (o.ytcfg !== false) {
    w.ytcfg = { data_: { INNERTUBE_API_KEY: 'AIzaFAKE', INNERTUBE_CONTEXT_CLIENT_NAME: 1, INNERTUBE_CLIENT_VERSION: '2.20261127.01.00',
      INNERTUBE_CONTEXT: { client: { clientName: 'WEB', clientVersion: '2.20261127.01.00', hl: 'en', visitorData: 'VIS' } } },
    get(k) { return this.data_[k]; } };
    w.ytInitialData = { currentVideoEndpoint: { watchEndpoint: { videoId: state.id } }, engagementPanels: [{ engagementPanelSectionListRenderer: {
      content: { continuationItemRenderer: { continuationEndpoint: { getTranscriptEndpoint: { params: 'PAGEPARAMS' } } } } } }] };
  }
  // background réel : ytPlayer -> scripting.executeScript (world MAIN) -> ytMain exécutée dans la page
  const { bg, api } = H.makeBackground({ local: { settings: {} } });
  const injections = [];
  api.scripting = {
    executeScript: async (opts) => {
      injections.push(opts);
      if (o.injectFails) throw new Error('Cannot access contents of the page');
      const fn = w.eval('(' + opts.func.toString() + ')');
      const r = await fn.apply(null, opts.args);
      return [{ frameId: 0, result: JSON.parse(JSON.stringify(r)) }];
    }
  };
  const sender = { tab: { id: 9 }, frameId: 0, url: 'https://www.youtube.com/watch?v=' + state.id };
  const ytPlayer = (req) => {
    const m = { type: 'ytPlayer', op: req.op, url: req.url || '', arg: req.arg == null ? '' : req.arg };
    assert.equal(globalThis.DDT_isTrustedSender(m, sender, { runtime: { getURL: () => 'chrome-extension://x/' } }), true);
    return bg.onMessage(m, sender);
  };
  // vidéo qui « joue » : temps et vitesse pilotés par le test
  const video = d.querySelector('video');
  video.volume = 1;
  let paused = false;
  let time = 0;
  let rate = 1;
  Object.defineProperty(video, 'paused', { get: () => paused, configurable: true });
  Object.defineProperty(video, 'currentTime', { get: () => time, set: (x) => { time = x; }, configurable: true });
  Object.defineProperty(video, 'playbackRate', { get: () => rate, set: (x) => { rate = x; }, configurable: true });
  const E = w.Event;
  const ctl = {
    set time(x) { time = x; video.dispatchEvent(new E('timeupdate')); },
    get time() { return time; },
    set rate(x) { rate = x; },
    pause() { paused = true; video.dispatchEvent(new E('pause')); },
    play() { paused = false; video.dispatchEvent(new E('play')); },
    seek(x) { time = x; video.dispatchEvent(new E('seeking')); video.dispatchEvent(new E('seeked')); }
  };
  const tts = { calls: [], stops: 0, pending: [] };
  tts.voices = () => Promise.resolve({ ok: true, engine: 'tts', voices: [{ name: 'Google français', lang: 'fr-FR' }] });
  tts.speak = (x) => { tts.calls.push(x); return new Promise((r) => tts.pending.push(r)); };
  tts.stop = () => { tts.stops++; tts.pending.splice(0).forEach((r) => r({ ok: false, type: 'interrupted' })); return Promise.resolve({ ok: true }); };
  tts.endAll = () => tts.pending.splice(0).forEach((r) => r({ ok: true, type: 'end' }));
  const calls = [];
  const opened = [];
  const voice = w.DDT_createVoice(d, w, Object.assign({
    transport: { translate(texts) { calls.push(Array.from(texts)); return Promise.resolve({ translations: texts.map(H.fakeTranslate) }); } },
    transcribe: o.transcribe || (() => Promise.resolve({ ok: false, error: 'no_groq' })),
    tts, ytPlayer, openOptions: () => { opened.push(1); return Promise.resolve({ ok: true }); },
    rampMs: 0, unduckMs: 10, ytPollMs: 15, ytPotWaitMs: 400, ytInfoWaitMs: 300, ytWaitMs: 200, watchMs: 30,
    settings: Object.assign({ target: 'fr', mode: 'replace', voiceMode: 'dub' }, o.settings || {})
  }, o.deps || {}));
  return { dom, w, d, state, voice, ctl, video, tts, calls, opened, injections, bg, api, btn, player };
}
function band(d) {
  const h = d.querySelector('div[data-tr-ui="voice"]');
  if (!h) return null;
  const sr = h.shadowRoot;
  const open = sr.querySelector('.open');
  return { tr: sr.querySelector('.tr').textContent, orig: sr.querySelector('.orig').textContent, msg: sr.querySelector('.msg').textContent,
    open: open.hidden ? null : open.textContent, openBtn: open };
}

/* ---------------- Outils sans état ---------------- */
test('json3 : mots des sous-titres automatiques horodatés, lignes vides ignorées, texte jamais interprété', () => {
  const { w } = ytSetup();
  const T = w.DDT_ytTools;
  const cues = T.parseTimedText(JSON.stringify({ events: EN.vid1 }));
  assert.deepEqual(plain(cues.map((c) => c.text)), ['Open', ' the', ' terminal.', 'Then', ' run', ' npm', ' install.', 'Finally', ' deploy', ' the', ' app.']);
  assert.equal(cues[0].start, 1);
  assert.equal(cues[1].start, 1.3);
  assert.ok(cues[2].end <= 4 && cues[2].end > 1.6, 'dernier mot borné (pas 4 s entières) : ' + cues[2].end);
  assert.equal(cues[3].first, true);
  assert.equal(cues[4].first, false);
  assert.equal(T.parseTimedText('').length, 0);
  assert.equal(T.parseTimedText('{pas du json').length, 0);
  assert.equal(T.parseTimedText('<html>sorry</html>').length, 0, 'page d\'erreur HTML sans DOMParser : rien');
  const evil = T.parseTimedText(JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: '<img src=x onerror=alert(1)>' }] }] }));
  assert.equal(evil[0].text, '<img src=x onerror=alert(1)>', 'gardé comme du texte (affiché avec textContent)');
});

test('XML : srv1 (<text start dur>) et srv3 (<p t d>), entités décodées', () => {
  const { w } = ytSetup();
  const T = w.DDT_ytTools;
  const srv1 = T.parseTimedText('<?xml version="1.0"?><transcript><text start="1.5" dur="2">it&amp;#39;s here</text><text start="4" dur="1">done.</text></transcript>', w.DOMParser);
  assert.deepEqual(plain(srv1.map((c) => [c.start, c.text])), [[1.5, "it's here"], [4, 'done.']]);
  const srv3 = T.parseTimedText('<timedtext format="3"><body><p t="2000" d="1500">Hello <s>world</s></p></body></timedtext>', w.DOMParser);
  assert.deepEqual(plain(srv3.map((c) => [c.start, c.end, c.text])), [[2, 3.5, 'Hello world']]);
});

test('phrases : ponctuation, silence, 12 s au plus, coupe douce dès 6 s, chinois sans espaces', () => {
  const { w } = ytSetup();
  const T = w.DDT_ytTools;
  const s = T.mergeSentences(T.parseTimedText(JSON.stringify({ events: EN.vid1 })));
  assert.deepEqual(plain(s.map((x) => x.text)), ['Open the terminal.', 'Then run npm install.', 'Finally deploy the app.']);
  assert.equal(s[0].start, 1);
  assert.ok(s[0].end > 1.6 && s[0].end <= 4, 'fin prolongée, jamais après la phrase suivante');
  // sous-titres automatiques sans ponctuation : un mot toutes les 0,4 s pendant 30 s
  const words = [];
  for (let i = 0; i < 75; i++) words.push({ start: i * 0.4, end: i * 0.4 + 0.35, text: ' w' + i, first: false });
  const long = T.mergeSentences(words);
  assert.ok(long.length >= 3, 'découpée : ' + long.length);
  long.forEach((x) => assert.ok(x.end - x.start <= 13.1, 'phrase de ' + (x.end - x.start) + ' s'));
  // silence de 3 s : nouvelle phrase même sans ponctuation
  const pause = T.mergeSentences([{ start: 0, end: 1, text: 'one', first: true }, { start: 4, end: 5, text: 'two', first: true }]);
  assert.deepEqual(plain(pause.map((x) => x.text)), ['one', 'two']);
  const zh = T.mergeSentences([{ start: 0, end: 1, text: '你好', first: true }, { start: 1, end: 2, text: '世界。', first: true }]);
  assert.equal(zh[0].text, '你好世界。');
});

test('piste : langue parlée, écrite à la main avant l\'automatique ; piste humaine dans la langue cible d\'abord', () => {
  const { w } = ytSetup();
  const T = w.DDT_ytTools;
  const tk = (lang, kind) => ({ lang, kind, url: 'https://www.youtube.com/api/timedtext?lang=' + lang + (kind ? '&kind=' + kind : '') });
  assert.equal(T.pickCaptionTrack([tk('en', 'asr'), tk('en', '')], 'en', 'fr').kind, '', 'manuelle avant automatique');
  assert.equal(T.pickCaptionTrack([tk('de', ''), tk('en', 'asr')], 'en', 'fr').lang, 'en', 'langue parlée avant une autre');
  assert.equal(T.pickCaptionTrack([tk('en', ''), tk('fr', '')], 'en', 'fr').lang, 'fr', 'traduction humaine dans la langue cible');
  assert.equal(T.pickCaptionTrack([tk('fr', 'asr'), tk('en', '')], 'en', 'fr').lang, 'en', 'automatique dans la cible : pas préférée');
  assert.equal(T.pickCaptionTrack([tk('ja', 'asr')], '', 'fr').lang, 'ja', 'langue inconnue : celle des sous-titres automatiques');
  assert.equal(T.pickCaptionTrack([], 'en', 'fr'), null);
  assert.equal(T.ytLanguage(['en', 'zh-Hans', 'zh-Hant', 'iw', 'pt'], 'zh-CN'), 'zh-Hans');
  assert.equal(T.ytLanguage(['zh-Hans', 'zh-Hant'], 'zh-TW'), 'zh-Hant');
  assert.equal(T.ytLanguage(['iw'], 'he'), 'iw');
  assert.equal(T.ytLanguage(['pt'], 'pt-BR'), 'pt');
  assert.equal(T.ytLanguage(['de'], 'fr'), '');
});

test('adresses : jeton « pot » du lecteur ajouté à la piste choisie, puis adresse du lecteur, puis baseUrl nue ; json3, sans tlang', () => {
  const { w } = ytSetup();
  const T = w.DDT_ytTools;
  const base = 'https://www.youtube.com/watch?v=vid1';
  const seen = T.observedUrls(['https://www.youtube.com/api/timedtext?v=old&pot=X', '/api/timedtext?v=vid1&lang=en&fmt=srv3',
    'https://www.youtube.com/api/timedtext?v=vid1&lang=de&tlang=fr&pot=P1&c=WEB', 'https://www.youtube.com/youtubei/v1/player'], 'vid1', base);
  assert.equal(seen.length, 2, 'autre vidéo et autre adresse ignorées');
  assert.ok(/pot=P1/.test(seen[0]), 'adresse avec jeton d\'abord');
  const urls = T.captionUrls({ url: 'https://www.youtube.com/api/timedtext?v=vid1&lang=en&kind=asr&signature=S' }, seen[0], base);
  assert.equal(urls.length, 3);
  const u0 = new w.URL(urls[0]);
  assert.deepEqual([u0.searchParams.get('lang'), u0.searchParams.get('signature'), u0.searchParams.get('pot'), u0.searchParams.get('c'),
    u0.searchParams.get('fmt'), u0.searchParams.get('tlang')], ['en', 'S', 'P1', 'WEB', 'json3', null]);
  assert.equal(new w.URL(urls[1]).searchParams.get('lang'), 'de', 'piste du lecteur, jeton compris');
  assert.equal(new w.URL(urls[1]).searchParams.get('tlang'), null);
  assert.equal(new w.URL(urls[2]).searchParams.get('pot'), null, 'baseUrl nue en dernier');
  assert.deepEqual(T.captionUrls({ url: 'https://www.youtube.com/api/timedtext?v=1' }, 'https://evil.example/x?pot=1', base).length, 1,
    'adresse observée qui n\'est pas /api/timedtext ignorée');
});

/* ---------------- Monde de la page (ytMain) et background ---------------- */
test('page (monde MAIN) : pistes, langues de traduction, langue du son et adresses timedtext lues ; fetch limité à /api/timedtext du site', async () => {
  const { w, state } = ytSetup({ perf: true });
  const fn = w.eval('(' + ytMain.toString() + ')');
  const info = fn('info', '');
  assert.equal(info.ok, true);
  assert.equal(info.videoId, 'vid1');
  assert.equal(info.audioLang, 'en');
  assert.deepEqual(plain(info.tracks.map((k) => [k.lang, k.kind, k.translatable, k.name])), [['en', 'asr', true, 'English (auto-generated)']]);
  assert.deepEqual(plain(info.tlangs), ['de', 'es']);
  assert.equal(info.timed.length, 1);
  assert.ok(/pot=TOKEN1/.test(info.timed[0]));
  assert.deepEqual(plain(fn('fetch', 'https://evil.example/api/timedtext?x=1')), { ok: false, error: 'bad_url' });
  assert.deepEqual(plain(fn('fetch', 'https://www.youtube.com/youtubei/v1/player')), { ok: false, error: 'bad_url' });
  assert.equal(state.fetches.length, 0, 'rien demandé hors /api/timedtext');
  const r = await fn('fetch', '/api/timedtext?v=vid1&lang=en&pot=Z&fmt=json3');
  assert.equal(r.ok, true);
  assert.ok(JSON.parse(r.text).events.length > 0);
  assert.deepEqual(plain(fn('nope')), { ok: false, error: 'bad_op' });
  // page sans lecteur ni réponse : pas d'erreur
  w.document.getElementById('movie_player').remove();
  assert.deepEqual([fn('info').ok, fn('info').player, fn('info').tracks.length], [true, false, 0]);
});

test('background : ytPlayer seulement pour un onglet YouTube, world MAIN dans le bon cadre, ytPlayer/openOptions acceptés depuis une page', async () => {
  const { bg, api } = H.makeBackground({ local: { settings: {} } });
  const runs = [];
  api.scripting = { executeScript: (o) => { runs.push(o); return Promise.resolve([{ result: { ok: true, videoId: 'x' } }]); } };
  const yt = { tab: { id: 4 }, frameId: 0, url: 'https://www.youtube.com/watch?v=x' };
  assert.deepEqual(await bg.onMessage({ type: 'ytPlayer', op: 'info' }, yt), { ok: true, videoId: 'x' });
  assert.equal(runs[0].world, 'MAIN');
  assert.deepEqual(runs[0].target, { tabId: 4, frameIds: [0] });
  assert.equal(runs[0].func, globalThis.DDT_ytMain);
  assert.deepEqual(runs[0].args, ['info', '']);
  assert.equal((await bg.onMessage({ type: 'ytPlayer', op: 'info' }, { tab: { id: 4 }, url: 'https://evil.example/' })).error, 'not_youtube');
  assert.equal((await bg.onMessage({ type: 'ytPlayer', op: 'eval' }, yt)).error, 'bad_op');
  assert.equal((await bg.onMessage({ type: 'ytPlayer', op: 'fetch', url: '' }, yt)).error, 'bad_url');
  assert.equal((await bg.onMessage({ type: 'ytPlayer', op: 'info' }, { url: yt.url })).error, 'no_tab');
  assert.equal(runs.length, 1, 'aucune injection refusée n\'est lancée');
  api.scripting.executeScript = () => Promise.reject(new Error('Cannot access contents of url'));
  assert.equal((await bg.onMessage({ type: 'ytPlayer', op: 'info' }, yt)).error, 'inject');
  let opened = 0;
  api.runtime = Object.assign({}, api.runtime, { openOptionsPage: () => { opened++; return Promise.resolve(); } });
  assert.deepEqual(await bg.onMessage({ type: 'openOptions' }, yt), { ok: true });
  assert.equal(opened, 1);
  const ok = globalThis.DDT_isTrustedSender;
  const page = { url: 'https://www.youtube.com/watch?v=x', tab: { id: 3 } };
  const ext = { runtime: { getURL: (p) => 'chrome-extension://abc/' + p } };
  assert.equal(ok({ type: 'ytPlayer' }, page, ext), true);
  assert.equal(ok({ type: 'openOptions' }, page, ext), true);
  assert.equal(ok({ type: 'tabCommand' }, page, ext), false, 'le reste reste réservé aux pages de l\'extension');
});

/* ---------------- Mode transcription ---------------- */
test('transcription : sous-titres activés le temps d\'obtenir le jeton, json3 lu, phrases traduites d\'avance, dites à leur heure', async () => {
  const { d, state, voice, ctl, tts, calls, btn, injections } = ytSetup();
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript'), 'mode transcription : ' + voice.status().mode + ' / ' + voice.status().message);
  assert.ok(injections.every((o) => o.world === 'MAIN'));
  assert.equal(state.ccClicks, 2, 'sous-titres activés puis remis comme avant');
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
  assert.ok(state.player.some((u) => /pot=TOKEN2/.test(u)), 'demande du lecteur provoquée : ' + state.player.join('\n'));
  assert.deepEqual(state.fetches, state.player, 'corps capturé utilisé tel quel : aucune demande rejouée');
  assert.ok(voice.status().diag.some((x) => x.src === 'captured' && /cues \(en\)/.test(x.result)), JSON.stringify(voice.status().diag));
  assert.ok(/^voiceYtTranscript/.test(band(d).msg), band(d).msg);
  assert.ok(d.querySelector('style[data-tr-ui="voice-style"]'), 'sous-titres de YouTube masqués');
  assert.ok(await until(() => calls.length >= 1));
  assert.deepEqual(calls[0], ['Open the terminal.', 'Then run npm install.', 'Finally deploy the app.'], 'traduites d\'avance, en un lot');
  assert.equal(band(d).tr, '', 'avant la première phrase : rien');
  ctl.time = 1.1;
  assert.ok(await until(() => band(d).tr === 'OPEN THE TERMINAL.'));
  assert.ok(await until(() => tts.calls.length === 1), 'dite');
  assert.equal(tts.calls[0].text, 'OPEN THE TERMINAL.');
  assert.equal(tts.calls[0].lang, 'fr-FR');
  const r1 = tts.calls[0].rate;
  assert.ok(r1 >= 0.9 && r1 <= 1.7, 'vitesse calée : ' + r1);
  tts.endAll();
  ctl.time = 4.1;
  assert.ok(await until(() => band(d).tr === 'THEN RUN NPM INSTALL.'));
  assert.ok(await until(() => tts.calls.length === 2));
  assert.equal(calls.length, 1, 'aucune nouvelle demande de traduction');
  voice.stop();
  assert.equal(d.querySelector('style[data-tr-ui="voice-style"]'), null);
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
});

test('transcription : pause = voix coupée, lecture = phrase redite ; saut = phrase du nouvel endroit ; vidéo 2× = voix plus rapide', async () => {
  const { d, voice, ctl, tts } = ytSetup({ ccOn: true });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript'));
  ctl.time = 4.05;
  assert.ok(await until(() => tts.calls.length === 1));
  const normal = tts.calls[0].rate;
  ctl.pause();
  assert.equal(tts.stops, 1, 'pause : voix coupée');
  ctl.play();
  assert.ok(await until(() => tts.calls.length === 2), 'lecture : redite');
  assert.equal(tts.calls[1].text, 'THEN RUN NPM INSTALL.');
  ctl.seek(10.05);
  assert.ok(await until(() => band(d).tr === 'FINALLY DEPLOY THE APP.'));
  assert.ok(await until(() => tts.calls.length === 3));
  assert.equal(tts.calls[2].text, 'FINALLY DEPLOY THE APP.');
  assert.ok(tts.stops >= 2, 'saut : phrase d\'avant coupée');
  assert.ok(normal >= 0.9 && normal <= 1.7);
  tts.endAll();
  // vitesse calée sur le temps qui reste, puis vidéo à 2× : deux fois moins de temps, voix plus rapide
  ctl.seek(5);
  assert.ok(await until(() => tts.calls.length === 4));
  const at1 = tts.calls[3].rate;
  tts.endAll();
  ctl.rate = 2;
  ctl.seek(5);
  assert.ok(await until(() => tts.calls.length === 5));
  assert.ok(tts.calls[4].rate > at1, `plus rapide à 2× : ${tts.calls[4].rate} > ${at1}`);
  // entre deux phrases : bande vide, rien de dit
  tts.endAll();
  ctl.rate = 1;
  ctl.seek(8.5);
  assert.ok(await until(() => band(d).tr === ''));
  await wait(200);
  assert.equal(tts.calls.length, 5);
  voice.stop();
});

test('transcription : sous-titres déjà traduits par YouTube (tlang) : aucune demande au fournisseur, original en bilingue', async () => {
  const { d, state, voice, ctl, tts, calls } = ytSetup({ ccOn: true, tlangs: ['de', 'fr'], settings: { mode: 'bilingual' } });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript'));
  assert.ok(state.fetches.some((u) => /tlang=fr/.test(u) && /pot=TOKEN2/.test(u)), 'traduction demandée à YouTube');
  assert.equal(state.ccClicks, 2, 'CC déjà actif au chargement : coupé puis remis (nouvelle demande du lecteur)');
  assert.equal(d.querySelector('.ytp-subtitles-button').getAttribute('aria-pressed'), 'true', 'laissé actif, comme avant');
  assert.equal(voice.status().diag.filter((x) => x.src === 'cc')[0].result, 'was on: off then on');
  assert.equal(band(d).msg, 'voiceYtByYouTube');
  ctl.time = 1.2;
  assert.ok(await until(() => band(d).tr === 'Ouvre le terminal.'));
  assert.equal(band(d).orig, 'Open the terminal.', 'texte d\'origine de la même fenêtre');
  assert.ok(await until(() => tts.calls.length === 1));
  assert.equal(tts.calls[0].text, 'Ouvre le terminal.');
  ctl.time = 10.2;
  assert.ok(await until(() => band(d).tr === "Enfin, déploie l'application."));
  await wait(100);
  assert.equal(calls.length, 0, 'fournisseur jamais appelé');
  voice.stop();
});

test('transcription : piste non traduisible par YouTube ou langue absente : fournisseur habituel (translateMany)', async () => {
  const { d, voice, ctl, calls } = ytSetup({ ccOn: true, tlangs: ['fr'], translatable: false });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript'));
  ctl.time = 1.2;
  assert.ok(await until(() => band(d).tr === 'OPEN THE TERMINAL.'));
  assert.equal(calls.length, 1);
  voice.stop();
});

test('transcription : publicité (ad-showing) : rien d\'affiché ni de dit', async () => {
  const { d, voice, ctl, tts, player } = ytSetup({ ccOn: true });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript'));
  player.classList.add('ad-showing');
  ctl.time = 1.2;
  await wait(300);
  assert.equal(band(d).tr, '');
  assert.equal(tts.calls.length, 0);
  player.classList.remove('ad-showing');
  assert.ok(await until(() => band(d).tr === 'OPEN THE TERMINAL.'));
  voice.stop();
});

test('transcription : vidéo suivante (navigation interne) : nouvelle transcription, attendue tant que l\'ancien lecteur répond', async () => {
  const { w, d, state, voice, ctl } = ytSetup({ ccOn: true });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript'));
  ctl.time = 1.2;
  assert.ok(await until(() => band(d).tr === 'OPEN THE TERMINAL.'));
  state.prev = 'vid1';
  state.id = 'vid2';
  state.lag = 3;
  state.entries.push({ name: 'https://www.youtube.com/api/timedtext?v=vid2&lang=en&kind=asr&pot=TOKEN3' });
  ctl.time = 0;
  w.history.pushState({}, '', '/watch?v=vid2');
  d.dispatchEvent(new w.Event('yt-navigate-finish'));
  assert.equal(band(d).tr, '', 'ancienne phrase effacée');
  assert.ok(await until(() => voice.status().mode === 'transcript' && state.fetches.some((u) => /v=vid2/.test(u))));
  assert.ok(!state.fetches.some((u) => /v=vid1/.test(u) && /TOKEN3/.test(u)), 'jeton de la nouvelle vidéo jamais mêlé à l\'ancienne');
  ctl.time = 0.6;
  assert.ok(await until(() => band(d).tr === 'SECOND VIDEO HERE.'));
  voice.stop();
});

/* ---------------- Replis ---------------- */
test('repli 1 : page inaccessible (injection refusée) : lecture du texte affiché, message clair', async () => {
  const { d, voice, btn } = ytSetup({ injectFails: true, settings: { voiceMode: 'subs' } });
  voice.start();
  assert.ok(await until(() => band(d) && band(d).msg === 'voiceYtScreen'), band(d) && band(d).msg);
  assert.equal(voice.status().mode, 'youtube');
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'ancien mode : sous-titres activés');
  const box = d.querySelector('.ytp-caption-window-container');
  const seg = d.createElement('span');
  seg.className = 'ytp-caption-segment';
  seg.textContent = 'from the screen';
  box.appendChild(seg);
  assert.ok(await until(() => band(d).tr === 'FROM THE SCREEN', 3000));
  voice.stop();
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
});

test('repli 1 bis : fichier de sous-titres toujours vide (jeton refusé) : lecture du texte affiché', async () => {
  const { d, state, voice } = ytSetup({ emptyAlways: true, settings: { voiceMode: 'subs' } });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'youtube' && band(d).msg === 'voiceYtScreen'));
  assert.ok(state.fetches.length >= 2, 'plusieurs adresses essayées : ' + state.fetches.length);
  assert.ok(state.fetches.some((u) => !/pot=/.test(u)), 'baseUrl nue essayée aussi');
  voice.stop();
});

test('repli 2 : vidéo sans aucun sous-titre : écoute du son ; sans clé Groq, message clair et bouton vers les réglages', async () => {
  const { d, video, voice, opened } = ytSetup({ noCaptions: true, settings: { voiceMode: 'subs' } });
  const w = d.defaultView;
  const track = { kind: 'audio', readyState: 'live', id: 'a1' };
  video.captureStream = () => ({ getAudioTracks: () => [track], getTracks: () => [track] });
  w.MediaStream = function (tracks) { this.tracks = tracks; };
  function Rec() { this.state = 'inactive'; }
  Rec.isTypeSupported = () => true;
  Rec.prototype.start = function () { this.state = 'recording'; };
  Rec.prototype.stop = function () { this.state = 'inactive'; this.ondataavailable({ data: new w.Blob(['x'], { type: 'audio/webm' }) }); this.onstop(); };
  voice.stop();
  const v2 = w.DDT_createVoice(d, w, {
    transport: { translate: (t) => Promise.resolve({ translations: t }) },
    transcribe: () => Promise.resolve({ ok: false, error: 'no_groq' }),
    ytPlayer: () => Promise.resolve({ ok: true, player: true, videoId: 'vid1', tracks: [], tlangs: [], timed: [] }),
    openOptions: () => { opened.push(1); return Promise.resolve(); },
    MediaRecorder: Rec, chunkMs: 30, ytPollMs: 15, settings: { target: 'fr', voiceMode: 'subs' }
  });
  v2.start();
  assert.ok(await until(() => v2.status().mode === 'audio'), 'pas de sous-titres : son, sans passer par le texte à l\'écran');
  assert.ok(await until(() => band(d).msg === 'voiceNoCaptionsGroq'), band(d).msg);
  assert.equal(band(d).open, 'voiceOpenSettings');
  band(d).openBtn.click();
  assert.equal(opened.length, 1, 'réglages ouverts');
  assert.equal(v2.status().active, true, 'la voix reste lancée');
  v2.stop();
});

test('lecteur sans réponse (pas prêt) : jamais pris pour « pas de sous-titres », repli sur le texte à l\'écran', async () => {
  const { d, voice } = ytSetup({ settings: { voiceMode: 'subs' }, deps: {
    ytPlayer: () => Promise.resolve({ ok: true, player: true, videoId: '', tracks: [], tlangs: [], timed: [] }), ytInfoWaitMs: 120 } });
  voice.start();
  assert.ok(await until(() => band(d).msg === 'voiceYtScreen'), band(d).msg);
  assert.equal(voice.status().mode, 'youtube');
  voice.stop();
});

test('sans deps.ytPlayer (ancienne page ou test) : ancien mode, comme avant', async () => {
  const { d, voice } = ytSetup({ deps: { ytPlayer: undefined }, settings: { voiceMode: 'subs' } });
  voice.start();
  assert.equal(voice.status().mode, 'youtube');
  assert.equal(band(d).msg, 'voiceSourceTrack');
  voice.stop();
});

/* ---------------- 1.4.1 : capture réelle (crochets XHR / fetch), CC déjà actif, get_transcript ---------------- */
test('page : crochets XHR et fetch posés une seule fois, seules les réponses /api/timedtext gardées, réponse du lecteur intacte', async () => {
  const { w, state } = ytSetup();
  const fn = w.eval('(' + ytMain.toString() + ')');
  const xp = w.XMLHttpRequest.prototype;
  const i1 = fn('info', '');
  assert.deepEqual(plain(i1.hooks), ['xhr', 'fetch']);
  const open1 = xp.open;
  const fetch1 = w.fetch;
  fn('info', '');
  assert.equal(xp.open, open1, 'XHR pas réenveloppé');
  assert.equal(w.fetch, fetch1, 'fetch pas réenveloppé');
  // XHR du lecteur : corps gardé
  const x = new w.XMLHttpRequest();
  x.open('GET', 'https://www.youtube.com/api/timedtext?v=vid1&lang=en&fmt=json3&pot=P');
  x.send();
  // fetch du lecteur : la réponse rendue est l'originale
  const r = await w.fetch('/api/timedtext?v=vid1&lang=en&fmt=srv3&pot=P2');
  assert.ok(/<timedtext/.test(await r.text()), 'le lecteur reçoit sa réponse');
  await w.fetch('/youtubei/v1/player');   // autre adresse : jamais regardée
  const y = new w.XMLHttpRequest();
  y.open('GET', 'https://www.youtube.com/youtubei/v1/next');
  y.send();
  await wait(30);
  const c = fn('captured', 'vid1');
  assert.equal(c.items.length, 2);
  assert.ok(c.items.some((it) => /fmt=srv3/.test(it.url) && /<p t=/.test(it.text)), 'corps XML capturé');
  assert.ok(c.items.some((it) => /fmt=json3/.test(it.url) && JSON.parse(it.text).events.length), 'corps json3 capturé (XHR)');
  assert.equal(fn('captured', 'autre').items.length, 0, 'autre vidéo : rien');
  // nos propres demandes passent par le fetch d'origine : jamais capturées
  await fn('fetch', '/api/timedtext?v=vid1&lang=en&pot=Z');
  assert.equal(fn('captured', 'vid1').items.length, 2);
  assert.ok(state.fetches.length >= 3);
});

test('transcription : lecteur en XHR, format srv3 (XML), CC déjà actif au chargement : coupé puis remis, corps capturé lu', async () => {
  const { d, state, voice, ctl, btn } = ytSetup({ xhr: true, fmt: 'srv3', ccOn: true });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript'), JSON.stringify(voice.status().diag));
  assert.equal(state.ccClicks, 2, 'off puis on');
  assert.equal(btn.getAttribute('aria-pressed'), 'true', 'laissé actif comme avant');
  assert.deepEqual(state.fetches, state.player, 'aucune demande rejouée : le corps XML reçu par le lecteur suffit');
  ctl.time = 1.1;
  assert.ok(await until(() => band(d).tr === 'OPEN THE TERMINAL.'));
  voice.stop();
});

test('transcription : CC actif et piste en cache (off/on ne redemande rien) : setOption de la piste puis avec tlang, adresse du lecteur rejouée', async () => {
  const { d, state, voice, ctl } = ytSetup({ ccOn: true, cacheCc: true, tlangs: ['de', 'fr'], settings: { mode: 'bilingual' } });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript'), JSON.stringify(voice.status().diag));
  assert.ok((state.setOptions || []).some((o) => o.languageCode === 'en' && o.translationLanguage && o.translationLanguage.languageCode === 'fr'),
    JSON.stringify(state.setOptions));
  assert.ok(state.fetches.some((u) => state.player.indexOf(u) === -1 && /pot=TOKEN2/.test(u) && !/tlang=/.test(u)), 'original rejoué avec le jeton du lecteur');
  assert.ok(voice.status().diag.some((x) => x.src === 'tlang' && x.result === 'captured body'), 'traduction de YouTube prise dans le corps capturé');
  ctl.time = 1.2;
  assert.ok(await until(() => band(d).tr === 'Ouvre le terminal.'));
  assert.equal(band(d).orig, 'Open the terminal.');
  voice.stop();
});

test('transcription : seule get_transcript répond (lecteur muet) : clé, en-têtes du client et params de la page, segments lus', async () => {
  const { d, state, voice, ctl } = ytSetup({ neverRequest: true, innertube: true });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript', 6000), JSON.stringify(voice.status().diag));
  const p = state.posts[0];
  assert.ok(/[?&]key=AIzaFAKE/.test(p.url) && /prettyPrint=false/.test(p.url), p.url);
  assert.equal(p.init.method, 'POST');
  assert.equal(p.init.credentials, 'include');
  assert.equal(p.init.headers['X-Youtube-Client-Name'], '1');
  assert.equal(p.init.headers['X-Youtube-Client-Version'], '2.20261127.01.00');
  assert.equal(p.init.headers['X-Goog-Visitor-Id'], 'VIS');
  const body = JSON.parse(p.init.body);
  assert.equal(body.params, 'PAGEPARAMS', 'params de getTranscriptEndpoint (engagementPanels)');
  assert.equal(body.context.client.clientName, 'WEB');
  assert.ok(voice.status().diag.some((x) => x.src === 'get_transcript' && /segments/.test(x.result)));
  ctl.time = 1.2;
  assert.ok(await until(() => band(d).tr === 'OPEN THE TERMINAL.'));
  voice.stop();
});

test('page : get_transcript défensif (401 connecté -> essai anonyme, params construits, structure inconnue ignorée)', async () => {
  const { w } = ytSetup({ ytcfg: false });
  const calls = [];
  w.fetch = (url, init) => {
    calls.push({ url, cred: init && init.credentials, params: init && JSON.parse(init.body).params });
    if (init.credentials === 'include') return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('') });
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ a: [1, null, 'x', { b: { transcriptSegmentRenderer: {
      startMs: '1500', endMs: '3000', snippet: { simpleText: 'hello there' } } } }, { transcriptSegmentRenderer: { startMs: 'nope', snippet: {} } }] })) });
  };
  const fn = w.eval('(' + ytMain.toString() + ')');
  const r = await fn('transcript', 'vid1abcdef');
  assert.equal(r.ok, true);
  assert.deepEqual(plain(r.segments), [{ start: 1.5, end: 3, text: 'hello there' }]);
  assert.deepEqual(calls.map((c) => c.cred), ['include', 'omit']);
  assert.equal(w.atob(calls[0].params), '\n\u000avid1abcdef', 'params construits (champ 1 = id de la vidéo)');
  assert.deepEqual(plain(r.tried), ['built:401', 'built/anon:200']);
});

test('pistes présentes mais illisibles : jamais « vidéo sans sous-titres », message distinct (clé Groq pour écouter le son)', async () => {
  function Rec() { this.state = 'inactive'; }
  Rec.isTypeSupported = () => true;
  Rec.prototype.start = function () { this.state = 'recording'; };
  Rec.prototype.stop = function () { this.state = 'inactive'; this.ondataavailable({ data: new this.W.Blob(['x'], { type: 'audio/webm' }) }); this.onstop(); };
  const s = ytSetup({ neverRequest: true, settings: { voiceMode: 'subs' }, deps: { chunkMs: 30, MediaRecorder: Rec } });
  Rec.prototype.W = s.w;
  const track = { kind: 'audio', readyState: 'live', id: 'a1' };
  s.video.captureStream = () => ({ getAudioTracks: () => [track], getTracks: () => [track] });
  s.w.MediaStream = function (tracks) { this.tracks = tracks; };
  s.voice.start();
  assert.ok(await until(() => s.voice.status().mode === 'audio', 6000), JSON.stringify(s.voice.status().diag));
  assert.ok(await until(() => band(s.d).msg === 'voiceYtUnreadableGroq'), band(s.d).msg);
  const diag = s.voice.status().diag;
  ['player', 'captured', 'cc', 'replay (bare)', 'get_transcript', 'source', 'groq'].forEach((k) => assert.ok(diag.some((x) => x.src === k), 'diagnostic : ' + k));
  s.voice.stop();
});

test('entrées de performance : simple bonus, rejouées si rien n\'est capturé', async () => {
  const { voice, state } = ytSetup({ neverRequest: true, perf: true, api: false });
  voice.start();
  assert.ok(await until(() => voice.status().mode === 'transcript', 6000), JSON.stringify(voice.status().diag));
  assert.ok(state.fetches.some((u) => /pot=TOKEN1/.test(u) && /fmt=json3/.test(u)), state.fetches.join('\n'));
  voice.stop();
});

test('background : ytPlayer track/captured/transcript : seulement des codes de langue et un id de vidéo', async () => {
  const { bg, api } = H.makeBackground({ local: { settings: {} } });
  const runs = [];
  api.scripting = { executeScript: (o) => { runs.push(o); return Promise.resolve([{ result: { ok: true } }]); } };
  const yt = { tab: { id: 4 }, frameId: 0, url: 'https://www.youtube.com/watch?v=x' };
  await bg.onMessage({ type: 'ytPlayer', op: 'track', arg: { lang: 'en', kind: 'asr', tlang: 'fr"); alert(1', extra: 'x' } }, yt);
  assert.deepEqual(runs[0].args, ['track', { lang: 'en', kind: 'asr' }]);
  await bg.onMessage({ type: 'ytPlayer', op: 'captured', arg: '../x' }, yt);
  assert.deepEqual(runs[1].args, ['captured', '']);
  assert.equal((await bg.onMessage({ type: 'ytPlayer', op: 'transcript', arg: '' }, yt)).error, 'bad_arg');
  await bg.onMessage({ type: 'ytPlayer', op: 'transcript', arg: 'QTR4S_uP5Mc' }, yt);
  assert.deepEqual(runs[2].args, ['transcript', 'QTR4S_uP5Mc']);
  assert.equal(runs.length, 3);
});
