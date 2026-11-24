#!/usr/bin/env node
/* Images promotionnelles du Chrome Web Store : store/promo-440x280.png et store/promo-1400x560.png. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const logo = fs.readFileSync(path.join(ROOT, 'design', 'logo', 'devdoctrad-symbol.svg'), 'utf8');
const shot = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'store', 'screenshots', 'screenshot-1-traduction-fr.png')).toString('base64');
function page(w, h, big) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif;
  background:#070a1d;background-image:radial-gradient(60% 70% at 0% 0%,rgba(40,70,190,.75),transparent 70%),radial-gradient(60% 70% at 100% 10%,rgba(92,50,190,.6),transparent 70%),radial-gradient(60% 60% at 70% 100%,rgba(16,150,160,.5),transparent 70%);color:#eef0ff;display:flex;align-items:center;gap:${big ? 56 : 18}px;padding:0 ${big ? 80 : 26}px}
  .logo svg{width:${big ? 190 : 92}px;height:${big ? 190 : 92}px;filter:drop-shadow(0 10px 24px rgba(47,107,255,.45))}
  h1{margin:0;font-size:${big ? 76 : 34}px;letter-spacing:-.03em;line-height:1}
  h1 b{background:linear-gradient(115deg,#7c5cf6,#3b82f6,#22d3ee,#2dd4b4);-webkit-background-clip:text;background-clip:text;color:transparent}
  p{margin:${big ? 18 : 10}px 0 0;font-size:${big ? 26 : 14.5}px;line-height:1.35;color:#c3c9ee;max-width:${big ? 520 : 260}px}
  .shot{margin-left:auto;width:520px;border-radius:18px;padding:8px;background:rgba(30,34,78,.7);border:1px solid rgba(170,190,255,.2);box-shadow:0 30px 70px rgba(0,0,0,.5)}
  .shot img{display:block;width:100%;border-radius:12px}
  </style></head><body><div class="logo">${logo.replace(/<title>[^<]*<\/title>/, '')}</div><div><h1>DevDoc<b>Trad</b></h1>
  <p>${big ? 'Faithful translation of developer docs. Code stays intact.' : 'Faithful translation of developer docs. Code stays intact.'}</p></div>
  ${big ? `<div class="shot"><img src="${shot}"></div>` : ''}</body></html>`;
}
(async () => {
  const b = await chromium.launch(process.env.DDT_CHROMIUM ? { executablePath: process.env.DDT_CHROMIUM } : {});
  const p = await b.newPage();
  for (const [w, h, big, out] of [[440, 280, false, 'store/promo-440x280.png'], [1400, 560, true, 'store/promo-1400x560.png']]) {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(page(w, h, big));
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(ROOT, out) });
    console.log(out);
  }
  await b.close();
})();
