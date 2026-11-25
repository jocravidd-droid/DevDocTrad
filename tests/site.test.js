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
  for (const f of ['lang.js', 'llms.txt', 'sitemap.xml']) {
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
