/*
 * Petite vidéo « tutoriel » de 10 s (sans son), servie à l'extension pendant la capture
 * de la voix des vidéos. Elle remplace l'image de test de tools/demo/voice/clip.webm,
 * qui est faite pour les tests, pas pour une publicité. Les sous-titres anglais sont
 * ceux de tools/demo/voice/subs.en.vtt (mêmes moments, mêmes phrases).
 *
 * Rendu image par image (temps fixe, 30 i/s) dans Chromium puis encodé en VP9 par ffmpeg.
 */
'use strict';
const { spawn } = require('child_process');

const W = 1280, H = 720, DPR = 1.5, FPS = 30, DUR = 10;

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:I;src:url(/tools/video/fonts/Inter-Regular.woff2);font-weight:400}
@font-face{font-family:I;src:url(/tools/video/fonts/Inter-SemiBold.woff2);font-weight:600}
@font-face{font-family:I;src:url(/tools/video/fonts/InterDisplay-ExtraBold.woff2);font-weight:800}
@font-face{font-family:M;src:url(/tools/video/fonts/JetBrainsMono-Regular.woff2)}
*{box-sizing:border-box}html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
body{font-family:I,sans-serif;color:#e6edf3;background:#0b0f1a;position:relative}
.bg{position:absolute;inset:-20%;background:radial-gradient(40% 50% at 20% 20%,rgba(56,120,255,.35),transparent 70%),radial-gradient(40% 50% at 85% 30%,rgba(255,120,80,.25),transparent 70%),radial-gradient(50% 50% at 50% 100%,rgba(40,200,170,.18),transparent 70%)}
.brand{position:absolute;left:28px;top:22px;display:flex;align-items:center;gap:10px;font-weight:600;font-size:17px;opacity:.92}
.brand i{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#ff8a4c,#ff4f7b);display:block}
.ep{position:absolute;right:28px;top:24px;font-size:14px;color:#9aa4b2;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.part{position:absolute;inset:0;opacity:0}
.title{position:absolute;left:0;right:0;top:150px;text-align:center}
.title h1{margin:0;font-weight:800;font-size:84px;letter-spacing:-.035em}
.title p{margin:10px 0 0;font-size:26px;color:#9aa4b2}
.avatar{position:absolute;left:50%;top:330px;transform:translateX(-50%);display:flex;align-items:center;gap:16px;padding:12px 20px 12px 12px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.avatar b{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#ffb36b,#ff6a88);display:grid;place-items:center;font-size:20px;color:#2a1020}
.wave{display:flex;gap:4px;align-items:center;height:34px}.wave span{width:5px;border-radius:3px;background:#ffb36b;display:block}
.win{position:absolute;left:190px;right:190px;top:96px;border-radius:14px;background:#0d1117;border:1px solid #30363d;box-shadow:0 30px 60px rgba(0,0,0,.45);overflow:hidden}
.win .bar{height:38px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:8px;padding:0 14px;font-size:14px;color:#8b949e}
.win .bar i{width:12px;height:12px;border-radius:50%;display:block}
.win pre{margin:0;padding:22px 26px;font:21px/1.6 M,monospace;min-height:270px;white-space:pre}
.p{color:#7ee787}.d{color:#8b949e}.k{color:#ff7b72}.s{color:#a5d6ff}.n{color:#79c0ff}
.cur{display:inline-block;width:11px;height:24px;background:#e6edf3;vertical-align:-4px}
</style></head><body><div class="bg" id="bg"></div>
<div class="brand"><i></i>Nimbus HTTP</div><div class="ep">Tutorial · 0:10</div>
<div class="part" id="a"><div class="title"><h1>Getting started</h1><p>Nimbus HTTP in 10 seconds</p></div>
<div class="avatar"><b>N</b><div class="wave" id="wave"></div></div></div>
<div class="part" id="b"><div class="win"><div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span style="margin-left:10px">Terminal — my-app</span></div><pre id="term"></pre></div></div>
<div class="part" id="c"><div class="win"><div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span style="margin-left:10px">nimbus.config.js</span></div><pre id="code"></pre></div></div>
<script>
const wave = document.getElementById('wave');
for (let i = 0; i < 18; i++) wave.appendChild(document.createElement('span'));
const ease = (x) => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const CMD = 'npm install nimbus-http';
const CODE = [
  ['<span class="k">export default</span> {'],
  ['  baseUrl: <span class="s">\\'https://api.example.com\\'</span>,', 'baseUrl'],
  ['  timeout: <span class="n">30000</span>,'],
  ['  retries: <span class="n">2</span>,'],
  ['};']
];
window.renderAt = (t) => {
  const fa = ease((t - 0.0) / .4) * (1 - ease((t - 3.3) / .3));
  const fb = ease((t - 3.4) / .35) * (1 - ease((t - 6.8) / .3));
  const fc = ease((t - 6.9) / .35);
  const set = (id, o, dy) => { const e = document.getElementById(id); e.style.opacity = o; e.style.transform = 'translateY(' + (1 - o) * dy + 'px)'; };
  set('a', fa, 20); set('b', fb, 24); set('c', fc, 24);
  document.getElementById('bg').style.transform = 'translate(' + Math.sin(t * .5) * 30 + 'px,' + Math.cos(t * .4) * 20 + 'px)';
  [...wave.children].forEach((s, i) => { s.style.height = (6 + 26 * Math.abs(Math.sin(t * 7.3 + i * .8) * Math.sin(t * 2.1 + i * .37))) + 'px'; });
  const n = Math.max(0, Math.min(CMD.length, Math.floor((t - 3.8) * 18)));
  const blink = Math.floor(t * 2) % 2 === 0;
  let term = '<span class="p">~/my-app</span> <span class="d">$</span> ' + CMD.slice(0, n);
  if (t < 5.4) term += blink || n < CMD.length ? '<span class="cur"></span>' : '';
  if (t >= 5.6) term += '\\n\\n<span class="d">added 1 package, audited 2 packages in 812ms</span>';
  if (t >= 5.9) term += '\\n<span class="p">found 0 vulnerabilities</span>';
  if (t >= 6.1) term += '\\n\\n<span class="p">~/my-app</span> <span class="d">$</span> ' + (blink ? '<span class="cur"></span>' : '');
  document.getElementById('term').innerHTML = term;
  const lines = Math.max(0, Math.min(CODE.length, Math.floor((t - 7.2) * 3.2) + 1));
  document.getElementById('code').innerHTML = t < 7.2 ? '' : CODE.slice(0, lines).map((l) => l[0]).join('\\n') + (blink ? '<span class="cur"></span>' : ' ');
};
</script></body></html>`;

/* Rend la vidéo dans outFile (webm VP9). page : page Playwright sur le serveur local. */
async function renderClip(page, baseUrl, outFile, log) {
  await page.setViewportSize({ width: W, height: H });
  await page.goto(baseUrl + '/__clip.html');
  await page.evaluate(() => document.fonts.ready);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '28', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-pix_fmt', 'yuv420p', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, ko) => ff.on('close', (c) => (c ? ko(new Error('ffmpeg clip ' + c)) : ok())));
  for (let i = 0; i < FPS * DUR; i++) {
    await page.evaluate((t) => window.renderAt(t), i / FPS);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  if (log) log('vidéo tutoriel : ' + outFile);
}

module.exports = { CLIP_HTML: HTML, renderClip, CLIP_SIZE: { W, H, DPR } };
