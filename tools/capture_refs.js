#!/usr/bin/env node
/*
 * Capture les pages de référence du dossier design/DESIGN_RESEARCH.md dans un vrai Chromium.
 * Les images vont dans design/references/ (ignoré par git : ce sont des pages de tiers,
 * gardées pour l'étude locale, non republiées). Relancer : node tools/capture_refs.js
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'design', 'references');
const REFS = [
  ['01-apple-liquid-glass', 'https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass'],
  ['02-apple-hig-materials', 'https://developer.apple.com/design/human-interface-guidelines/materials'],
  ['03-apple-hig-app-icons', 'https://developer.apple.com/design/human-interface-guidelines/app-icons'],
  ['04-apple-macos', 'https://www.apple.com/macos/'],
  ['05-apple-newsroom-design', 'https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/'],
  ['06-raycast', 'https://www.raycast.com/'],
  ['07-mdn-backdrop-filter', 'https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter'],
  ['08-behance-iridescent', 'https://www.behance.net/search/projects/iridescent%20glass%20icon'],
  ['09-chrome-ext-docs', 'https://developer.chrome.com/docs/extensions/'],
  ['10-wikipedia-dichroic', 'https://en.wikipedia.org/wiki/Dichroic_glass']
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(process.env.DDT_CHROMIUM ? { executablePath: process.env.DDT_CHROMIUM } : {});
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, locale: 'en-US' });
    for (const [name, url] of REFS) {
      if (scheme === 'dark' && !/apple|raycast/.test(url)) continue;
      const p = await ctx.newPage();
      try {
        await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => p.waitForTimeout(3000));
        await p.waitForTimeout(1500);
        const file = path.join(OUT, `${name}-${scheme}.png`);
        await p.screenshot({ path: file });
        const title = await p.title();
        console.log('OK  ', name, scheme, '|', title);
        // une capture plus bas dans la page pour les sites vitrines
        if (/apple\.com\/(macos|newsroom)|raycast/.test(url)) {
          for (const y of [1, 2, 3]) {
            await p.evaluate((n) => window.scrollTo(0, n * window.innerHeight), y);
            await p.waitForTimeout(1200);
            await p.screenshot({ path: path.join(OUT, `${name}-${scheme}-scroll${y}.png`) });
          }
        }
      } catch (e) {
        console.log('FAIL', name, scheme, String(e.message).split('\n')[0]);
      }
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
})();
