/* Tests du site multilingue (docs/, généré par tools/build_site.py depuis tools/site/<langue>.json). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SRC = path.join(ROOT, 'tools', 'site');
const SITE = 'https://devdoctrad.vercel.app';
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests', 'base.json'), 'utf8')).version;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const RTL = ['ar', 'he', 'fa', 'ur'];
const EXT_TARGETS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'pt-BR', 'nl', 'pl', 'ru', 'uk', 'cs', 'sk', 'ro', 'hu', 'bg', 'el',
  'sv', 'da', 'no', 'fi', 'tr', 'ar', 'he', 'fa', 'hi', 'bn', 'ur', 'id', 'ms', 'vi', 'th', 'zh', 'zh-TW', 'ja', 'ko', 'sw'];

const langs = fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const load = (l) => JSON.parse(fs.readFileSync(path.join(SRC, l + '.json'), 'utf8'));
const fr = load('fr');
const folder = (l) => (l === 'fr' ? '' : l.toLowerCase());
const pageFile = (l) => path.join(DOCS, folder(l), 'index.html');
const page = (l) => new JSDOM(fs.readFileSync(pageFile(l), 'utf8')).window.document;

test('site : les 37 langues de traduction de l\'extension ont leur page', () => {
  assert.deepEqual(langs.slice().sort(), EXT_TARGETS.slice().sort());
  // même liste que DDT.TARGETS dans l'extension
  const DDT = require('../src/shared.js');
  assert.deepEqual(Object.keys(DDT.TARGETS).sort(), EXT_TARGETS.slice().sort());
});

for (const l of langs) {
  test(`site ${l} : textes complets, jetons et balises corrects`, () => {
    const t = load(l);
    assert.deepEqual(Object.keys(t).sort(), Object.keys(fr).sort(), 'mêmes clés que fr.json');
    for (const [k, v] of Object.entries(t)) {
      assert.equal(typeof v, 'string', k);
      assert.ok(v.trim(), `${l}.${k} vide`);
      assert.ok(!EMOJI.test(v), `${l}.${k} : emoji`);
      const tags = (v.match(/<[^>]*>/g) || []).filter((x) => !/^<\/?(b|code)>$/.test(x));
      assert.deepEqual(tags, [], `${l}.${k} : balise non autorisée`);
      assert.equal((v.match(/<b>/g) || []).length, (v.match(/<\/b>/g) || []).length, `${l}.${k} : <b> non fermé`);
      const tokens = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
      assert.equal(tokens(v), tokens(fr[k]), `${l}.${k} : jetons {…} différents du français`);
    }
    for (const k of Object.keys(t)) {
      if (/^(inst_k4|f_modes_p)$/.test(k)) assert.ok(/Alt\+/.test(t[k]), `${l}.${k} : raccourci absent`);
    }
    assert.ok(/Groq/.test(t.a_voice) && /Alt\+\S+\+V/.test(t.a_voice), `${l} : la réponse sur la voix cite Groq et le raccourci`);
  });

  test(`site ${l} : page générée (langue, sens, canonique, hreflang, liens)`, () => {
    const d = page(l);
    const t = load(l);
    const html = d.documentElement;
    assert.equal(html.getAttribute('dir'), RTL.includes(l) ? 'rtl' : 'ltr');
    assert.ok(html.getAttribute('lang'));
    const url = SITE + '/' + (folder(l) ? folder(l) + '/' : '');
    assert.equal(d.querySelector('link[rel=canonical]').href, url);
    const alts = [...d.querySelectorAll('link[rel=alternate][hreflang]')];
    assert.equal(alts.length, langs.length + 1, 'toutes les langues + x-default');
    assert.equal(d.title, t.meta_title.replace(/<[^>]+>/g, ''));
    assert.equal(d.querySelectorAll('.grid .card').length, 7, '7 fonctions, dont la voix');
    assert.equal(d.querySelectorAll('#faq details').length, 7);
    assert.equal(d.querySelectorAll('details.lang li a').length, langs.length, 'menu : toutes les langues');
    assert.equal(d.querySelectorAll('details.lang a[aria-current=page]').length, 1);
    // liens de téléchargement à jour
    const zips = [...d.querySelectorAll('a[href$=".zip"]')].map((a) => a.getAttribute('href'));
    assert.deepEqual(zips.map((z) => path.basename(z)), [`devdoctrad-chrome-${version}.zip`, `devdoctrad-firefox-${version}.zip`]);
    for (const z of zips) assert.ok(fs.existsSync(path.join(ROOT, 'release', path.basename(z))), 'zip publié : ' + z);
    // ressources relatives : toutes présentes
    const base = path.dirname(pageFile(l));
    for (const el of d.querySelectorAll('img[src], link[href], script[src], a[href]')) {
      const u = el.getAttribute('src') || el.getAttribute('href');
      if (/^(https?:|#|mailto:)/.test(u)) continue;
      const target = path.resolve(base, u.endsWith('/') || u === '' ? u + 'index.html' : u);
      assert.ok(fs.existsSync(target), `${l} : lien cassé ${u}`);
    }
    // JSON-LD valide
    const ld = JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);
    assert.equal(ld.softwareVersion, version);
    assert.equal(ld.offers.price, '0');
  });
}

/* ---------- Firefox sur addons.mozilla.org, démos interactives, site.js ---------- */
const AMO = 'https://addons.mozilla.org/firefox/addon/devdoctrad/';
const DEMO_CODE = 'import { readFile } from "node:fs/promises";\n\nconst text = await readFile("config.json", "utf8");\nconst config = JSON.parse(text);';
const DEMO_KEYS = ['demo_title', 'demo_sub', 'demo_modes', 'demo_orig', 'demo_tr', 'demo_bi', 'demo_h', 'demo_p', 'demo_a', 'demo_note',
  'vid_title', 'vid_sub', 'vid_label', 'vid_play', 'vid_pause', 'vid_replay', 'vid_1', 'vid_2', 'vid_3',
  'theme_dark', 'copy', 'copied', 'inst_f_amo', 'inst_f_amo_p', 'inst_f_manual'];
const codes = (els) => [...els].map((c) => c.textContent);

for (const l of langs) {
  test(`site ${l} : Firefox s'installe depuis addons.mozilla.org, le zip reste en option`, () => {
    const d = page(l);
    const t = load(l);
    assert.equal(d.querySelector('.hero .btns a[href*="mozilla"]').getAttribute('href'), AMO, 'bouton « Installer sur Firefox »');
    const card = [...d.querySelectorAll('#install .cols .card')].find((c) => c.querySelector('h3').textContent === 'Firefox');
    const first = card.querySelector('h3').nextElementSibling.querySelector('a');
    assert.equal(first.getAttribute('href'), AMO, 'AMO en premier dans la carte Firefox');
    assert.equal(first.textContent, t.inst_f_amo);
    assert.ok(/addons\.mozilla\.org/.test(t.inst_f_amo), `${l}.inst_f_amo cite addons.mozilla.org`);
    const zip = card.querySelector('details.alt a[href$=".zip"]');
    assert.ok(zip && /firefox/.test(zip.getAttribute('href')), 'zip manuel dans l\'option repliée');
    assert.equal(JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent).installUrl, AMO);
  });

  test(`site ${l} : site.js chargé, démo des modes et démo de la voix présentes`, () => {
    const d = page(l);
    const t = load(l);
    const s = d.querySelector('script[src$="site.js"]');
    assert.ok(s && s.hasAttribute('defer'), 'site.js chargé en defer');
    // démo des modes : trois boutons, bilingue par défaut (lisible sans JavaScript : tout est affiché)
    const demo = d.querySelector('#demo .demo');
    assert.equal(demo.getAttribute('data-mode'), 'bi');
    const btns = [...demo.querySelectorAll('.modes button[data-mode]')];
    assert.deepEqual(btns.map((b) => b.getAttribute('data-mode')), ['or', 'tr', 'bi']);
    assert.deepEqual(btns.map((b) => b.textContent), [t.demo_orig, t.demo_tr, t.demo_bi]);
    assert.deepEqual(btns.map((b) => b.getAttribute('aria-pressed')), ['false', 'false', 'true']);
    assert.ok(demo.querySelector('.modes').hasAttribute('hidden'), 'boutons cachés tant que site.js n\'a pas tourné');
    for (const sel of ['h3', 'p:not(.lk)', 'p.lk a']) {
      const el = demo.querySelector('.doc ' + sel);
      assert.ok(el.querySelector('.or').textContent.trim() && el.querySelector('.tr').textContent.trim(), `${l} : ${sel} original et traduit`);
      assert.equal(el.querySelector('.or').getAttribute('dir'), 'ltr');
    }
    // démo de la voix : 3 sous-titres, région annoncée, commandes cachées sans JavaScript
    const vid = d.querySelector('#voice-demo .vid');
    const cues = vid.querySelectorAll('.cues li');
    assert.equal(cues.length, 3);
    for (const [i, li] of [...cues].entries()) {
      assert.ok(li.querySelector('.o').textContent.trim(), 'sous-titre original');
      assert.equal(li.querySelector('.t').textContent.replace(/\s+/g, ' ').trim(),
        t['vid_' + (i + 1)].replace('{cmd}', 'npm install lru-cache').replace('{f1}', 'fetch()').replace('{f2}', 'cachedFetch()'));
    }
    assert.equal(vid.querySelector('.cue').getAttribute('aria-live'), 'polite');
    assert.ok(vid.querySelector('.big').hasAttribute('hidden') && vid.querySelector('.ctl').hasAttribute('hidden'));
    for (const k of ['data-play', 'data-pause', 'data-replay']) assert.ok(vid.getAttribute(k).trim(), k);
    // thème et copie
    assert.equal(d.querySelector('button.theme').getAttribute('aria-label'), t.theme_dark);
    assert.equal(d.body.getAttribute('data-copy'), t.copy);
    assert.equal(d.body.getAttribute('data-copied'), t.copied);
    assert.equal(d.querySelectorAll('#install code.cp').length, 4, 'chrome://, edge://, brave://, about:debugging');
  });

  test(`site ${l} : le code des démos est identique au caractère près`, () => {
    const d = page(l);
    assert.equal(d.querySelector('#demo pre code').textContent, DEMO_CODE);
    assert.deepEqual(codes(d.querySelectorAll('#demo .doc p:not(.lk) .tr code')), ['readFile()', 'JSON.parse()']);
    assert.deepEqual(codes(d.querySelectorAll('#demo .doc p:not(.lk) .or code')), ['readFile()', 'JSON.parse()']);
    assert.deepEqual(codes(d.querySelectorAll('#voice-demo .cues .t code')), ['npm install lru-cache', 'fetch()', 'cachedFetch()']);
    assert.equal(d.querySelector('#demo .doc p.lk a').getAttribute('href'), page('fr').querySelector('#demo .doc p.lk a').getAttribute('href'));
  });
}

test('démos : textes présents et vraiment traduits dans les 37 langues', () => {
  const en = load('en');
  for (const l of langs) {
    const t = load(l);
    for (const k of DEMO_KEYS) assert.ok(t[k] && t[k].trim(), `${l}.${k} vide`);
    if (l === 'en') continue;
    for (const k of ['demo_h', 'demo_p', 'demo_a', 'vid_1', 'vid_2', 'vid_3', 'demo_sub', 'vid_sub']) {
      assert.notEqual(t[k], en[k], `${l}.${k} : resté en anglais`);
    }
  }
  // la page anglaise montre une doc française (sinon « traduire » l'anglais en anglais ne montrerait rien)
  assert.equal(page('en').querySelector('#demo .doc h3 .or').getAttribute('lang'), 'fr');
  assert.equal(page('ja').querySelector('#demo .doc h3 .or').getAttribute('lang'), 'en');
  assert.equal(page('ja').querySelector('#demo .doc h3 .or').textContent, load('en').demo_h);
});

/* ---------- Comportement de site.js (jsdom) ---------- */
function interactive(l, opts = {}) {
  let html = fs.readFileSync(pageFile(l), 'utf8').replace(/<script src="[^"]*\.js"[^>]*><\/script>/g, '');
  if (opts.step) html = html.replace(/data-step="\d+"/, `data-step="${opts.step}"`);
  const dom = new JSDOM(html, { url: SITE + '/' + (folder(l) ? folder(l) + '/' : ''), runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (opts.blockStorage) Object.defineProperty(w, 'localStorage', { get() { throw new Error('bloqué'); } });
  w.eval(fs.readFileSync(path.join(DOCS, 'site.js'), 'utf8'));
  return w;
}

test('site.js : les trois modes de la démo changent l\'affichage et aria-pressed', () => {
  const w = interactive('fr');
  const d = w.document;
  const demo = d.querySelector('.demo');
  assert.equal(d.querySelector('.modes').hidden, false, 'boutons visibles avec JavaScript');
  const btn = (m) => d.querySelector(`.modes button[data-mode="${m}"]`);
  for (const m of ['or', 'tr', 'bi']) {
    btn(m).click();
    assert.equal(demo.getAttribute('data-mode'), m);
    for (const o of ['or', 'tr', 'bi']) assert.equal(btn(o).getAttribute('aria-pressed'), String(o === m));
    assert.equal(d.querySelector('#demo pre code').textContent, DEMO_CODE, 'le code ne bouge pas');
  }
  // flèche droite : bouton suivant
  btn('or').click();
  btn('or').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(demo.getAttribute('data-mode'), 'tr');
  assert.equal(d.activeElement, btn('tr'));
});

test('site.js : thème mémorisé, et rien ne casse si le stockage est bloqué', () => {
  let w = interactive('de');
  const b = w.document.querySelector('button.theme');
  assert.equal(b.hidden, false);
  assert.equal(b.getAttribute('aria-pressed'), 'false', 'clair par défaut (système clair dans jsdom)');
  b.click();
  assert.equal(w.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(b.getAttribute('aria-pressed'), 'true');
  assert.equal(w.localStorage.getItem('ddt-site-theme'), 'dark');
  b.click();
  assert.equal(w.localStorage.getItem('ddt-site-theme'), 'light');
  w = interactive('ar', { blockStorage: true });
  w.document.querySelector('button.theme').click();
  assert.equal(w.document.documentElement.getAttribute('data-theme'), 'dark');
});

test('site.js : boutons copier ajoutés à côté des commandes', () => {
  const w = interactive('ja');
  const btns = w.document.querySelectorAll('#install button.copy');
  assert.equal(btns.length, 4);
  assert.equal(btns[0].previousElementSibling.textContent, 'chrome://extensions');
  assert.equal(btns[0].getAttribute('aria-label'), load('ja').copy + ' chrome://extensions');
  assert.equal(w.document.querySelectorAll('.sr[aria-live=polite]').length, 1, 'annonce « copié » pour les lecteurs d\'écran');
});

test('site.js : la fausse vidéo fait défiler les 3 sous-titres, se met en pause, puis propose de rejouer', async () => {
  const es = load('es');
  // pas par défaut (3,5 s) : lecture puis pause sur le premier sous-titre
  const w = interactive('es');
  const v = w.document.querySelector('.vid');
  assert.equal(v.querySelector('.ctl').hidden, false);
  assert.equal(v.querySelector('.big').hidden, false);
  assert.equal(v.querySelector('.cue').textContent, '');
  v.querySelector('.big').click();
  assert.equal(v.getAttribute('data-state'), 'playing');
  assert.equal(v.querySelector('.big').hidden, true);
  assert.equal(v.querySelector('.pp').getAttribute('aria-label'), es.vid_pause);
  assert.equal(w.document.activeElement, v.querySelector('.pp'), 'focus gardé sur la commande');
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(v.querySelector('.cue .t').textContent, es.vid_1);
  v.querySelector('.pp').click();
  assert.equal(v.getAttribute('data-state'), 'paused');
  assert.equal(v.querySelector('.big').hidden, false);
  w.close();
  // pas très court : la démo va au bout
  const w2 = interactive('es', { step: 25 });
  const v2 = w2.document.querySelector('.vid');
  const seen = new Set();
  new w2.MutationObserver(() => seen.add(v2.querySelector('.cue').textContent)).observe(v2.querySelector('.cue'), { childList: true, subtree: true });
  v2.querySelector('.big').click();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(v2.getAttribute('data-state'), 'ended');
  assert.equal(v2.querySelector('.pp').getAttribute('aria-label'), es.vid_replay);
  assert.equal(v2.querySelector('.big span').textContent, es.vid_replay);
  assert.equal(v2.querySelector('.cue .t').textContent.replace('cachedFetch()', '{f2}').replace('fetch()', '{f1}'), es.vid_3);
  assert.equal([...seen].filter(Boolean).length, 3, 'les trois sous-titres sont passés dans la région annoncée');
  w2.close();
});

test('sitemap : une adresse par langue, avec toutes les variantes', () => {
  const xml = fs.readFileSync(path.join(DOCS, 'sitemap.xml'), 'utf8');
  assert.equal((xml.match(/<loc>/g) || []).length, langs.length);
  assert.equal((xml.match(/hreflang="x-default"/g) || []).length, langs.length);
  assert.ok(fs.readFileSync(path.join(DOCS, 'robots.txt'), 'utf8').includes(SITE + '/sitemap.xml'));
});

test('llms.txt : cite la voix et toutes les langues du site', () => {
  const txt = fs.readFileSync(path.join(DOCS, 'llms.txt'), 'utf8');
  assert.ok(/voice of videos/i.test(txt));
  assert.equal((txt.match(/- \[Website \(/g) || []).length, langs.length);
  assert.ok(txt.includes(`Current version: ${version}`));
});

test('site : docs/ est à jour avec tools/site (relancer python3 tools/build_site.py sinon)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-site-'));
  execFileSync('python3', [path.join(ROOT, 'tools', 'build_site.py')], { env: Object.assign({}, process.env, { DDT_SITE_OUT: tmp }) });
  const strip = (s) => s.replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  for (const l of langs) {
    const rel = path.join(folder(l), 'index.html');
    assert.equal(fs.readFileSync(path.join(tmp, rel), 'utf8'), fs.readFileSync(path.join(DOCS, rel), 'utf8'), 'page périmée : ' + rel);
  }
  for (const f of ['lang.js', 'site.js', 'llms.txt', 'sitemap.xml']) {
    assert.equal(strip(fs.readFileSync(path.join(tmp, f), 'utf8')), strip(fs.readFileSync(path.join(DOCS, f), 'utf8')), 'fichier périmé : ' + f);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* ---------- Bandeau « voir ce site dans ta langue » ---------- */
function banner(pageLang, languages, stored) {
  const html = fs.readFileSync(pageFile(pageLang), 'utf8').replace(/<script src="[^"]*lang\.js"[^>]*><\/script>/, '');
  const dom = new JSDOM(html, { url: SITE + '/' + (folder(pageLang) ? folder(pageLang) + '/' : ''), runScripts: 'outside-only' });
  const w = dom.window;
  Object.defineProperty(w.navigator, 'languages', { value: languages, configurable: true });
  if (stored) w.localStorage.setItem('ddt-site-lang-dismissed', stored);
  w.eval(fs.readFileSync(path.join(DOCS, 'lang.js'), 'utf8'));
  const bar = w.document.querySelector('.langbar');
  const out = bar ? { text: bar.querySelector('a').textContent, href: bar.querySelector('a').getAttribute('href'), dir: bar.dir, close: bar.querySelector('button') } : null;
  return { out, w };
}

test('bandeau : propose la langue du navigateur, dans cette langue', () => {
  assert.deepEqual((({ text, href }) => ({ text, href }))(banner('fr', ['ru-RU', 'ru']).out), { text: 'Открыть сайт на русском', href: '/ru/' });
  assert.equal(banner('en', ['de-AT']).out.href, '/de/');
  assert.equal(banner('fr', ['zh-HK']).out.href, '/zh-tw/');
  assert.equal(banner('fr', ['zh-CN']).out.href, '/zh/');
  assert.equal(banner('fr', ['pt-BR']).out.href, '/pt-br/');
  assert.equal(banner('fr', ['pt-PT']).out.href, '/pt/');
  assert.equal(banner('fr', ['nb-NO']).out.href, '/no/');
  assert.equal(banner('en', ['fr-CA']).out.href, '/');
  assert.equal(banner('fr', ['ar-EG']).out.dir, 'rtl');
});

test('bandeau : rien si la page est déjà dans la bonne langue, si la langue est inconnue, ou après fermeture', () => {
  assert.equal(banner('ru', ['ru-RU']).out, null);
  assert.equal(banner('zh-TW', ['zh-TW']).out, null);
  assert.equal(banner('fr', ['xx-YY']).out, null);
  assert.equal(banner('fr', ['ja'], 'ja').out, null);
  const { out, w } = banner('fr', ['ko-KR']);
  out.close.click();
  assert.equal(w.document.querySelector('.langbar'), null);
  assert.equal(w.localStorage.getItem('ddt-site-lang-dismissed'), 'ko');
});

test('bandeau : la deuxième langue préférée sert si la première n\'existe pas', () => {
  assert.equal(banner('fr', ['gsw-CH', 'it-CH']).out.href, '/it/');
});

test('galerie : grandes images cliquables (plein écran), lien direct vers l\'image sans JavaScript', () => {
  const css = fs.readFileSync(path.join(DOCS, 'style.css'), 'utf8');
  assert.ok(/\.gallery\{[^}]*minmax\(min\(100%,460px\)/.test(css), '2 grandes colonnes au plus');
  for (const l of langs) {
    const d = page(l);
    const links = [...d.querySelectorAll('.gallery a.zoom')];
    assert.equal(links.length, 4, l);
    for (const a of links) assert.equal(a.getAttribute('href'), a.querySelector('img').getAttribute('src'), l);
    assert.ok(d.querySelector('.gallery').getAttribute('data-close'), l + ' : libellé Fermer');
  }
  assert.ok(fs.readFileSync(path.join(DOCS, 'site.js'), 'utf8').includes('lightbox'));
});
