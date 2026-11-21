#!/usr/bin/env node
/*
 * Exporte le logo (design/logo/*.svg) en PNG avec Chromium : icônes de l'extension,
 * icône du Chrome Web Store, images du site. Relancer : node tools/export_logo.js
 * 16 et 32 px utilisent la version simplifiée (devdoctrad-symbol-small.svg).
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const L = (f) => fs.readFileSync(path.join(ROOT, 'design', 'logo', f), 'utf8');
const JOBS = [
  ['devdoctrad-symbol-small.svg', 16, 0, 'src/icons/icon-16.png'],
  ['devdoctrad-symbol-small.svg', 32, 0, 'src/icons/icon-32.png'],
  ['devdoctrad-symbol.svg', 48, 0, 'src/icons/icon-48.png'],
  ['devdoctrad-symbol.svg', 128, 0, 'src/icons/icon-128.png'],
  ['devdoctrad-symbol.svg', 128, 16, 'store/icon-128.png'],
  ['devdoctrad-symbol.svg', 512, 0, 'docs/assets/icon-512.png'],
  ['devdoctrad-symbol.svg', 180, 18, 'docs/assets/apple-touch-icon.png'],
  ['devdoctrad-symbol-small.svg', 32, 0, 'docs/assets/favicon-32.png'],
  ['devdoctrad-symbol.svg', 1024, 0, 'design/logo/devdoctrad-symbol-1024.png'],
  ['devdoctrad-logotype-light.svg', [1120, 256], 0, 'design/logo/devdoctrad-logotype-light.png'],
  ['devdoctrad-logotype-dark.svg', [1120, 256], 0, 'design/logo/devdoctrad-logotype-dark.png']
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [file, size, pad, out] of JOBS) {
    const [w, h] = Array.isArray(size) ? size : [size, size];
    await p.setViewportSize({ width: w, height: h });
    const svg = L(file).replace(/<svg([^>]*?)width="\d+" height="\d+"/, `<svg$1width="${w - 2 * pad}" height="${h - 2 * pad}"`);
    await p.setContent(`<html><body style="margin:0;background:transparent;display:grid;place-items:center;width:${w}px;height:${h}px">${svg}</body></html>`);
    fs.mkdirSync(path.dirname(path.join(ROOT, out)), { recursive: true });
    await p.screenshot({ path: path.join(ROOT, out), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
    console.log(out, w + 'x' + h);
  }
  await b.close();
})();
