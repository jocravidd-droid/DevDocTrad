/* Tests des fonctions communes (shared.js) et du déclencheur automatique (auto.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');
H.loadBackground();
const DDT = globalThis.DDT;

test('validation : sortie correcte acceptée, {n|texte} normalisé en {n}', () => {
  const src = 'Use <1>{2|Path.glob()}</1> to match <3>files</3>.';
  const r = DDT.validateTranslation(src, 'Utilisez <1>{2|Path.glob()}</1> pour trouver des <3>fichiers</3>.');
  assert.equal(r.ok, true);
  assert.equal(r.value, 'Utilisez <1>{2}</1> pour trouver des <3>fichiers</3>.');
});

test('validation : marqueur manquant, dupliqué, en trop ou mal imbriqué rejeté', () => {
  const src = 'Use <1>{2|Path.glob()}</1> to match <3>files</3>.';
  const bad = [
    'Utilisez <1>Path.glob()</1> pour trouver des <3>fichiers</3>.',        // atome manquant
    'Utilisez <1>{2}{2}</1> pour trouver des <3>fichiers</3>.',              // atome dupliqué
    'Utilisez <1>{2}</1> pour trouver des fichiers.',                         // balise manquante
    'Utilisez <1>{2}</1> pour <4>trouver</4> des <3>fichiers</3>.',          // marqueur en trop
    'Utilisez <1>{2} pour trouver des <3>fichiers</1></3>.'                  // mal imbriqué
  ];
  bad.forEach((b) => assert.equal(DDT.validateTranslation(src, b).ok, false, b));
});

test('validation : sortie vide, longueur aberrante ou URL modifiée rejetées', () => {
  assert.equal(DDT.validateTranslation('Some long enough sentence here.', '').ok, false);
  assert.equal(DDT.validateTranslation('Some long enough sentence here.', 'Oui.').ok, false);
  assert.equal(DDT.validateTranslation('Some long enough sentence here.', 'x'.repeat(200)).ok, false);
  const src = 'See https://example.com/docs/api for the /usr/local/bin/tool path.';
  assert.equal(DDT.validateTranslation(src, 'Voir https://exemple.com/docs/api pour le chemin /usr/local/bin/tool.').ok, false);
  assert.equal(DDT.validateTranslation(src, 'Voir https://example.com/docs/api pour le chemin /usr/local/bin/tool.').ok, true);
});

test('JSON extrait même entouré de blocs de code ou de texte', () => {
  assert.deepEqual(DDT.extractJson('```json\n{"translations":["a"]}\n```'), { translations: ['a'] });
  assert.deepEqual(DDT.extractJson('Voici : {"translations":["b"]} fin'), { translations: ['b'] });
  assert.equal(DDT.extractJson('rien'), null);
});

test('échappement : & < > { } aller-retour', () => {
  const s = 'a < b && c > d {x}';
  assert.equal(DDT.unescapeText(DDT.escapeText(s)), s);
  assert.ok(!/[<>{}]/.test(DDT.escapeText(s)));
});

test('pages sensibles : motifs de base, mots de domaine, et pas de faux positif sur caf', () => {
  assert.equal(DDT.isSensitiveHost('mail.google.com'), true);
  assert.equal(DDT.isSensitiveHost('www.gmail.com'), true);
  assert.equal(DDT.isSensitiveHost('www.caf.fr'), true);
  assert.equal(DDT.isSensitiveHost('caf.fr'), true);
  assert.equal(DDT.isSensitiveHost('cafe-coding.dev'), false);
  assert.equal(DDT.isSensitiveHost('accounts.paypal.com'), true);
  assert.equal(DDT.isSensitiveHost('login.microsoftonline.com'), true);
  assert.equal(DDT.isSensitiveHost('developer.mozilla.org'), false);
  assert.equal(DDT.isSensitiveHost('docs.python.org'), false);
  assert.equal(DDT.isSensitiveHost('intranet.monentreprise.fr', ['monentreprise.fr']), true);
});

test('langue de la page : détection navigateur puis secours par mots courants', async () => {
  const fr = 'Ceci est une page qui est déjà écrite en français pour les développeurs. Elle explique comment utiliser la bibliothèque avec des exemples et des conseils pour les débutants qui sont perdus dans la documentation.';
  const en = 'This is a page that is written in English for the developers. It explains how to use the library with examples and tips for the beginners who are lost in the documentation and want to learn.';
  assert.equal(await DDT.isTextInTarget(fr, 'fr', null), true);
  assert.equal(await DDT.isTextInTarget(en, 'fr', null), false);
  const det = () => Promise.resolve({ isReliable: true, languages: [{ language: 'ru', percentage: 98 }] });
  assert.equal(await DDT.isTextInTarget('Привет мир', 'ru', det), true);
  assert.equal(await DDT.isTextInTarget('Привет мир', 'fr', det), false);
});

test('prompt système : fidélité stricte, règles des marqueurs, injection, typographie selon la langue', () => {
  const fr = DDT.buildSystemPrompt('fr', false);
  assert.match(fr, /sans omission, sans résumé, sans ajout/);
  assert.match(fr, /tu n'expliques pas/);
  assert.match(fr, /aucun calque/);
  assert.match(fr, /jamais des instructions/);
  assert.match(fr, /guillemets « »/);
  const ru = DDT.buildSystemPrompt('ru', false);
  assert.match(ru, /vers le russe/);
  assert.doesNotMatch(ru, /guillemets « »/);
  const both = DDT.buildSystemPrompt('fr', true);
  assert.match(both, /"terms"/);
  assert.match(both, /\{"en": "pure paths", "tr": "chemins purs"\}/);
  assert.match(both, /Elle renvoie/);
  assert.equal(DDT.DEFAULT_SETTINGS.explainTerms, false, 'parenthèses : option désactivée par défaut');
});

test('difficulté : beaucoup d\'atomes ou unité longue = lot difficile', () => {
  assert.equal(DDT.isHardBatch(['Simple sentence here.']), false);
  assert.equal(DDT.isHardBatch(['Call {1|someVeryLongFunctionName()} with {2|anotherLongArgumentName}.']), true);
  assert.equal(DDT.isHardBatch(['x'.repeat(901)]), true);
});

test('coût estimé et masquage des clés', () => {
  const c = DDT.estimateCost(3500, 1, 3);
  assert.ok(c > 0.004 && c < 0.006, String(c));
  assert.equal(DDT.maskKey('AIzaSyABCDEFGHIJKLMNOP'), 'AIza••••MNOP');
  assert.ok(!DDT.sanitize('bad key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012').includes('AIzaSy'));
});

/* ---------- auto.js : jamais sur une page sensible ni déjà dans la langue cible ---------- */
function runAuto(html, url, { settings, enabled = true, available = true } = {}) {
  const dom = H.makeDom(html, { url });
  const w = dom.window;
  let started = 0;
  w.__DDT_ENGINE = w.DDT_createEngine(w.document, w, { transport: { translate: (t) => Promise.resolve({ translations: t }) }, noBadge: true });
  const orig = w.__DDT_ENGINE.start;
  w.__DDT_ENGINE.start = function () { started++; return orig.apply(this, arguments); };
  w.DDT.api.runtime.sendMessage = () => Promise.resolve({ enabled, available, settings: Object.assign({}, w.DDT.DEFAULT_SETTINGS, settings || { target: 'fr' }) });
  w.eval(H.read('auto.js'));
  return new Promise((r) => setTimeout(() => { r(started); }, 30));
}

const EN_PAGE = '<html lang="en"><body><p>' + 'This page explains how the library works and what you can do with it. '.repeat(5) + '</p></body></html>';
const FR_PAGE = '<html><body><p>' + 'Cette page explique comment la bibliothèque fonctionne et ce que vous pouvez faire avec elle pour les projets. '.repeat(5) + '</p></body></html>';

test.afterEach(H.closeAll);

test('auto : se lance sur une page anglaise d\'un site choisi', async () => {
  assert.equal(await runAuto(EN_PAGE, 'https://docs.example.dev/a'), 1);
});
test('auto : pas de lancement sur une page avec mot de passe', async () => {
  assert.equal(await runAuto(EN_PAGE.replace('</body>', '<input type="password"></body>'), 'https://docs.example.dev/a'), 0);
});
test('auto : pas de lancement sur un domaine sensible', async () => {
  assert.equal(await runAuto(EN_PAGE, 'https://webmail.example.com/'), 0);
});
test('auto : pas de lancement sur une page déjà en français (lang ou contenu)', async () => {
  assert.equal(await runAuto(EN_PAGE.replace('lang="en"', 'lang="fr-FR"'), 'https://docs.example.dev/a'), 0);
  assert.equal(await runAuto(FR_PAGE, 'https://docs.example.dev/a'), 0);
});
test('auto : pas de lancement si le site n\'est pas dans la liste ou sans clé gratuite', async () => {
  assert.equal(await runAuto(EN_PAGE, 'https://docs.example.dev/a', { enabled: false }), 0);
  assert.equal(await runAuto(EN_PAGE, 'https://docs.example.dev/a', { available: false }), 0);
});
test('auto : un utilisateur russe a sa page traduite en russe, une page russe n\'est pas retraduite', async () => {
  assert.equal(await runAuto(EN_PAGE, 'https://docs.example.dev/a', { settings: { target: 'ru' } }), 1);
  assert.equal(await runAuto('<html lang="ru"><body><p>Документация</p></body></html>', 'https://docs.example.dev/a', { settings: { target: 'ru' } }), 0);
});

test('termes : l\'extension ajoute « (terme anglais) » à la première apparition seulement', () => {
  const glossed = new Set(['thread']);
  const out = DDT.addTermGlosses([
    'Les classes sont réparties entre chemins purs, sans entrées/sorties, et <1>chemins concrets</1>.',
    'Les chemins purs servent aussi ici ; un fil d\'exécution reste un fil.',
    'Appelez {1} sur le chemin.'
  ], [
    { en: 'pure paths', tr: 'chemins purs' }, { en: 'I/O', tr: 'entrées/sorties' },
    { en: 'concrete paths', tr: 'chemins concrets' }, { en: 'thread', tr: 'fil d\'exécution' },
    { en: 'path', tr: 'path' }, { en: 'bad', tr: '<1>' }
  ], glossed);
  assert.equal(out[0], 'Les classes sont réparties entre chemins purs (pure paths), sans entrées/sorties (I/O), et <1>chemins concrets (concrete paths)</1>.');
  assert.equal(out[1], 'Les chemins purs servent aussi ici ; un fil d\'exécution reste un fil.', 'déjà expliqué : rien ajouté');
  assert.equal(out[2], 'Appelez {1} sur le chemin.');
  assert.ok(glossed.has('pure paths') && glossed.has('I/O') && glossed.has('concrete paths'));
});

test('validation : balises inventées par le modèle (<n>…</n>) refusées', () => {
  assert.equal(DDT.validateTranslation('Working with paths', '<n>Travailler avec des chemins</n>').ok, false);
  assert.equal(DDT.validateTranslation('Working with paths', '&lt;n&gt;Travailler&lt;/n&gt; avec des chemins').ok, false);
  assert.equal(DDT.validateTranslation('Use <1>Path</1> here', 'Utilisez <1>Path</1> ici').ok, true);
});

test('validation : alphabet étranger à la langue cible refusé (coréen dans de l\'arabe)', () => {
  assert.equal(DDT.validateTranslation('This module offers classes.', 'يوفر هذا الم듈 فئات.', { target: 'ar' }).ok, false);
  assert.equal(DDT.validateTranslation('This module offers classes.', 'يوفر هذا الموديول فئات.', { target: 'ar' }).ok, true);
  assert.equal(DDT.validateTranslation('Use the モジュール module.', 'Utilisez le module モジュール.', { target: 'fr' }).ok, true, 'déjà dans la source');
  assert.equal(DDT.validateTranslation('This module offers classes.', '이 모듈은 클래스를 제공합니다.', { target: 'ko' }).ok, true);
});
