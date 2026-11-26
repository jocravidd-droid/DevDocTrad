/* Cohérence d'une version : numéros, journal, paquets publiés et empreintes. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const version = JSON.parse(read('manifests/base.json')).version;

test('version : même numéro dans le manifeste et package.json, format SemVer', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(read('package.json')).version, version);
});

test('version : le journal (CHANGELOG.md) a une section pour la version actuelle, datée', () => {
  const log = read('CHANGELOG.md');
  assert.match(log, new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'));
});

test('paquets : les zips de la version sont dans release/ et leurs empreintes sont justes', () => {
  const sums = read('release/SHA256SUMS.txt').trim().split('\n').map((l) => l.split(/\s+/));
  const names = sums.map((s) => s[1]).sort();
  assert.deepEqual(names, [`devdoctrad-chrome-${version}.zip`, `devdoctrad-firefox-${version}.zip`]);
  for (const [hash, name] of sums) {
    const buf = fs.readFileSync(path.join(ROOT, 'release', name));
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), hash, name);
  }
  const old = fs.readdirSync(path.join(ROOT, 'release')).filter((f) => f.endsWith('.zip') && !f.includes(version));
  assert.deepEqual(old, [], 'anciens zips à retirer');
});

test('paquets : le zip Chrome contient bien le code actuel (voice.js, manifeste à jour)', () => {
  // lecture minimale du répertoire central d'un zip, sans dépendance
  const buf = fs.readFileSync(path.join(ROOT, 'release', `devdoctrad-chrome-${version}.zip`));
  const names = [];
  let i = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(i + 10);
  let off = buf.readUInt32LE(i + 16);
  for (let n = 0; n < count; n++) {
    const len = buf.readUInt16LE(off + 28);
    const extra = buf.readUInt16LE(off + 30);
    const comment = buf.readUInt16LE(off + 32);
    names.push(buf.slice(off + 46, off + 46 + len).toString());
    off += 46 + len + extra + comment;
  }
  for (const f of ['manifest.json', 'voice.js', 'background.js', 'content.js', 'shared.js', 'popup.html', '_locales/fr/messages.json']) {
    assert.ok(names.includes(f), 'absent du zip : ' + f);
  }
  const srcFiles = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /\.(js|html|css)$/.test(f));
  for (const f of srcFiles) assert.ok(names.includes(f), 'fichier source absent du zip : ' + f);
});

test('site et README : liens de téléchargement vers la version actuelle', () => {
  for (const f of ['README.md', 'docs/index.html', 'docs/en/index.html']) {
    const s = read(f);
    const zips = s.match(/devdoctrad-(?:chrome|firefox)-\d+\.\d+\.\d+\.zip/g) || [];
    assert.ok(zips.length >= 2, f);
    for (const z of zips) assert.ok(z.includes(version), `${f} : ${z} n'est pas la version ${version}`);
    // la page de la dernière version d'abord : elle reste valable quand une nouvelle version retire les anciens zips
    assert.ok(s.includes('https://github.com/jocravidd-droid/DevDocTrad/releases/latest'), `${f} : lien releases/latest absent`);
    const direct = s.match(/https:\/\/github\.com\/jocravidd-droid\/DevDocTrad\/raw\/main\/release\/devdoctrad-(?:chrome|firefox)-[\d.]+\.zip/g) || [];
    assert.ok(direct.length >= 2, `${f} : liens directs raw/main/release absents`);
    assert.ok(s.indexOf('/releases/latest') < s.indexOf('/raw/main/release/'), `${f} : releases/latest doit venir avant le lien direct`);
  }
});
