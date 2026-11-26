/* Tests de la page de réglages (options.js) dans jsdom avec une fausse API chrome : bornes des champs
   numériques, enregistrement immédiat (supprimer, monter, descendre, fermeture de l'onglet), resetKey
   limité à la carte modifiée, adresse d'Ollama et permission d'origine, focus après suppression. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { read, fakeArea, SRC } = require('./helpers');

const EN = JSON.parse(read('_locales/en/messages.json'));
const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle(n = 6) { for (let i = 0; i < n; i++) await tick(); }

const opened = [];
test.after(() => { opened.forEach((w) => { try { w.close(); } catch (e) { /* déjà fermé */ } }); });

function storedKey(keys, id) { return keys.filter((k) => k.id === id)[0]; }

async function openOptions(keys) {
  const html = fs.readFileSync(path.join(SRC, 'options.html'), 'utf8');
  const vc = new VirtualConsole();   // jsdom : « not implemented » (scrollTo…) sans bruit
  const dom = new JSDOM(html, { url: 'chrome-extension://test/options.html#keys', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  opened.push(w);
  const sent = [];
  const perms = [];
  const local = fakeArea({ keys, settings: { target: 'auto', autoSites: [], theme: 'system', sensitiveExtra: [] }, glossary: [] });
  w.setInterval = () => 0;
  w.confirm = () => true;
  w.chrome = {
    i18n: { getMessage: (k) => (EN[k] ? EN[k].message : ''), getUILanguage: () => 'en' },
    runtime: {
      sendMessage: (m) => { sent.push(m); return Promise.resolve(m.type === 'getState' ? { keys: [], settings: {} } : { ok: true, models: [] }); },
      getManifest: () => ({ version: '1.1.0' })
    },
    storage: { local, onChanged: { addListener: () => {} } },
    permissions: {
      contains: () => Promise.resolve(true),
      request: (o) => { perms.push(o); return Promise.resolve(perms.granted !== false); }
    },
    commands: { getAll: () => Promise.resolve([]) }
  };
  for (const f of ['shared.js', 'ui.js', 'options.js']) w.eval(read(f));
  await settle();
  const doc = w.document;
  const card = (id) => doc.querySelector('.keycard[data-id="' + id + '"]');
  const field = (id, f) => card(id).querySelector('[data-f=' + f + ']');
  const type = (id, f, value) => { const i = field(id, f); i.value = value; i.dispatchEvent(new w.Event('input', { bubbles: true })); return i; };
  const stored = async () => (await local.get('keys')).keys;
  return { w, doc, sent, perms, local, card, field, type, stored };
}

const K = (id, extra) => Object.assign({ id, provider: 'groq', label: id, key: 'gsk_TEST_' + id, tier: 'free', enabled: true, modelEasy: 'm', order: 0 }, extra);

test('réglages : champs numériques bornés, les valeurs refusées ne sont jamais enregistrées', async () => {
  const o = await openOptions([K('a', { tier: 'paid', priceIn: 1, priceOut: 2, dailyCap: 3 })]);
  const neg = o.type('a', 'maxRequestsPerDay', '-5');
  o.type('a', 'maxChars', '5');            // min 200 dans options.html
  o.type('a', 'priceIn', '-1');            // min 0
  o.type('a', 'dailyCap', '-0.5');
  assert.equal(neg.getAttribute('aria-invalid'), 'true', 'champ marqué invalide');
  o.w.dispatchEvent(new o.w.Event('pagehide'));
  await settle();
  let k = storedKey(await o.stored(), 'a');
  assert.equal(k.maxRequestsPerDay, undefined);
  assert.equal(k.maxChars, undefined);
  assert.equal(k.priceIn, 1);
  assert.equal(k.dailyCap, 3);
  // valeurs correctes : enregistrées, marque retirée ; vide = valeur par défaut du fournisseur
  o.type('a', 'maxRequestsPerDay', '100');
  o.type('a', 'maxChars', '1200');
  o.type('a', 'priceIn', '0.075');         // pas de 0,01 : un prix plus fin reste accepté
  o.type('a', 'dailyCap', '');
  o.w.dispatchEvent(new o.w.Event('pagehide'));
  await settle();
  k = storedKey(await o.stored(), 'a');
  assert.equal(k.maxRequestsPerDay, 100);
  assert.equal(k.maxChars, 1200);
  assert.equal(k.priceIn, 0.075);
  assert.equal(k.dailyCap, '');
  assert.equal(neg.hasAttribute('aria-invalid'), false);
});

test('réglages : supprimer, monter et descendre enregistrent tout de suite (sans les 400 ms)', async () => {
  const o = await openOptions([K('a', { order: 0 }), K('b', { order: 1 }), K('c', { order: 2 })]);
  o.card('b').querySelector('[data-a=del]').click();
  await settle();
  assert.deepEqual((await o.stored()).map((k) => k.id), ['a', 'c'], 'suppression écrite avant tout délai');
  o.card('c').querySelector('[data-a=up]').click();
  await settle();
  assert.deepEqual((await o.stored()).map((k) => [k.id, k.order]), [['c', 0], ['a', 1]]);
  o.card('c').querySelector('[data-a=down]').click();
  await settle();
  assert.deepEqual((await o.stored()).map((k) => k.id), ['a', 'c']);
});

test('réglages : une modification en attente est écrite quand l\'onglet se ferme ou passe en arrière-plan', async () => {
  const o = await openOptions([K('a')]);
  o.type('a', 'label', 'Nouveau nom');
  await settle();
  assert.equal(storedKey(await o.stored(), 'a').label, 'a', 'encore en attente (400 ms)');
  o.w.dispatchEvent(new o.w.Event('pagehide'));
  await settle();
  assert.equal(storedKey(await o.stored(), 'a').label, 'Nouveau nom');
  o.type('a', 'label', 'Autre nom');
  Object.defineProperty(o.doc, 'visibilityState', { configurable: true, get: () => 'hidden' });
  o.doc.dispatchEvent(new o.w.Event('visibilitychange'));
  await settle();
  assert.equal(storedKey(await o.stored(), 'a').label, 'Autre nom');
});

test('réglages : resetKey seulement pour la carte modifiée (une clé arrêtée en 401 le reste)', async () => {
  const o = await openOptions([K('a'), K('b'), K('c')]);
  o.type('b', 'key', 'gsk_NOUVELLE');
  o.w.dispatchEvent(new o.w.Event('pagehide'));
  await settle();
  assert.deepEqual(o.sent.filter((m) => m.type === 'resetKey').map((m) => m.keyId), ['b']);
  o.sent.length = 0;
  o.card('c').querySelector('[data-a=up]').click();   // réordonner ne réactive personne
  await settle();
  assert.deepEqual(o.sent.filter((m) => m.type === 'resetKey'), []);
});

test('réglages : focus sur la carte suivante après une suppression, sinon sur « Ajouter »', async () => {
  const o = await openOptions([K('a'), K('b')]);
  o.card('a').querySelector('[data-a=del]').click();
  await settle();
  assert.equal(o.doc.activeElement, o.card('b'));
  o.card('b').querySelector('[data-a=del]').click();
  await settle();
  assert.equal(o.doc.activeElement, o.doc.getElementById('emptyAdd'), 'liste vide : bouton d\'ajout de l\'écran vide');
  // bouton afficher/masquer : état initial annoncé
  const o2 = await openOptions([K('x')]);
  assert.equal(o2.card('x').querySelector('[data-a=show]').getAttribute('aria-pressed'), 'false');
});

test('réglages : adresse d\'Ollama validée (http/https), « /api » final retiré', async () => {
  const o = await openOptions([K('o', { provider: 'ollama', tier: 'local', key: '', baseUrl: 'http://localhost:11434' })]);
  const inp = o.type('o', 'baseUrl', 'ftp://serveur:11434');
  assert.equal(inp.getAttribute('aria-invalid'), 'true');
  o.type('o', 'baseUrl', 'pas une adresse');
  o.w.dispatchEvent(new o.w.Event('pagehide'));
  await settle();
  assert.equal(storedKey(await o.stored(), 'o').baseUrl, 'http://localhost:11434', 'adresse invalide jamais enregistrée');
  o.type('o', 'baseUrl', 'http://192.168.1.20:11434/api/');
  o.w.dispatchEvent(new o.w.Event('pagehide'));
  await settle();
  assert.equal(storedKey(await o.stored(), 'o').baseUrl, 'http://192.168.1.20:11434');
  assert.equal(inp.hasAttribute('aria-invalid'), false);
});

test('réglages : Ollama sur un autre hôte → permission d\'origine demandée dès le clic sur Tester', async () => {
  const o = await openOptions([K('o', { provider: 'ollama', tier: 'local', key: '', baseUrl: 'http://192.168.1.20:11434' })]);
  o.card('o').querySelector('[data-a=test]').click();
  // demandée dans le geste utilisateur, avant toute attente (Firefox l'exige)
  assert.deepEqual(JSON.parse(JSON.stringify(o.perms)), [{ origins: ['http://192.168.1.20:11434/*'] }]);
  await settle();
  assert.equal(o.sent.filter((m) => m.type === 'testKey').length, 1);
  // refusée : pas de test, message clair
  o.perms.length = 0;
  o.perms.granted = false;
  o.sent.length = 0;
  o.card('o').querySelector('[data-a=test]').click();
  await settle();
  assert.equal(o.sent.filter((m) => m.type === 'testKey').length, 0);
  assert.ok(o.card('o').querySelector('.kc-result').textContent.includes('http://192.168.1.20:11434'));
  // localhost:11434 : déjà couvert par le manifeste, aucune demande
  const l = await openOptions([K('l', { provider: 'ollama', tier: 'local', key: '', baseUrl: 'http://localhost:11434' })]);
  l.card('l').querySelector('[data-a=test]').click();
  await settle();
  assert.deepEqual(l.perms, []);
  assert.equal(l.sent.filter((m) => m.type === 'testKey').length, 1);
});

test('notifications : pas d\'aria-live sur le conteneur, chaque notification a son rôle', async () => {
  const o = await openOptions([K('a')]);
  o.w.DDT_UI.toast('success', 'ok');
  o.w.DDT_UI.toast('error', 'non');
  const box = o.doc.querySelector('.toasts');
  assert.equal(box.hasAttribute('aria-live'), false);
  assert.deepEqual(Array.from(box.children).map((t) => t.getAttribute('role')), ['status', 'alert']);
});
