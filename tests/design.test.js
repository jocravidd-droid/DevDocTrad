/* Tests de cohérence du système visuel (tokens, badge, icônes, textes, emoji). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

function block(css, selector) {
  const i = css.indexOf(selector);
  assert.ok(i !== -1, 'bloc introuvable : ' + selector);
  const open = css.indexOf('{', i + selector.length - 1);
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}' && --depth === 0) return css.slice(open + 1, j);
  }
  throw new Error('bloc non fermé');
}
function vars(text) {
  const out = {};
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().replace(/\s+/g, ' ');
  return out;
}

const tokens = read('tokens.css');
const light = vars(block(tokens, ':root {'));
const dark = vars(block(tokens, ':root[data-theme="dark"] {'));
const darkMedia = vars(block(block(tokens, '@media (prefers-color-scheme: dark) {'), ':root:not([data-theme="light"]) {') + ';');

test('tokens : le thème sombre est identique en mode forcé et en mode système', () => {
  assert.deepEqual(darkMedia, dark);
});

test('tokens : chaque variable du thème sombre existe dans le thème clair', () => {
  for (const k of Object.keys(dark)) assert.ok(k in light, k);
});

test('badge : ses couleurs sont celles des tokens (clair et sombre)', () => {
  const content = read('content.js');
  const css = content.slice(content.indexOf('var BADGE_CSS'), content.indexOf("].join('');", content.indexOf('var BADGE_CSS')));
  const flat = css.replace(/'\s*\+?\s*\n\s*'/g, '').replace(/',\s*'/g, '');
  const host = vars(flat.match(/:host\{all:initial;([^}]*)\}/)[1] + ';');
  const hostDark = vars(flat.match(/:host\(\[data-theme=dark\]\)\{([^}]*)\}/)[1] + ';');
  const map = { '--b-text-1': '--text-1', '--b-text-2': '--text-2', '--b-accent': '--accent', '--b-focus': '--focus',
    '--b-solid': '--solid-fallback', '--b-hairline': '--hairline', '--b-err': '--err', '--b-warn': '--warn', '--b-ok': '--ok', '--b-shadow': '--shadow-2' };
  for (const [b, tk] of Object.entries(map)) {
    assert.equal(host[b], light[tk], `${b} (clair) ≠ ${tk}`);
    assert.equal(hostDark[b], dark[tk], `${b} (sombre) ≠ ${tk}`);
  }
  assert.ok(!/iris|gradient/.test(flat), 'pas d\'irisation dans le badge');
});

test('icônes : chaque data-icon utilisé existe dans ui.js', () => {
  const ui = read('ui.js');
  const known = new Set([...ui.matchAll(/^\s{4}(\w+):\s*'/gm)].map((m) => m[1]));
  const used = new Set();
  for (const f of fs.readdirSync(SRC).filter((x) => /\.(html|js)$/.test(x))) {
    for (const m of read(f).matchAll(/data-icon="(\w+)"/g)) used.add(m[1]);
    for (const m of read(f).matchAll(/(?:UI|DDT_UI)\.icon\('(\w+)'/g)) used.add(m[1]);
  }
  for (const n of used) assert.ok(known.has(n), 'icône inconnue : ' + n);
});

test('textes : chaque clé utilisée existe en français et en anglais', () => {
  const fr = JSON.parse(read('_locales/fr/messages.json'));
  const en = JSON.parse(read('_locales/en/messages.json'));
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  const keys = new Set();
  for (const f of fs.readdirSync(SRC).filter((x) => /\.(html|js)$/.test(x))) {
    const s = read(f);
    for (const m of s.matchAll(/data-i18n(?:-placeholder|-title|-aria)?="(\w+)"/g)) keys.add(m[1]);
    for (const m of s.matchAll(/\bt\('(\w+)'/g)) keys.add(m[1]);
  }
  for (const k of keys) {
    if (/_$/.test(k)) continue;
    assert.ok(fr[k], 'texte manquant : ' + k);
  }
});

test('aucun emoji dans l\'interface', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
  for (const f of fs.readdirSync(SRC).filter((x) => /\.(html|js|css)$/.test(x))) {
    assert.ok(!emoji.test(read(f)), 'emoji dans ' + f);
  }
  for (const l of ['fr', 'en']) assert.ok(!emoji.test(read(`_locales/${l}/messages.json`)));
});

test('popup et réglages : couleurs uniquement via les tokens', () => {
  for (const f of ['popup.css', 'options.css', 'ui.css']) {
    const css = read(f).replace(/url\("data:[^)]*\)/g, '');
    const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    const allowed = ['#fff', '#ffffff'];
    const bad = hex.filter((h) => !allowed.includes(h.toLowerCase()));
    assert.deepEqual(bad, [], f + ' contient des couleurs en dur : ' + bad.join(', '));
  }
});
