/*
 * Composition de la vidéo de présentation DevDocTrad (voir stage.html et make.js).
 * Tout dépend du temps t passé à window.renderAt(t) : aucune animation CSS, aucune horloge.
 * Les images de la page de démo, du popup et de la vidéo sous-titrée sont de vraies
 * captures de l'extension (tools/video/capture.js), lues dans dist/video/captures.
 */
(function () {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const FMT = Q.get('fmt') || 'wide';
  const LANG = Q.get('lang') === 'en' ? 'en' : 'fr';
  const CAP = Q.get('captures') || '/dist/video/captures/';
  const SIZE = { wide: [1920, 1080], vertical: [1080, 1920], thumb: [1280, 720] }[FMT];
  const [W, H] = SIZE;
  const V = FMT === 'vertical';
  const NB = ' ', NNB = ' ';

  const TEXT = {
    fr: {
      hook: V ? ['Une doc', 'en anglais' + NNB + '?'] : ['Une doc en anglais' + NNB + '?'],
      hookSub: 'Lis-la dans ta langue.',
      ghosts: ['Getting started', 'Handling errors', 'API reference', 'Retries and timeouts', 'Streaming responses', 'Changelog', 'Making requests', 'Configuration'],
      cap: {
        doc: 'Ta doc préférée… en anglais.',
        click: 'Un clic sur DevDocTrad',
        translate: 'La page se traduit en français…',
        code: '…et le code reste intact.',
        modes: 'Original, traduction ou bilingue' + NB + ': un clic.',
        video: 'Les vidéos aussi' + NB + ': sous-titres traduits.'
      },
      url: 'localhost/nimbus-http/getting-started',
      tagOrig: 'Original · anglais', tagTr: 'Traduit · français',
      chip: 'Code intact',
      seg: ['Original', 'Traduction', 'Bilingue'],
      vlabel: 'Voix des vidéos',
      langsWord: 'langues', langsSub: 'La tienne est sûrement dedans.',
      cards: [['Gratuit', 'Clés gratuites ou Ollama'], ['Open source', 'Licence MIT'], ['Sans pistage', 'Aucune statistique']],
      tagline: 'Traduit la doc. Jamais le code.',
      cta1: ['Disponible pour Firefox', 'addons.mozilla.org'],
      cta2: ['Chrome · Edge · Brave', 'devdoctrad.vercel.app'],
      foot: 'Gratuit · open source · sans pistage',
      thumb: { kicker: 'Une doc en anglais' + NNB + '?', title: ['Traduite', 'en un clic.'], sub: 'Le code reste intact.<br>37 langues · gratuit · open source' }
    },
    en: {
      hook: V ? ['Docs not in', 'your language?'] : ['Docs not in your language?'],
      hookSub: 'Read them in yours.',
      ghosts: ['Getting started', 'Handling errors', 'API reference', 'Retries and timeouts', 'Streaming responses', 'Changelog', 'Making requests', 'Configuration'],
      cap: {
        doc: 'Great docs… but not in your language.',
        click: 'One click on DevDocTrad',
        translate: 'The page is translated…',
        code: '…and the code stays untouched.',
        modes: 'Original, translation or both: one click.',
        video: 'Videos too: translated subtitles.'
      },
      url: 'localhost/nimbus-http/getting-started',
      tagOrig: 'Original · English', tagTr: 'Translated · French',
      chip: 'Code untouched',
      seg: ['Original', 'Translation', 'Bilingual'],
      vlabel: 'Video voice',
      langsWord: 'languages', langsSub: 'Yours is probably one of them.',
      cards: [['Free', 'Free API keys or Ollama'], ['Open source', 'MIT License'], ['No tracking', 'No analytics at all']],
      tagline: 'Translates the docs. Never the code.',
      cta1: ['Get it for Firefox', 'addons.mozilla.org'],
      cta2: ['Chrome · Edge · Brave', 'devdoctrad.vercel.app'],
      foot: 'Free · open source · no tracking',
      thumb: { kicker: 'Docs not in your language?', title: ['Translated', 'in one click.'], sub: 'The code stays untouched.<br>37 languages · free · open source' }
    }
  }[LANG];

  const LANGS = ['Français', 'Español', 'Deutsch', '日本語', 'Português', 'Русский', '中文', 'Italiano', '한국어', 'Türkçe',
    'Polski', 'العربية', 'Nederlands', 'Українська', 'Tiếng Việt', 'Ελληνικά', 'Svenska', 'Bahasa Indonesia', 'Čeština',
    'עברית', 'Română', 'हिन्दी', 'Magyar', 'ไทย', 'Dansk', 'Suomi', 'Norsk', 'فارسی', 'Български', 'Slovenčina',
    'বাংলা', 'Bahasa Melayu', 'Kiswahili', '繁體中文', 'English', 'اردو', 'Português (BR)'];

  /* ---------- outils ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const pr = (t, a, b) => clamp((t - a) / (b - a));
  const eo = (x) => 1 - Math.pow(1 - x, 3);
  const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const eback = (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const lerp = (a, b, x) => a + (b - a) * x;
  /* visible entre a et b, avec apparition et disparition */
  const vis = (t, a, b, fi = 0.35, fo = 0.35) => eo(pr(t, a, a + fi)) * (1 - eio(pr(t, b - fo, b)));
  /* images clés : [[t, {..valeurs}], ...] -> valeurs interpolées (ease in-out) */
  function keys(t, list) {
    if (t <= list[0][0]) return list[0][1];
    for (let i = 1; i < list.length; i++) {
      if (t <= list[i][0]) {
        const [ta, a] = list[i - 1], [tb, b] = list[i];
        const x = eio(pr(t, ta, tb));
        const o = {};
        for (const k in b) o[k] = lerp(a[k], b[k], x);
        return o;
      }
    }
    return list[list.length - 1][1];
  }
  function el(tag, cls, parent, css, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) Object.assign(e.style, css);
    if (html != null) e.innerHTML = html;
    (parent || stage).appendChild(e);
    return e;
  }
  const px = (n) => n + 'px';
  function place(e, x, y, w, h) { e.style.left = px(x); e.style.top = px(y); if (w != null) e.style.width = px(w); if (h != null) e.style.height = px(h); }
  /* réduit la police tant que le texte dépasse maxW */
  function fit(e, maxW, inner) { const m = inner || e; let fs = parseFloat(e.style.fontSize); while ((inner ? m.offsetWidth : m.scrollWidth) > (maxW || m.clientWidth + 1) && fs > 10) { fs -= 1; e.style.fontSize = px(fs); } }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const ICON = {
    check: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
    lock: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/></svg>`,
    puzzle: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#d7dcf7" stroke-width="2" stroke-linejoin="round"><path d="M10 4a2 2 0 014 0v1h4a1 1 0 011 1v4h-1a2 2 0 000 4h1v4a1 1 0 01-1 1h-4v-1a2 2 0 00-4 0v1H6a1 1 0 01-1-1v-4h1a2 2 0 000-4H5V6a1 1 0 011-1h4z"/></svg>`,
    voice: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>`,
    code: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/></svg>`,
    shield: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`,
    zero: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 11-17 0 8.5 8.5 0 0117 0z"/><path d="M15.5 8.6A4.6 4.6 0 008.4 10M15.5 15.4A4.6 4.6 0 018.4 14M6.5 10.8h6M6.5 13.2h6"/></svg>`,
    arrow: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    globe: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg>`
  };
  const CURSOR = '<svg width="44" height="44" viewBox="0 0 24 24"><path d="M4.5 2.8v16.6l4.3-4.1 2.9 6.6 3-1.3-2.9-6.5h6z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';

  /* ---------- calendrier (secondes) ---------- */
  const T = V ? {
    dur: 29.5, hookOut: 2.6, winIn: 2.3, capDoc: [2.8, 4.0],
    curIn: 3.2, extAt: 3.85, click1: 4.0, capClick: [4.0, 5.55], trAt: 4.85, click2: 5.0, popClose: 5.3, sweep: [5.45, 6.6],
    capTr: [5.55, 8.0], zoomH1: [6.6, 7.2], zoomPre: [8.0, 8.6], spot: [8.25, 11.0], capCode: [8.0, 11.0], swaps: [[9.35, 'en'], [10.1, 'fr']],
    zoomOut: [11.0, 11.6], seg: [11.25, 14.1], segOrig: null, segBi: 12.1, zoomBi: [12.35, 13.0], capModes: [11.25, 14.0], winOut: [13.9, 14.4],
    video: [14.2, 19.0], capVideo: [14.4, 19.0], vStart: 14.5,
    langs: [19.0, 22.2], free: [22.2, 25.0], cta: 25.0
  } : {
    dur: 39, hookOut: 3.0, winIn: 2.7, capDoc: [3.3, 5.8],
    curIn: 5.0, extAt: 5.75, click1: 5.9, capClick: [5.9, 7.9], trAt: 6.95, click2: 7.1, popClose: 7.4, sweep: [7.55, 8.85],
    capTr: [7.9, 11.3], zoomH1: [8.9, 9.7], zoomPre: [11.2, 12.0], spot: [11.6, 15.2], capCode: [11.3, 15.2], swaps: [[13.0, 'en'], [13.9, 'fr']],
    zoomOut: [15.2, 15.9], seg: [15.6, 19.9], segOrig: 16.6, segBi: 17.5, zoomBi: [17.75, 18.5], capModes: [15.6, 19.85], winOut: [19.6, 20.2],
    video: [20.0, 25.8], capVideo: [20.2, 25.8], vStart: 20.4,
    langs: [25.8, 29.6], free: [29.6, 33.0], cta: 33.0
  };
  const EVENTS = [];
  if (FMT !== 'thumb') {
    EVENTS.push({ t: 0.1, type: 'whoosh' }, { t: T.winIn, type: 'whoosh' }, { t: T.click1, type: 'click' }, { t: T.click2, type: 'click' },
      { t: T.sweep[0], type: 'sweep' }, { t: T.spot[0], type: 'pop' }, { t: T.segBi, type: 'click' }, { t: T.video[0], type: 'whoosh' },
      { t: T.langs[0], type: 'whoosh' }, { t: T.free[0] + 0.1, type: 'pop' }, { t: T.free[0] + 0.3, type: 'pop' }, { t: T.free[0] + 0.5, type: 'pop' },
      { t: T.cta, type: 'whoosh' }, { t: T.cta + 0.3, type: 'chime' });
    if (T.segOrig) EVENTS.push({ t: T.segOrig, type: 'click' });
    EVENTS.sort((a, b) => a.t - b.t);
  }

  /* ---------- construction ---------- */
  const stage = document.getElementById('stage');
  Object.assign(stage.style, { width: px(W), height: px(H) });
  document.documentElement.style.width = document.body.style.width = px(W);
  document.documentElement.style.height = document.body.style.height = px(H);

  let M, SET, CAPS, R;   // manifeste, format de page, captures de la langue, positions
  const E = {};

  function buildBackground() {
    const bl = [['#1d4ed8', 0.62], ['#7c3aed', 0.5], ['#0d9488', 0.42], ['#db2777', 0.22]];
    E.blobs = bl.map(([c, o]) => el('div', 'blob', stage, { width: px(W * 0.9), height: px(W * 0.9), background: `radial-gradient(closest-side,${c},transparent)`, opacity: o }));
    el('div', 'grain');
  }

  function buildHook() {
    const big = V ? 124 : 132;
    E.hook = el('div', 'abs', stage, { left: 0, top: 0, width: px(W), height: px(H) });
    E.ghosts = TEXT.ghosts.map((g, i) => el('div', 'ghost', E.hook, { fontSize: px(V ? 30 : 28) }, esc(g)));
    E.hookLines = [];
    const lineH = big * 1.08;
    const top0 = H / 2 - (TEXT.hook.length * lineH) / 2 - (V ? 80 : 60);
    TEXT.hook.forEach((line, li) => {
      const L = el('div', 'display', E.hook, { position: 'absolute', left: 0, width: px(W), top: px(top0 + li * lineH), textAlign: 'center', fontSize: px(big) });
      const inner = el('span', '', L, { display: 'inline-block', whiteSpace: 'nowrap' });
      const words = line.split(' ');
      const spans = words.map((w, i) => el('span', 'w' + (li === TEXT.hook.length - 1 && i === words.length - 1 ? ' gtext' : ''), inner, null, esc(w) + (i < words.length - 1 ? ' ' : '')));
      fit(L, W - (V ? 80 : 160), inner);
      E.hookLines.push(spans);
    });
    E.hookSub = el('div', 'sub', E.hook, { position: 'absolute', left: 0, width: px(W), textAlign: 'center', top: px(top0 + TEXT.hook.length * lineH + 30), fontSize: px(V ? 52 : 50), fontWeight: 600, color: '#b9c0e8' }, esc(TEXT.hookSub));
    const spots = V
      ? [[90, 260], [600, 180], [140, 1500], [560, 1640], [80, 1250], [640, 1380], [300, 330], [520, 1520]]
      : [[120, 140], [1420, 120], [180, 880], [1380, 900], [760, 90], [700, 960], [90, 520], [1560, 520]];
    E.ghosts.forEach((g, i) => { g.dataset.x = spots[i][0]; g.dataset.y = spots[i][1]; });
  }

  function buildWindow() {
    const L = V ? { x: 40, y: 92, w: 1000, bar: 74 } : { x: 280, y: 28, w: 1360, bar: 58 };
    SET = M.sets[V ? 'tall' : 'wide'];
    const s = L.w / SET.w;
    L.s = s; L.vh = Math.round(SET.h * s);
    E.L = L;
    E.win = el('div', 'abs glass', stage, { width: px(L.w), left: px(L.x), top: px(L.y), borderRadius: px(V ? 30 : 26) });
    E.win.id = 'win';
    const bar = el('div', '', E.win, { height: px(L.bar), padding: V ? '0 22px' : '0 18px', gap: px(V ? 16 : 12) });
    bar.id = 'bar';
    const d = V ? 18 : 14;
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c) => el('i', 'dot', bar, { width: px(d), height: px(d), background: c, display: 'block' }));
    const url = el('div', '', bar, { height: px(V ? 50 : 38), padding: V ? '0 22px' : '0 18px', fontSize: px(V ? 25 : 19), marginLeft: px(V ? 8 : 14) }, ICON.lock(V ? 24 : 18) + `<span class="mono">${esc(TEXT.url)}</span>`);
    url.id = 'url';
    const eb = el('div', '', bar, { width: px(V ? 56 : 44), height: px(V ? 56 : 44) }, `<img src="/design/logo/devdoctrad-symbol.svg" width="${V ? 44 : 34}" height="${V ? 44 : 34}">`);
    eb.id = 'extbtn';
    E.extbtn = eb;
    el('div', '', bar, null, ICON.puzzle(V ? 30 : 24)).id = 'puzzle';
    E.view = el('div', '', E.win, { width: px(L.w), height: px(L.vh) });
    E.view.id = 'view';
    E.cam = el('div', '', E.view, { width: px(SET.w), height: px(SET.h) });
    E.cam.id = 'cam';
    E.pages = {};
    for (const k of ['en', 'fr', 'orig', 'bi']) {
      E.pages[k] = el('img', 'page', E.cam, { width: px(SET.w), height: px(SET.h) });
      E.pages[k].src = CAP + SET.shots[k].file;
    }
    E.sweep = el('div', '', E.cam, { zIndex: 6 }, '<div class="glow"></div><div class="line"></div>');
    E.sweep.id = 'sweep';
    const pre = R.fr.pre;
    E.spot = el('div', '', E.cam, { zIndex: 5, left: px(pre.x), top: px(pre.y), width: px(pre.w), height: px(pre.h), borderRadius: '10px' });
    E.spot.id = 'spot';
    E.chip = el('div', '', E.view, { fontSize: px(V ? 36 : 30), padding: V ? '14px 28px' : '12px 24px' }, ICON.check(V ? 36 : 30) + esc(TEXT.chip));
    E.chip.id = 'chip';
    E.langtag = el('div', '', E.view, { fontSize: px(V ? 30 : 24), padding: V ? '12px 24px' : '10px 20px', left: px(V ? 24 : 22), bottom: px(V ? 250 : 20) });
    E.langtag.id = 'langtag';
    // sélecteur original / traduction / bilingue
    const sw = V ? 290 : 240, sh = V ? 78 : 62;
    E.seg = el('div', '', stage, { width: px(sw * 3 + 12), height: px(sh + 12) });
    E.seg.id = 'seg';
    E.segInd = el('div', 'ind', E.seg, { width: px(sw) });
    E.segItems = TEXT.seg.map((s2, i) => el('span', '', E.seg, { width: px(sw), lineHeight: px(sh), fontSize: px(V ? 32 : 27) }, esc(s2)));
    E.segGeo = { sw, sh, x: L.x + (L.w - (sw * 3 + 12)) / 2, y: L.y + L.bar / 2 - (sh + 12) / 2 };
    place(E.seg, E.segGeo.x, E.segGeo.y);
    // popup de l'extension (vraie capture)
    const k = V ? 1.55 : 1.12;
    const P = M.popup;
    const ph = P.contentH || Math.min(P.h, 472);
    E.popGeo = { k, w: P.w * k, h: ph * k };
    E.popup = el('div', '', stage, { width: px(P.w * k), height: px(ph * k) }, `<img src="${CAP + P.file}">`);
    E.popup.id = 'popup';
    E.press = el('div', '', E.popup);
    E.press.id = 'press';
    const tr = P.rects.translate;
    place(E.press, tr.x * k, tr.y * k, tr.w * k, tr.h * k);
  }

  function buildVideo() {
    const cw = V ? 1000 : 1400;
    const ih = V ? 800 : Math.round((cw - 28) * 9 / 16);
    const ch = ih + 28;
    const x = (W - cw) / 2, y = V ? (H - ch) / 2 - 60 : 116;
    E.vcard = el('div', 'abs glass', stage, { left: px(x), top: px(y), width: px(cw), height: px(ch) });
    E.vcard.id = 'vcard';
    const wrap = el('div', '', E.vcard, { height: px(ih), overflow: 'hidden', borderRadius: '16px' });
    E.vimg = el('img', '', wrap, { width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 50%', transformOrigin: '50% 80%', borderRadius: 0 });
    E.vlabel = el('div', '', stage, { fontSize: px(V ? 44 : 30), padding: V ? '16px 32px' : '12px 24px' }, ICON.voice(V ? 44 : 30) + esc(TEXT.vlabel));
    E.vlabel.id = 'vlabel';
    E.vGeo = { x, y, cw, ch };
    E.vframes = M.voice.frames.map((f) => CAP + M.voice.dir + '/' + f);
  }

  function buildLangs() {
    E.langs = el('div', '', stage);
    E.langs.id = 'langs';
    const n = el('div', '', E.langs);
    n.id = 'n37';
    E.num = el('span', 'num display gtext', n, { fontSize: px(V ? 330 : 360), lineHeight: 1 }, '37');
    E.numWord = el('div', 'display', n, { fontSize: px(V ? 96 : 92) }, esc(TEXT.langsWord));
    E.numSub = el('div', '', n, { fontSize: px(V ? 40 : 34), fontWeight: 600, color: '#b9c0e8', marginTop: '18px' }, esc(TEXT.langsSub));
    if (V) place(n, 0, 210, W); else place(n, 120, 250, 820);
    E.n37 = n;
    const area = V ? { x: 50, y: 900, w: 980, h: 900 } : { x: 1000, y: 40, w: 820, h: 1000 };
    E.cols = el('div', '', E.langs, { left: px(area.x), top: px(area.y), width: px(area.w), height: px(area.h) });
    E.cols.id = 'cols';
    const ncol = 3, cw = area.w / ncol;
    E.colEls = [];
    for (let c = 0; c < ncol; c++) {
      const col = el('div', 'col', E.cols, { left: px(c * cw), width: px(cw - 16), gap: px(18) });
      const names = LANGS.filter((_, i) => i % ncol === c);
      for (let rep = 0; rep < 3; rep++) names.forEach((nm) => el('div', 'pill', col, { fontSize: px(V ? 36 : 32), padding: V ? '16px 10px' : '14px 10px', overflow: 'hidden' }, esc(nm)));
      E.colEls.push({ col, names: names.length, speed: [70, 95, 80][c] * (c % 2 ? -1 : 1) });
    }
    E.langArea = area;
  }

  function buildFree() {
    E.cards = TEXT.cards.map(([h, p], i) => {
      const c = el('div', 'card3 glass', stage);
      const ics = [ICON.zero, ICON.code, ICON.shield][i];
      if (V) {
        Object.assign(c.style, { width: px(880), height: px(330), padding: '40px 50px', display: 'flex', alignItems: 'center', gap: '40px', textAlign: 'left' });
        el('div', 'ic', c, { width: px(150), height: px(150), flex: 'none', margin: 0 }, ics(84));
        const tx = el('div', '', c);
        el('h3', '', tx, { fontSize: px(70) }, esc(h));
        el('p', '', tx, { fontSize: px(36), marginTop: '10px' }, esc(p));
        place(c, 100, 330 + i * 400);
      } else {
        Object.assign(c.style, { width: px(500), height: px(440), padding: '56px 30px' });
        el('div', 'ic', c, { width: px(132), height: px(132) }, ics(76));
        el('h3', '', c, { fontSize: px(60), marginTop: '38px' }, esc(h));
        el('p', '', c, { fontSize: px(30), marginTop: '14px' }, esc(p));
        place(c, 175 + i * 540, 290);
      }
      return c;
    });
  }

  function buildCta() {
    E.cta = el('div', '', stage);
    E.cta.id = 'cta';
    const lg = V ? 250 : 200;
    E.logo = el('img', 'logo', E.cta, { width: px(lg), height: px(lg), left: px((W - lg) / 2), top: px(V ? 300 : 90) });
    E.logo.src = '/design/logo/devdoctrad-symbol.svg';
    E.name = el('div', 'name display', E.cta, { fontSize: px(V ? 140 : 130), top: px(V ? 600 : 310) }, 'DevDoc<span class="gtext">Trad</span>');
    E.tagline = el('div', 'tagline', E.cta, { fontSize: px(V ? 46 : 44), top: px(V ? 780 : 470), padding: '0 40px' }, esc(TEXT.tagline));
    const b1 = el('div', 'btn primary', E.cta, { fontSize: px(V ? 44 : 38), padding: V ? '30px 50px' : '24px 44px' },
      `<div class="col2"><span>${esc(TEXT.cta1[0])}</span><small class="mono" style="font-size:${V ? 32 : 26}px">${esc(TEXT.cta1[1])}</small></div>${ICON.arrow(V ? 50 : 42)}`);
    const b2 = el('div', 'btn sec glass', E.cta, { fontSize: px(V ? 44 : 38), padding: V ? '30px 50px' : '24px 44px', boxShadow: 'none' },
      `<div class="col2"><span>${esc(TEXT.cta2[0])}</span><small class="mono" style="font-size:${V ? 32 : 26}px">${esc(TEXT.cta2[1])}</small></div>${ICON.globe(V ? 50 : 42)}`);
    E.btns = [b1, b2];
    E.foot = el('div', 'tagline', E.cta, { fontSize: px(V ? 36 : 30), top: px(V ? 1560 : 900), color: '#8f98c8' }, esc(TEXT.foot));
  }

  function layoutCta() {
    const [b1, b2] = E.btns;
    if (V) {
      const w = 900;
      b1.style.width = b2.style.width = px(w);
      b1.style.justifyContent = b2.style.justifyContent = 'space-between';
      place(b1, (W - w) / 2, 1010); place(b2, (W - w) / 2, 1230);
    } else {
      const gap = 36, w1 = b1.offsetWidth, w2 = b2.offsetWidth;
      const x0 = (W - (w1 + w2 + gap)) / 2;
      place(b1, x0, 620); place(b2, x0 + w1 + gap, 620);
    }
  }

  function buildCaption() {
    E.cap = el('div', '', stage, { fontSize: px(V ? 56 : 50), padding: V ? '24px 40px' : '18px 44px', width: 'max-content', maxWidth: px(V ? 980 : 1640), textWrap: 'balance', lineHeight: 1.2 });
    E.cap.id = 'cap';
  }

  function buildThumb() {
    const th = TEXT.thumb;
    const box = el('div', '', stage);
    box.id = 'thumb';
    const head = el('div', 'abs', box, { left: '64px', top: '50px', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '38px', fontWeight: 800 },
      '<img src="/design/logo/devdoctrad-symbol.svg" width="64" height="64"><span class="display">DevDoc<span class="gtext">Trad</span></span>');
    el('div', 'abs', box, { left: '66px', top: '170px', fontSize: '40px', fontWeight: 700, color: '#c9cff2' }, esc(th.kicker));
    const t1 = el('div', 'abs display', box, { left: '62px', top: '228px', fontSize: '104px', width: '640px' }, esc(th.title[0]) + '<br><span class="gtext">' + esc(th.title[1]) + '</span>');
    fit(t1, 640);
    el('div', 'abs', box, { left: '66px', top: '492px', fontSize: '29px', fontWeight: 600, color: '#b9c0e8', width: '560px', lineHeight: 1.35 }, th.sub);
    // capture : titre et bloc de code, page traduite
    const set = M.sets.wide, sh = set.shots.fr, r = sh.rects;
    const crop = { x: r.h1.x - 30, y: r.h1.y - 26, w: r.pre.x + r.pre.w + 30 - (r.h1.x - 30) };
    crop.h = r.pre.y + r.pre.h + 30 - crop.y;
    const fw = 600, k = fw / crop.w, fh = crop.h * k;
    const frame = el('div', 'abs glass', box, { left: '640px', top: px((720 - fh) / 2 + 30), width: px(fw + 20), height: px(fh + 20), padding: '10px', borderRadius: '24px', transform: 'rotate(-2.5deg)' });
    const vw = el('div', '', frame, { position: 'relative', width: px(fw), height: px(fh), overflow: 'hidden', borderRadius: '16px', background: '#fff' });
    el('img', '', vw, { position: 'absolute', width: px(set.w * k), left: px(-crop.x * k), top: px(-crop.y * k) }).src = CAP + sh.file;
    el('div', '', vw, { position: 'absolute', left: px((r.pre.x - crop.x - 5) * k), top: px((r.pre.y - crop.y - 5) * k), width: px((r.pre.w + 10) * k), height: px((r.pre.h + 10) * k), borderRadius: '12px', boxShadow: '0 0 0 4px #2dd4b4, 0 0 30px rgba(45,212,180,.6)' });
    el('div', '', frame, { position: 'absolute', right: '-4px', top: px(10 + (r.pre.y - crop.y) * k - 34), display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '999px', fontSize: '26px', fontWeight: 800, color: '#fff', background: 'linear-gradient(115deg,#16a34a,#10b981)', boxShadow: '0 10px 26px rgba(16,185,129,.5)' }, ICON.check(26) + esc(TEXT.chip));
    el('div', '', frame, { position: 'absolute', left: '-20px', top: '-22px', padding: '10px 20px', borderRadius: '999px', fontSize: '24px', fontWeight: 800, color: '#fff', background: 'rgba(12,16,40,.9)', border: '1px solid rgba(255,255,255,.25)' }, 'EN → FR');
    E.thumbHead = head;
  }

  /* ---------- rendu d'une image ---------- */
  let lastFrame = -1;
  function bg(t) {
    const P = [[0.1, 0.05, 0.31, 0.27], [0.75, 0.1, 0.23, 0.37], [0.6, 0.85, 0.29, 0.21], [0.05, 0.8, 0.19, 0.33]];
    E.blobs.forEach((b, i) => {
      const [cx, cy, fx, fy] = P[i];
      const x = (cx + 0.09 * Math.sin(t * fx + i)) * W - W * 0.45;
      const y = (cy + 0.07 * Math.cos(t * fy + i * 2)) * H - W * 0.45;
      b.style.transform = `translate(${x}px,${y}px)`;
    });
  }

  function caption(t) {
    const list = [['doc', T.capDoc], ['click', T.capClick], ['translate', T.capTr], ['code', T.capCode], ['modes', T.capModes], ['video', T.capVideo]];
    let o = 0, txt = '';
    for (const [k, [a, b]] of list) {
      if (t >= a && t < b) { o = vis(t, a, b, 0.25, 0.25); txt = TEXT.cap[k]; break; }
    }
    if (E.cap.textContent !== txt) E.cap.textContent = txt;
    E.cap.style.opacity = o;
    E.cap.style.display = o > 0.001 ? '' : 'none';
    const h = E.cap.offsetHeight;
    E.cap.style.top = px(H - (V ? 70 : 36) - h + (1 - o) * 16);
    E.cap.style.transform = 'translateX(-50%)';
  }

  function cam(t) {
    const r = R.fr, rb = R.bi, L = E.L;
    const C = (a, b) => ({ fx: (a.x + b.x + b.w) / 2, fy: (a.y + b.y + b.h) / 2 });
    const full = { z: 1, fx: SET.w / 2, fy: SET.h / 2 };
    const h1 = Object.assign({ z: V ? 1.55 : 1.7 }, C(r.h1, r.install));
    const pre = { z: Math.min(V ? 1.7 : 1.55, (L.w * 0.93) / (r.pre.w * L.s)), fx: r.pre.x + r.pre.w / 2, fy: r.pre.y + r.pre.h / 2 - (V ? 0 : 30) };
    const bi = Object.assign({ z: V ? 1.45 : 1.5 }, C(rb.h1, rb.lead));
    const k = keys(t, [[0, full], [T.zoomH1[0], full], [T.zoomH1[1], h1], [T.zoomPre[0], h1], [T.zoomPre[1], pre], [T.zoomOut[0], pre], [T.zoomOut[1], full],
      [T.zoomBi[0], full], [T.zoomBi[1], bi]]);
    const S = L.s * k.z;
    const tx = clamp(L.w / 2 - k.fx * S, L.w - SET.w * S, 0);
    const ty = clamp(L.vh / 2 - k.fy * S, L.vh - SET.h * S, 0);
    E.cam.style.transform = `translate(${tx}px,${ty}px) scale(${S})`;
    return { S, tx, ty };
  }

  function pages(t) {
    const seq = [[0, 'en'], [T.sweep[0], 'fr', 'sweep'], ...T.swaps.map(([a, k]) => [a, k])];
    if (T.segOrig) seq.push([T.segOrig, 'orig']);
    seq.push([T.segBi, 'bi']);
    let i = 0;
    for (let j = 0; j < seq.length; j++) if (t >= seq[j][0]) i = j;
    const cur = seq[i], prev = seq[i - 1];
    for (const k in E.pages) { E.pages[k].style.opacity = 0; E.pages[k].style.zIndex = 0; E.pages[k].style.clipPath = 'none'; }
    E.sweep.style.opacity = 0;
    if (prev) { E.pages[prev[1]].style.opacity = 1; E.pages[prev[1]].style.zIndex = 1; }
    const c = E.pages[cur[1]];
    c.style.zIndex = 2;
    if (cur[2] === 'sweep') {
      const x = eio(pr(t, T.sweep[0], T.sweep[1]));
      c.style.opacity = 1;
      c.style.clipPath = `inset(0 0 ${(1 - x) * 100}% 0)`;
      E.sweep.style.top = px(x * SET.h);
      E.sweep.style.opacity = x > 0 && x < 1 ? 1 : 0;
    } else {
      c.style.opacity = prev ? eio(pr(t, cur[0], cur[0] + 0.25)) : 1;
    }
    return cur[1];
  }

  function cursorAt(t) {
    const L = E.L;
    const ext = { x: L.x + L.w - (V ? 22 : 18) - (V ? 30 : 24) - (V ? 16 : 12) - (V ? 56 : 44) / 2, y: L.y + L.bar / 2 };
    const pg = popupGeo();
    const tr = M.popup.rects.translate;
    const trb = { x: pg.x + (tr.x + tr.w / 2) * pg.k, y: pg.y + (tr.y + tr.h / 2) * pg.k };
    const sg = E.segGeo;
    const segP = (i) => ({ x: sg.x + 6 + sg.sw * (i + 0.5), y: sg.y + 6 + sg.sh / 2 });
    const tracks = [];
    tracks.push({ a: T.curIn, b: T.popClose + 0.5, k: [[T.curIn, { x: W * 0.8, y: H * 0.85 }], [T.extAt, ext], [T.click1 + 0.3, ext], [T.trAt, trb], [T.click2 + 0.25, trb], [T.popClose + 0.5, { x: trb.x + 120, y: trb.y + 260 }]] });
    const segA = T.seg[0] + 0.25;
    const sk = [[segA, { x: W * 0.72, y: sg.y + 300 }]];
    if (T.segOrig) sk.push([T.segOrig - 0.1, segP(0)], [T.segOrig + 0.3, segP(0)]);
    sk.push([T.segBi - 0.1, segP(2)], [T.segBi + 0.35, segP(2)], [T.segBi + 0.9, { x: segP(2).x + 160, y: segP(2).y + 280 }]);
    tracks.push({ a: segA, b: T.segBi + 0.9, k: sk });
    for (const tr2 of tracks) {
      if (t >= tr2.a && t <= tr2.b) return { p: keys(t, tr2.k), o: vis(t, tr2.a, tr2.b, 0.25, 0.3) };
    }
    return null;
  }

  function popupGeo() {
    const L = E.L, g = E.popGeo;
    return { x: L.x + L.w - g.w - (V ? 14 : 70), y: L.y + L.bar + 6, k: g.k, w: g.w, h: g.h };
  }

  function renderWindow(t) {
    const L = E.L;
    const o = eo(pr(t, T.winIn, T.winIn + 0.6)) * (1 - eio(pr(t, T.winOut[0], T.winOut[1])));
    const inY = (1 - eo(pr(t, T.winIn, T.winIn + 0.7))) * 140;
    const outS = 1 - 0.06 * eio(pr(t, T.winOut[0], T.winOut[1]));
    E.win.style.opacity = o;
    E.win.style.display = o > 0.001 ? '' : 'none';
    E.win.style.transform = `translateY(${inY - 50 * eio(pr(t, T.winOut[0], T.winOut[1]))}px) scale(${(0.94 + 0.06 * eo(pr(t, T.winIn, T.winIn + 0.7))) * outS})`;
    if (o <= 0.001) { E.seg.style.display = 'none'; E.popup.style.display = 'none'; return; }
    const c = cam(t);
    const cur = pages(t);
    // mise en évidence du code
    const so = vis(t, T.spot[0], T.spot[1], 0.4, 0.4);
    E.spot.style.opacity = so;
    E.spot.style.boxShadow = `0 0 0 4000px rgba(6,8,24,${0.55 * so}), 0 0 60px rgba(45,212,180,${0.55 * so})`;
    const pre = R.fr.pre;
    const co = vis(t, T.spot[0] + 0.3, T.spot[1], 0.35, 0.3);
    E.chip.style.opacity = co;
    E.chip.style.display = co > 0.001 ? '' : 'none';
    const cw = E.chip.offsetWidth, chh = E.chip.offsetHeight;
    const cx = c.tx + (pre.x + pre.w) * c.S - cw + 10, cy = c.ty + pre.y * c.S - chh / 2;
    E.chip.style.left = px(clamp(cx, 10, L.w - cw - 10));
    E.chip.style.top = px(clamp(cy, 10, L.vh - chh - 10));
    E.chip.style.transform = `scale(${0.7 + 0.3 * eback(pr(t, T.spot[0] + 0.3, T.spot[0] + 0.75))})`;
    // étiquette de langue
    const lo = vis(t, T.winIn + 0.5, T.seg[0], 0.3, 0.3);
    E.langtag.style.opacity = lo;
    E.langtag.style.display = lo > 0.001 ? '' : 'none';
    const tagTxt = cur === 'en' || cur === 'orig' ? TEXT.tagOrig : TEXT.tagTr;
    const dot = cur === 'en' || cur === 'orig' ? '#94a3b8' : '#2dd4b4';
    const html = `<i style="width:.55em;height:.55em;border-radius:50%;background:${dot};display:block"></i>${esc(tagTxt)}`;
    if (E.langtag.innerHTML !== html) E.langtag.innerHTML = html;
    // sélecteur
    const sgo = vis(t, T.seg[0], T.seg[1], 0.35, 0.3);
    E.seg.style.display = sgo > 0.001 ? '' : 'none';
    E.seg.style.opacity = sgo;
    E.seg.style.transform = `translateY(${(1 - eo(pr(t, T.seg[0], T.seg[0] + 0.4))) * -20}px)`;
    const idx = keys(t, [[T.seg[0], { i: 1 }], ...(T.segOrig ? [[T.segOrig, { i: 1 }], [T.segOrig + 0.25, { i: 0 }]] : []), [T.segBi, { i: T.segOrig ? 0 : 1 }], [T.segBi + 0.3, { i: 2 }]]).i;
    E.segInd.style.left = px(6 + idx * E.segGeo.sw);
    // extension : bouton et popup
    const press = 1 - 0.12 * Math.sin(Math.PI * pr(t, T.click1 - 0.05, T.click1 + 0.15));
    E.extbtn.style.transform = `scale(${press})`;
    E.extbtn.style.background = t >= T.click1 && t < T.popClose + 0.2 ? 'rgba(255,255,255,.22)' : 'transparent';
    const po = eo(pr(t, T.click1 + 0.05, T.click1 + 0.35)) * (1 - eio(pr(t, T.popClose, T.popClose + 0.25)));
    E.popup.style.display = po > 0.001 ? '' : 'none';
    const pg = popupGeo();
    place(E.popup, pg.x, pg.y);
    E.popup.style.opacity = po;
    E.popup.style.transform = `scale(${0.88 + 0.12 * eback(pr(t, T.click1 + 0.05, T.click1 + 0.4))})`;
    E.press.style.opacity = 0.9 * Math.sin(Math.PI * pr(t, T.click2 - 0.05, T.click2 + 0.25));
  }

  function renderCursor(t) {
    const c = cursorAt(t);
    E.cursor.style.display = c ? '' : 'none';
    if (c) {
      const clicks = [T.click1, T.click2, T.segBi].concat(T.segOrig ? [T.segOrig] : []);
      let sc = 1;
      for (const k of clicks) sc = Math.min(sc, 1 - 0.18 * Math.sin(Math.PI * pr(t, k - 0.05, k + 0.15)));
      const cs = V ? 1.5 : 1.15;
      E.cursor.style.opacity = c.o;
      E.cursor.style.transform = `translate(${c.p.x - 10 * cs}px,${c.p.y - 4 * cs}px) scale(${cs * sc})`;
    }
    const clicks = [T.click1, T.click2, T.segBi].concat(T.segOrig ? [T.segOrig] : []);
    E.ripple.style.display = 'none';
    for (const k of clicks) {
      const x = pr(t, k, k + 0.5);
      if (x > 0 && x < 1) {
        const p = cursorAt(k).p, s = (V ? 110 : 84) * eo(x);
        E.ripple.style.display = '';
        place(E.ripple, p.x - s / 2, p.y - s / 2, s, s);
        E.ripple.style.opacity = 1 - x;
      }
    }
  }

  function renderHook(t) {
    const o = 1 - eio(pr(t, T.hookOut - 0.4, T.hookOut));
    E.hook.style.display = o > 0.001 ? '' : 'none';
    if (o <= 0.001) return;
    E.hook.style.opacity = o;
    E.hook.style.transform = `scale(${1 + 0.05 * eio(pr(t, T.hookOut - 0.4, T.hookOut))})`;
    let n = 0;
    E.hookLines.forEach((spans) => spans.forEach((s) => {
      const a = 0.1 + n * 0.14;
      const x = eo(pr(t, a, a + 0.45));
      s.style.opacity = x;
      s.style.transform = `translateY(${(1 - x) * 60}px)`;
      n++;
    }));
    const sx = eo(pr(t, 0.1 + n * 0.14 + 0.2, 0.1 + n * 0.14 + 0.7));
    E.hookSub.style.opacity = sx;
    E.hookSub.style.transform = `translateY(${(1 - sx) * 30}px)`;
    E.ghosts.forEach((g, i) => {
      const x = +g.dataset.x + Math.sin(t * 0.6 + i) * 18, y = +g.dataset.y - t * (14 + (i % 3) * 6);
      g.style.transform = `translate(${x}px,${y}px)`;
      g.style.opacity = 0.55 * eo(pr(t, 0.05 * i, 0.05 * i + 0.6));
    });
  }

  async function renderVideo(t) {
    const [a, b] = T.video;
    const o = vis(t, a, b, 0.45, 0.4);
    const show = o > 0.001;
    E.vcard.style.display = E.vlabel.style.display = show ? '' : 'none';
    if (!show) return;
    E.vcard.style.opacity = o;
    E.vcard.style.transform = `translateY(${(1 - eo(pr(t, a, a + 0.6))) * 120}px) scale(${0.95 + 0.05 * eo(pr(t, a, a + 0.6)) - 0.04 * eio(pr(t, b - 0.4, b))})`;
    const lo = vis(t, a + 0.35, b, 0.35, 0.35);
    E.vlabel.style.opacity = lo;
    const g = E.vGeo;
    const lw = E.vlabel.offsetWidth;
    if (V) place(E.vlabel, (W - lw) / 2, g.y - 130);
    else place(E.vlabel, (W - lw) / 2, 22);
    E.vlabel.style.transform = `translateY(${(1 - eo(pr(t, a + 0.35, a + 0.8))) * 20}px)`;
    E.vimg.style.transform = `scale(${1 + (V ? 0.16 : 0.12) * eio(pr(t, a + 0.8, a + 2.4))})`;
    const fi = clamp(Math.floor((t - T.vStart) * M.voice.fps), 0, E.vframes.length - 1);
    if (fi !== lastFrame) {
      lastFrame = fi;
      E.vimg.src = E.vframes[fi];
      try { await E.vimg.decode(); } catch (e) { /* image suivante */ }
    }
  }

  function renderLangs(t) {
    const [a, b] = T.langs;
    const o = vis(t, a, b, 0.4, 0.35);
    E.langs.style.display = o > 0.001 ? '' : 'none';
    if (o <= 0.001) return;
    E.langs.style.opacity = o;
    const n = Math.round(1 + 36 * eo(pr(t, a + 0.15, a + 1.3)));
    E.num.textContent = String(n);
    E.n37.style.transform = `scale(${0.9 + 0.1 * eback(pr(t, a, a + 0.6))})`;
    E.colEls.forEach((c, i) => {
      const h = c.col.scrollHeight / 3;
      let off = ((t - a) * c.speed + i * 140) % h;
      if (off < 0) off += h;
      c.col.style.transform = `translateY(${-h + (c.speed > 0 ? off : off) - 0}px)`;
      c.col.style.opacity = eo(pr(t, a + 0.1 * i, a + 0.5 + 0.1 * i));
    });
  }

  function renderFree(t) {
    const [a, b] = T.free;
    E.cards.forEach((c, i) => {
      const s = a + 0.1 + i * 0.2;
      const o = eo(pr(t, s, s + 0.3)) * (1 - eio(pr(t, b - 0.35, b)));
      c.style.display = o > 0.001 ? (V ? 'flex' : '') : 'none';
      c.style.opacity = o;
      c.style.transform = `translateY(${(1 - eo(pr(t, s, s + 0.5))) * 60}px) scale(${0.85 + 0.15 * eback(pr(t, s, s + 0.55))})`;
    });
  }

  function renderCta(t) {
    const a = T.cta;
    const o = eo(pr(t, a, a + 0.5));
    E.cta.style.display = o > 0.001 ? '' : 'none';
    if (o <= 0.001) return;
    const items = [E.logo, E.name, E.tagline, E.btns[0], E.btns[1], E.foot];
    items.forEach((e, i) => {
      const s = a + 0.05 + i * 0.13;
      const x = eo(pr(t, s, s + 0.5));
      e.style.opacity = x;
      const extra = e === E.logo ? ` scale(${0.6 + 0.4 * eback(pr(t, s, s + 0.7))}) rotate(${(1 - eo(pr(t, s, s + 0.8))) * -12}deg)` : '';
      e.style.transform = `translateY(${(1 - x) * 40}px)` + extra;
    });
    const pulse = 1 + 0.025 * Math.sin(Math.max(0, t - a - 1.6) * 3.2) * pr(t, a + 1.6, a + 2.2);
    E.btns[0].style.transform += ` scale(${pulse})`;
  }

  async function renderAt(t) {
    if (FMT === 'thumb') { bg(4.2); return; }
    bg(t);
    renderHook(t);
    renderWindow(t);
    renderCursor(t);
    await renderVideo(t);
    renderLangs(t);
    renderFree(t);
    renderCta(t);
    caption(t);
  }

  async function init() {
    const res = await fetch(CAP + 'manifest.json');
    const all = await res.json();
    M = all[LANG];
    if (!M) throw new Error('captures absentes pour ' + LANG);
    await document.fonts.load('800 100px "DDT Display"');
    await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(w + ' 20px "DDT Inter"')));
    await document.fonts.load('400 20px "DDT Mono"');
    buildBackground();
    if (FMT === 'thumb') {
      buildThumb();
    } else {
      SET = M.sets[V ? 'tall' : 'wide'];
      R = { fr: SET.shots.fr.rects, en: SET.shots.en.rects, bi: SET.shots.bi.rects };
      buildHook(); buildWindow(); buildVideo(); buildLangs(); buildFree(); buildCta(); buildCaption();
      E.ripple = el('div', 'ripple');
      E.cursor = el('div', '', stage, null, CURSOR);
      E.cursor.id = 'cursor';
      layoutCta();
      document.querySelectorAll('#cols .pill').forEach((p) => fit(p));
    }
    await Promise.all([...document.images].map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((ok) => { i.onload = i.onerror = () => i.decode().then(ok, ok); }))));
    await document.fonts.ready;
  }

  window.DURATION = T.dur;
  window.EVENTS = EVENTS;
  window.SIZE = SIZE;
  window.renderAt = renderAt;
  window.ready = init();
})();
