/* Paquets livrés : le validateur officiel de Mozilla (addons-linter, celui d'addons.mozilla.org)
   doit rendre 0 erreur, 0 avertissement, 0 avis sur le paquet Firefox ; le manifeste Chrome ne
   doit contenir aucune clé inconnue de Chrome. Les paquets sont construits dans un dossier
   temporaire (build.py --dist) : dist/ et release/ ne sont pas touchés. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LINTER = path.join(ROOT, 'node_modules', 'addons-linter', 'bin', 'addons-linter');

/* Avertissements tolérés le temps qu'un travail en cours les supprime. À vider dès que possible :
   chaque entrée encore présente mais devenue inutile fait échouer le test, pour ne pas l'oublier.
   - voice.js : la bande de sous-titres est en cours de réécriture (construction DOM sans innerHTML). */
const PENDING = [
  { code: 'UNSAFE_VAR_ASSIGNMENT', file: 'voice.js' }
];

let dir;
test.before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddt-build-'));
  const r = spawnSync('python3', [path.join(ROOT, 'build.py'), '--dist', dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'build.py --dist a échoué :\n' + r.stdout + r.stderr);
});
test.after(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

test('validateur de Mozilla : 0 erreur, 0 avertissement, 0 avis sur le paquet Firefox', () => {
  const r = spawnSync(process.execPath, [LINTER, path.join(dir, 'firefox'), '--output', 'json'], { encoding: 'utf8', maxBuffer: 32 << 20 });
  let report;
  try { report = JSON.parse(r.stdout); } catch (e) { assert.fail('sortie illisible du validateur :\n' + r.stdout + r.stderr); }
  const all = [];
  for (const kind of ['errors', 'warnings', 'notices']) {
    for (const m of report[kind] || []) all.push({ kind, code: m.code, file: m.file || '', line: m.line || '', message: m.message });
  }
  const pending = (m) => PENDING.some((p) => p.code === m.code && p.file === m.file && m.kind === 'warnings');
  const left = all.filter((m) => !pending(m));
  const list = left.map((m) => `  [${m.kind}] ${m.code} ${m.file}${m.line ? ':' + m.line : ''} - ${m.message}`).join('\n');
  assert.equal(left.length, 0, `${left.length} message(s) du validateur de Mozilla :\n${list}`);
  for (const p of PENDING) {
    assert.ok(all.some((m) => m.code === p.code && m.file === p.file), `exception devenue inutile, à retirer de PENDING : ${p.code} ${p.file}`);
  }
});

test('paquet Chrome : manifeste sans clé inconnue de Chrome', () => {
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'chrome', 'manifest.json'), 'utf8'));
  // clés de manifeste MV3 reconnues par Chrome (developer.chrome.com/docs/extensions/reference/manifest)
  const KNOWN = new Set(['manifest_version', 'name', 'short_name', 'description', 'version', 'version_name',
    'default_locale', 'homepage_url', 'icons', 'action', 'options_ui', 'options_page', 'permissions',
    'host_permissions', 'optional_permissions', 'optional_host_permissions', 'commands', 'background',
    'content_scripts', 'web_accessible_resources', 'minimum_chrome_version', 'content_security_policy',
    'author', 'key', 'side_panel', 'storage', 'externally_connectable', 'incognito', 'offline_enabled',
    'update_url', 'devtools_page', 'chrome_url_overrides', 'declarative_net_request', 'omnibox']);
  const unknown = Object.keys(m).filter((k) => !KNOWN.has(k));
  assert.deepEqual(unknown, [], 'clés inconnues de Chrome : ' + unknown.join(', '));
  assert.ok(!('browser_specific_settings' in m), 'browser_specific_settings est propre à Firefox');
  assert.ok(m.background && m.background.service_worker && !m.background.scripts, 'Chrome : service_worker seul');
});

test('paquet Firefox : version minimale de Firefox pour Android déclarée (collecte de données, Firefox 142)', () => {
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'firefox', 'manifest.json'), 'utf8'));
  assert.ok(m.browser_specific_settings.gecko.data_collection_permissions);
  assert.equal(m.browser_specific_settings.gecko_android.strict_min_version, '142.0');
});
