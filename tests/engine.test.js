/* Tests du moteur de page (content.js) : découpage, application, restauration, bilingue, SPA. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeDom, makeEngine, fakeTranslate, closeAll } = require('./helpers');
test.afterEach(closeAll);

const PAGES = {
  doc: `<!doctype html><html lang="en"><head><title>Pathlib guide</title></head><body>
    <nav><a href="/">Home</a> <a href="/api" title="Open the API reference">API</a></nav>
    <main><h1>Working with files</h1>
    <p>Use <a href="/glob"><code>Path.glob()</code></a> to match <strong>files</strong> in a directory.</p>
    <p>Run <code>pip install pathlib2</code> then read https://docs.python.org/3/library/pathlib.html for details.</p>
    <ul><li>First item with <em>emphasis</em></li><li>Second item, see <kbd>Ctrl</kbd>+<kbd>C</kbd></li></ul>
    <table><tr><th>Name</th><th>Description</th></tr><tr><td><code>exists()</code></td><td>Returns true if the path exists.</td></tr></table>
    <pre><code>// Create a server
const x = 1;</code></pre>
    <div>Direct text inside a div <span>with a span</span><br>and a line break.</div>
    <p translate="no">This paragraph must stay untouched.</p>
    <p class="notranslate">Neither should this one.</p>
    <img src="a.png" alt="Diagram of the request flow">
    <input placeholder="Search the documentation">
    </main></body></html>`,
  readme: `<!doctype html><html><head><title>README</title></head><body><article class="markdown-body">
    <h2 id="install">Installation</h2>
    <p>Clone the repository and install the dependencies with <code>npm install</code>.</p>
    <blockquote><p>Note: this project requires Node 20 or later.</p></blockquote>
    <ol><li>Open <code>config.json</code>.</li><li>Set your <strong>token</strong> and save the file.</li></ol>
    </article></body></html>`,
  so: `<!doctype html><html><head><title>How to reverse a list?</title></head><body>
    <div class="question"><div class="s-prose"><p>I want to reverse a list without creating a copy. Is there a built-in way?</p></div>
    <div class="comments"><span class="comment-copy">Did you try <code>list.reverse()</code>?</span> – <a class="user" href="/u/1">alice</a></div></div>
    <div class="answer"><p>Yes, call the method directly on the list; it works in place.</p></div></body></html>`,
  forum: `<!doctype html><html><head><title>Forum thread</title></head><body>
    <div class="post"><div class="cooked"><p>Hello everyone, I am stuck with an <em>async</em> bug.<br>Any idea what could cause it?</p></div></div>
    <div class="post"><div class="cooked"><p>You are probably missing an <code>await</code> before the call.</p></div></div></body></html>`
};

function bodyOf(dom) { return dom.window.document.body.innerHTML; }

test('découpage : paragraphe avec code et lien, listes, tableaux, div, pre et translate=no ignorés, attributs, titre', () => {
  const dom = makeDom(PAGES.doc);
  const { engine } = makeEngine(dom);
  const units = engine.scan();
  const srcs = units.map((u) => u.src);
  assert.ok(srcs.includes('Use <1>{2|Path.glob()}</1> to match <3>files</3> in a directory.'), srcs.join('\n'));
  assert.ok(srcs.includes('First item with <1>emphasis</1>'));
  assert.ok(srcs.some((s) => s.startsWith('Second item, see {1|Ctrl}+{2|C}')));
  assert.ok(srcs.includes('Returns true if the path exists.'));
  assert.ok(srcs.includes('Direct text inside a div <1>with a span</1>{2|}and a line break.'));
  assert.ok(srcs.some((s) => s.includes('https://docs.python.org/3/library/pathlib.html')));
  assert.ok(!srcs.some((s) => s.includes('Create a server')), 'pre ignoré');
  assert.ok(!srcs.some((s) => s.includes('must stay untouched')), 'translate=no ignoré');
  assert.ok(!srcs.some((s) => s.includes('Neither should')), 'notranslate ignoré');
  assert.ok(!srcs.includes('exists()'), 'unité qui n\'est que du code ignorée');
  const attrs = units.filter((u) => u.kind === 'attr').map((u) => u.attr + '=' + u.src);
  assert.ok(attrs.includes('title=Open the API reference'));
  assert.ok(attrs.includes('alt=Diagram of the request flow'));
  assert.ok(attrs.includes('placeholder=Search the documentation'));
  assert.ok(units.some((u) => u.kind === 'title' && u.src === 'Pathlib guide'));
});

test('découpage : unité qui n\'est qu\'une URL ou un identifiant ignorée', () => {
  const dom = makeDom('<html><body><p>https://example.com/a/b</p><p>my_variable_name</p><p>getElementById</p><p>Installation</p></body></html>');
  const { engine } = makeEngine(dom);
  const srcs = [...engine.scan().filter((u) => u.kind === 'run').map((u) => u.src)];
  assert.deepEqual(srcs, ['Installation']);
});

test('découpage : contenu dans une shadow root ouverte', async () => {
  const dom = makeDom('<html><body><div id="host"></div></body></html>');
  const doc = dom.window.document;
  const sr = doc.getElementById('host').attachShadow({ mode: 'open' });
  sr.innerHTML = '<p>Text inside a web component.</p>';
  const { engine } = makeEngine(dom);
  const units = engine.scan();
  assert.ok(units.some((u) => u.src === 'Text inside a web component.'));
  await engine.start();
  assert.equal(sr.querySelector('p').textContent, 'TEXT INSIDE A WEB COMPONENT.');
  engine.showOriginal();
  assert.equal(sr.innerHTML, '<p>Text inside a web component.</p>');
});

for (const [name, html] of Object.entries(PAGES)) {
  test(`aller-retour exact (remplacer) : page ${name}`, async () => {
    const dom = makeDom(html);
    const before = bodyOf(dom);
    const title = dom.window.document.title;
    const htmlAttrs = dom.window.document.documentElement.outerHTML.split('>')[0];
    const { engine } = makeEngine(dom);
    await engine.start();
    assert.notEqual(bodyOf(dom), before, 'la page a changé');
    assert.equal(dom.window.document.documentElement.getAttribute('translate'), 'no');
    assert.ok(dom.window.document.querySelector('meta[name=google][content=notranslate]'));
    engine.showOriginal();
    assert.equal(bodyOf(dom), before, 'innerHTML identique après restauration');
    assert.equal(dom.window.document.title, title);
    assert.equal(dom.window.document.documentElement.outerHTML.split('>')[0], htmlAttrs);
    assert.equal(dom.window.document.querySelector('meta[name=google]'), null);
    // et encore une fois (traduction depuis la mémoire puis restauration)
    await engine.showTranslation();
    engine.showOriginal();
    assert.equal(bodyOf(dom), before, 'identique après deux allers-retours');
  });
}

test('les éléments code et liens gardent leur identité et leur contenu', async () => {
  const dom = makeDom(PAGES.doc);
  const doc = dom.window.document;
  const link = doc.querySelector('a[href="/glob"]');
  const code = link.querySelector('code');
  let clicks = 0;
  link.addEventListener('click', (e) => { e.preventDefault(); clicks++; });
  const { engine } = makeEngine(dom);
  await engine.start();
  const p = doc.querySelector('main p');
  assert.equal(p.textContent, 'USE Path.glob() TO MATCH FILES IN A DIRECTORY.');
  assert.equal(doc.querySelector('a[href="/glob"]'), link, 'même objet lien');
  assert.equal(link.querySelector('code'), code, 'même objet code');
  assert.equal(code.textContent, 'Path.glob()');
  link.click();
  assert.equal(clicks, 1, 'écouteur conservé');
  assert.equal(doc.querySelector('pre').textContent, '// Create a server\nconst x = 1;');
});

test('le modèle peut déplacer les marqueurs (grammaire) sans casser la page', async () => {
  const dom = makeDom('<html><body><p>The <b>red</b> <i>car</i> is fast.</p></body></html>');
  const before = bodyOf(dom);
  const { engine } = makeEngine(dom, { translator: () => 'La <2>voiture</2> <1>rouge</1> est rapide.' });
  await engine.start();
  assert.equal(dom.window.document.querySelector('p').innerHTML.replace('<!--ddt-->', ''), 'La <i>voiture</i> <b>rouge</b> est rapide.');
  engine.showOriginal();
  assert.equal(bodyOf(dom), before);
});

test('mode bilingue : original intact, copie ajoutée, restauration complète, rien entre deux td ou li', async () => {
  const dom = makeDom(PAGES.doc);
  const doc = dom.window.document;
  const before = bodyOf(dom);
  const firstP = doc.querySelector('main p').outerHTML;
  const { engine } = makeEngine(dom, { settings: { mode: 'bilingual' } });
  await engine.start();
  assert.equal(doc.querySelector('main p').outerHTML.split('<span data-tr-bi')[0], firstP.replace('</p>', ''));
  const bis = doc.querySelectorAll('[data-tr-bi]');
  assert.ok(bis.length >= 5);
  bis.forEach((b) => {
    assert.equal(b.getAttribute('translate'), 'no');
    assert.ok(!['TR', 'UL', 'OL', 'TABLE', 'TBODY'].includes(b.parentNode.tagName), 'parent ' + b.parentNode.tagName);
  });
  assert.equal(doc.querySelector('a[href="/glob"]').textContent, 'Path.glob()', 'original non modifié');
  assert.equal(doc.querySelectorAll('[data-tr-bi] a[href="/glob"]').length, 1, 'copie du lien dans la traduction');
  engine.showOriginal();
  assert.equal(bodyOf(dom), before);
});

test('une unité retirée de la page avant le retour du lot n\'est pas appliquée', async () => {
  const dom = makeDom('<html><body><div id="a"><p>First paragraph here.</p></div><p>Second paragraph here.</p></body></html>');
  const doc = dom.window.document;
  let release;
  const transport = {
    translate(texts) {
      return new Promise((r) => { release = () => r({ translations: texts.map(fakeTranslate) }); });
    }
  };
  const { engine } = makeEngine(dom, { transport });
  const p = engine.start();
  await new Promise((r) => setTimeout(r, 10));
  doc.getElementById('a').remove();
  release();
  await p;
  assert.equal(doc.body.innerHTML.includes('SECOND PARAGRAPH HERE.'), true);
  const u = engine._units().find((x) => x.src === 'First paragraph here.');
  assert.ok(!u.applied, 'unité disparue non appliquée');
});

test('SPA : changement d\'URL, le nouveau contenu est traduit, l\'ancien n\'est pas retraduit', async () => {
  const dom = makeDom('<html><body><main id="m"><p>Old page text.</p></main></body></html>');
  const doc = dom.window.document;
  const { engine, calls } = makeEngine(dom);
  await engine.start();
  assert.equal(calls.length, 1);
  dom.window.history.pushState({}, '', '/guide/next');
  doc.getElementById('m').innerHTML = '<p>New page text after navigation.</p>';
  engine._checkUrl();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], ['New page text after navigation.']);
  assert.equal(doc.querySelector('#m p').textContent, 'NEW PAGE TEXT AFTER NAVIGATION.');
});

test('contenu ajouté plus tard (MutationObserver) traduit sans retraduire l\'existant', async () => {
  const dom = makeDom('<html><body><p>Initial text.</p><div id="feed"></div></body></html>');
  const doc = dom.window.document;
  const { engine, calls } = makeEngine(dom);
  await engine.start();
  const p = doc.createElement('p');
  p.textContent = 'Loaded later by the site.';
  doc.getElementById('feed').appendChild(p);
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], ['Loaded later by the site.']);
  assert.equal(p.textContent, 'LOADED LATER BY THE SITE.');
});

test('texte caché puis montré par une classe (section dépliée, menu) : traduit quand il apparaît', async () => {
  const dom = makeDom('<html><head><style>.fold{display:none}</style></head><body><p>Visible text.</p>' +
    '<ol id="sub" class="fold"><li>Hidden chapter title</li></ol></body></html>');
  const doc = dom.window.document;
  const { engine, calls } = makeEngine(dom);
  await engine.start();
  assert.equal(calls.length, 1);
  assert.equal(doc.querySelector('li').textContent, 'Hidden chapter title');
  doc.getElementById('sub').className = 'open';
  await new Promise((r) => setTimeout(r, 1000));
  assert.deepEqual(calls[1], ['Hidden chapter title']);
  assert.equal(doc.querySelector('li').textContent, 'HIDDEN CHAPTER TITLE');
});

test('commentaires de code : désactivé ne touche à rien ; activé traduit seulement le texte du commentaire', async () => {
  const html = '<html><body><pre><code class="language-js"><span class="token comment">// Create a new server</span>\n' +
    'const s = <span class="token function">create</span>();\n<span class="token comment">// foo(bar);</span></code></pre></body></html>';
  let dom = makeDom(html);
  let { engine } = makeEngine(dom);
  assert.equal(engine.scan().length, 0, 'option désactivée : aucune unité dans pre');

  dom = makeDom(html);
  const before = bodyOf(dom);
  ({ engine } = makeEngine(dom, { settings: { translateComments: true } }));
  await engine.start();
  const comments = dom.window.document.querySelectorAll('.token.comment');
  assert.equal(comments[0].textContent, '// CREATE A NEW SERVER');
  assert.equal(comments[1].textContent, '// foo(bar);', 'code commenté non traduit');
  assert.ok(dom.window.document.querySelector('pre').textContent.includes('const s = create();'));
  engine.showOriginal();
  assert.equal(bodyOf(dom), before, 'bloc restauré à l\'identique');
});

test('une sortie invalide n\'est jamais appliquée et l\'unité est comptée en échec', async () => {
  const dom = makeDom('<html><body><p>Hello <b>world</b>.</p><p>Second line ok.</p></body></html>');
  const transport = { translate: (texts) => Promise.resolve({ translations: texts.map((s, i) => (i === 0 ? null : fakeTranslate(s))) }) };
  const { engine } = makeEngine(dom, { transport });
  await engine.start();
  const ps = dom.window.document.querySelectorAll('p');
  assert.equal(ps[0].innerHTML, 'Hello <b>world</b>.');
  assert.equal(ps[1].textContent, 'SECOND LINE OK.');
  assert.equal(engine.status().failed, 1);
});

test('limite de caractères par page : arrêt puis reprise avec Continuer', async () => {
  const paras = Array.from({ length: 10 }, (_, i) => `<p>${'Paragraph number ' + i + ' '.repeat(1)}${'lorem ipsum '.repeat(10)}</p>`).join('');
  const dom = makeDom(`<html><body>${paras}</body></html>`);
  const { engine } = makeEngine(dom, { settings: { pageCap: 300, batchChars: 200 } });
  await engine.start();
  assert.equal(engine.status().state, 'paused');
  const done1 = engine.status().done;
  assert.ok(done1 > 0 && done1 < 10);
  await engine.continueAfterCap();
  assert.ok(engine.status().done > done1);
});

test('limite atteinte (rate_limited) : 3 nouveaux essais maximum puis arrêt', async () => {
  const dom = makeDom('<html><body><p>Some text to translate.</p></body></html>');
  let n = 0;
  const transport = { translate: () => { n++; return Promise.resolve({ translations: [undefined], error: 'rate_limited', waitMs: 10 }); } };
  const { engine } = makeEngine(dom, { transport });
  await engine.start();
  assert.equal(n, 4);
  assert.equal(engine.status().state, 'error');
});

test('raccourci / bascule : toggle traduit, puis original, puis traduction depuis la mémoire', async () => {
  const dom = makeDom('<html><body><p>Toggle me please.</p></body></html>');
  const { engine, calls } = makeEngine(dom);
  await engine.toggle();
  assert.equal(dom.window.document.querySelector('p').textContent, 'TOGGLE ME PLEASE.');
  await engine.toggle();
  assert.equal(dom.window.document.querySelector('p').textContent, 'Toggle me please.');
  await engine.toggle();
  assert.equal(dom.window.document.querySelector('p').textContent, 'TOGGLE ME PLEASE.');
  assert.equal(calls.length, 1, 'pas de nouvel appel');
});

test('le badge est dans un shadow DOM et n\'est jamais traduit', async () => {
  const dom = makeDom('<html><body><p>Badge test page.</p></body></html>');
  const { engine, calls } = makeEngine(dom, { noBadge: false });
  await engine.start();
  const host = dom.window.document.querySelector('div[data-tr-ui]');
  assert.ok(host && host.shadowRoot);
  assert.deepEqual([...calls.flat()], ['Badge test page.']);
});

test('bilingue : pas de copie quand la traduction est identique (nom de produit)', async () => {
  const dom = makeDom('<html><body><p>Nimbus HTTP</p><p>Real sentence here.</p></body></html>');
  const before = bodyOf(dom);
  const { engine } = makeEngine(dom, { settings: { mode: 'bilingual' }, translator: (s) => (s === 'Nimbus HTTP' ? s : fakeTranslate(s)) });
  await engine.start();
  assert.equal(dom.window.document.querySelectorAll('[data-tr-bi]').length, 1);
  engine.showOriginal();
  assert.equal(bodyOf(dom), before);
});

test('ordre : le contenu principal passe avant les menus et barres latérales', async () => {
  const dom = makeDom('<html><body><nav><a href="/">Home page link</a></nav><aside><p>Sidebar text here.</p></aside>' +
    '<main><aside><p>Inner aside text.</p></aside><article><h1>Main title of the page</h1><p>Main paragraph content.</p></article></main>' +
    '<footer><p>Footer text here.</p></footer></body></html>');
  const { engine, calls } = makeEngine(dom, { settings: { batchChars: 30 } });
  await engine.start();
  const order = calls.flat();
  assert.equal(order.indexOf('Main title of the page') < order.indexOf('<1>Home page link</1>'), true, order.join(' | '));
  assert.ok(order.indexOf('Main paragraph content.') < order.indexOf('Sidebar text here.'));
  assert.ok(order.indexOf('Main paragraph content.') < order.indexOf('Inner aside text.'));
});

test('limite par page : une limite basse réglée après coup est respectée', async () => {
  const paras = Array.from({ length: 12 }, (_, i) => `<p>Paragraph ${i} ${'lorem ipsum dolor '.repeat(6)}</p>`).join('');
  const dom = makeDom(`<html><body>${paras}</body></html>`);
  const { engine } = makeEngine(dom, { settings: { batchChars: 150 } });   // créé avec la limite par défaut
  engine.setSettings({ pageCap: 400 });                                     // puis réglée plus bas
  await engine.start();
  assert.equal(engine.status().state, 'paused');
  assert.ok(engine.status().done < 12);
});
