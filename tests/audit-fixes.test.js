/* Corrections d'audit : ordre des éléments imbriqués, textes remplacés en boucle par la page,
   attributs traduits que la page modifie ensuite. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
test.after(() => H.closeAll());

/* Traduction valide qui inverse l'imbrication : <1>A<2>B</2>C</1> -> <2>B <1>A C</1></2> */
function invert(s) {
  const m = s.match(/^(.*)<1>(.*)<2>(.*)<\/2>(.*)<\/1>(.*)$/);
  return m ? `${m[1]}<2>${m[3]} <1>${m[2]}${m[4]}</1></2>${m[5]}` : s;
}
const NESTED = '<p>Hello <b>bold <i>italic here</i> end</b> after text</p>';

test('imbrication inversée par la traduction : « Original » rend le DOM exact', async () => {
  const dom = H.makeDom('<body>' + NESTED + '</body>');
  const src = 'Hello <1>bold <2>italic here</2> end</1> after text';
  assert.ok(dom.window.DDT.validateTranslation(src, invert(src), {}).ok, 'traduction acceptée');
  const { engine } = H.makeEngine(dom, { translator: invert });
  await engine.start({});
  const p = dom.window.document.querySelector('p');
  assert.equal(p.firstElementChild.tagName, 'I', 'traduction appliquée (italique à l\'extérieur)');
  engine.showOriginal();
  assert.equal(p.outerHTML, NESTED);
  // et de nouveau : traduction puis original
  await engine.showTranslation();
  engine.showOriginal();
  assert.equal(p.outerHTML, NESTED);
});

test('imbrication inversée : changement de langue rend l\'original exact', async () => {
  const dom = H.makeDom('<body>' + NESTED + '</body>');
  const { engine } = H.makeEngine(dom, { translator: invert });
  await engine.start({});
  engine.setSettings({ target: 'de' });
  assert.equal(dom.window.document.querySelector('p').outerHTML, NESTED);
});

test('imbrication inversée : texte modifié par la page (sweep) puis original, sans DOM mélangé', async () => {
  const dom = H.makeDom('<body>' + NESTED + '</body>');
  const { engine } = H.makeEngine(dom, { translator: invert });
  await engine.start({});
  const doc = dom.window.document;
  const errors = [];
  dom.window.addEventListener('error', (e) => errors.push(e.error || e.message));
  // la page réécrit un texte du passage traduit : sweep le rend à la page puis le retraduit
  const tw = doc.createTreeWalker(doc.querySelector('p'), 4);
  let t;
  while ((t = tw.nextNode())) if (/end/.test(t.data)) break;
  assert.ok(t, doc.body.innerHTML);
  t.data = t.data.replace('end', 'end!');
  await wait(1100);
  assert.deepEqual(errors, []);
  engine.showOriginal();
  const p = doc.querySelector('p');
  assert.equal(p.querySelectorAll('b > i').length, 1, 'italique de nouveau dans le gras');
  assert.equal(p.querySelectorAll('i b').length, 0);
  assert.match(p.textContent.replace(/\s+/g, ' '), /^Hello bold .*italic here.* after text$/);
});

test('texte remplacé en entier chaque seconde (textContent) : nombre de requêtes borné', async () => {
  const dom = H.makeDom('<body><p>Main text of the documentation page</p><div id="c">Updated 0 seconds ago</div></body>');
  const { engine, calls } = H.makeEngine(dom);
  await engine.start({});
  const c = dom.window.document.getElementById('c');
  for (let i = 1; i <= 10; i++) {
    c.textContent = 'Updated ' + i + ' seconds ago';
    await wait(900);
  }
  assert.ok(calls.length <= 1 + 6, 'quota respecté : ' + calls.length + ' requêtes');
  assert.ok(calls.length >= 3, 'les premières réécritures sont bien retraduites');
});

test('aria-label traduit puis changé par la page : retraduit, et « Original » garde l\'état de la page', async () => {
  const dom = H.makeDom('<body><p>Some text to translate here</p><button aria-label="Expand menu">x</button></body>');
  const { engine } = H.makeEngine(dom);
  await engine.start({});
  const b = dom.window.document.querySelector('button');
  assert.equal(b.getAttribute('aria-label'), 'EXPAND MENU');
  b.setAttribute('aria-label', 'Collapse menu');
  await wait(1100);
  assert.equal(b.getAttribute('aria-label'), 'COLLAPSE MENU', 'nouvelle valeur retraduite');
  engine.showOriginal();
  assert.equal(b.getAttribute('aria-label'), 'Collapse menu', 'original = valeur actuelle de la page');
});

test('title traduit puis changé pendant l\'affichage de l\'original : pas d\'ancienne traduction remise', async () => {
  const dom = H.makeDom('<body><p>Some text to translate here</p><a href="#" title="Open settings">s</a></body>');
  const { engine } = H.makeEngine(dom);
  await engine.start({});
  const a = dom.window.document.querySelector('a');
  engine.showOriginal();
  assert.equal(a.getAttribute('title'), 'Open settings');
  a.setAttribute('title', 'Close settings');
  await engine.showTranslation();
  await wait(50);
  assert.equal(a.getAttribute('title'), 'CLOSE SETTINGS');
  // la page change la valeur traduite : « Original » ne remet pas l'ancienne valeur
  a.setAttribute('title', 'Settings (2)');
  engine.showOriginal();
  assert.equal(a.getAttribute('title'), 'Settings (2)');
});
