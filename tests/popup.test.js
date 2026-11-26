/* Tests du popup (popup.js) dans jsdom avec une fausse API chrome : sites automatiques couverts par
   un domaine parent, clés payantes seules, relecture de l'interrupteur « voix des vidéos ». */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { read, fakeArea, SRC } = require('./helpers');

const EN = JSON.parse(read('_locales/en/messages.json'));
const msg = (k) => EN[k].message;
const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle(n = 6) { for (let i = 0; i < n; i++) await tick(); }

const opened = [];
test.after(() => { opened.forEach((w) => { try { w.close(); } catch (e) { /* déjà fermé */ } }); });

/* Ouvre popup.html ; state = réponse de getState, status = réponse du script de la page */
async function openPopup({ url = 'https://docs.example.com/guide', keys = [], settings = {}, status = null, voiceActive = false } = {}) {
  const html = fs.readFileSync(path.join(SRC, 'popup.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'chrome-extension://test/popup.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  opened.push(w);
  const sent = [];
  const perms = [];
  const intervals = [];
  const voice = { active: voiceActive };
  const local = fakeArea({ settings: Object.assign({ target: 'auto', autoSites: [], theme: 'system', sensitiveExtra: [] }, settings) });
  w.setInterval = (fn) => { intervals.push(fn); return intervals.length; };   // actualisation pilotée par le test
  w.clearInterval = () => {};
  w.close = () => {};
  w.chrome = {
    i18n: { getMessage: (k) => (EN[k] ? EN[k].message : ''), getUILanguage: () => 'en' },
    runtime: {
      sendMessage: (m) => {
        sent.push(m);
        if (m.type === 'getState') return local.get('settings').then((r) => ({ keys, settings: r.settings }));
        if (m.type === 'voiceCommand') return Promise.resolve({ active: voice.active });
        if (m.type === 'removeAutoSite') {
          return local.get('settings').then((r) => {
            r.settings.autoSites = r.settings.autoSites.filter((h) => h !== m.host);
            return local.set({ settings: r.settings });
          }).then(() => ({ ok: true }));
        }
        return Promise.resolve({ ok: true });
      },
      openOptionsPage: () => {}
    },
    tabs: {
      query: () => Promise.resolve([{ id: 9, url }]),
      sendMessage: () => (status ? Promise.resolve(status) : Promise.reject(new Error('aucun script')))
    },
    storage: { local, onChanged: { addListener: () => {} } },
    permissions: { request: (o) => { perms.push(o); return Promise.resolve(true); } },
    commands: { getAll: () => Promise.resolve([{ name: 'toggle-translation', shortcut: 'Alt+Shift+T' }]) },
    action: { setBadgeText: () => {}, setTitle: () => {} }
  };
  for (const f of ['shared.js', 'ui.js', 'popup.js']) w.eval(read(f));
  await settle();
  return { w, doc: w.document, sent, perms, local, intervals, voice };
}

const paidKey = { id: 'p1', provider: 'mistral', label: 'Mistral', tier: 'paid', enabled: true, configured: true, available: true, requests: 0, maxPerDay: 0 };
const freeKey = { id: 'f1', provider: 'groq', label: 'Groq', tier: 'free', enabled: true, configured: true, available: true, requests: 3, maxPerDay: 1000 };

test('popup : site couvert par un domaine parent, décocher retire l\'entrée réelle (example.com)', async () => {
  const p = await openPopup({ url: 'https://docs.example.com/guide', keys: [freeKey], settings: { autoSites: ['example.com', 'autre.org'] } });
  const box = p.doc.getElementById('autoSite');
  assert.equal(box.checked, true, 'case cochée : docs.example.com est couvert par example.com');
  box.checked = false;
  box.dispatchEvent(new p.w.Event('change'));
  await settle();
  const removes = p.sent.filter((m) => m.type === 'removeAutoSite').map((m) => m.host);
  assert.deepEqual(removes, ['example.com']);
  assert.deepEqual((await p.local.get('settings')).settings.autoSites, ['autre.org']);
});

test('popup : www.example.com décoché retire example.com ; un site sans entrée reste décoché', async () => {
  const p = await openPopup({ url: 'https://www.example.com/', keys: [freeKey], settings: { autoSites: ['example.com'] } });
  const box = p.doc.getElementById('autoSite');
  assert.equal(box.checked, true);
  box.checked = false;
  box.dispatchEvent(new p.w.Event('change'));
  await settle();
  assert.deepEqual(p.sent.filter((m) => m.type === 'removeAutoSite').map((m) => m.host), ['example.com']);
  const q = await openPopup({ url: 'https://notexample.com/', keys: [freeKey], settings: { autoSites: ['example.com'] } });
  assert.equal(q.doc.getElementById('autoSite').checked, false, 'notexample.com n\'est pas un sous-domaine');
});

test('popup : seulement des clés payantes → message dédié, puis prêt une fois la clé choisie', async () => {
  const p = await openPopup({ keys: [paidKey] });
  const chip = p.doc.getElementById('stateChip').textContent;
  assert.equal(chip, msg('statePaidOnly'));
  assert.notEqual(chip, msg('stateNoKey'));
  assert.equal(p.doc.getElementById('status').textContent, msg('popupPaidOnly'));
  // la clé payante est bien proposée dans le menu « Clé »
  const options = Array.from(p.doc.getElementById('keySel').options).map((o) => o.value);
  assert.deepEqual(options, ['', 'p1']);
  // Traduire sans choisir : avertissement qui explique quoi faire, aucune commande envoyée
  p.doc.getElementById('translate').click();
  await settle();
  assert.ok(p.doc.querySelector('.toast').textContent.includes(msg('popupPaidOnly')));
  assert.equal(p.sent.filter((m) => m.type === 'tabCommand').length, 0);
  // Choisir la clé payante : prêt à traduire, la commande part avec cette clé
  const sel = p.doc.getElementById('keySel');
  sel.value = 'p1';
  sel.dispatchEvent(new p.w.Event('change'));
  assert.equal(p.doc.getElementById('stateChip').textContent, msg('stateReady'));
  assert.equal(p.doc.getElementById('status').textContent, '');
  p.doc.getElementById('translate').click();
  await settle();
  assert.deepEqual(p.sent.filter((m) => m.type === 'tabCommand').map((m) => [m.cmd, m.keyId]), [['translate', 'p1']]);
});

test('popup : aucune clé du tout → « aucune clé » (inchangé)', async () => {
  const p = await openPopup({ keys: [] });
  assert.equal(p.doc.getElementById('stateChip').textContent, msg('stateNoKey'));
  assert.equal(p.doc.getElementById('noKeys').hidden, false);
});

test('popup : l\'interrupteur « voix des vidéos » est relu une actualisation sur quatre', async () => {
  const p = await openPopup({ keys: [freeKey], status: { state: 'idle', done: 0, total: 0 }, voiceActive: true });
  const sw = p.doc.getElementById('voiceSwitch');
  assert.equal(sw.checked, true);
  assert.equal(p.intervals.length, 1, 'une seule boucle d\'actualisation');
  const voiceCalls = () => p.sent.filter((m) => m.type === 'voiceCommand' && m.cmd === 'status').length;
  const before = voiceCalls();
  p.voice.active = false;   // la voix s'arrête seule (vidéo terminée)
  for (let i = 0; i < 3; i++) p.intervals[0]();
  await settle();
  assert.equal(voiceCalls(), before, 'pas de relecture aux 3 premières actualisations');
  p.intervals[0]();
  await settle();
  assert.equal(voiceCalls(), before + 1);
  assert.equal(sw.checked, false, 'l\'interrupteur suit l\'état réel');
});

test('popup : accessibilité (barre de progression nommée, titres complets des libellés coupés)', async () => {
  const p = await openPopup({ keys: [freeKey], status: { state: 'running', done: 3, total: 10, showing: 'translated' } });
  const bar = p.doc.getElementById('progress');
  assert.equal(bar.getAttribute('aria-label'), msg('popupProgress'));
  assert.equal(bar.getAttribute('aria-valuenow'), '30');
  assert.equal(p.doc.getElementById('stop').hidden, false);
  for (const id of ['autoSite', 'voiceSwitch']) assert.ok(p.doc.getElementById(id).closest('label').title, id + ' : title');
  for (const l of p.doc.querySelectorAll('.controls .seg label')) assert.ok(l.title);
});
