/*
 * DevDocTrad - voice.js
 * Traduit la voix des vidéos, gratuitement, en sous-titres affichés sur la vidéo.
 *
 * Trois sources, dans cet ordre :
 *   1. les sous-titres de la vidéo (<track>, pistes texte HTML5) : traduits à l'avance, sans aucun coût audio ;
 *   2. les sous-titres de YouTube (activés automatiquement s'ils existent) ;
 *   3. sinon, le son de la vidéo : morceaux de quelques secondes transcrits par Groq Whisper
 *      (palier gratuit, avec la clé Groq de l'utilisateur), puis traduits comme le reste.
 * Trois modes (popup) : sous-titres ; sous-titres + voix traduite (doublage) ; voix traduite seule.
 * La voix est produite par l'extension elle-même (message « speak » au background : chrome.tts sous
 * Chrome / Edge / Brave, speechSynthesis de la page de fond sous Firefox), gratuite, calée sur les
 * sous-titres et multipliée par la vitesse choisie, pendant que le son d'origine est baissé.
 * Pourquoi pas speechSynthesis dans la page : Chrome la refuse (« not-allowed ») tant que la page n'a
 * reçu aucun clic, et le clic dans le popup ne compte pas. Elle ne sert plus que de repli.
 *
 * Vidéos et sons (<video>, <audio>) cherchés aussi dans les shadow roots ouverts (lecteurs en composants
 * web). Lecteur intégré d'un autre site (<iframe> YouTube, Vimeo...) : lien pour l'ouvrir dans un onglet.
 *
 * Injecté seulement à la demande (popup ou raccourci Alt+Maj+V). Licence MIT.
 */
(function (root) {
  'use strict';
  if (root.__DDT_VOICE_LOADED) return;
  root.__DDT_VOICE_LOADED = true;
  var DDT = root.DDT;

  var CHUNK_MS = 8000;           // durée d'un morceau de son (Groq compte au moins 10 s par requête)
  var SILENCE_RMS = 0.006;       // en dessous : morceau considéré comme silencieux, pas envoyé
  var YT_WAIT_MS = 6000;         // délai pour voir apparaître des sous-titres YouTube
  var YT_STABLE_MS = 700;        // texte YouTube stable depuis ce délai : on le traduit
  var YT_MAX_WAIT_MS = 2500;     // texte qui défile sans arrêt : traduit quand même après ce délai
  var BATCH = 40;                // sous-titres traduits par demande
  var WATCH_MS = 1000;           // surveillance : vidéo retirée ou remplacée, vidéo YouTube suivante
  var OWN_LABEL = 'DevDocTrad';  // piste texte ajoutée pour le plein écran natif (jamais prise comme source)
  var DUCK = 0.15;               // doublage : son d'origine à 15 % pendant que la voix parle
  var RAMP_MS = 280;             // durée de la baisse ou de la remontée du son
  var UNDUCK_MS = 350;           // silence entre deux phrases avant de remonter le son
  var MAX_LAG_MS = 2000;         // retard de la voix au-delà duquel la phrase en cours est coupée
  var RATE_MIN = 0.9;            // calage sur la durée du sous-titre
  var RATE_MAX = 1.7;
  var FINAL_RATE_MIN = 0.5;      // après la vitesse choisie par l'utilisateur
  var FINAL_RATE_MAX = 3;
  var TTS_MAX_CHARS = 1000;      // texte d'une phrase envoyée à la synthèse (limite du background)
  var VOICES_WAIT_MS = 1500;     // attente de « voiceschanged » (liste des voix chargée plus tard)
  var MAX_SHADOW_DEPTH = 8;

  /* Lecteurs vidéo intégrés connus (adresse d'un <iframe>) */
  var PLAYER_RE = new RegExp([
    'youtube(-nocookie)?\\.com/(embed|shorts|live)/', 'youtu\\.be/', 'player\\.vimeo\\.com/', 'vimeo\\.com/(video|event)/',
    'dailymotion\\.com/(embed|player)', 'geo\\.dailymotion\\.com/', 'dai\\.ly/', 'wistia\\.(com|net)/', 'wi\\.st/',
    'loom\\.com/(embed|share)/', 'player\\.twitch\\.tv', 'clips\\.twitch\\.tv', 'streamable\\.com/[eo]/', 'vidyard\\.com/',
    'players\\.brightcove\\.net/', 'jwplayer\\.com/players', 'jwplatform\\.com/', 'facebook\\.com/plugins/video',
    'player\\.bilibili\\.com/', 'rumble\\.com/embed/', 'embed\\.ted\\.com/', '/videos/embed/', 'bitchute\\.com/embed/',
    'odysee\\.com/\\$/embed/', 'vk\\.com/video_ext', 'ok\\.ru/videoembed/', 'mediadelivery\\.net/embed/',
    'cloudflarestream\\.com/', 'videodelivery\\.net/', 'vidyard\\.com/', 'kaltura\\.com/', 'panopto\\.(com|eu)/',
    'canva\\.com/design/.*/watch', 'descript\\.com/embed', 'tella\\.tv/video'
  ].join('|'), 'i');

  /* Langues : alias des codes de voix (norvégien « nb », hébreu « iw »...) et région par défaut */
  var LANG_ALIAS = { no: ['no', 'nb', 'nn'], he: ['he', 'iw'], id: ['id', 'in'], fil: ['fil', 'tl'] };
  var DEFAULT_REGION = { en: 'US', ja: 'JP', ko: 'KR', zh: 'CN', sv: 'SE', da: 'DK', el: 'GR', cs: 'CZ', uk: 'UA',
    hi: 'IN', bn: 'IN', ta: 'IN', te: 'IN', mr: 'IN', vi: 'VN', he: 'IL', fa: 'IR', ar: 'SA', ms: 'MY', sw: 'KE',
    ur: 'PK', no: 'NO', nb: 'NO', ca: 'ES', et: 'EE', sl: 'SI', sr: 'RS', fil: 'PH' };
  var QUALITY_RE = /natural|neural|online|google|premium|enhanced/i;

  function normLang(code) { return String(code || '').replace(/_/g, '-').toLowerCase(); }
  function primary(code) { return normLang(code).split('-')[0]; }
  function sameLanguage(voiceLang, target) {
    var p = primary(voiceLang);
    var tp = primary(target);
    return p === tp || (LANG_ALIAS[tp] || []).indexOf(p) !== -1;
  }
  /* Voix « exacte » : même code complet, ou région par défaut de la langue (fr -> fr-FR, en -> en-US) */
  function exactLanguage(voiceLang, target) {
    var v = normLang(voiceLang);
    var tg = normLang(target);
    if (v === tg) return true;
    if (tg.indexOf('-') !== -1 || !sameLanguage(v, tg)) return false;
    var region = (DEFAULT_REGION[tg] || tg).toLowerCase();
    return v.split('-')[1] === region || v === tg;
  }
  /* Meilleure voix de synthèse pour la langue cible : langue exacte d'abord, puis voix de bonne qualité
     (« Natural », « Neural », « Online », « Google », « Premium », « Enhanced »), puis la langue seule. */
  function pickTtsVoice(voices, target) {
    var best = null;
    var bestScore = -1;
    Array.prototype.forEach.call(voices || [], function (v, i) {
      if (!v || !sameLanguage(v.lang, target)) return;
      var score = (exactLanguage(v.lang, target) ? 100 : 0) + (QUALITY_RE.test(v.name || '') ? 10 : 0) + (v.default ? 1 : 0);
      if (score > bestScore) { best = v; bestScore = score; }
    });
    return best;
  }
  /* Durée naturelle d'une phrase (secondes, vitesse 1) : environ 15 caractères par seconde,
     moins pour le chinois, le japonais et le coréen (une syllabe par caractère). */
  function speechSeconds(text, lang) {
    var n = String(text || '').replace(/\s+/g, '').length;
    var cps = /^(zh|ja)/.test(primary(lang)) ? 6.5 : primary(lang) === 'ko' ? 8 : 15;
    return 0.15 + n / cps;
  }
  /* Vitesse de lecture : la phrase doit tenir dans le temps du sous-titre (moins le retard de la voix),
     bornée entre 0,9 et 1,7. Sans durée connue (YouTube, son transcrit) : rythme un peu soutenu. */
  function dubRate(text, availSec, lagSec, lang) {
    var est = speechSeconds(text, lang);
    var lag = Math.max(0, lagSec || 0);
    var room = availSec == null ? est / 1.1 - lag : availSec - lag;
    room = Math.max(room, 0.4);
    var r = est / room;
    return Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, r)) * 100) / 100;
  }

  function cueText(s) {
    return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  }

  function createVoice(doc, win, deps) {
    var transport = deps.transport;
    var transcribe = deps.transcribe;
    var t = deps.t || DDT.t;
    var settings = Object.assign({}, DDT.DEFAULT_SETTINGS, deps.settings || {});
    var keyId = null;
    var chunkMs = deps.chunkMs || CHUNK_MS;
    var ytWaitMs = deps.ytWaitMs || YT_WAIT_MS;
    var watchMs = deps.watchMs || WATCH_MS;

    var active = false;
    var mode = null;             // 'track' | 'youtube' | 'audio'
    var video = null;
    var message = '';
    var cleanups = [];           // bande et surveillance : défaits à l'arrêt
    var srcCleanups = [];        // source en cours (pistes, YouTube, son) : défaits aussi au changement de vidéo
    var ytCurrent = null;        // identifiant de la vidéo YouTube en cours (null : pas YouTube)
    var memo = {};               // texte original -> traduction
    var pending = {};            // texte original -> promesse
    var speaking = false;        // doublage (lecture à voix haute) en marche
    var frameAnchor = null;      // <iframe> de lecteur signalé quand la page n'a pas de vidéo
    var ttsVoice = null;         // voix de synthèse choisie pour la langue cible
    var ttsKind = null;          // moteur de cette voix : 'tts' (chrome.tts), 'synth' (Firefox, page de fond), 'page'
    var voicesPromise = null;    // voix de la page (repli)
    var choicePromise = null;    // voix choisie : { kind: 'ext' | 'page', voice, engine }
    var extBroken = false;       // synthèse de l'extension indisponible : repli sur la page
    var extUsed = false;         // au moins une phrase envoyée au background (à couper à l'arrêt)
    var clickArmed = false;      // repli page sous Chrome : phrase redite au premier clic
    var lastRate = null;         // vitesse de la dernière phrase envoyée
    var rawSettings = deps.settings || {};
    var voiceMode = DDT.voiceModeOf(rawSettings);
    var userRate = DDT.clampVoiceRate(rawSettings.voiceRate);
    var frameMode = false;       // message « lecteur intégré » affiché (pas de voix)
    var fsSync = null;           // plein écran natif : resynchronise la piste DevDocTrad (mode voix seule)
    var speakGen = 0;            // incrémenté à chaque annulation : les rappels des phrases annulées sont ignorés
    var queued = 0;              // phrases envoyées à la synthèse et pas encore finies
    var speakEnd = 0;            // heure (ms) prévue de fin des phrases en file
    var lastSaid = '';           // dernière phrase envoyée (évite de la redire en double)
    var live = [];               // phrases en cours : gardées en mémoire (Chrome perd sinon leurs événements)
    var baseVolume = null;       // volume d'origine pendant le doublage (null : son non baissé)
    var ducked = false;
    var rampTimer = null;
    var volumeHook = null;       // Firefox (mozCaptureStream) : recopie le volume de la vidéo sur le son renvoyé
    var unduckTimer = null;
    var resumeHook = null;       // source en cours : redire le bon sous-titre après une pause ou un saut
    var mediaOff = null;         // retire les écouteurs pause / lecture / saut de la vidéo suivie
    var rampMs = deps.rampMs != null ? deps.rampMs : RAMP_MS;
    var unduckMs = deps.unduckMs != null ? deps.unduckMs : UNDUCK_MS;
    var host = null;
    var box = null;
    var lastShown = '';
    var stats = { translated: 0, transcribed: 0 };

    /* ---------------- Choix de la vidéo (ou du son) ---------------- */
    function area(v) {
      var r = v.getBoundingClientRect ? v.getBoundingClientRect() : { width: 0, height: 0 };
      return Math.max(0, r.width) * Math.max(0, r.height);
    }
    /* Surface réellement visible dans la fenêtre */
    function visibleArea(el) {
      if (!el.getBoundingClientRect) return 0;
      var r = el.getBoundingClientRect();
      var vw = win.innerWidth || 1024;
      var vh = win.innerHeight || 768;
      var w = Math.min(r.right != null ? r.right : r.left + r.width, vw) - Math.max(r.left || 0, 0);
      var h = Math.min(r.bottom != null ? r.bottom : r.top + r.height, vh) - Math.max(r.top || 0, 0);
      return Math.max(0, w) * Math.max(0, h);
    }
    /* <video>, <audio> et <iframe> du document et des shadow roots ouverts (lecteurs en composants web) */
    function collect(node, out, depth) {
      var list;
      try { list = node.querySelectorAll('video, audio, iframe'); } catch (e) { return; }
      for (var i = 0; i < list.length; i++) (list[i].tagName === 'IFRAME' ? out.frames : out.media).push(list[i]);
      if (depth >= MAX_SHADOW_DEPTH) return;
      var all = node.querySelectorAll('*');
      for (var j = 0; j < all.length; j++) {
        var sr = all[j].shadowRoot;
        if (sr && sr !== host && all[j] !== host) collect(sr, out, depth + 1);
      }
    }
    function scan() {
      var out = { media: [], frames: [] };
      collect(doc, out, 0);
      return out;
    }
    function playing(m) { return !m.paused && !m.ended; }
    function hasSource(m) {
      return !!(m.currentSrc || m.src || m.srcObject || (m.querySelector && m.querySelector('source[src]')) ||
        (m.textTracks && m.textTracks.length));
    }
    /* Plusieurs vidéos : celle qui joue, sinon la plus grande visible ; une vidéo passe avant un son */
    function pickVideo() {
      var list = scan().media;
      if (!list.length) return null;
      var info = list.map(function (m, i) {
        return { m: m, i: i, play: playing(m) ? 1 : 0, area: visibleArea(m) || area(m) * 0.001,
          video: m.tagName === 'VIDEO' ? 1 : 0, src: hasSource(m) ? 1 : 0 };
      });
      info.sort(function (a, b) {
        return (b.play - a.play) || (b.area - a.area) || (b.video - a.video) || (b.src - a.src) || (a.i - b.i);
      });
      return info[0].m;
    }
    function isAudio(m) { return !!m && m.tagName === 'AUDIO'; }
    /* Lecteur intégré d'un autre site : l'extension n'est injectée que dans le cadre principal.
       On rend l'adresse à ouvrir dans un onglet (YouTube : page de la vidéo, avec ses sous-titres). */
    function playerUrl(src) {
      var u;
      try { u = new URL(src, doc.baseURI); } catch (e) { return ''; }
      if (!/^https?:$/.test(u.protocol)) return '';
      var yt = /(^|\.)youtube(-nocookie)?\.com$/i.test(u.hostname) && /^\/(embed|shorts|live)\/([^/?#]+)/.exec(u.pathname);
      if (yt && yt[2] !== 'videoseries') {
        var start = u.searchParams.get('start') || u.searchParams.get('t');
        return 'https://www.youtube.com/watch?v=' + encodeURIComponent(yt[2]) + (start ? '&t=' + encodeURIComponent(start) : '');
      }
      return u.href;
    }
    function isPlayerFrame(f) {
      var src = f.src || f.getAttribute('src') || f.getAttribute('data-src') || '';
      if (!src || /^(about|javascript|data|blob):/i.test(src)) return false;
      if (PLAYER_RE.test(src)) return true;
      var allow = (f.getAttribute('allow') || '') + (f.hasAttribute('allowfullscreen') ? ' fullscreen' : '');
      return /fullscreen|autoplay|encrypted-media|picture-in-picture/i.test(allow) && /embed|player|video/i.test(src);
    }
    function pickPlayerFrame(frames) {
      var best = null;
      var bestArea = 0;
      (frames || scan().frames).forEach(function (f) {
        var a = visibleArea(f);
        var r = f.getBoundingClientRect ? f.getBoundingClientRect() : { width: 0, height: 0 };
        if (r.width < 120 || r.height < 68 || a <= 0 || !isPlayerFrame(f)) return;
        if (a > bestArea) { best = f; bestArea = a; }
      });
      return best;
    }
    function isYouTube() { return /(^|\.)youtube(-nocookie)?\.com$/i.test(win.location.hostname); }
    function textTracks(v) {
      var out = [];
      var tl = v && v.textTracks;
      if (!tl) return out;
      for (var i = 0; i < tl.length; i++) {
        if (tl[i].label === OWN_LABEL) continue;   // notre propre piste du plein écran
        if (tl[i].kind === 'subtitles' || tl[i].kind === 'captions') out.push(tl[i]);
      }
      return out;
    }

    /* ---------------- Traduction ---------------- */
    function translateMany(texts) {
      // mémoire capturée : une traduction qui arrive après un changement de vidéo YouTube
      // ne remplit pas la nouvelle mémoire
      var store = memo;
      var pend = pending;
      var todo = [];
      texts.forEach(function (s) { if (s && !(s in store) && !pend[s] && todo.indexOf(s) === -1) todo.push(s); });
      if (!todo.length) return Promise.resolve();
      var batches = [];
      for (var i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
      var seq = Promise.resolve();
      batches.forEach(function (b) {
        var p = seq.then(function () {
          if (!active) return;
          return transport.translate(b.map(DDT.escapeText), { keyId: keyId }).then(function (res) {
            if (!res || res.error) { noteError(res); return; }
            b.forEach(function (s, j) {
              var tr = res.translations && res.translations[j];
              if (typeof tr === 'string') { store[s] = DDT.plainText(tr); stats.translated++; }
            });
          });
        });
        b.forEach(function (s) { pend[s] = p; });
        seq = p.then(function () { b.forEach(function (s) { delete pend[s]; }); },
          function () { b.forEach(function (s) { delete pend[s]; }); });
      });
      return seq;
    }
    function translateOne(s) {
      if (s in memo) return Promise.resolve(memo[s]);
      if (!pending[s]) translateMany([s]);
      return (pending[s] || Promise.resolve()).then(function () { return memo[s]; });
    }
    function noteError(res) {
      // réponse arrivée après « Arrêter » : rien à afficher (sinon la bande est recréée)
      if (!res || !active) return;
      if (res.error === 'no_key') setMessage(t('badgeNoKey'));
      else if (res.error === 'rate_limited') setMessage(t('badgeRateGiveUp'));
      else if (res.error === 'disconnected') setMessage(t('badgeError', ['disconnected']));
      else setMessage(res.message || t('badgeError', [res.error]));
    }

    /* ---------------- Affichage sur la vidéo ---------------- */
    var CSS = [
      ':host{all:initial}',
      '.box{position:fixed;z-index:2147483646;display:none;flex-direction:column;align-items:center;gap:6px;',
      'pointer-events:none;font:600 clamp(15px,2.1vw,26px)/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}',
      '.box.on{display:flex}',
      '.line{pointer-events:auto;max-width:100%;padding:6px 14px;border-radius:12px;background:rgba(0,0,0,.78);color:#fff;',
      'text-align:center;text-shadow:0 1px 2px rgba(0,0,0,.6);white-space:pre-wrap}',
      '.orig{font-size:.72em;font-weight:500;opacity:.82}',
      '.orig:empty,.tr:empty,.line[hidden]{display:none}',
      '.bar{pointer-events:auto;display:flex;gap:6px;align-items:center;font:500 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;',
      'color:#fff;background:rgba(0,0,0,.6);border-radius:999px;padding:3px 4px 3px 10px}',
      '.bar button{all:unset;cursor:pointer;width:24px;height:24px;border-radius:12px;display:grid;place-items:center}',
      '.bar button:hover{background:rgba(255,255,255,.18)}',
      '.bar button:focus-visible{outline:2px solid #4da3ff;outline-offset:1px}',
      '.bar button[aria-pressed=true]{background:#0a84ff}',
      '.bar button[disabled]{opacity:.4;cursor:default;background:none}',
      '.bar svg{width:15px;height:15px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.msg{max-width:46ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.msg:empty{display:none}',
      '.msg.long{white-space:normal;max-width:60ch;padding:3px 0}',
      '.rates{display:flex;align-items:center;gap:1px}',
      '.rates[hidden],.bar button[hidden]{display:none}',
      '.rate{min-width:3.4em;text-align:center;font-variant-numeric:tabular-nums}',
      '.bar button.open{width:auto;padding:0 10px;background:#0a84ff;font-weight:600;white-space:nowrap}',
      '.bar button.open:hover{background:#3d9bff}'
    ].join('');
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var ICON_SPEAK = ['M4 9v6h4l5 4V5L8 9z', 'M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12'];
    var ICON_CLOSE = ['M6 6l12 12M18 6L6 18'];
    var ICON_MINUS = ['M6 12h12'];
    var ICON_PLUS = ['M12 6v12M6 12h12'];

    /* Bande construite élément par élément (jamais de HTML en texte : rien de la page ni des
       traductions ne peut y devenir du code) */
    function make(tag, cls) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      return e;
    }
    function icon(paths) {
      var svg = doc.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      paths.forEach(function (d) {
        var p = doc.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d);
        svg.appendChild(p);
      });
      return svg;
    }
    function iconButton(cls, paths, label) {
      var b = make('button', cls);
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.appendChild(icon(paths));
      return b;
    }
    function ensureBox() {
      if (host) return;
      host = doc.createElement('div');
      host.setAttribute('data-tr-ui', 'voice');
      host.setAttribute('translate', 'no');
      var sr = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
      var style = doc.createElement('style');
      style.textContent = CSS;
      sr.appendChild(style);
      box = make('div', 'box');
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', t('popupVoice'));
      var orig = make('div', 'line orig');
      var tr = make('div', 'line tr');
      // aria-live seulement sur la traduction (pas sur les boutons ni les messages), et coupé
      // pendant la lecture à voix haute : sinon le lecteur d'écran la lirait une seconde fois
      tr.setAttribute('aria-live', speaking ? 'off' : 'polite');
      var bar = make('div', 'bar');
      var msg = make('span', 'msg');
      var open = make('button', 'open');
      open.type = 'button';
      open.hidden = true;
      open.textContent = t('voiceOpenTab');
      open.addEventListener('click', function () {
        var url = open.getAttribute('data-url');
        if (url) { try { win.open(url, '_blank', 'noopener'); } catch (e) { /* rien */ } }
        stop();
      });
      var speak = iconButton('speak', ICON_SPEAK, t('voiceSpeak'));
      speak.setAttribute('aria-pressed', 'false');
      speak.addEventListener('click', function () { setSpeaking(!speaking); });
      // vitesse de la voix : − / valeur / +, appliquée dès la phrase suivante et enregistrée
      var rates = make('span', 'rates');
      rates.setAttribute('role', 'group');
      rates.setAttribute('aria-label', t('optVoiceRate'));
      var slower = iconButton('slower', ICON_MINUS, t('voiceSlower'));
      var value = make('span', 'rate');
      var faster = iconButton('faster', ICON_PLUS, t('voiceFaster'));
      slower.addEventListener('click', function () { setRate(userRate - 0.1, true); });
      faster.addEventListener('click', function () { setRate(userRate + 0.1, true); });
      rates.appendChild(slower);
      rates.appendChild(value);
      rates.appendChild(faster);
      var close = iconButton('close', ICON_CLOSE, t('btnClose'));
      close.addEventListener('click', function () { stop(); });
      [msg, open, speak, rates, close].forEach(function (n) { bar.appendChild(n); });
      [orig, tr, bar].forEach(function (n) { box.appendChild(n); });
      sr.appendChild(box);
      renderSpeak();
      placeHost();
      var onFs = function () { placeHost(); position(); };
      doc.addEventListener('fullscreenchange', onFs);
      doc.addEventListener('webkitfullscreenchange', onFs);
      var timer = win.setInterval(position, 300);
      var onScroll = function () { position(); };
      win.addEventListener('scroll', onScroll, true);
      win.addEventListener('resize', onScroll);
      cleanups.push(function () {
        win.clearInterval(timer);
        doc.removeEventListener('fullscreenchange', onFs);
        doc.removeEventListener('webkitfullscreenchange', onFs);
        win.removeEventListener('scroll', onScroll, true);
        win.removeEventListener('resize', onScroll);
        if (host && host.parentNode) host.parentNode.removeChild(host);
        host = null;
        box = null;
      });
    }
    /* En plein écran, seul l'élément en plein écran est visible : la bande y est déplacée
       (sauf si c'est la vidéo elle-même, qui ne peut pas contenir d'élément). */
    function placeHost() {
      if (!host) return;
      var fs = doc.fullscreenElement || doc.webkitFullscreenElement;
      var parent = fs && fs.tagName !== 'VIDEO' ? fs : (doc.body || doc.documentElement);
      if (host.parentNode !== parent) parent.appendChild(host);
    }
    /* Bande sur la vidéo ; pour un son (<audio>, podcast) ou sans vidéo visible : en bas de la fenêtre */
    function position() {
      if (!box) return;
      var anchor = video || frameAnchor;
      var r = anchor && !isAudio(anchor) && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { width: 0, height: 0, top: 0, bottom: 0, left: 0 };
      var vw = win.innerWidth || 1024;
      var vh = win.innerHeight || 768;
      var visible = r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < vh;
      var left = visible ? Math.max(8, r.left + r.width * 0.05) : 16;
      var width = visible ? Math.min(vw - 16, r.width * 0.9) : vw - 32;
      var bottom = visible ? Math.max(8, vh - r.bottom + Math.max(52, r.height * 0.12)) : 24;
      box.style.left = Math.round(left) + 'px';
      box.style.width = Math.round(width) + 'px';
      box.style.bottom = Math.round(bottom) + 'px';
    }
    /* « Voix traduite seule » : pas de lignes de texte tant que la voix parle (seulement la barre).
       Sans voix (aucune pour la langue, haut-parleur coupé) : les sous-titres reviennent. */
    function linesHidden() { return voiceMode === 'voice' && speaking; }
    function show(original, translated, timing) {
      if (!active) return;            // réponse asynchrone arrivée après « Arrêter »
      ensureBox();
      var bilingual = settings.mode === 'bilingual';
      box.querySelector('.orig').textContent = bilingual && translated ? original || '' : '';
      box.querySelector('.tr').textContent = translated || '';
      box.classList.add('on');
      position();
      if (translated && translated !== lastShown) {
        lastShown = translated;
        if (speaking) say(translated, timing);
      }
    }
    function clearLines() {
      if (!box) return;
      box.querySelector('.orig').textContent = '';
      box.querySelector('.tr').textContent = '';
    }
    /* Après « Arrêter », aucun message (erreur, transcription en retard) ne recrée la bande,
       ses écouteurs ni son intervalle. */
    function setMessage(m) {
      if (!active) return;
      message = m || '';
      ensureBox();
      box.querySelector('.msg').textContent = message;
      box.querySelector('.msg').title = message;
      box.classList.add('on');
      position();
    }

    /* ---------------- Doublage : voix de synthèse (locale ou du navigateur, gratuite) ----------------
     * D'abord la synthèse de l'extension (deps.tts : messages au background, qui utilise chrome.tts sous
     * Chrome / Edge / Brave, speechSynthesis de sa page de fond sous Firefox) : elle parle sans clic dans
     * la page. Repli : speechSynthesis de la page (Chrome exige alors un clic dans la page). */
    function synth() { return win.speechSynthesis || null; }
    function pageSynthOk() { return !!synth() && !!win.SpeechSynthesisUtterance; }
    function targetLang() { return DDT.resolveTarget(settings.target); }
    /* Liste des voix de la page : souvent vide au premier appel, remplie à l'événement « voiceschanged » */
    function loadVoices() {
      if (voicesPromise) return voicesPromise;
      var s = synth();
      voicesPromise = new Promise(function (resolve) {
        var list = [];
        try { list = s.getVoices() || []; } catch (e) { list = []; }
        if (list.length) { resolve(list); return; }
        var done = false;
        var finish = function () {
          if (done) return;
          done = true;
          try { if (s.removeEventListener) s.removeEventListener('voiceschanged', finish); } catch (e) { /* rien */ }
          var l2 = [];
          try { l2 = s.getVoices() || []; } catch (e) { l2 = []; }
          if (!l2.length) voicesPromise = null;   // liste encore vide : nouvel essai au prochain doublage
          resolve(l2);
        };
        try {
          if (s.addEventListener) s.addEventListener('voiceschanged', finish);
          else s.onvoiceschanged = finish;
        } catch (e) { /* rien */ }
        win.setTimeout(finish, deps.voicesWaitMs || VOICES_WAIT_MS);
      });
      return voicesPromise;
    }
    /* Voix choisie : celle de l'extension si elle en a une pour la langue cible (même ordre de
       préférence), sinon celle de la page. null : aucune voix, sous-titres seuls. */
    function ensureVoice() {
      if (choicePromise) return choicePromise;
      var target = targetLang();
      var ext = deps.tts && !extBroken
        ? Promise.resolve().then(function () { return deps.tts.voices(); }).catch(function () { return null; })
        : Promise.resolve(null);
      var p = ext.then(function (r) {
        var v = r && r.ok ? pickTtsVoice(r.voices, target) : null;
        if (v) return { kind: 'ext', voice: v, engine: r.engine || 'tts' };
        if (!pageSynthOk()) return null;
        return loadVoices().then(function (list) {
          var pv = pickTtsVoice(list, target);
          return pv ? { kind: 'page', voice: pv, engine: 'page' } : null;
        });
      });
      choicePromise = p.then(function (c) {
        if (!c) choicePromise = null;           // nouvel essai plus tard (voix installée, liste chargée)
        return c;
      });
      return choicePromise;
    }
    function noVoiceMessage() { return t('voiceNoTts', [DDT.languageName(targetLang())]); }

    /* Volume de la vidéo. Avec mozCaptureStream, c'est le gain du son renvoyé aux haut-parleurs qui
       compte (video.volume n'agit plus) : il est recopié tout de suite, sans attendre « volumechange ». */
    function setVolume(v, x) {
      try { v.volume = x; } catch (e) { /* rien */ }
      if (volumeHook) volumeHook();
    }
    /* Son d'origine : baissé en douceur pendant que la voix parle, remonté entre les phrases */
    function ramp(to, done) {
      if (rampTimer) { win.clearInterval(rampTimer); rampTimer = null; }
      var v = video;
      if (!v) { if (done) done(); return; }
      to = Math.max(0, Math.min(1, to));
      var from = v.volume;
      var steps = Math.max(1, Math.round(rampMs / 40));
      if (!rampMs || Math.abs(from - to) < 0.005) {
        setVolume(v, to);
        if (done) done();
        return;
      }
      var k = 0;
      rampTimer = win.setInterval(function () {
        k++;
        setVolume(v, Math.max(0, Math.min(1, from + (to - from) * Math.min(1, k / steps))));
        if (k >= steps) { win.clearInterval(rampTimer); rampTimer = null; if (done) done(); }
      }, 40);
    }
    function duck() {
      if (!video) return;
      if (unduckTimer) { win.clearTimeout(unduckTimer); unduckTimer = null; }
      if (ducked) return;
      if (baseVolume === null) baseVolume = video.volume;   // volume choisi par l'utilisateur, relu à chaque reprise
      ducked = true;
      ramp(baseVolume * DUCK);
    }
    function scheduleUnduck() {
      if (unduckTimer) win.clearTimeout(unduckTimer);
      unduckTimer = win.setTimeout(function () {
        unduckTimer = null;
        if (queued || !ducked) return;
        ducked = false;
        var base = baseVolume;
        if (base === null) return;
        ramp(base, function () { if (!ducked) baseVolume = null; });
      }, unduckMs);
    }
    /* Volume d'origine rendu tout de suite (arrêt, changement de vidéo) */
    function restoreVolume() {
      if (unduckTimer) { win.clearTimeout(unduckTimer); unduckTimer = null; }
      if (rampTimer) { win.clearInterval(rampTimer); rampTimer = null; }
      if (baseVolume !== null && video) setVolume(video, baseVolume);
      baseVolume = null;
      ducked = false;
    }
    function cancelSpeech() {
      var had = queued;
      speakGen++;
      queued = 0;
      speakEnd = 0;
      lastSaid = '';
      live = [];
      var s = synth();
      if (s) { try { s.cancel(); } catch (e) { /* rien */ } }
      if (had && extUsed && deps.tts) {
        try { Promise.resolve(deps.tts.stop()).catch(function () { /* rien */ }); } catch (e) { /* rien */ }
      }
      if (ducked) scheduleUnduck();
    }
    /* Chrome, repli sur la synthèse de la page : la page n'a reçu aucun clic. Message clair, et la
       phrase affichée est redite au premier clic dans la page. */
    function needClick() {
      setMessage(t('voiceDubClick'));
      if (clickArmed) return;
      clickArmed = true;
      var onClick = function () {
        doc.removeEventListener('pointerdown', onClick, true);
        doc.removeEventListener('keydown', onClick, true);
        clickArmed = false;
        if (!active || !speaking || !lastShown) return;
        if (message === t('voiceDubClick')) setMessage('');
        lastSaid = '';
        win.setTimeout(function () { say(lastShown, null); }, 0);
      };
      doc.addEventListener('pointerdown', onClick, true);
      doc.addEventListener('keydown', onClick, true);
      cleanups.push(function () {
        doc.removeEventListener('pointerdown', onClick, true);
        doc.removeEventListener('keydown', onClick, true);
        clickArmed = false;
      });
    }
    /* Synthèse de la page : une phrase, réponse à sa fin (comme le message « speak » du background) */
    function pageSpeak(text, voice, lang, rate) {
      var s = synth();
      return new Promise(function (resolve) {
        var u = new win.SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = lang;
        u.rate = rate;
        var done = function (ev) {
          live = live.filter(function (x) { return x !== u; });
          resolve(ev && ev.error ? { ok: false, type: 'error', error: ev.error } : { ok: true, type: 'end' });
        };
        u.onend = done;
        u.onerror = done;
        live.push(u);                 // gardée en mémoire : Chrome perd sinon ses événements
        try { s.speak(u); } catch (e) { done({ error: 'error' }); }
      });
    }
    /* Vitesse d'une phrase : calage sur la durée du sous-titre (0,9 à 1,7), multiplié par la vitesse
       choisie par l'utilisateur, puis borné entre 0,5 et 3. */
    function finalRate(text, availSec, lagSec, lang) {
      var r = dubRate(text, availSec, lagSec, lang) * userRate;
      return Math.round(Math.min(FINAL_RATE_MAX, Math.max(FINAL_RATE_MIN, r)) * 100) / 100;
    }
    /* Une phrase traduite à dire. timing.end : fin du sous-titre (temps de la vidéo), pour caler la vitesse. */
    function say(text, timing) {
      if (!text) return;
      ensureVoice().then(function (choice) {
        if (!speaking || !active || !choice) return;
        if (video && video.paused) return;            // reprise à la lecture (resumeHook)
        if (text === lastSaid && queued) return;       // déjà en cours (sous-titre redit après un saut)
        var availSec = null;
        if (timing && timing.end != null && video) {
          availSec = (timing.end - (video.currentTime || 0)) / (video.playbackRate || 1);
          if (availSec < 0.25) return;                 // sous-titre presque fini : trop tard
        }
        var now = Date.now();
        var lagMs = queued ? Math.max(0, speakEnd - now) : 0;
        // retard trop grand : la phrase en cours est coupée ; sinon la suivante est accélérée
        if (lagMs > MAX_LAG_MS) { cancelSpeech(); lagMs = 0; }
        var lang = choice.voice.lang || targetLang();
        var rate = finalRate(text, availSec, lagMs / 1000, lang);
        var spoken = text.length > TTS_MAX_CHARS ? text.slice(0, TTS_MAX_CHARS) : text;
        var gen = speakGen;
        var finished = false;
        var guard = null;
        var end = function (res) {
          if (finished) return;
          finished = true;
          if (guard) win.clearTimeout(guard);
          if (gen !== speakGen) return;
          queued = Math.max(0, queued - 1);
          var err = res && res.ok === false ? res.error || res.type : '';
          // Chrome refuse de parler tant que la page n'a reçu aucun clic : on le dit
          if (err === 'not-allowed') needClick();
          // l'extension ne sait pas parler : repli sur la page. Message perdu (service worker relancé) :
          // la voix de l'extension est redemandée à la phrase suivante, sans repli définitif sur la page
          // (que Chrome bloquerait sans clic).
          if (choice.kind === 'ext' && err === 'no_tts') { extBroken = true; choicePromise = null; }
          else if (choice.kind === 'ext' && err === 'disconnected') choicePromise = null;
          if (!queued) { speakEnd = 0; scheduleUnduck(); }
        };
        queued++;
        speakEnd = Math.max(now, speakEnd) + speechSeconds(text, lang) / rate * 1000;
        lastSaid = text;
        lastRate = rate;
        duck();
        // garde-fou : une fin de phrase perdue ne laisse jamais le son d'origine baissé
        guard = win.setTimeout(function () { end({ ok: false, type: 'timeout' }); },
          speechSeconds(text, lang) / rate * 2000 + 6000);
        var p;
        if (choice.kind === 'ext') {
          extUsed = true;
          p = Promise.resolve().then(function () {
            return deps.tts.speak({ text: spoken, lang: lang, rate: rate, voiceName: choice.voice.name });
          });
        } else {
          p = pageSpeak(spoken, choice.voice, lang, rate);
        }
        p.then(function (res) { end(res || { ok: false, error: 'disconnected' }); },
          function () { end({ ok: false, error: 'disconnected' }); });
      });
    }
    function renderSpeak() {
      if (!box) return;
      var b = box.querySelector('.speak');
      b.setAttribute('aria-pressed', speaking ? 'true' : 'false');
      var label = t(speaking ? 'voiceSpeakOff' : 'voiceSpeak') + (speaking && ttsVoice ? ' (' + ttsVoice.name + ')' : '');
      b.title = label;
      b.setAttribute('aria-label', label);
      box.querySelector('.tr').setAttribute('aria-live', speaking ? 'off' : 'polite');
      var hide = linesHidden();
      box.querySelector('.orig').hidden = hide;
      box.querySelector('.tr').hidden = hide;
      box.classList.toggle('voiceonly', hide);
      box.querySelector('.rates').hidden = !speaking || frameMode;
      renderRate();
      if (fsSync) fsSync();
    }
    function renderRate() {
      if (!box) return;
      var label = DDT.formatVoiceRate(userRate);
      var v = box.querySelector('.rate');
      v.textContent = label;
      v.title = t('voiceRateValue', [label]);
      box.querySelector('.slower').disabled = userRate <= DDT.VOICE_RATE_MIN;
      box.querySelector('.faster').disabled = userRate >= DDT.VOICE_RATE_MAX;
    }
    /* Vitesse choisie (0,5 à 2, pas de 0,1) : prise en compte dès la phrase suivante.
       save : enregistrée dans les réglages (boutons de la bande) ; sinon venue des réglages. */
    function setRate(x, save) {
      var r = DDT.clampVoiceRate(Math.round(Number(x) * 10) / 10);
      var changed = r !== userRate;
      userRate = r;
      settings.voiceRate = r;
      renderRate();
      if (changed && save && deps.saveRate) {
        try { Promise.resolve(deps.saveRate(r)).catch(function () { /* rien */ }); } catch (e) { /* rien */ }
      }
      return status();
    }
    /* Doublage marche/arrêt. Sans voix pour la langue cible : message clair, sous-titres seuls. */
    function setSpeaking(on) {
      var want = !!on && (!!deps.tts || pageSynthOk());
      if (!want) {
        speaking = false;
        renderSpeak();
        cancelSpeech();
        restoreVolume();
        if (on) setMessage(noVoiceMessage());
        return Promise.resolve(false);
      }
      speaking = true;
      renderSpeak();
      return ensureVoice().then(function (choice) {
        if (!speaking) return false;
        if (!choice) {
          speaking = false;
          renderSpeak();
          if (active) setMessage(noVoiceMessage());
          return false;
        }
        ttsVoice = choice.voice;
        ttsKind = choice.engine;
        renderSpeak();
        if (lastShown && active) say(lastShown, null);
        return true;
      });
    }
    /* Mode choisi dans le popup : 'subs' (sous-titres), 'dub' (sous-titres + voix), 'voice' (voix seule) */
    function setMode(m) {
      voiceMode = DDT.VOICE_MODES.indexOf(m) !== -1 ? m : 'subs';
      settings.voiceMode = voiceMode;
      if (!active) return Promise.resolve(status());
      var want = voiceMode !== 'subs';
      var p = want === speaking ? Promise.resolve(speaking) : setSpeaking(want);
      renderSpeak();
      return p.then(function () { return status(); });
    }
    /* Pause de la vidéo : la voix se tait ; lecture : elle reprend au sous-titre affiché ;
       saut dans la vidéo : la voix repart au sous-titre du nouvel endroit. */
    function bindMedia(v) {
      if (mediaOff) mediaOff();
      mediaOff = null;
      if (!v || !v.addEventListener) return;
      var onPause = function () { if (speaking) cancelSpeech(); };
      var onPlay = function () { if (speaking && resumeHook) resumeHook(); };
      var onSeeking = function () { if (speaking) cancelSpeech(); };
      var onSeeked = function () { if (speaking && resumeHook && !v.paused) resumeHook(true); };
      v.addEventListener('pause', onPause);
      v.addEventListener('play', onPlay);
      v.addEventListener('seeking', onSeeking);
      v.addEventListener('seeked', onSeeked);
      mediaOff = function () {
        v.removeEventListener('pause', onPause);
        v.removeEventListener('play', onPlay);
        v.removeEventListener('seeking', onSeeking);
        v.removeEventListener('seeked', onSeeked);
      };
    }
    /* Reprise par défaut (YouTube, son transcrit) : la traduction affichée, pas après un saut */
    function defaultResume(seek) {
      if (seek || !lastShown) return;
      var l = lastShown;
      lastSaid = '';
      say(l, null);
    }

    /* ---------------- 1. Pistes de sous-titres HTML5 ---------------- */
    function startTrack(tracks) {
      mode = 'track';
      var target = DDT.resolveTarget(settings.target).slice(0, 2);
      var track = tracks.filter(function (tr) { return tr.mode === 'showing'; })[0] ||
        tracks.filter(function (tr) { return String(tr.language || '').slice(0, 2) !== target; })[0] || tracks[0];
      var before = track.mode;
      tracks.forEach(function (tr) { if (tr !== track && tr.mode === 'showing') tr.mode = 'disabled'; });
      track.mode = 'hidden';          // charge les sous-titres sans les dessiner : la bande les remplace
      setMessage(t('voiceSourceTrack'));
      var prepared = false;
      function prepare() {
        if (prepared || !track.cues || !track.cues.length) return;
        prepared = true;
        var texts = [];
        for (var i = 0; i < track.cues.length; i++) texts.push(cueText(track.cues[i].text));
        // d'abord les sous-titres autour de la position actuelle, puis le reste
        var now = video ? video.currentTime : 0;
        var order = texts.map(function (s, i2) { return { s: s, d: Math.abs((track.cues[i2].startTime || 0) - now) }; })
          .sort(function (a, b) { return a.d - b.d; }).map(function (x) { return x.s; });
        translateMany(order).then(syncFullscreen);
      }

      /* Plein écran natif de la vidéo : la bande ne peut pas s'afficher dans une <video>. Les traductions
         passent alors par une piste texte ajoutée à la vidéo et dessinée par le navigateur, « showing »
         seulement pendant ce plein écran, avec les temps des sous-titres d'origine. */
      var fsTrack = null;
      var fsAdded = {};              // index des sous-titres d'origine déjà copiés
      var fsLang = DDT.resolveTarget(settings.target);
      function nativeFullscreen() {
        var fs = doc.fullscreenElement || doc.webkitFullscreenElement;
        return (!!fs && fs === video) || !!video.webkitDisplayingFullscreen;
      }
      function emptyTrack(tt) {
        try { if (tt.mode === 'disabled') tt.mode = 'hidden'; } catch (e) { /* rien */ }   // piste désactivée : cues === null
        var list = Array.prototype.slice.call(tt.cues || []);
        list.forEach(function (c) { try { tt.removeCue(c); } catch (e) { /* rien */ } });
      }
      function ownTrack() {
        if (fsTrack) return fsTrack;
        // une piste laissée par un démarrage précédent est reprise (addTextTrack ne se retire pas)
        var tl = video.textTracks || [];
        for (var i = 0; i < tl.length; i++) {
          if (tl[i].label === OWN_LABEL) { fsTrack = tl[i]; emptyTrack(fsTrack); return fsTrack; }
        }
        if (typeof video.addTextTrack !== 'function' || !win.VTTCue) return null;
        try { fsTrack = video.addTextTrack('subtitles', OWN_LABEL, fsLang); } catch (e) { fsTrack = null; }
        return fsTrack;
      }
      function syncFullscreen() {
        if (!active) return;
        if (!nativeFullscreen() || linesHidden()) {   // voix seule : aucun texte, même en plein écran
          if (fsTrack && fsTrack.mode !== 'disabled') fsTrack.mode = 'disabled';
          return;
        }
        var own = ownTrack();
        if (!own) return;
        var cues = track.cues || [];
        for (var i = 0; i < cues.length; i++) {
          if (fsAdded[i]) continue;
          var s = cueText(cues[i].text);
          var tr = memo[s];
          if (!tr) continue;
          var text = settings.mode === 'bilingual' ? s + '\n' + tr : tr;
          try { own.addCue(new win.VTTCue(cues[i].startTime, cues[i].endTime, text)); fsAdded[i] = true; } catch (e) { /* rien */ }
        }
        if (own.mode !== 'showing') own.mode = 'showing';
      }
      function dropFullscreenTrack() {
        if (!fsTrack) return;
        emptyTrack(fsTrack);
        try { fsTrack.mode = 'disabled'; } catch (e) { /* rien */ }
        fsTrack = null;
        fsAdded = {};
      }
      fsSync = syncFullscreen;
      doc.addEventListener('fullscreenchange', syncFullscreen);
      doc.addEventListener('webkitfullscreenchange', syncFullscreen);
      video.addEventListener('webkitbeginfullscreen', syncFullscreen);   // Safari iOS
      video.addEventListener('webkitendfullscreen', syncFullscreen);
      var fsVideo = video;

      function onCue() {
        prepare();
        syncFullscreen();
        var list = track.activeCues || [];
        var parts = [];
        var end = null;          // fin du sous-titre : le doublage cale sa vitesse dessus
        for (var i = 0; i < list.length; i++) {
          parts.push(cueText(list[i].text));
          if (typeof list[i].endTime === 'number' && isFinite(list[i].endTime)) end = Math.max(end == null ? 0 : end, list[i].endTime);
        }
        var timing = end == null ? null : { end: end };
        var s = parts.join('\n').trim();
        if (!s) { clearLines(); return; }
        if (s in memo) { show(s, memo[s], timing); return; }
        show(s, '');
        translateOne(s).then(function (tr) {
          var cur = [];
          var l2 = track.activeCues || [];
          for (var j = 0; j < l2.length; j++) cur.push(cueText(l2[j].text));
          if (active && cur.join('\n').trim() === s) show(s, tr || '', timing);
          syncFullscreen();
        });
      }
      track.addEventListener('cuechange', onCue);
      // pause puis lecture, ou saut : le sous-titre actif est redit depuis le début
      resumeHook = function () { lastShown = ''; onCue(); };
      var poll = win.setInterval(prepare, 500);
      win.setTimeout(function () { win.clearInterval(poll); }, 15000);
      prepare();
      onCue();
      srcCleanups.push(function () {
        resumeHook = defaultResume;
        if (fsSync === syncFullscreen) fsSync = null;
        track.removeEventListener('cuechange', onCue);
        win.clearInterval(poll);
        doc.removeEventListener('fullscreenchange', syncFullscreen);
        doc.removeEventListener('webkitfullscreenchange', syncFullscreen);
        fsVideo.removeEventListener('webkitbeginfullscreen', syncFullscreen);
        fsVideo.removeEventListener('webkitendfullscreen', syncFullscreen);
        dropFullscreenTrack();
        try { track.mode = before; } catch (e) { /* rien */ }
      });
    }

    /* ---------------- 2. Sous-titres YouTube ---------------- */
    function ytText() {
      var segs = doc.querySelectorAll('.ytp-caption-window-container .ytp-caption-segment');
      var parts = [];
      for (var i = 0; i < segs.length; i++) parts.push(segs[i].textContent);
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    function startYouTube() {
      mode = 'youtube';
      var btn = doc.querySelector('.ytp-subtitles-button');
      var turnedOn = false;
      if (btn && btn.getAttribute('aria-pressed') === 'false') { btn.click(); turnedOn = true; }
      var style = doc.createElement('style');
      style.setAttribute('data-tr-ui', 'voice-style');
      style.textContent = '.ytp-caption-window-container{opacity:0!important}';
      (doc.head || doc.documentElement).appendChild(style);
      setMessage(t('voiceSourceTrack'));
      var seen = false;
      var last = '';
      var changedAt = 0;
      var firstChangeAt = 0;
      var sent = '';
      var tick = win.setInterval(function () {
        var s = ytText();
        var now = Date.now();
        if (s !== last) {
          if (!last || !firstChangeAt) firstChangeAt = now;
          last = s;
          changedAt = now;
        }
        if (!s) { if (sent) { clearLines(); sent = ''; } firstChangeAt = 0; return; }
        seen = true;
        if (s === sent) return;
        if (now - changedAt >= YT_STABLE_MS || now - firstChangeAt >= YT_MAX_WAIT_MS) {
          sent = s;
          firstChangeAt = now;
          translateOne(s).then(function (tr) { if (active && sent === s && tr) show(s, tr); });
        }
      }, 200);
      var fallback = null;
      // vidéo en pause : on invite à la lancer et on revient voir chaque seconde, sinon le son
      // n'était jamais capté après « lecture » (vidéo sans sous-titres)
      function arm(ms) {
        fallback = win.setTimeout(function () {
          if (seen || !active || mode !== 'youtube') return;
          if (video && video.paused) { setMessage(t('voicePlay')); arm(1000); return; }
          stopSource();
          startAudio();
        }, ms);
      }
      arm(ytWaitMs);
      function stopYouTube() {
        win.clearInterval(tick);
        win.clearTimeout(fallback);
        if (style.parentNode) style.parentNode.removeChild(style);
        if (turnedOn && btn && btn.getAttribute('aria-pressed') === 'true') btn.click();
        turnedOn = false;
      }
      srcCleanups.push(stopYouTube);
    }

    /* ---------------- 3. Son de la vidéo -> Groq Whisper ---------------- */
    function pickMime(MR) {
      var list = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
      for (var i = 0; i < list.length; i++) { try { if (MR.isTypeSupported(list[i])) return list[i]; } catch (e) { /* rien */ } }
      return '';
    }
    /* Le son enregistré (un Blob de la page) est lu par FileReader, qui rend directement une chaîne.
       Lire ses octets (arrayBuffer + Uint8Array) échoue dans Firefox : « Permission denied to access
       property constructor », l'objet appartient à la page et non au script d'extension. */
    function blobToBase64(blob) {
      return new Promise(function (resolve, reject) {
        var fr = new win.FileReader();
        fr.onload = function () { resolve(String(fr.result).replace(/^data:[^,]*,/, '')); };
        fr.onerror = function () { reject(fr.error); };
        fr.readAsDataURL(blob);
      });
    }
    /* Son de la vidéo lisible par la page ? Même origine, blob: (MediaSource, YouTube), data:,
       ou vidéo chargée avec CORS (attribut crossorigin). */
    function mediaReadable(v) {
      if (v.crossOrigin != null || (v.hasAttribute && v.hasAttribute('crossorigin'))) return true;
      var src = v.currentSrc || v.src || '';
      if (!src && v.querySelector) { var so = v.querySelector('source[src]'); src = so ? so.src : ''; }
      if (!src) return true;                    // rien de chargé, ou srcObject (flux de la page)
      if (/^(blob|data):/i.test(src)) return true;
      try { return new URL(src, doc.baseURI).origin === win.location.origin; } catch (e) { return false; }
    }
    function captureAudio(v) {
      var stream = null;
      var moz = false;
      try {
        if (typeof v.captureStream === 'function') stream = v.captureStream();
        else if (typeof v.mozCaptureStream === 'function') {
          // Firefox : mozCaptureStream retire le son de l'élément. Vidéo d'une autre origine sans CORS :
          // la capture ne rend que du silence et MediaRecorder échoue, la vidéo resterait muette.
          if (!mediaReadable(v)) return null;
          stream = v.mozCaptureStream();
          moz = true;
        }
      } catch (e) { stream = null; }
      return stream ? { stream: stream, moz: moz } : null;
    }
    /* Arrêter les pistes capturées : avec mozCaptureStream, c'est ce qui rend le son à la vidéo. */
    function releaseCapture(cap) {
      if (!cap || !cap.stream) return;
      try {
        var list = cap.stream.getTracks ? cap.stream.getTracks() : (cap.stream.getAudioTracks ? cap.stream.getAudioTracks() : []);
        Array.prototype.slice.call(list).forEach(function (tr) { try { tr.stop(); } catch (e) { /* rien */ } });
      } catch (e) { /* rien */ }
    }
    function sameTracks(a, b) {
      if (!a || a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i] && !(a[i].id && a[i].id === b[i].id)) return false;
      }
      return true;
    }
    function startAudio() {
      mode = 'audio';
      var MR = deps.MediaRecorder || win.MediaRecorder;
      var AC = deps.AudioContext || win.AudioContext || win.webkitAudioContext;
      // vidéo protégée (DRM, Netflix...) : le son capturé ne serait que du silence
      var cap = video.mediaKeys ? null : captureAudio(video);
      if (!MR || !cap) { releaseCapture(cap); setMessage(t('voiceNoAudio')); return; }
      var mime = pickMime(MR);
      setMessage(t('voiceListening'));
      var ctx = null;
      var analyser = null;
      var source = null;
      var graphTracks = null;      // pistes branchées sur l'analyseur
      var buf = null;
      var stopped = false;
      var recorder = null;
      var chain = Promise.resolve();
      var level = 0;
      var meter = null;
      var gain = null;             // Firefox : son renvoyé, au volume de la vidéo (réglage et doublage)
      var gainVideo = null;
      function syncGain() {
        if (!gain || !gainVideo) return;
        var g = gainVideo.muted ? 0 : Number(gainVideo.volume);
        if (!isFinite(g)) g = 1;
        try { gain.gain.value = Math.max(0, Math.min(1, g)); } catch (e) { /* rien */ }
      }

      function audioTracks() {
        var list = cap.stream.getAudioTracks ? cap.stream.getAudioTracks() : [];
        return Array.prototype.filter.call(list, function (tr) { return tr.readyState !== 'ended'; });
      }
      // Le contexte audio d'une page démarre souvent « suspendu » (pas de clic sur la page) : il ne
      // mesure alors que des zéros. On tente de le relancer ; sinon, pas de détection de silence.
      function wake() {
        if (!ctx || ctx.state === 'running' || !ctx.resume) return;
        try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* rien */ }
      }
      function closeGraph() {
        if (meter) win.clearInterval(meter);
        meter = null;
        if (gainVideo) { try { gainVideo.removeEventListener('volumechange', syncGain); } catch (e) { /* rien */ } }
        if (volumeHook === syncGain) volumeHook = null;
        try { if (gain) gain.disconnect(); } catch (e) { /* rien */ }
        gain = null;
        gainVideo = null;
        try { if (source) source.disconnect(); } catch (e) { /* rien */ }
        try { if (ctx) { var p = ctx.close(); if (p && p.catch) p.catch(function () {}); } } catch (e) { /* rien */ }
        ctx = null;
        analyser = null;
        source = null;
        graphTracks = null;
      }
      function setupGraph(tracks) {
        if (!AC) {
          // Firefox sans Web Audio : le son capturé ne pourrait pas revenir aux haut-parleurs
          if (cap.moz) fail();
          return;
        }
        try {
          if (!ctx) {
            ctx = new AC();
            analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            // Tampon créé côté page : dans Firefox, un tableau du script d'extension passé à une méthode
            // de la page n'est pas rempli (frontière Xray) et tout semblait silencieux.
            buf = new (win.Float32Array || Float32Array)(analyser.fftSize);
            meter = win.setInterval(function () {
              if (!ctx || !analyser) return;
              if (ctx.state !== 'running') { level = 1; return; }
              analyser.getFloatTimeDomainData(buf);
              var sum = 0;
              for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
              level = Math.max(level, Math.sqrt(sum / buf.length));
            }, 100);
          }
          if (source && sameTracks(graphTracks, tracks)) return;
          // Pistes changées (vidéo suivante, publicité) : captureStream a terminé les anciennes et en a
          // créé d'autres. La source est reconstruite, sinon l'analyseur écoute des pistes mortes (tout
          // semble silencieux) et, avec mozCaptureStream, le son des nouvelles pistes n'est plus entendu.
          if (source) { try { source.disconnect(); } catch (e) { /* rien */ } source = null; }
          source = ctx.createMediaStreamSource(new win.MediaStream(tracks));
          source.connect(analyser);
          // Firefox : mozCaptureStream retire le son de la vidéo ; on le renvoie vers les haut-parleurs,
          // par un gain qui suit video.volume / video.muted : sinon ni le réglage de l'utilisateur ni la
          // baisse du doublage n'auraient d'effet (le son capturé ignore le volume de l'élément).
          if (cap.moz && !ctx.createGain) source.connect(ctx.destination);
          else if (cap.moz) {
            if (!gain) {
              gain = ctx.createGain();
              gain.connect(ctx.destination);
              gainVideo = video;
              gainVideo.addEventListener('volumechange', syncGain);
              volumeHook = syncGain;
              syncGain();
            }
            source.connect(gain);
          }
          graphTracks = tracks.slice();
        } catch (e) {
          closeGraph();
          if (cap.moz) fail();                  // sans graphe, la vidéo resterait muette
        }
      }
      function recordOne() {
        if (stopped || !active) return;
        if (video.isConnected === false) { checkVideo(); return; }   // vidéo retirée : on suit la nouvelle
        var tracks = audioTracks();
        if (!tracks.length) {                      // pas encore de son (vidéo en pause ou pas chargée)
          if (video.paused) setMessage(t('voicePlay'));
          win.setTimeout(recordOne, 800);
          return;
        }
        setupGraph(tracks);
        if (stopped) return;
        wake();
        // contexte suspendu : l'analyseur ne lit que des zéros, le silence n'est pas détectable
        level = (analyser && ctx.state === 'running') ? 0 : 1;
        var chunks = [];
        var startedPlaying = !video.paused;
        var rec;
        try {
          rec = new MR(new win.MediaStream(tracks), mime ? { mimeType: mime } : undefined);
        } catch (e) { fail(); return; }
        recorder = rec;
        rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
        rec.onerror = function () { fail(); };
        rec.onstop = function () {
          var silent = level < SILENCE_RMS;
          var wasPlaying = startedPlaying || !video.paused;
          var blob = chunks.length ? new win.Blob(chunks, { type: (mime || 'audio/webm').split(';')[0] }) : null;
          if (!stopped) recordOne();               // le morceau suivant démarre tout de suite
          if (!blob || silent || !wasPlaying) return;
          // traitement dans l'ordre d'arrivée : les sous-titres ne se doublent jamais
          chain = chain.then(function () { return handleChunk(blob, mime); }).catch(function () { /* rien */ });
        };
        try { rec.start(); } catch (e) { fail(); return; }
        // « rec » et non « recorder » : si cet enregistreur s'arrête tout seul (pistes terminées), ce
        // minuteur ne doit pas couper le morceau suivant
        win.setTimeout(function () { try { if (rec.state !== 'inactive') rec.stop(); } catch (e) { /* rien */ } }, chunkMs);
      }
      function release() {
        if (stopped) return;
        stopped = true;
        try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch (e) { /* rien */ }
        releaseCapture(cap);                       // d'abord : le son revient à la vidéo (Firefox)
        closeGraph();
      }
      function fail() {
        if (stopped) return;
        release();
        if (active) setMessage(t('voiceNoAudio'));
      }
      recordOne();
      srcCleanups.push(release);
    }
    function handleChunk(blob, mime) {
      if (!active) return Promise.resolve();
      return blobToBase64(blob).then(function (b64) {
        return transcribe(b64, mime);
      }).then(function (r) {
        if (!active) return;
        if (!r || !r.ok) {
          if (r && r.error === 'no_groq') setMessage(t('voiceNeedGroq'));
          else if (r && r.error === 'rate_limited') setMessage(t('voiceRate'));
          else if (r && r.error === 'empty') return;
          else setMessage((r && r.message) || t('badgeError', [(r && r.error) || '?']));
          return;
        }
        stats.transcribed++;
        setMessage(t('voiceSourceAudio'));
        if (!r.text) return;
        show(r.text, '');
        return translateOne(r.text).then(function (tr) { if (active && tr) show(r.text, tr); });
      });
    }

    /* ---------------- Choix de la source, suivi de la vidéo ---------------- */
    function startSource() {
      var tracks = textTracks(video);
      if (tracks.length) startTrack(tracks);
      else if (isYouTube()) startYouTube();
      else startAudio();
    }
    function stopSource() {
      var list = srcCleanups;
      srcCleanups = [];
      list.reverse().forEach(function (fn) { try { fn(); } catch (e) { /* rien */ } });
      mode = null;
    }
    function useVideo(next) {
      if (next === video) return;
      // doublage : phrase en cours coupée et volume rendu à l'ancienne vidéo
      cancelSpeech();
      restoreVolume();
      video = next;
      bindMedia(video);
    }
    /* Vidéo retirée ou remplacée (application d'une seule page, YouTube) : la référence est périmée.
       On suit la nouvelle vidéo avec la source adaptée, sinon on arrête proprement. */
    function checkVideo() {
      if (!active || !video || video.isConnected !== false) return;
      stopSource();
      var next = pickVideo();
      if (!next) { stop(); return; }
      useVideo(next);
      lastShown = '';
      clearLines();
      startSource();
    }
    /* YouTube : vidéo suivante (navigation interne « yt-navigate-finish » ou autre « v= » dans l'adresse).
       Mémoire des sous-titres et détection (sous-titres présents ou non) remises à zéro. */
    function ytVideoId() {
      var loc = win.location;
      var m = /[?&]v=([^&#]+)/.exec(loc.search || '') || /^\/(?:shorts|live|embed)\/([^/?#]+)/.exec(loc.pathname || '');
      return m ? m[1] : '';
    }
    function checkYouTubeVideo() {
      if (!active || ytCurrent === null) return;
      var id = ytVideoId();
      if (id === ytCurrent) return;
      ytCurrent = id;
      memo = {};
      pending = {};
      lastShown = '';
      clearLines();
      stopSource();
      var next = pickVideo();
      if (next) useVideo(next);
      if (!video || video.isConnected === false) { stop(); return; }
      startSource();
    }
    function watch() {
      var check = function () { checkVideo(); checkYouTubeVideo(); };
      var timer = win.setInterval(check, watchMs);
      doc.addEventListener('yt-navigate-finish', check);
      cleanups.push(function () {
        win.clearInterval(timer);
        doc.removeEventListener('yt-navigate-finish', check);
      });
    }

    /* ---------------- Commandes ---------------- */
    function start(opts) {
      opts = opts || {};
      if (opts.settings) {
        settings = Object.assign({}, DDT.DEFAULT_SETTINGS, opts.settings);
        voiceMode = DDT.voiceModeOf(opts.settings);
        userRate = DDT.clampVoiceRate(opts.settings.voiceRate);
      }
      settings.voiceMode = voiceMode;
      settings.voiceRate = userRate;
      keyId = opts.keyId || null;
      if (active) return status();
      choicePromise = null;         // langue cible peut-être changée : voix choisie à nouveau
      var found = scan();
      video = pickVideo();
      if (!video) {
        // lecteur intégré d'un autre site : la traduction marchera dans son propre onglet
        var frame = pickPlayerFrame(found.frames);
        var url = frame ? playerUrl(frame.src || frame.getAttribute('src') || frame.getAttribute('data-src')) : '';
        if (url) {
          frameAnchor = frame;
          var hostName = '';
          try { hostName = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* rien */ }
          message = t('voiceInFrame', [hostName]);
          frameMode = true;
          ensureBox();
          var m = box.querySelector('.msg');
          m.textContent = message;
          m.title = message;
          m.classList.add('long');
          var open = box.querySelector('.open');
          open.hidden = false;
          open.setAttribute('data-url', url);
          box.querySelector('.speak').hidden = true;
          box.querySelector('.rates').hidden = true;
          box.classList.add('on');
          position();
          return status({ ok: false, error: 'iframe_player', url: url });
        }
        message = t('voiceNoVideo');
        return status({ ok: false, error: 'no_video' });
      }
      if (host) stop();             // message d'un lecteur intégré encore affiché
      frameMode = false;
      active = true;
      memo = {};
      pending = {};
      lastShown = '';
      resumeHook = defaultResume;
      ytCurrent = isYouTube() ? ytVideoId() : null;
      ensureBox();
      bindMedia(video);
      watch();
      startSource();
      if (voiceMode !== 'subs') setSpeaking(true);
      return status();
    }
    function stop() {
      if (!active && !host) return status();
      active = false;
      setSpeaking(false);
      if (mediaOff) mediaOff();
      mediaOff = null;
      resumeHook = null;
      frameAnchor = null;
      frameMode = false;
      stopSource();
      var list = cleanups;
      cleanups = [];
      list.reverse().forEach(function (fn) { try { fn(); } catch (e) { /* rien */ } });
      mode = null;
      message = '';
      ytCurrent = null;
      return status();
    }
    function toggle(opts) { return active ? stop() : start(opts); }
    function status(extra) {
      return Object.assign({ ok: true, active: active, mode: mode, message: message, speaking: speaking,
        dubVoice: speaking && ttsVoice ? ttsVoice.name : null, ttsEngine: speaking ? ttsKind : null,
        voiceMode: voiceMode, voiceRate: userRate, lastRate: lastRate,
        media: video ? video.tagName.toLowerCase() : null,
        translated: stats.translated, transcribed: stats.transcribed }, extra || {});
    }

    return {
      start: start, stop: stop, toggle: toggle, status: status, setSpeaking: setSpeaking,
      setMode: setMode, setRate: function (x) { return setRate(x, false); },
      // ancien message « dub » (1.2) : marche = doublage, arrêt = sous-titres
      setDub: function (on) { return setMode(on ? 'dub' : 'subs'); },
      _memo: function () { return memo; }, _video: function () { return video; }
    };
  }

  root.DDT_createVoice = createVoice;
  root.DDT_cueText = cueText;
  root.DDT_pickTtsVoice = pickTtsVoice;
  root.DDT_dubRate = dubRate;
  root.DDT_VOICE_LIMITS = { min: FINAL_RATE_MIN, max: FINAL_RATE_MAX, chars: TTS_MAX_CHARS };

  /* ---------------- Mise en route dans l'extension ---------------- */
  var api = DDT && DDT.api;
  if (!api || !api.runtime || !api.runtime.id || root.__DDT_TEST) return;

  var port = null;
  var seq = 0;
  var waiting = {};
  function ensurePort() {
    if (port) return port;
    port = api.runtime.connect({ name: 'ddt' });
    port.onMessage.addListener(function (m) { var cb = waiting[m.id]; if (cb) { delete waiting[m.id]; cb(m); } });
    port.onDisconnect.addListener(function () {
      port = null;
      var w = waiting;
      waiting = {};
      Object.keys(w).forEach(function (id) { w[id]({ error: 'disconnected' }); });
    });
    return port;
  }
  var transport = {
    translate: function (texts, opts) {
      return new Promise(function (resolve) {
        var id = ++seq;
        waiting[id] = resolve;
        try { ensurePort().postMessage({ type: 'translate', id: id, texts: texts, opts: opts }); } catch (e) {
          delete waiting[id];
          port = null;
          resolve({ error: 'disconnected' });
        }
      });
    }
  };
  function transcribe(b64, mime) {
    return api.runtime.sendMessage({ type: 'transcribe', audio: b64, mime: mime }).catch(function (e) {
      return { ok: false, error: 'error', message: String(e && e.message || e) };
    });
  }

  /* Voix traduite : produite par le background (chrome.tts, ou speechSynthesis de la page de fond
     sous Firefox), qui n'a pas besoin d'un clic dans la page. La réponse à « speak » arrive en fin de phrase. */
  var tts = {
    voices: function () { return api.runtime.sendMessage({ type: 'ttsVoices' }); },
    speak: function (o) {
      return api.runtime.sendMessage({ type: 'speak', text: o.text, lang: o.lang, rate: o.rate, voiceName: o.voiceName });
    },
    stop: function () { return api.runtime.sendMessage({ type: 'stopSpeaking' }); }
  };
  /* Vitesse changée avec − / + sur la vidéo : enregistrée (relue avant d'écrire : autre réglage modifié ailleurs) */
  function saveRate(rate) {
    return api.storage.local.get('settings').then(function (r) {
      var s = Object.assign({}, (r && r.settings) || {}, { voiceRate: rate });
      return api.storage.local.set({ settings: s });
    });
  }

  var voice = createVoice(document, window, { transport: transport, transcribe: transcribe, tts: tts, saveRate: saveRate });
  root.__DDT_VOICE = voice;

  // vitesse changée dans les réglages (ou dans un autre onglet) : appliquée tout de suite
  if (api.storage.onChanged) {
    api.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local' || !changes.settings || !changes.settings.newValue) return;
      var nv = changes.settings.newValue;
      if (nv.voiceRate != null && DDT.clampVoiceRate(nv.voiceRate) !== voice.status().voiceRate) voice.setRate(nv.voiceRate);
    });
  }

  api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.to !== 'voice') return;
    if (msg.cmd === 'status') { sendResponse(voice.status()); return; }
    if (msg.cmd === 'stop') { sendResponse(voice.stop()); return; }
    if (msg.cmd === 'dub') {
      // choix du popup appliqué tout de suite à la voix déjà lancée
      var m = DDT.VOICE_MODES.indexOf(msg.mode) !== -1 ? msg.mode : (msg.on ? 'dub' : 'subs');
      voice.setMode(m).then(sendResponse, function (e) { sendResponse({ ok: false, error: String(e) }); });
      return true;
    }
    api.storage.local.get('settings').then(function (r) {
      var raw = (r && r.settings) || {};
      var s = Object.assign({}, DDT.DEFAULT_SETTINGS, raw, { voiceMode: DDT.voiceModeOf(raw) });
      var opts = { settings: s, keyId: msg.keyId };
      sendResponse(msg.cmd === 'toggle' ? voice.toggle(opts) : voice.start(opts));
    }).catch(function (e) { sendResponse({ ok: false, error: String(e) }); });
    return true;
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
