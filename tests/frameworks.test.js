/* Robustesse du moteur de page (content.js) face aux frameworks (React, Vue...), aux SPA et à l'utilisateur. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeDom, makeEngine, fakeTranslate, closeAll } = require('./helpers');
test.afterEach(closeAll);

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const OBS = 1000;   // délai de l'observateur (800 ms) + marge

/* Transport dont chaque lot attend qu'on le libère */
function deferred(translator = fakeTranslate) {
  const pending = [];
  const calls = [];
  return {
    calls,
    pending,
    transport: {
      translate(texts) {
        calls.push(Array.from(texts));
        return new Promise((r) => pending.push(() => r({ translations: texts.map(translator) })));
      }
    },
    releaseOne() { const f = this.pending.shift(); if (f) f(); },
    async drain() { for (let i = 0; i < 50; i++) { await tick(); if (!this.pending.length) return; this.releaseOne(); } }
  };
}

/* ---------- C1 : les nœuds d'origine restent dans la page ---------- */
test('C1 : texte seul modifié sur place (même nœud), restauration exacte', async () => {
  const dom = makeDom('<html><body><p id="p">Hello from the framework.</p></body></html>');
  const doc = dom.window.document;
  const p = doc.getElementById('p');
  const ref = p.firstChild;
  const { engine } = makeEngine(dom);
  await engine.start();
  assert.equal(p.firstChild, ref, 'même nœud texte');
  assert.equal(p.childNodes.length, 1);
  assert.equal(ref.data, 'HELLO FROM THE FRAMEWORK.');
  engine.showOriginal();
  assert.equal(p.firstChild, ref);
  assert.equal(doc.body.innerHTML, '<p id="p">Hello from the framework.</p>');
});

test('C1 : framework simulé : removeChild / insertBefore sur des nœuds gardés en référence, ancre Vue intacte', async () => {
  const html = '<p id="p">Welcome <!--v-if--><b>dear</b> reader of the docs.</p>';
  const dom = makeDom(`<html><body>${html}</body></html>`);
  const doc = dom.window.document;
  const p = doc.getElementById('p');
  const [t1, anchor, b, t2] = Array.from(p.childNodes);
  const inner = b.firstChild;
  const { engine } = makeEngine(dom);
  await engine.start();
  assert.equal(p.textContent, 'WELCOME DEAR READER OF THE DOCS.');
  for (const n of [t1, anchor, b, t2]) assert.equal(n.parentNode, p, 'nœud d\'origine toujours dans le parent');
  assert.equal(b.firstChild, inner);
  assert.equal(anchor.previousSibling, t1, 'ancre <!--v-if--> à sa place');
  assert.ok(!p.innerHTML.includes('ddt'), 'pas de commentaire ajouté');
  // restauration exacte
  engine.showOriginal();
  assert.equal(p.outerHTML, html);
  // ce que ferait le framework à son prochain rendu, page traduite
  await engine.showTranslation();
  const x = doc.createElement('i');
  assert.doesNotThrow(() => p.insertBefore(x, t2));
  assert.doesNotThrow(() => p.removeChild(t1));
  assert.doesNotThrow(() => anchor.parentNode.insertBefore(doc.createElement('span'), anchor));
});

test('C1 : ref.data = ... par le framework : visible tout de suite puis retraduit', async () => {
  const dom = makeDom('<html><body><p id="p">Counter value is shown here.</p></body></html>');
  const doc = dom.window.document;
  const p = doc.getElementById('p');
  const ref = p.firstChild;
  const { engine, calls } = makeEngine(dom);
  await engine.start();
  ref.data = 'Value changed by the framework.';
  assert.equal(p.textContent, 'Value changed by the framework.', 'visible (nœud attaché)');
  await tick(OBS);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], ['Value changed by the framework.']);
  assert.equal(p.firstChild, ref);
  assert.equal(p.textContent, 'VALUE CHANGED BY THE FRAMEWORK.');
  engine.showOriginal();
  assert.equal(p.textContent, 'Value changed by the framework.', 'original = dernier texte de la page');
});

test('C1 : texte découpé en plusieurs nœuds (React) : un seul nœud réécrit, toute la phrase retraduite', async () => {
  const dom = makeDom('<html><body><p id="p"></p></body></html>');
  const doc = dom.window.document;
  const p = doc.getElementById('p');
  const a = doc.createTextNode('Hello ');
  const name = doc.createTextNode('Bob, welcome back.');
  p.append(a, name);
  const { engine } = makeEngine(dom);
  await engine.start();
  assert.equal(p.textContent, 'HELLO BOB, WELCOME BACK.');
  assert.deepEqual(Array.from(p.childNodes), [a, name]);
  name.data = 'Alice, welcome back.';
  await tick(OBS);
  assert.equal(p.textContent, 'HELLO ALICE, WELCOME BACK.');
  engine.showOriginal();
  assert.equal(p.textContent, 'Hello Alice, welcome back.');
});

test('C1 : un élément que la traduction sort de son parent en ligne revient à sa place', async () => {
  const html = '<p>Use <a href="#">the <code>x</code> tool</a> now please.</p>';
  const dom = makeDom(`<html><body>${html}</body></html>`);
  const doc = dom.window.document;
  const code = doc.querySelector('code');
  const { engine } = makeEngine(dom, { translator: () => '<1>THE TOOL</1> {2} NOW PLEASE.' });
  await engine.start();
  assert.equal(doc.querySelector('p').innerHTML, '<a href="#">THE TOOL</a> <code>x</code> NOW PLEASE.');
  assert.equal(doc.querySelector('code'), code);
  engine.showOriginal();
  assert.equal(doc.body.innerHTML, html);
});

/* ---------- I1 : pas de relance après « Arrêter » ou une erreur ---------- */
test('I1 : après Arrêter, un changement du DOM ne relance pas la traduction', async () => {
  const dom = makeDom('<html><body><p>First paragraph text.</p><p>Second paragraph text.</p></body></html>');
  const doc = dom.window.document;
  const d = deferred();
  const { engine } = makeEngine(dom, { transport: d.transport, settings: { batchChars: 10 } });
  const p = engine.start();
  await tick();
  engine.stop();
  d.releaseOne();
  await p;
  assert.equal(engine.status().state, 'stopped');
  doc.body.insertAdjacentHTML('beforeend', '<p>Added after the stop.</p>');
  await tick(OBS);
  assert.equal(d.calls.length, 1, 'aucun nouvel envoi');
  assert.equal(engine.status().state, 'stopped');
});

test('I1 : après une erreur (pas de clé), un changement du DOM ne relance pas la traduction', async () => {
  const dom = makeDom('<html><body><p>Some text to translate.</p></body></html>');
  let n = 0;
  const transport = { translate: () => { n++; return Promise.resolve({ error: 'no_key' }); } };
  const { engine } = makeEngine(dom, { transport });
  await engine.start();
  assert.equal(engine.status().state, 'error');
  dom.window.document.body.insertAdjacentHTML('beforeend', '<p>More text appears later.</p>');
  await tick(OBS);
  assert.equal(n, 1);
  assert.equal(engine.status().state, 'error');
});

/* ---------- I2 : SPA vide au départ ---------- */
test('I2 : page vide au départ : le contenu affiché ensuite est traduit', async () => {
  const dom = makeDom('<html><body><div id="app"></div></body></html>');
  const doc = dom.window.document;
  const { engine } = makeEngine(dom);
  await engine.start();
  assert.equal(engine.status().message, 'badgeNothing');
  doc.getElementById('app').innerHTML = '<p>Rendered later by the framework.</p>';
  await tick(OBS);
  assert.equal(doc.querySelector('p').textContent, 'RENDERED LATER BY THE FRAMEWORK.');
});

/* ---------- I3 : texte modifié pendant un lot ---------- */
test('I3 : texte changé par la page pendant le lot : l\'ancienne traduction ne l\'écrase pas, le nouveau est traduit', async () => {
  const dom = makeDom('<html><body><p id="p">Loading the documentation.</p></body></html>');
  const doc = dom.window.document;
  const p = doc.getElementById('p');
  const d = deferred();
  const { engine } = makeEngine(dom, { transport: d.transport });
  const run = engine.start();
  await tick();
  p.firstChild.data = 'The documentation is ready.';
  d.releaseOne();
  await run;
  assert.equal(p.textContent, 'The documentation is ready.', 'ancienne traduction non appliquée');
  await tick(OBS);
  await d.drain();
  assert.equal(p.textContent, 'THE DOCUMENTATION IS READY.');
});

/* ---------- I4 : titre après navigation SPA ---------- */
test('I4 : « Original » après navigation SPA ne remet pas le titre de la page précédente', async () => {
  const dom = makeDom('<html><head><title>First page title</title></head><body><main id="m"><p>Old page text.</p></main></body></html>');
  const doc = dom.window.document;
  const { engine } = makeEngine(dom);
  await engine.start();
  assert.equal(doc.title, 'FIRST PAGE TITLE');
  dom.window.history.pushState({}, '', '/guide/next');
  doc.title = 'Second page title';
  doc.getElementById('m').innerHTML = '<p>New page text here.</p>';
  engine._checkUrl();
  await tick(30);
  assert.equal(doc.title, 'SECOND PAGE TITLE');
  engine.showOriginal();
  assert.equal(doc.title, 'Second page title');
});

test('I4 : titre changé par la page sans navigation : « Original » n\'y touche pas', async () => {
  const dom = makeDom('<html><head><title>Some page title</title></head><body><p>Body text here.</p></body></html>');
  const doc = dom.window.document;
  const { engine } = makeEngine(dom);
  await engine.start();
  doc.title = '(1) New notification';
  engine.showOriginal();
  assert.equal(doc.title, '(1) New notification');
});

/* ---------- I5 : pas de fuite mémoire en SPA ---------- */
test('I5 : navigation SPA : les unités de l\'ancienne page sont oubliées', async () => {
  const dom = makeDom('<html><body><main id="m"><p>Old page text.</p><p>Another old paragraph.</p></main></body></html>');
  const doc = dom.window.document;
  const { engine } = makeEngine(dom);
  await engine.start();
  assert.equal(engine._units().length, 2);
  for (let i = 0; i < 3; i++) {
    dom.window.history.pushState({}, '', '/guide/p' + i);
    doc.getElementById('m').innerHTML = `<p>New page number ${i} text.</p>`;
    engine._checkUrl();
    await tick(30);
  }
  assert.equal(engine._units().length, 1, 'seule la page affichée reste');
  assert.equal(engine.status().total, 1);
  assert.equal(engine.status().done, 1);
});

/* ---------- I6 : ordre calculé une fois par scan ---------- */
test('I6 : la position des unités n\'est pas recalculée à chaque lot', async () => {
  const paras = Array.from({ length: 40 }, (_, i) => `<p>Paragraph number ${i} here.</p>`).join('');
  const dom = makeDom(`<html><body><main>${paras}</main></body></html>`);
  const proto = dom.window.Element.prototype;
  const orig = proto.getBoundingClientRect;
  let n = 0;
  proto.getBoundingClientRect = function () { n++; return orig.call(this); };
  const { engine, calls } = makeEngine(dom, { settings: { batchChars: 10 } });
  await engine.start();
  assert.equal(calls.length, 40, 'un lot par paragraphe');
  assert.ok(n <= 80, 'getBoundingClientRect appelé ' + n + ' fois');
  assert.equal(engine.status().done, 40);
});

/* ---------- I7 : iframe, vidéo, champs : jamais copiés ni déplacés ---------- */
const HEAVY = '<p>Watch <video src="a.mp4"></video> this clip and type <input value="x"> here please.</p>' +
  '<p>See <span>the frame <iframe src="about:blank"></iframe></span> below the text.</p>';

test('I7 : bilingue : pas de copie des vidéos, iframes ni champs', async () => {
  const dom = makeDom(`<html><body>${HEAVY}</body></html>`);
  const doc = dom.window.document;
  const before = doc.body.innerHTML;
  const { engine } = makeEngine(dom, { settings: { mode: 'bilingual' } });
  await engine.start();
  assert.ok(doc.querySelectorAll('[data-tr-bi]').length >= 2);
  assert.equal(doc.querySelectorAll('[data-tr-bi] video, [data-tr-bi] iframe, [data-tr-bi] input').length, 0);
  assert.equal(doc.querySelectorAll('video').length, 1);
  assert.equal(doc.querySelectorAll('iframe').length, 1);
  engine.showOriginal();
  assert.equal(doc.body.innerHTML, before);
});

test('I7 : remplacer : la séquence est coupée sur ces éléments, qui ne bougent pas', async () => {
  const dom = makeDom(`<html><body>${HEAVY}</body></html>`);
  const doc = dom.window.document;
  const before = doc.body.innerHTML;
  const { engine } = makeEngine(dom);
  const units = engine.scan();
  for (const u of units.filter((x) => x.kind === 'run')) {
    for (const k of Object.keys(u.map)) assert.ok(!/^(VIDEO|IFRAME|INPUT|SPAN)$/.test(u.map[k].el.tagName), u.src);
  }
  const video = doc.querySelector('video');
  const next = video.nextSibling;
  await engine.start();
  assert.equal(video.nextSibling, next, 'vidéo non déplacée');
  assert.ok(doc.body.textContent.includes('THIS CLIP AND TYPE'));
  assert.ok(doc.body.textContent.includes('THE FRAME'));
  engine.showOriginal();
  assert.equal(doc.body.innerHTML, before);
});

/* ---------- M1 : attributs dans des éléments en ligne imbriqués ---------- */
test('M1 : attribut d\'un élément imbriqué dans une séquence traduit malgré <html translate="no">', async () => {
  const dom = makeDom('<html><body><p>Read <em>the <a href="#" title="Open the reference guide">guide</a></em> carefully.</p>' +
    '<p translate="no">Keep <em><a href="#" title="Do not translate this">x</a></em> text.</p></body></html>');
  const doc = dom.window.document;
  const { engine } = makeEngine(dom);
  await engine.start();
  const links = doc.querySelectorAll('a');
  assert.equal(links[0].getAttribute('title'), 'OPEN THE REFERENCE GUIDE');
  assert.equal(links[1].getAttribute('title'), 'Do not translate this');
});

/* ---------- M2 : Arrêter puis Traduire pendant un lot ---------- */
test('M2 : Arrêter puis Traduire pendant un lot : la traduction continue jusqu\'au bout', async () => {
  const dom = makeDom('<html><body><p>First paragraph text.</p><p>Second paragraph text.</p><p>Third paragraph text.</p></body></html>');
  const d = deferred();
  const { engine } = makeEngine(dom, { transport: d.transport, settings: { batchChars: 10 } });
  const first = engine.start();
  await tick();
  engine.stop();
  const again = engine.start();
  await d.drain();
  await first;
  await again;
  assert.equal(engine.status().state, 'done');
  assert.equal(engine.status().done, 3);
});

/* ---------- M3 : bilingue : attributs non envoyés ---------- */
test('M3 : bilingue : les attributs ne sont pas envoyés (jamais appliqués)', async () => {
  const dom = makeDom('<html><body><p>Some body text.</p><img src="a.png" alt="Diagram of the flow"></body></html>');
  const { engine, calls } = makeEngine(dom, { settings: { mode: 'bilingual' } });
  await engine.start();
  assert.deepEqual(calls.flat(), ['Some body text.']);
  assert.equal(engine.status().state, 'done');
  assert.equal(engine.status().done, engine.status().total);
});

/* ---------- M4 : séquence avec un nœud déjà traité ---------- */
test('M4 : texte ajouté à côté d\'un passage traduit : traduit lui aussi', async () => {
  const dom = makeDom('<html><body><p id="p">Hello <b>world</b> again.</p></body></html>');
  const doc = dom.window.document;
  const p = doc.getElementById('p');
  const { engine, calls } = makeEngine(dom);
  await engine.start();
  p.appendChild(doc.createTextNode(' Extra sentence added later.'));
  await tick(OBS);
  assert.deepEqual(calls[1], ['Extra sentence added later.']);
  assert.equal(p.textContent, 'HELLO WORLD AGAIN. EXTRA SENTENCE ADDED LATER.');
});

/* ---------- M6 : badge fermé ---------- */
test('M6 : badge fermé : il le reste au lot suivant, rouvert par Traduire', async () => {
  const dom = makeDom('<html><body><p>First paragraph text.</p><p>Second paragraph text.</p></body></html>');
  const doc = dom.window.document;
  const d = deferred();
  const { engine } = makeEngine(dom, { transport: d.transport, noBadge: false, settings: { batchChars: 10 } });
  const run = engine.start();
  await tick();
  const host = doc.querySelector('div[data-tr-ui]');
  host.shadowRoot.querySelector('[data-a=close]').click();
  assert.equal(host.style.display, 'none');
  await d.drain();
  await run;
  assert.equal(host.style.display, 'none', 'toujours fermé après les lots');
  await engine.start();
  assert.equal(host.style.display, '');
});

/* ---------- M7 : annonces aux lecteurs d'écran ---------- */
test('M7 : la zone annoncée ne change qu\'avec l\'état, pas à chaque lot', async () => {
  const dom = makeDom('<html><body><p>First paragraph text.</p><p>Second paragraph text.</p><p>Third paragraph text.</p></body></html>');
  const doc = dom.window.document;
  const seenLive = [];
  const seenMsg = [];
  let box;
  const transport = {
    translate(texts) {
      box = box || doc.querySelector('div[data-tr-ui]').shadowRoot;
      seenLive.push(box.querySelector('[aria-live]').textContent);
      seenMsg.push(box.querySelector('.msg').textContent);
      return Promise.resolve({ translations: texts.map(fakeTranslate) });
    }
  };
  const { engine } = makeEngine(dom, { transport, noBadge: false, settings: { batchChars: 10 } });
  await engine.start();
  assert.equal(seenLive.length, 3);
  assert.equal(new Set(seenLive).size, 1, 'pas d\'annonce par lot : ' + seenLive.join(' / '));
  assert.ok(new Set(seenMsg).size > 1, 'le texte visible, lui, avance');
  assert.equal(box.querySelector('.msg').getAttribute('aria-live'), null);
  assert.notEqual(box.querySelector('[aria-live]').textContent, seenLive[0], 'fin annoncée');
});

/* ---------- M11 : changement de langue cible ---------- */
test('M11 : nouvelle langue : échecs remis à zéro, passages retentés', async () => {
  const dom = makeDom('<html><body><p>Hello <b>world</b>.</p><p>Second line ok.</p></body></html>');
  let fail = true;
  const transport = { translate: (texts) => Promise.resolve({ translations: texts.map((s, i) => (fail && i === 0 ? null : fakeTranslate(s))) }) };
  const { engine } = makeEngine(dom, { transport });
  await engine.start();
  assert.equal(engine.status().failed, 1);
  engine.setSettings({ target: 'de' });
  assert.equal(engine.status().failed, 0);
  assert.ok(engine._units().every((u) => !u.failed));
  fail = false;
  await engine.start();
  assert.equal(dom.window.document.querySelector('p').textContent, 'HELLO WORLD.');
});

test('M11 : nouvelle langue pendant un lot : la réponse de l\'ancienne langue est ignorée', async () => {
  const dom = makeDom('<html><body><p id="p">Translate me please.</p></body></html>');
  const doc = dom.window.document;
  const replies = ['ANCIENNE LANGUE.', 'NEUE SPRACHE.'];
  const pending = [];
  const transport = {
    translate(texts) {
      const v = replies[pending.length];
      return new Promise((r) => pending.push(() => r({ translations: texts.map(() => v) })));
    }
  };
  const { engine } = makeEngine(dom, { transport });
  const run = engine.start();
  await tick();
  engine.setSettings({ target: 'de' });
  pending[0]();
  for (let i = 0; i < 20 && pending.length < 2; i++) await tick();
  assert.equal(pending.length, 2, 'renvoyé dans la nouvelle langue');
  assert.equal(doc.getElementById('p').textContent, 'Translate me please.');
  pending[1]();
  await run;
  assert.equal(doc.getElementById('p').textContent, 'NEUE SPRACHE.');
});

test('C1 : texte qui change sans cesse (horloge) : retraduit quelques fois seulement (quota)', async () => {
  const dom = makeDom('<html><body><p id="p">Updated just now.</p></body></html>');
  const p = dom.window.document.getElementById('p');
  const { engine, calls } = makeEngine(dom);
  await engine.start();
  for (let i = 1; i <= 7; i++) {
    p.firstChild.data = `Updated ${i} seconds ago.`;
    await tick(900);
  }
  assert.equal(calls.length, 1 + 5, 'cinq retraductions au plus');
  assert.equal(p.textContent, 'Updated 7 seconds ago.', 'le texte de la page reste visible');
  engine.showOriginal();
  assert.equal(p.textContent, 'Updated 7 seconds ago.');
});
