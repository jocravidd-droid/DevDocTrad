/* Tests des traductions de l'interface (src/_locales/<langue>/messages.json). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', '_locales');
/* Noms de dossier acceptés par Chrome : un nom inconnu fait refuser toute l'extension. */
const CHROME_LOCALES = new Set(['ar', 'am', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'en_GB', 'en_US', 'es',
  'es_419', 'et', 'fa', 'fi', 'fil', 'fr', 'gu', 'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'lv',
  'ml', 'mr', 'ms', 'nl', 'no', 'pl', 'pt_BR', 'pt_PT', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'te', 'th',
  'tr', 'uk', 'vi', 'zh_CN', 'zh_TW']);
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;

const locales = fs.readdirSync(DIR).filter((d) => fs.statSync(path.join(DIR, d)).isDirectory()).sort();
const load = (l) => JSON.parse(fs.readFileSync(path.join(DIR, l, 'messages.json'), 'utf8'));
const en = load('en');
const enKeys = Object.keys(en);
const placeholders = (s) => (s.match(/\{\d\}/g) || []).sort().join(',');
const dollars = (s) => (s.match(/\$\$/g) || []).length;

test('langues : au moins 30 langues d\'interface, dont celles à écriture de droite à gauche', () => {
  assert.ok(locales.length >= 30, locales.join(' '));
  for (const l of ['en', 'fr', 'de', 'es', 'ru', 'ja', 'zh_CN', 'ar', 'he', 'fa']) assert.ok(locales.includes(l), l);
});

for (const l of locales) {
  test(`langue ${l} : dossier accepté par Chrome, JSON valide, textes cohérents avec l'anglais`, () => {
    assert.ok(CHROME_LOCALES.has(l), 'nom de dossier refusé par Chrome : ' + l);
    const m = load(l);
    const keys = Object.keys(m);
    for (const k of keys) {
      assert.ok(k in en, `${l} : clé inconnue ${k}`);
      const s = m[k] && m[k].message;
      assert.equal(typeof s, 'string', `${l}.${k} : "message" absent`);
      assert.ok(s.trim(), `${l}.${k} : texte vide`);
      assert.equal(placeholders(s), placeholders(en[k].message), `${l}.${k} : {n} différents de l'anglais`);
      assert.equal(dollars(s), dollars(en[k].message), `${l}.${k} : « $$ » différent de l'anglais`);
      assert.ok(!/\$/.test(s.replace(/\$\$/g, '')), `${l}.${k} : « $ » seul (écrire « $$ »)`);
      assert.ok(!EMOJI.test(s), `${l}.${k} : emoji`);
    }
    assert.ok(keys.length >= Math.ceil(enKeys.length * 0.95),
      `${l} : ${keys.length}/${enKeys.length} clés traduites (95 % minimum)`);
  });
}

test('langues : src/_locales correspond exactement à ce que génère tools/gen_locales.py', (t) => {
  const { spawnSync } = require('child_process');
  const os = require('os');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-locales-'));
  try {
    const r = spawnSync('python3', [path.join(__dirname, '..', 'tools', 'gen_locales.py'), '--out', out], { encoding: 'utf8' });
    if (r.error && r.error.code === 'ENOENT') { t.skip('python3 absent'); return; }
    assert.equal(r.status, 0, r.stderr);
    const generated = fs.readdirSync(out).sort();
    assert.deepEqual(generated, locales, 'mêmes dossiers de langue');
    for (const l of generated) {
      const want = fs.readFileSync(path.join(out, l, 'messages.json'), 'utf8');
      const have = fs.readFileSync(path.join(DIR, l, 'messages.json'), 'utf8');
      assert.ok(want === have, `${l} : src/_locales pas à jour, lancer python3 tools/gen_locales.py`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('langues : les noms de produits et les jetons techniques sont gardés tels quels', () => {
  const keep = {
    errOllamaOrigin: ['OLLAMA_ORIGINS', 'chrome-extension://*,moz-extension://*', '403'],
    errOllamaDown: ['localhost:11434'],
    errOpenRouterFree: [':free'],
    warnOpenRouter: [':free'],
    optShortcutWhereChrome: ['chrome://extensions/shortcuts'],
    extName: ['DevDocTrad']
  };
  for (const l of locales) {
    const m = load(l);
    for (const [k, tokens] of Object.entries(keep)) {
      if (!m[k]) continue;
      for (const tok of tokens) assert.ok(m[k].message.includes(tok), `${l}.${k} : « ${tok} » absent`);
    }
  }
});
