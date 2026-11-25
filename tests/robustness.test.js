/* Pages difficiles : sites interdits par le navigateur, PDF, fichiers texte et Markdown bruts,
   messages des autres destinataires. (Problèmes vus dans un vrai Firefox 161 sur 30 sites réels.) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');
const DDT = require('../src/shared.js');

test.after(() => H.closeAll());

test('pages interdites : domaines restreints de Firefox et boutiques reconnus', () => {
  for (const u of ['https://addons.mozilla.org/fr/firefox/addon/devdoctrad/', 'https://support.mozilla.org/kb/x',
    'https://accounts.firefox.com/', 'https://chromewebstore.google.com/detail/x', 'https://chrome.google.com/webstore/detail/x',
    'https://microsoftedge.microsoft.com/addons/detail/x']) {
    assert.equal(DDT.unsupportedReason(u), 'restricted', u);
  }
  assert.equal(DDT.unsupportedReason('https://www.rfc-editor.org/rfc/rfc9110.pdf'), 'pdf');
  assert.equal(DDT.unsupportedReason('about:addons'), 'scheme');
  assert.equal(DDT.unsupportedReason('chrome://extensions'), 'scheme');
  assert.equal(DDT.unsupportedReason(''), 'scheme');
  for (const u of ['https://developer.mozilla.org/en-US/docs/Web', 'https://github.com/x/y', 'http://localhost:8080/a.html',
    'https://mozilla.org/', 'https://google.com/search?q=a.pdf']) {
    assert.equal(DDT.unsupportedReason(u), '', u);
  }
});

test('injection refusée : message d\'aide au lieu de l\'erreur brute du navigateur', () => {
  assert.equal(DDT.injectionHelp(new Error('Missing host permission for the tab')), 'popupBlocked');
  assert.equal(DDT.injectionHelp(new Error('Cannot access contents of url "x"')), 'popupBlocked');
  assert.equal(DDT.injectionHelp(new Error('The extensions gallery cannot be scripted.')), 'popupBlocked');
  assert.match(DDT.injectionHelp(new Error('boom AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345')), /^badgeError: boom \[masqué\]$/);
});

test('background : ne répond pas à la place des autres destinataires', async () => {
  const { bg } = H.makeBackground({ local: { settings: {} } });
  assert.equal(bg.onMessage({ type: 'inconnu' }), null);
  assert.equal(bg.onMessage(null), null);
  assert.ok(bg.onMessage({ type: 'getState' }) instanceof Promise);
});

/* ---------- Fichiers texte et Markdown bruts ---------- */
const README = [
  '# Express',
  '',
  'Fast, unopinionated, minimalist web framework for [Node.js](https://nodejs.org).',
  '',
  '```js',
  "const express = require('express')",
  'app.listen(3000)',
  '```',
  '',
  '## Installation',
  '',
  'This is a [Node.js](https://nodejs.org/en/) module available through the',
  '`npm registry`. Install it with **npm**:',
  '',
  '    $ npm install express',
  '',
  '- Robust routing',
  '- Focus on high performance',
  '',
  '> Note: read the docs first.',
  '',
  '+-------+-------+',
  '| a     | b     |',
  '+-------+-------+'
].join('\n');

function rawDom(text, url = 'https://raw.githubusercontent.com/expressjs/express/master/Readme.md') {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return H.makeDom(`<html><head></head><body><pre style="word-wrap: break-word; white-space: pre-wrap;">${esc}</pre></body></html>`, { url });
}

test('Markdown brut : vue lisible traduite, code intact, original exact au retour', async () => {
  const dom = rawDom(README);
  const d = dom.window.document;
  const pre = d.querySelector('body > pre');
  const before = pre.outerHTML;
  const { engine, calls } = H.makeEngine(dom);
  await engine.start();
  const view = d.querySelector('[data-ddt-plain]');
  assert.ok(view, 'vue lisible créée');
  assert.equal(pre.style.display, 'none', 'pre d\'origine caché pendant la traduction');
  assert.equal(view.querySelector('h1').textContent, 'EXPRESS');
  assert.equal(view.querySelector('h2').textContent, 'INSTALLATION');
  const codes = [...view.querySelectorAll('pre')].map((p) => p.textContent);
  assert.ok(codes.includes("const express = require('express')\napp.listen(3000)"), 'bloc ``` gardé tel quel');
  assert.ok(codes.includes('$ npm install express'), 'bloc indenté gardé tel quel');
  assert.ok(codes.some((c) => c.includes('+-------+')), 'tableau ASCII gardé tel quel');
  const p = view.querySelectorAll('p')[1];
  assert.equal(p.querySelector('code').textContent, 'npm registry', 'code en ligne jamais traduit');
  assert.equal(p.querySelector('a').getAttribute('href'), 'https://nodejs.org/en/');
  assert.equal(view.querySelectorAll('ul li').length, 2);
  assert.equal(view.querySelector('blockquote').textContent, 'NOTE: READ THE DOCS FIRST.');
  assert.ok(calls.flat().every((s) => !s.includes('app.listen')), 'le code n\'est jamais envoyé');
  assert.equal(engine.status().state, 'done');
  engine.showOriginal();
  assert.equal(view.style.display, 'none');
  assert.equal(pre.outerHTML, before.replace('white-space: pre-wrap;"', 'white-space: pre-wrap;"'), 'pre d\'origine intact');
  assert.equal(pre.style.display, '');
  await engine.toggle();
  assert.equal(view.style.display, '');
  assert.equal(pre.style.display, 'none');
});

test('texte brut (.txt) : paragraphes coupés en lignes réunis, rien de perdu', async () => {
  const txt = 'Hypertext Transfer Protocol\n\nThe Hypertext Transfer Protocol is a stateless\napplication-level protocol for distributed systems.\n\n1. Introduction\n\nThis document describes the semantics.';
  const dom = rawDom(txt, 'https://example.org/rfc9110.txt');
  const { engine } = H.makeEngine(dom);
  await engine.start();
  const view = dom.window.document.querySelector('[data-ddt-plain]');
  const ps = [...view.querySelectorAll('p')].map((p) => p.textContent);
  assert.ok(ps.includes('THE HYPERTEXT TRANSFER PROTOCOL IS A STATELESS APPLICATION-LEVEL PROTOCOL FOR DISTRIBUTED SYSTEMS.'), ps.join(' | '));
  assert.equal(view.querySelector('ol li').textContent, 'INTRODUCTION');
});

test('type text/plain annoncé par le serveur : pris en charge même sans extension .md/.txt', async () => {
  const dom = rawDom('Hello world.\n\nSecond paragraph here.', 'https://example.org/notes');
  Object.defineProperty(dom.window.document, 'contentType', { value: 'text/plain' });
  const { engine } = H.makeEngine(dom);
  await engine.start();
  assert.equal(dom.window.document.querySelectorAll('[data-ddt-plain] p').length, 2);
});

test('une vraie page HTML avec un seul <pre> (exemple de code) n\'est pas transformée', async () => {
  const dom = H.makeDom('<html><body><pre>npm install x</pre></body></html>', { url: 'https://example.org/page' });
  const { engine } = H.makeEngine(dom);
  await engine.start();
  assert.equal(dom.window.document.querySelector('[data-ddt-plain]'), null);
  assert.equal(engine.status().message, 'badgeNothing');
});

test('Markdown : pas d\'injection HTML depuis le texte du fichier', async () => {
  const dom = rawDom('# Title <img src=x onerror=alert(1)>\n\nText with <script>bad()</script> and [x](javascript:alert(1)).', 'https://example.org/a.md');
  const { engine } = H.makeEngine(dom);
  await engine.start();
  const view = dom.window.document.querySelector('[data-ddt-plain]');
  assert.equal(view.querySelector('img'), null);
  assert.equal(view.querySelector('script'), null);
  assert.equal(view.querySelector('a'), null, 'lien javascript: refusé');
});

test('Markdown réel (README GitHub) : sous-listes, lien dans du gras, échappements, HTML brut', async () => {
  const md = ['<p align="center">', '  <img src="logo.svg">', '</p>', '',
    '**Fast web framework for [Node.js](https://nodejs.org).**', '', '- Docs \\& Community', '- Contributing',
    '    - [TC emeriti members](#tc-emeriti-members)', '', '<b>Note</b> keep it short.'].join('\n');
  const dom = rawDom(md, 'https://raw.githubusercontent.com/x/y/main/README.md');
  const { engine } = H.makeEngine(dom);
  await engine.start();
  const view = dom.window.document.querySelector('[data-ddt-plain]');
  const b = view.querySelector('p > b');
  assert.equal(b.querySelector('a').getAttribute('href'), 'https://nodejs.org', 'lien dans le gras');
  const items = [...view.querySelectorAll('li')].map((li) => li.textContent);
  assert.deepEqual(items, ['DOCS & COMMUNITY', 'CONTRIBUTING', 'TC EMERITI MEMBERS'], 'sous-liste = éléments, pas du code');
  assert.ok([...view.querySelectorAll('pre')].some((p) => p.textContent.includes('<img src="logo.svg">')), 'HTML seul gardé tel quel');
  assert.ok([...view.querySelectorAll('p')].some((p) => p.textContent.trim() === 'NOTE KEEP IT SHORT.'), 'balises retirées du texte');
});
