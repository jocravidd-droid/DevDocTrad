/* Outils communs aux tests : DOM jsdom, faux stockage, faux fournisseurs. Aucun appel réseau réel. */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = path.join(__dirname, '..', 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

/* ---------- Faux « traducteur » : met le texte en majuscules, garde les marqueurs ---------- */
function fakeTranslate(src) {
  const parts = src.split(/(<\/?\d+>|\{\d+(?:\|[^{}]*)?\}|&[a-z#0-9]+;)/g);
  return parts.map((p) => {
    if (!p) return '';
    const atom = p.match(/^\{(\d+)(?:\|[^{}]*)?\}$/);
    if (atom) return '{' + atom[1] + '}';
    if (/^<\/?\d+>$/.test(p) || /^&[a-z#0-9]+;$/.test(p)) return p;
    // garde les URL et chemins tels quels (comme le ferait un bon modèle)
    return p.replace(/(https?:\/\/\S+|(?:~|\.{1,2})?\/[\w.@-]+(?:\/[\w.@-]*)+)|([^\s]+)/g, (m, keep, word) => keep || word.toUpperCase());
  }).join('');
}

/* ---------- DOM avec le moteur chargé ---------- */
const openDoms = [];
function closeAll() { while (openDoms.length) { try { openDoms.pop().window.close(); } catch (e) { /* déjà fermé */ } } }

function makeDom(html, opts = {}) {
  const dom = new JSDOM(html, {
    url: opts.url || 'https://docs.example.dev/guide/intro',
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });
  const w = dom.window;
  w.__DDT_TEST = true;
  w.chrome = {
    runtime: {},
    i18n: { getMessage: () => '', getUILanguage: () => opts.uiLang || 'fr' }
  };
  w.eval(read('shared.js'));
  w.eval(read('content.js'));
  openDoms.push(dom);
  return dom;
}

function makeEngine(dom, opts = {}) {
  const calls = [];
  const transport = opts.transport || {
    translate(texts) {
      calls.push(Array.from(texts));
      const tr = texts.map(opts.translator || fakeTranslate);
      return Promise.resolve({ translations: tr, via: { label: 'Fake', local: false } });
    }
  };
  const engine = dom.window.DDT_createEngine(dom.window.document, dom.window, {
    transport,
    settings: Object.assign({ target: 'fr', mode: 'replace' }, opts.settings || {}),
    noBadge: opts.noBadge !== false
  });
  return { engine, calls };
}

/* ---------- Faux stockage façon chrome.storage ---------- */
function fakeArea(initial) {
  let data = JSON.parse(JSON.stringify(initial || {}));
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  return {
    get(keys) {
      const out = {};
      if (keys == null) Object.assign(out, clone(data));
      else (Array.isArray(keys) ? keys : [keys]).forEach((k) => { if (k in data) out[k] = clone(data[k]); });
      return Promise.resolve(out);
    },
    set(obj) { Object.assign(data, clone(obj)); return Promise.resolve(); },
    remove(keys) { (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete data[k]); return Promise.resolve(); },
    _data: () => data
  };
}

function fakeApi(local, session) {
  return {
    storage: { local: fakeArea(local), session: session === null ? undefined : fakeArea(session || {}) },
    permissions: { contains: () => Promise.resolve(true), remove: () => Promise.resolve(true) },
    scripting: null,
    tabs: null
  };
}

/* ---------- Faux fournisseurs ---------- */
function response(status, body, headers = {}) {
  const txt = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(txt),
    headers: { get: (h) => headers[h.toLowerCase()] || null }
  };
}

function textsFromRequest(url, init) {
  const body = JSON.parse(init.body);
  let user;
  if (url.includes('generateContent')) user = body.contents[0].parts[0].text;
  else user = body.messages[1].content;
  return { body, user: JSON.parse(user) };
}

function okReply(url, translations, extra = {}) {
  const payload = JSON.stringify(Object.assign({ translations }, extra));
  if (url.includes('generateContent')) return response(200, { candidates: [{ content: { parts: [{ text: payload }] } }] });
  if (url.includes('/api/chat')) return response(200, { message: { content: payload } });
  return response(200, { choices: [{ message: { content: payload } }] });
}

/* fetch simulé : handler(url, init, n) -> réponse ; garde toutes les requêtes */
function fakeFetch(handler) {
  const calls = [];
  const f = (url, init) => {
    calls.push({ url, init });
    try { return Promise.resolve(handler(url, init, calls.length)); } catch (e) { return Promise.reject(e); }
  };
  f.calls = calls;
  return f;
}

function translatingHandler(map) {
  return (url, init) => {
    const { user } = textsFromRequest(url, init);
    return okReply(url, user.texts.map(map || fakeTranslate));
  };
}

/* ---------- Background chargé dans Node ---------- */
let bgLoaded = false;
function loadBackground() {
  if (!bgLoaded) {
    globalThis.__DDT_TEST = true;
    require(path.join(SRC, 'shared.js'));
    require(path.join(SRC, 'background.js'));
    bgLoaded = true;
  }
  return globalThis.DDT_createBackground;
}

function makeBackground({ local, session, handler, clock }) {
  const create = loadBackground();
  const api = fakeApi(local, session);
  const fetch = fakeFetch(handler || translatingHandler());
  const logs = [];
  let t = clock || 1_800_000_000_000;
  const bg = create({
    api, fetch,
    now: () => t,
    sleep: (ms) => { t += ms; return Promise.resolve(); },
    log: (...a) => logs.push(a.join(' '))
  });
  return { bg, api, fetch, logs, advance: (ms) => { t += ms; }, now: () => t };
}

function key(id, provider, extra = {}) {
  return Object.assign({
    id, provider, label: id, key: 'TEST-KEY-' + id + '-0123456789abcdef', tier: 'free', enabled: true,
    modelEasy: provider === 'openrouter' ? 'test/model:free' : 'test-model', order: 0
  }, extra);
}

module.exports = {
  read, fakeTranslate, makeDom, closeAll, makeEngine, fakeArea, fakeApi, response, fakeFetch, okReply,
  textsFromRequest, translatingHandler, loadBackground, makeBackground, key, SRC
};
