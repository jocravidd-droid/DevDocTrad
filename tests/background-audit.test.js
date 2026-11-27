/* Tests des correctifs de l'audit du background : plafond de dépense, nombre de requêtes borné,
 * états partagés sérialisés, jetons de sortie et dépense réelle, cache par entrée, expéditeurs
 * des messages, Whisper séparé, intervalle Gemini, découpage et 429, pages sensibles, délai du corps. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');
const { makeBackground, key, response, okReply, textsFromRequest, fakeTranslate } = H;

function settings(extra) { return Object.assign({ target: 'fr', explainTerms: false }, extra || {}); }
const TEXTS = ['Hello <1>world</1>.', 'Read the {1|README.md} file first.'];
const many = (n) => Array.from({ length: n }, (_, i) => 'Sentence number ' + i + ' to translate.');
const DDT = () => globalThis.DDT;

/* Stockage lent (comme le vrai, asynchrone) : les lectures et écritures de plusieurs onglets
 * s'entremêlent, ce qui fait apparaître les courses entre lecture et écriture. */
function slowStorage(api, areas = ['local', 'session']) {
  const tick = () => new Promise((r) => setTimeout(r, 2));
  for (const area of areas.map((a) => api.storage[a])) {
    if (!area) continue;
    const get = area.get;
    const set = area.set;
    area.get = (k) => tick().then(() => get(k));
    area.set = (o) => tick().then(() => set(o));
  }
}

/* Réponse mal formée : un texte de moins que demandé */
function malformed(url, init) {
  const t = textsFromRequest(url, init).user.texts;
  return okReply(url, t.slice(0, Math.max(0, t.length - 1)).map(fakeTranslate));
}
function withUsage(res, usage) {
  const txt = res._txt;
  return Object.assign({}, res, { text: () => txt.then((s) => JSON.stringify(Object.assign(JSON.parse(s), usage))) });
}
function okWithUsage(url, init, usage) {
  const r = okReply(url, textsFromRequest(url, init).user.texts.map(fakeTranslate));
  return withUsage(Object.assign(r, { _txt: r.text() }), usage);
}

/* ---------- 1. Plafond de dépense d'une clé payante ---------- */
test('clé payante : découpages et réessais ne dépassent jamais le plafond (réservation avant l\'appel)', async () => {
  const cap = 0.005;
  const env = makeBackground({
    local: { settings: settings(), keys: [key('p', 'mistral', { tier: 'paid', dailyCap: cap, priceIn: 1, priceOut: 3 })] },
    handler: malformed
  });
  const r = await env.bg.translateTexts(many(40), { keyId: 'p' });
  const u = env.api.storage.local._data().usage.perKey.p;
  assert.ok(u.cost <= cap, 'dépense ' + u.cost + ' <= plafond ' + cap);
  assert.equal(u.requests, env.fetch.calls.length, 'chaque envoi compté');
  assert.equal(r.error, 'error');
  assert.match(r.message, /errPaidCap/);
});

test('clé payante : deux onglets en parallèle ne dépassent pas le plafond', async () => {
  // plafond qui laisse passer un seul appel
  const one = makeBackground({ local: { settings: settings(), keys: [key('p', 'mistral', { tier: 'paid', dailyCap: 10, priceIn: 1, priceOut: 3 })] } });
  await one.bg.translateTexts(['Text A to translate.'], { keyId: 'p' });
  const c1 = one.api.storage.local._data().usage.perKey.p.cost;
  const cap = c1 * 1.5;
  const env = makeBackground({ local: { settings: settings(), keys: [key('p', 'mistral', { tier: 'paid', dailyCap: cap, priceIn: 1, priceOut: 3 })] } });
  slowStorage(env.api);
  const rs = await Promise.all([
    env.bg.translateTexts(['Text A to translate.'], { keyId: 'p' }),
    env.bg.translateTexts(['Text B to translate.'], { keyId: 'p' })
  ]);
  const u = env.api.storage.local._data().usage.perKey.p;
  assert.equal(env.fetch.calls.length, 1, 'un seul appel envoyé');
  assert.ok(u.cost <= cap, 'dépense ' + u.cost + ' <= ' + cap);
  assert.equal(rs.filter((r) => r.error === 'error' && /errPaidCap/.test(r.message)).length, 1);
});

test('clé payante : le second envoi (repli sans response_format) est compté et contrôlé', async () => {
  const first = makeBackground({ local: { settings: settings(), keys: [key('p', 'groq', { tier: 'paid', dailyCap: 10, priceIn: 1, priceOut: 3 })] } });
  await first.bg.translateTexts(TEXTS, { keyId: 'p' });
  const c1 = first.api.storage.local._data().usage.perKey.p.cost;
  const handler = (url, init) => {
    const b = JSON.parse(init.body);
    if (b.response_format) return response(400, { error: { message: 'response_format json_object is not supported' } });
    return okReply(url, JSON.parse(b.messages[1].content).texts.map(fakeTranslate));
  };
  let env = makeBackground({ local: { settings: settings(), keys: [key('p', 'groq', { tier: 'paid', dailyCap: 10, priceIn: 1, priceOut: 3 })] }, handler });
  let r = await env.bg.translateTexts(TEXTS, { keyId: 'p' });
  assert.equal(r.error, undefined);
  let u = env.api.storage.local._data().usage.perKey.p;
  assert.equal(u.requests, 2, 'deux envois comptés');
  assert.ok(u.cost >= 2 * c1 - 1e-9, 'deux réservations : ' + u.cost + ' vs ' + c1);
  // plafond qui ne permet qu'un envoi : le second est refusé avant de partir
  env = makeBackground({ local: { settings: settings(), keys: [key('p', 'groq', { tier: 'paid', dailyCap: c1 * 1.5, priceIn: 1, priceOut: 3 })] }, handler });
  r = await env.bg.translateTexts(TEXTS, { keyId: 'p' });
  assert.equal(env.fetch.calls.length, 1, 'second envoi bloqué par le plafond');
  assert.match(r.message, /errPaidCap/);
});

/* ---------- 2. Avalanche de requêtes ---------- */
test('réponses mal formées : nombre total d\'appels borné par morceau, textes laissés en original', async () => {
  const { bg, fetch } = makeBackground({ local: { settings: settings(), keys: [key('a', 'mistral', { minIntervalMs: 0 })] }, handler: malformed });
  const r = await bg.translateTexts(many(40), {});
  assert.ok(fetch.calls.length <= 6 + 8, 'appels : ' + fetch.calls.length);
  assert.equal(r.translations.length, 40);
  assert.ok(r.translations.every((v) => v === null), 'textes en original');
});

/* ---------- 3. États partagés sérialisés ---------- */
test('écart minimal respecté entre deux onglets sur la même clé', async () => {
  const stamps = [];
  let env;
  env = makeBackground({
    local: { settings: settings(), keys: [key('a', 'groq')] },
    handler: (url, init) => { stamps.push(env.now()); return okReply(url, textsFromRequest(url, init).user.texts.map(fakeTranslate)); }
  });
  // seul l'état de session est lent : l'horloge simulée avance d'un coup pendant une attente,
  // il ne faut pas qu'une autre étape lente décale le départ de la première requête
  slowStorage(env.api, ['session']);
  await Promise.all([env.bg.translateTexts(['First page text.'], {}), env.bg.translateTexts(['Second page text.'], {})]);
  assert.equal(stamps.length, 2);
  assert.ok(Math.abs(stamps[1] - stamps[0]) >= 2500, 'écart : ' + (stamps[1] - stamps[0]));
});

test('erreurs de clé simultanées : une clé désactivée par un onglet n\'est pas réactivée par un autre', async () => {
  // La première requête répond après la seconde : chaque onglet traite son erreur avec un état
  // lu avant l'erreur de l'autre. Les deux ordres sont essayés.
  for (const [late, early] of [[401, 429], [429, 401]]) {
    let release;
    const gate = new Promise((r) => { release = r; });
    const reply = (st) => (st === 401 ? response(401, { error: 'invalid api key' }) : response(429, { error: { message: 'Rate limit' } }));
    const { bg, api, fetch } = makeBackground({
      local: { settings: settings(), keys: [key('a', 'groq')] },
      handler: (url, init, n) => {
        if (n === 1) return gate.then(() => reply(late));
        setTimeout(release, 20);
        return reply(early);
      }
    });
    await Promise.all([bg.translateTexts(['Tab one text.'], {}), bg.translateTexts(['Tab two text.'], {})]);
    assert.equal(fetch.calls.length, 2);
    const st = api.storage.session._data();
    assert.equal(st.disabled.a, 'auth', 'désactivation gardée (' + late + ' en dernier)');
    assert.ok(st.pauses.a > 0, 'pause gardée (' + late + ' en dernier)');
  }
});

test('compteur de requêtes juste avec plusieurs onglets en parallèle', async () => {
  const { bg, api } = makeBackground({ local: { settings: settings(), keys: [key('a', 'groq', { minIntervalMs: 0 })] } });
  slowStorage(api);
  await Promise.all([1, 2, 3].map((i) => bg.translateTexts(['Parallel text ' + i + '.'], { keyId: 'a' })));
  assert.equal(api.storage.local._data().usage.perKey.a.requests, 3);
});

/* ---------- 4. Jetons de sortie plafonnés, dépense réelle ---------- */
test('clé payante : max_tokens envoyé et dépense corrigée avec l\'usage réel (OpenAI et Gemini)', async () => {
  let env = makeBackground({
    local: { settings: settings(), keys: [key('p', 'mistral', { tier: 'paid', dailyCap: 1, priceIn: 2, priceOut: 6 })] },
    handler: (url, init) => okWithUsage(url, init, { usage: { prompt_tokens: 1000, completion_tokens: 100 } })
  });
  await env.bg.translateTexts(TEXTS, { keyId: 'p' });
  const chars = TEXTS.reduce((a, s) => a + s.length, 0);
  const body = JSON.parse(env.fetch.calls[0].init.body);
  assert.equal(body.max_tokens, DDT().maxOutputTokens(chars, 'fr'));
  assert.ok(body.max_tokens >= 256 && body.max_tokens < 400);
  assert.ok(Math.abs(env.api.storage.local._data().usage.perKey.p.cost - (1000 * 2 + 100 * 6) / 1e6) < 1e-9, 'dépense réelle');

  env = makeBackground({
    local: { settings: settings(), keys: [key('g', 'gemini', { tier: 'paid', dailyCap: 1, priceIn: 1, priceOut: 4 })] },
    handler: (url, init) => okWithUsage(url, init, { usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 50 } })
  });
  await env.bg.translateTexts(TEXTS, { keyId: 'g' });
  const gb = JSON.parse(env.fetch.calls[0].init.body);
  assert.equal(gb.generationConfig.maxOutputTokens, DDT().maxOutputTokens(chars, 'fr'));
  assert.ok(Math.abs(env.api.storage.local._data().usage.perKey.g.cost - (500 * 1 + 50 * 4) / 1e6) < 1e-9);

  // clé gratuite : pas de plafond de sortie imposé
  env = makeBackground({ local: { settings: settings(), keys: [key('f', 'mistral')] } });
  await env.bg.translateTexts(TEXTS, {});
  assert.equal(JSON.parse(env.fetch.calls[0].init.body).max_tokens, undefined);
});

/* ---------- 5. Cache : une entrée par clé, lecture ciblée, migration ---------- */
async function hashOf(text, target = 'fr') {
  const d = DDT();
  const gh = await d.sha256hex(JSON.stringify([]));
  return d.sha256hex([d.PROMPT_VERSION, target, 0, gh, text].join('\u0001'));
}

test('cache : ancien format converti puis supprimé, lecture des seules clés demandées', async () => {
  H.loadBackground();
  const h = await hashOf('Hello there.');
  const old = { [h]: { t: 'Bonjour.', ts: 1 }, other: { t: 'Autre', ts: 2 } };
  const env = makeBackground({ local: { settings: settings(), keys: [key('a', 'gemini')], cache: old } });
  const asked = [];
  const get = env.api.storage.local.get;
  env.api.storage.local.get = (k) => { asked.push(k); return get(k); };
  const r = await env.bg.translateTexts(['Hello there.'], {});
  assert.equal(r.fromCache, true);
  assert.deepEqual(r.translations, ['Bonjour.']);
  assert.equal(env.fetch.calls.length, 0);
  const data = env.api.storage.local._data();
  assert.equal(data.cache, undefined, 'ancienne clé supprimée');
  assert.equal(data['c:' + h].t, 'Bonjour.');
  assert.ok(data['c:other']);
  assert.equal(Object.keys(data.cacheIndex).length, 2);
  // lecture suivante : seulement l'entrée demandée, jamais tout le cache
  asked.length = 0;
  await env.bg.translateTexts(['Hello there.'], {});
  const flat = asked.flatMap((k) => (Array.isArray(k) ? k : [k]));
  assert.ok(flat.includes('c:' + h));
  assert.ok(!flat.includes('c:other') && !flat.includes('cache'), JSON.stringify(flat));
  // nouvelle entrée : seules les nouvelles clés sont écrites
  const sets = [];
  const set = env.api.storage.local.set;
  env.api.storage.local.set = (o) => { sets.push(Object.keys(o)); return set(o); };
  await env.bg.translateTexts(['A brand new sentence.'], {});
  await env.bg.flushCache();
  const written = sets.flat().filter((k) => k.startsWith('c:'));
  assert.deepEqual(written, ['c:' + await hashOf('A brand new sentence.')]);
  const info = await env.bg.cacheInfo();
  assert.equal(info.entries, 3);
  assert.ok(info.bytes > 0);
  await env.bg.clearCache();
  assert.deepEqual(await env.bg.cacheInfo(), { entries: 0, bytes: 0 });
  assert.equal(Object.keys(env.api.storage.local._data()).filter((k) => k.startsWith('c:')).length, 0);
});

test('cache : éviction des plus anciennes entrées au-delà de la taille maximale', async () => {
  const old = {};
  for (let i = 0; i < 6001; i++) old['h' + i] = { t: 'T' + i, ts: i + 1 };
  const env = makeBackground({ local: { settings: settings(), keys: [key('a', 'gemini')], cache: old } });
  await env.bg.translateTexts(['Fresh sentence to translate.'], {});
  await env.bg.flushCache();
  const data = env.api.storage.local._data();
  const keys = Object.keys(data).filter((k) => k.startsWith('c:'));
  assert.equal(keys.length, 5400);
  assert.equal(Object.keys(data.cacheIndex).length, 5400);
  assert.equal(data['c:h0'], undefined, 'plus ancienne retirée');
  assert.ok(keys.includes('c:' + await hashOf('Fresh sentence to translate.')), 'nouvelle gardée');
});

/* ---------- 6. Expéditeurs des messages ---------- */
test('messages : un script de contenu n\'a droit qu\'à autoCheck, transcribe et la voix (speak, stopSpeaking, ttsVoices)', () => {
  H.loadBackground();
  const ok = globalThis.DDT_isTrustedSender;
  const api = { runtime: { getURL: (p) => 'chrome-extension://abc/' + p } };
  const page = { url: 'https://evil.example/page', tab: { id: 3 } };
  const popup = { url: 'chrome-extension://abc/popup.html' };
  assert.equal(ok({ type: 'autoCheck' }, page, api), true);
  assert.equal(ok({ type: 'transcribe' }, page, api), true);
  for (const type of ['speak', 'stopSpeaking', 'ttsVoices']) assert.equal(ok({ type }, page, api), true, type);
  for (const type of ['testKey', 'listModels', 'getState', 'clearCache', 'resetKey', 'addAutoSite', 'tabCommand', 'voiceCommand', 'syncAuto']) {
    assert.equal(ok({ type }, page, api), false, type + ' refusé depuis une page');
    assert.equal(ok({ type }, popup, api), true, type + ' accepté depuis le popup');
  }
  assert.equal(ok({ type: 'testKey' }, { url: 'chrome-extension://other/popup.html' }, api), false, 'autre extension');
  assert.equal(ok({ type: 'testKey' }, {}, api), false, 'sans adresse');
  assert.equal(ok({ type: 'testKey' }, { url: 'moz-extension://abc/options.html' }, { runtime: { getURL: (p) => 'moz-extension://abc/' + p } }), true);
});

/* ---------- 7. Whisper séparé de la traduction ---------- */
test('Whisper : pause et compteur à part, la traduction en pause ou au quota n\'empêche pas la voix', async () => {
  const AUDIO = Buffer.from('audio').toString('base64');
  const day = DDT().todayKey(new Date(1_800_000_000_000));
  const { bg, api } = makeBackground({
    local: { settings: settings(), keys: [key('g', 'groq', { maxRequestsPerDay: 5 })], usage: { day, perKey: { g: { requests: 5, cost: 0 } } } },
    session: { pauses: {}, disabled: {}, lastReq: {} },
    handler: () => response(200, { text: 'Hello from the video.' })
  });
  const r = await bg.transcribe({ audio: AUDIO });
  assert.equal(r.ok, true, 'quota du chat atteint : la voix marche');
  assert.equal(api.storage.local._data().usage.perKey.g.requests, 5, 'quota du chat intact');
  assert.equal(api.storage.local._data().usage.perKey['g:whisper'].requests, 1);
  await api.storage.session.set({ pauses: { g: 1_800_000_000_000 + 600000 } });
  assert.equal((await bg.transcribe({ audio: AUDIO })).ok, true, 'chat en pause : la voix marche');
});

/* ---------- 8. Gemini gratuit : 6,5 s entre deux requêtes ---------- */
test('Gemini gratuit : au moins 6,5 s entre deux requêtes', async () => {
  assert.equal(DDT().PROVIDERS.gemini.minIntervalMs, 6500);
  const stamps = [];
  let env;
  env = makeBackground({
    local: { settings: settings(), keys: [key('g', 'gemini')] },
    handler: (url, init) => { stamps.push(env.now()); return okReply(url, textsFromRequest(url, init).user.texts.map(fakeTranslate)); }
  });
  await env.bg.translateTexts(['One text.'], {});
  await env.bg.translateTexts(['Another text.'], {});
  assert.ok(stamps[1] - stamps[0] >= 6500, 'écart : ' + (stamps[1] - stamps[0]));
});

/* ---------- 9. 429 au milieu d'un découpage ---------- */
test('429 au milieu d\'un découpage : les moitiés déjà traduites sont gardées', async () => {
  const texts = ['Alpha text.', 'Beta text.', 'Gamma text.', 'Delta text.'];
  const sent = [];
  const { bg } = makeBackground({
    local: { settings: settings(), keys: [key('a', 'groq'), key('b', 'mistral', { order: 1 })] },
    handler: (url, init, n) => {
      const t = textsFromRequest(url, init).user.texts;
      sent.push([url.includes('groq') ? 'a' : 'b', t.length]);
      if (url.includes('groq')) {
        if (n === 1) return malformed(url, init);
        if (n === 3) return response(429, { error: { message: 'Rate limit' } });
      }
      return okReply(url, t.map(fakeTranslate));
    }
  });
  const r = await bg.translateTexts(texts, {});
  assert.equal(r.error, undefined);
  assert.deepEqual(r.translations, texts.map(fakeTranslate));
  assert.deepEqual(sent, [['a', 4], ['a', 2], ['a', 2], ['b', 2]], 'seule la moitié non traduite repart');
});

/* ---------- 10. Pages sensibles hors cache ---------- */
test('page sensible : traductions jamais écrites dans le cache', async () => {
  const env = makeBackground({ local: { settings: settings(), keys: [key('a', 'gemini')] } });
  await env.bg.translateTexts(TEXTS, { sensitive: true });
  await env.bg.flushCache();
  assert.equal(Object.keys(env.api.storage.local._data()).filter((k) => k.startsWith('c:')).length, 0);
  await env.bg.translateTexts(TEXTS, {});
  assert.equal(env.fetch.calls.length, 2, 'rien en cache : nouvel appel');
});

/* ---------- 11. Délai appliqué jusqu'à la fin de la lecture du corps ---------- */
test('corps de réponse bloqué : le délai coupe la lecture, pas de blocage', { timeout: 5000 }, async () => {
  const { bg, fetch } = makeBackground({
    local: { settings: settings(), keys: [key('a', 'groq', { timeoutMs: 40 })] },
    handler: (url, init) => ({
      ok: true, status: 200, headers: { get: () => null },
      text: () => new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
      })
    })
  });
  const r = await bg.translateTexts(TEXTS, {});
  assert.equal(fetch.calls.length, 2, 'un essai + un nouvel essai après le délai');
  assert.ok(r.error, 'erreur renvoyée au lieu d\'attendre sans fin');
});

/* ---------- Interface : clé sans clé d'API, prix invalides ---------- */
test('état : une clé avec modèle mais sans clé d\'API n\'est ni configurée ni disponible', async () => {
  const ollama = { id: 'ol', provider: 'ollama', label: 'Ollama', tier: 'local', enabled: true, modelEasy: 'm' };
  const { bg } = makeBackground({ local: { settings: settings(), keys: [key('a', 'groq', { key: '' }), ollama] } });
  const st = await bg.publicState();
  const a = st.keys.find((k) => k.id === 'a');
  assert.equal(a.configured, false);
  assert.equal(a.available, false);
  assert.equal(a.reason, 'no_key');
  const o = st.keys.find((k) => k.id === 'ol');
  assert.equal(o.configured, true, 'Ollama sans clé d\'API reste configuré');
  assert.equal(o.available, true);
});

test('clé payante : prix négatif ou non numérique traité comme non réglé, jamais utilisée', async () => {
  for (const bad of [{ priceIn: -1, priceOut: 1 }, { priceIn: 1, priceOut: 'abc' }, { priceIn: '0.1abc', priceOut: 1 }, { priceIn: 1, priceOut: 1, dailyCap: -5 }, { priceIn: 1, priceOut: 1, dailyCap: 'x' }]) {
    const k = key('p', 'mistral', Object.assign({ tier: 'paid', dailyCap: 1 }, bad));
    const { bg, fetch } = makeBackground({ local: { settings: settings(), keys: [k] } });
    const r = await bg.translateTexts(TEXTS, { keyId: 'p' });
    assert.equal(r.error, 'error', JSON.stringify(bad));
    assert.match(r.message, /errPaidUnset/);
    assert.equal(fetch.calls.length, 0);
  }
});
